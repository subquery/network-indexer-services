// This file is part of SubQuery.

// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later WITH Classpath-exception-2.0

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

#![deny(warnings)]
use axum::{
    extract::{ConnectInfo, Path, Query, WebSocketUpgrade}, http::{
        header::{HeaderMap, HeaderValue},
        Method, Response, StatusCode,
    }, response::IntoResponse, routing::{get, post}, Json, Router
};
use axum_auth::AuthBearer;
use axum::extract::ws::WebSocket;
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use subql_indexer_utils::{
    eip712::{recover_consumer_token_payload, recover_indexer_token_payload},
    error::Error,
    payg::{MultipleQueryState, QueryState},
    tools::{hex_u256, u256_hex},
};
use tower_http::cors::{Any, CorsLayer};

use crate::account::{get_indexer, indexer_healthy};
use crate::auth::{create_jwt, AuthQuery, AuthQueryLimit, Payload};
use crate::cli::COMMAND;
use crate::contracts::check_agreement_and_consumer;
use crate::metrics::{get_owner_metrics, MetricsNetwork, MetricsQuery};
use crate::payg::{
    extend_channel, fetch_channel_cache, merket_price, open_state, pay_channel,
    query_multiple_state, query_single_state, AuthPayg,
};
use crate::project::get_project;
use crate::websocket::handle_websocket;

#[derive(Serialize)]
pub struct QueryUri {
    /// the url refer to specific project
    pub uri: String,
}

#[derive(Serialize)]
pub struct QueryToken {
    /// jwt auth token
    pub token: String,
}

pub async fn start_server(port: u16) {
    let app = Router::new()
        // `POST /token` goes to create token for query
        .route("/token", post(generate_token))
        // `POST /query/Qm...955X` goes to query with agreement
        .route("/query/:deployment", post(query_handler))
        .route("/query/:deployment/ws", get(ws_query_handler))
        // `GET /query-limit` get the query limit times with agreement
        .route("/query-limit", get(query_limit_handler))
        // `GET /payg-price` get the payg price
        .route("/payg-price", get(payg_price))
        // `POST /payg-open` goes to open a state channel for payg
        .route("/payg-open", post(payg_generate))
        // `POST /payg/Qm...955X` goes to query with Pay-As-You-Go with state channel
        .route("/payg/:deployment", post(payg_query))
        // `POST /payg-extend/0x00...955X` goes to extend channel expiration
        .route("/payg-extend/:channel", post(payg_extend))
        // `GET /payg-state/0x00...955X` goes to get channel state
        .route("/payg-state/:channel", get(payg_state))
        // `GET /payg-pay` goes to pay to channel some spent
        .route("/payg-pay", post(payg_pay))
        // `Get /metadata/Qm...955X?block=100` goes to query the metadata
        .route("/metadata/:deployment", get(metadata_handler))
        .route("/metrics", get(metrics_handler))
        // `Get /healthy` goes to query the service in running success (response the indexer)
        .route("/healthy", get(healthy_handler))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_headers(Any)
                .allow_methods([Method::GET, Method::POST])
                .expose_headers(Any),
        );

    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), port);
    info!("HTTP server bind: {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service_with_connect_info::<SocketAddr>())
        .await
        .unwrap();
}

async fn generate_token(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<Payload>,
) -> Result<Json<Value>, Error> {
    get_project(&payload.deployment_id).await?;
    let indexer = get_indexer().await;
    if indexer.to_lowercase() != payload.indexer.to_lowercase() {
        return Err(Error::AuthCreate(1002));
    }

    let signer = match (&payload.consumer, &payload.agreement) {
        (Some(consumer), Some(agreement)) => recover_consumer_token_payload(
            consumer,
            &payload.indexer,
            agreement,
            &payload.deployment_id,
            payload.timestamp,
            payload.chain_id,
            &payload.signature,
        )?,
        _ => recover_indexer_token_payload(
            &payload.indexer,
            &payload.deployment_id,
            payload.timestamp,
            payload.chain_id,
            &payload.signature,
        )?,
    };

    let (checked, daily, rate, free) = if signer == payload.indexer.to_lowercase() {
        // if signer is indexer itself, return the token
        (true, 0, 0, None)
    } else {
        // if singer is consumer, check signer is consumer,
        // and check whether the agreement is expired and the it is consistent with
        // `indexer` and `consumer`
        match &payload.agreement {
            Some(agreement) => {
                let (checked, daily, rate) =
                    check_agreement_and_consumer(&signer, agreement).await?;
                (checked, daily, rate, None)
            }
            _ => {
                // fixed plan just for try and dispute usecase. 1/second
                if let Some(consumer) = &payload.consumer {
                    if signer == consumer.to_lowercase() {
                        (true, COMMAND.free_limit(), 1, Some(addr))
                    } else {
                        (false, 0, 0, None)
                    }
                } else {
                    (false, 0, 0, None)
                }
            }
        }
    };

    if checked {
        let token = create_jwt(payload, daily, rate, free).await?;
        Ok(Json(json!(QueryToken { token })))
    } else {
        Err(Error::AuthCreate(1001))
    }
}

#[derive(Deserialize)]
struct EpName {
    ep_name: Option<String>,
}

async fn query_handler(
    mut headers: HeaderMap,
    AuthQuery(deployment_id): AuthQuery,
    Path(deployment): Path<String>,
    ep_name: Query<EpName>,
    body: String,
) -> Result<Response<String>, Error> {
    if COMMAND.auth() && deployment != deployment_id {
        return Err(Error::AuthVerify(1004));
    };

    let res_fmt = headers
        .remove("X-Indexer-Response-Format")
        .unwrap_or(HeaderValue::from_static("inline"));

    let (data, signature) = get_project(&deployment)
        .await?
        .query(
            body,
            ep_name.0.ep_name,
            MetricsQuery::CloseAgreement,
            MetricsNetwork::HTTP,
            false,
        )
        .await?;

    let (body, mut headers) = match res_fmt.to_str() {
        Ok("inline") => (
            String::from_utf8(data).unwrap_or("".to_owned()),
            vec![
                ("X-Indexer-Sig", signature.as_str()),
                ("X-Indexer-Response-Format", "inline"),
            ],
        ),
        Ok("wrapped") => (
            serde_json::to_string(&json!({
                "result": general_purpose::STANDARD.encode(&data),
                "signature": signature
            }))
            .unwrap_or("".to_owned()),
            vec![("X-Indexer-Response-Format", "wrapped")],
        ),
        _ => ("".to_owned(), vec![]),
    };
    headers.push(("Content-Type", "application/json"));

    Ok(build_response(body, headers))
}

async fn ws_query_handler(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    Path(deployment): Path<String>,
    AuthQuery(deployment_id): AuthQuery,
) -> impl IntoResponse {
    if COMMAND.auth() && deployment != deployment_id {
        return Error::AuthVerify(1004).into_response();
    };

    // Handle WebSocket connection
    ws.on_upgrade(move |socket: WebSocket| handle_websocket(socket, headers, deployment))
}

async fn query_limit_handler(
    AuthQueryLimit(daily_limit, daily_used, rate_limit, rate_used): AuthQueryLimit,
) -> Result<Json<Value>, Error> {
    Ok(Json(json!({
        "daily_limit": daily_limit,
        "daily_used": daily_used,
        "rate_limit": rate_limit,
        "rate_used": rate_used,
    })))
}

async fn payg_price() -> Result<Json<Value>, Error> {
    let projects = merket_price(None).await?;
    Ok(Json(projects))
}

async fn payg_generate(Json(payload): Json<Value>) -> Result<Json<Value>, Error> {
    let state = open_state(&payload).await?;
    Ok(Json(state))
}

async fn payg_query(
    mut headers: HeaderMap,
    AuthPayg(auth): AuthPayg,
    Path(deployment): Path<String>,
    ep_name: Query<EpName>,
    body: String,
) -> Result<Response<String>, Error> {
    let res_fmt = headers
        .remove("X-Indexer-Response-Format")
        .unwrap_or(HeaderValue::from_static("inline"));

    // single or multiple
    let block = headers
        .remove("X-Channel-Block")
        .unwrap_or(HeaderValue::from_static("single"));

    let (data, signature, state_data) = match block.to_str() {
        Ok("multiple") => {
            let state = MultipleQueryState::from_bs64(auth)?;
            query_multiple_state(
                &deployment,
                body,
                ep_name.0.ep_name,
                state,
                MetricsNetwork::HTTP,
            )
            .await?
        }
        _ => {
            let state = QueryState::from_bs64_old1(auth)?;
            query_single_state(
                &deployment,
                body,
                ep_name.0.ep_name,
                state,
                MetricsNetwork::HTTP,
            )
            .await?
        }
    };

    let (body, mut headers) = match res_fmt.to_str() {
        Ok("inline") => (
            String::from_utf8(data).unwrap_or("".to_owned()),
            vec![
                ("X-Indexer-Sig", signature.as_str()),
                ("X-Channel-State", state_data.as_str()),
                ("X-Indexer-Response-Format", "inline"),
            ],
        ),
        // `wrapped` or other res format
        _ => (
            serde_json::to_string(&json!({
                "result": general_purpose::STANDARD.encode(&data),
                "signature": signature,
                "state": state_data
            }))
            .unwrap_or("".to_owned()),
            vec![("X-Indexer-Response-Format", "wrapped")],
        ),
    };
    headers.push(("Content-Type", "application/json"));

    Ok(build_response(body, headers))
}

async fn payg_pay(body: String) -> Result<String, Error> {
    let state = QueryState::from_bs64(body)?;
    let new_state = pay_channel(state).await?;
    Ok(new_state)
}

#[derive(Deserialize)]
struct ExtendParams {
    expired: i64,
    expiration: i32,
    signature: String,
}

async fn payg_extend(
    Path(channel): Path<String>,
    Json(payload): Json<ExtendParams>,
) -> Result<Json<Value>, Error> {
    let extend = extend_channel(
        channel,
        payload.expired,
        payload.expiration,
        payload.signature,
    )
    .await?;
    Ok(Json(json!({
        "signature": extend
    })))
}

#[derive(Deserialize)]
struct PoiBlock {
    block: Option<u64>,
}

async fn payg_state(Path(channel): Path<String>) -> Result<Json<Value>, Error> {
    let channel_id = hex_u256(&channel);
    let (state, _) = fetch_channel_cache(channel_id).await?;

    Ok(Json(json!({
        "channel": u256_hex(&channel_id),
        "price": state.price.to_string(),
        "total": state.total.to_string(),
        "spent": state.spent.to_string(),
        "remote": state.remote.to_string(),
        "conflict": state.conflict,
    })))
}

async fn metadata_handler(
    Path(deployment): Path<String>,
    block: Query<PoiBlock>,
) -> Result<Json<Value>, Error> {
    get_project(&deployment)
        .await?
        .metadata(block.0.block, MetricsNetwork::HTTP)
        .await
        .map(Json)
}

async fn healthy_handler() -> Result<Json<Value>, Error> {
    let info = indexer_healthy().await;
    Ok(Json(info))
}

async fn metrics_handler(AuthBearer(token): AuthBearer) -> Response<String> {
    if token == COMMAND.metrics_token {
        let body = get_owner_metrics().await;

        build_response(
            body,
            vec![(
                "Content-Type",
                "application/openmetrics-text; version=1.0.0; charset=utf-8",
            )],
        )
    } else {
        Response::builder()
            .status(StatusCode::FORBIDDEN)
            .body("".to_owned())
            .unwrap()
    }
}

fn build_response(body: String, headers: Vec<(&str, &str)>) -> Response<String> {
    let mut res = Response::builder();
    for (key, value) in headers {
        res = res.header(key, value);
    }
    res = res.status(StatusCode::OK);

    match res.body(body) {
        Ok(res) => res,
        Err(_) => Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body("".to_owned())
            .unwrap(),
    }
}
