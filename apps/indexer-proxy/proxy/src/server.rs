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
use axum::extract::ws::WebSocket;
use axum::{
    extract::{ConnectInfo, Path, WebSocketUpgrade},
    http::{
        header::{self, HeaderMap, HeaderValue},
        Method, Response, StatusCode,
    },
    response::{IntoResponse, Redirect, Response as AxumResponse},
    routing::{get, post},
    Json, Router,
};
use axum_auth::AuthBearer;
use axum_streams::StreamBodyAs;
use base64::{engine::general_purpose, Engine as _};
use ethers::prelude::U256;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use subql_indexer_utils::{
    eip712::{recover_consumer_token_payload, recover_indexer_token_payload},
    error::Error,
    payg::{MultipleQueryState, QueryState},
    request::{graphql_request, GraphQLQuery},
    tools::{hex_u256, string_u256, u256_hex},
};
use tower_http::cors::{Any, CorsLayer};

use crate::ai::api_stream;
use crate::auth::{create_jwt, AuthQuery, AuthQueryLimit, Payload};
use crate::cli::COMMAND;
use crate::contracts::check_agreement_and_consumer;
use crate::metrics::{get_owner_metrics, MetricsNetwork, MetricsQuery};
use crate::payg::{
    extend_channel, fetch_channel_cache, merket_price, open_state, pay_channel,
    query_multiple_state, query_single_state, AuthPayg,
};
use crate::project::get_project;
use crate::sentry_log::make_sentry_message;
use crate::websocket::{connect_to_project_ws, handle_websocket, validate_project, QueryType};
use crate::{
    account::{get_indexer, indexer_healthy},
    auth::AuthWhitelistQuery,
};

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
        .route("/query/:deployment", post(default_query))
        .route("/query/:deployment/:ep_name", post(query_handler))
        .route("/query/:deployment/:ep_name", get(ws_query))
        // `GET /query-limit` get the query limit times with agreement
        .route("/query-limit", get(query_limit_handler))
        // `POST /wl-query/:Qm...955X` goes to query with whitelist account
        .route("/wl-query/:deployment", post(default_wl_query))
        .route("/wl-query/:deployment/:ep_name", post(wl_query))
        .route("/wl-query/:deployment/:ep_name", get(ws_wl_query))
        // `GET /payg-price` get the payg price
        .route("/payg-price", get(payg_price))
        // `POST /payg-open` goes to open a state channel for payg
        .route("/payg-open", post(payg_generate))
        // `POST /payg/Qm...955X` goes to query with Pay-As-You-Go with state channel
        .route("/payg/:deployment", post(default_payg))
        .route("/payg/:deployment/:ep_name", post(payg_query))
        .route("/payg/:deployment/:ep_name", get(ws_payg_query))
        // `POST /payg-extend/0x00...955X` goes to extend channel expiration
        .route("/payg-extend/:channel", post(payg_extend))
        // `GET /payg-state/0x00...955X` goes to get channel state
        .route("/payg-state/:channel", get(payg_state))
        .route("/payg-state-raw/:channel", get(payg_state_raw))
        // `POST /payg-pay` goes to pay to channel some spent
        .route("/payg-pay", post(payg_pay))
        // `Get /metadata/Qm...955X?block=100` goes to query the metadata
        .route("/metadata/:deployment", get(metadata_handler))
        .route("/metrics", get(metrics_handler))
        // `Get /healthy` goes to query the service in running success (response the indexer)
        .route("/healthy", get(healthy_handler))
        .route("/empty_test", get(empty_test))
        .route("/", get(|| async { Redirect::to("/healthy") }))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_headers(Any)
                .allow_methods([Method::GET, Method::POST])
                .expose_headers(Any),
        );

    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), port);
    info!("HTTP server bind: {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}

#[derive(Deserialize)]
struct WhiteListBody {
    body: String,
    path: String,
    method: String,
}

async fn ep_wl_query(
    deployment_id: String,
    deployment: String,
    ep_name: String,
    body: String,
) -> Result<Response<String>, Error> {
    if deployment != deployment_id {
        return Err(Error::AuthVerify(1004));
    };

    let (new_body, path) = match serde_json::from_str::<WhiteListBody>(&body) {
        Ok(body) => (body.body, Some((body.path, body.method))),
        Err(_) => (body, None),
    };

    let project = get_project(&deployment).await?;
    let endpoint = project.endpoint(&ep_name, false)?;
    let (data, signature, _limit) = project
        .check_query(
            new_body,
            endpoint.endpoint.clone(),
            MetricsQuery::Whitelist,
            MetricsNetwork::HTTP,
            false,
            false,
            path,
        )
        .await?;

    let body = serde_json::to_string(&json!({
        "result": general_purpose::STANDARD.encode(data),
        "signature": signature
    }))
    .unwrap_or("".to_owned());

    let header = vec![("Content-Type", "application/json")];

    Ok(build_response(body, header))
}

async fn default_wl_query(
    AuthWhitelistQuery(deployment_id): AuthWhitelistQuery,
    Path(deployment): Path<String>,
    body: String,
) -> Result<Response<String>, Error> {
    ep_wl_query(deployment_id, deployment, "default".to_owned(), body).await
}

async fn wl_query(
    AuthWhitelistQuery(deployment_id): AuthWhitelistQuery,
    Path((deployment, ep_name)): Path<(String, String)>,
    body: String,
) -> Result<Response<String>, Error> {
    ep_wl_query(deployment_id, deployment, ep_name, body).await
}

async fn ws_wl_query(
    headers: HeaderMap,
    ws: WebSocketUpgrade,
    Path((deployment, ep_name)): Path<(String, String)>,
    AuthWhitelistQuery(deployment_id): AuthWhitelistQuery,
) -> impl IntoResponse {
    if deployment != deployment_id {
        return Error::AuthVerify(1004).into_response();
    };

    ws_handler(headers, ws, deployment, ep_name, QueryType::Whitelist)
        .await
        .into_response()
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

async fn default_query(
    headers: HeaderMap,
    AuthQuery(deployment_id): AuthQuery,
    Path(deployment): Path<String>,
    body: String,
) -> Result<Response<String>, Error> {
    ep_query_handler(
        headers,
        deployment_id,
        deployment,
        "default".to_owned(),
        body,
    )
    .await
}

async fn query_handler(
    headers: HeaderMap,
    AuthQuery(deployment_id): AuthQuery,
    Path((deployment, ep_name)): Path<(String, String)>,
    body: String,
) -> Result<Response<String>, Error> {
    ep_query_handler(headers, deployment_id, deployment, ep_name, body).await
}

async fn ep_query_handler(
    mut headers: HeaderMap,
    deployment_id: String,
    deployment: String,
    ep_name: String,
    body: String,
) -> Result<Response<String>, Error> {
    if COMMAND.auth() && deployment != deployment_id {
        return Err(Error::AuthVerify(1004));
    };

    let res_fmt = headers
        .remove("X-Indexer-Response-Format")
        .unwrap_or(HeaderValue::from_static("inline"));
    let res_sig = headers
        .remove("X-SQ-No-Resp-Sig")
        .unwrap_or(HeaderValue::from_static("false"));
    let no_sig = res_sig.to_str().map(|s| s == "true").unwrap_or(false);

    let project = get_project(&deployment).await?;
    let endpoint = project.endpoint(&ep_name, true)?;
    if endpoint.is_ws {
        return Err(Error::WebSocket(1315));
    }
    let (data, signature, limit) = project
        .check_query(
            body.clone(),
            endpoint.endpoint.clone(),
            MetricsQuery::CloseAgreement,
            MetricsNetwork::HTTP,
            false,
            no_sig,
            None,
        )
        .await?;

    let (body, mut headers) = match res_fmt.to_str() {
        Ok("inline") => {
            let return_body = if let Ok(return_data) = String::from_utf8(data.clone()) {
                return_data
            } else {
                let unique_title = format!(
                    "ep_query_handler, inline returns empty, deployment_id: {}, ep_name: {}",
                    deployment_id, ep_name
                );
                let msg = format!(
                    "res_fmt: {:#?}, headers: {:#?}, body: {}, data: {:?}",
                    res_fmt, headers, body, data
                );
                make_sentry_message(&unique_title, &msg);
                "".to_owned()
            };
            (
                return_body,
                vec![
                    ("X-Indexer-Sig", signature.as_str()),
                    ("X-Indexer-Response-Format", "inline"),
                ],
            )
        }
        Ok("wrapped") => (
            serde_json::to_string(&json!({
                "result": general_purpose::STANDARD.encode(&data),
                "signature": signature
            }))
            .unwrap_or("".to_owned()),
            vec![("X-Indexer-Response-Format", "wrapped")],
        ),
        _ => {
            let unique_title = format!(
                "ep_query_handler, not inline or wrapped, deployment_id: {}, ep_name: {}",
                deployment_id, ep_name
            );
            let msg = format!(
                "res_fmt: {:#?}, headers: {:#?}, body: {}",
                res_fmt, headers, body
            );
            make_sentry_message(&unique_title, &msg);
            ("".to_owned(), vec![])
        }
    };
    headers.push(("Content-Type", "application/json"));
    headers.push(("Access-Control-Max-Age", "600"));

    if let Some((t, u)) = limit {
        headers.push(("X-RateLimit-Limit-Second", t.to_string().leak()));
        headers.push(("X-RateLimit-Remaining-Second", (t - u).to_string().leak()));
    }

    Ok(build_response(body, headers))
}

async fn ws_query(
    headers: HeaderMap,
    ws: WebSocketUpgrade,
    Path((deployment, ep_name)): Path<(String, String)>,
    AuthQuery(deployment_id): AuthQuery,
) -> impl IntoResponse {
    if COMMAND.auth() && deployment != deployment_id {
        return Error::AuthVerify(1004).into_response();
    };

    ws_handler(headers, ws, deployment, ep_name, QueryType::CloseAgreement)
        .await
        .into_response()
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

async fn default_payg(
    headers: HeaderMap,
    AuthPayg(auth): AuthPayg,
    Path(deployment): Path<String>,
    body: String,
) -> AxumResponse {
    ep_payg_handler(headers, auth, deployment, "default".to_owned(), body).await
}

async fn payg_query(
    headers: HeaderMap,
    AuthPayg(auth): AuthPayg,
    Path((deployment, ep_name)): Path<(String, String)>,
    body: String,
) -> AxumResponse {
    ep_payg_handler(headers, auth, deployment, ep_name, body).await
}

async fn ep_payg_handler(
    mut headers: HeaderMap,
    auth: String,
    deployment: String,
    ep_name: String,
    body: String,
) -> AxumResponse {
    let res_fmt = headers
        .remove("X-Indexer-Response-Format")
        .unwrap_or(HeaderValue::from_static("inline"));
    let res_sig = headers
        .remove("X-SQ-No-Resp-Sig")
        .unwrap_or(HeaderValue::from_static("false"));
    let no_sig = res_sig.to_str().map(|s| s == "true").unwrap_or(false);

    // single or multiple
    let block = headers
        .remove("X-Channel-Block")
        .unwrap_or(HeaderValue::from_static("single"));

    let project = match get_project(&deployment).await {
        Ok(p) => p,
        Err(e) => return e.into_response(),
    };
    let endpoint = match project.endpoint(&ep_name, true) {
        Ok(p) => p,
        Err(e) => return e.into_response(),
    };

    if endpoint.is_ws {
        return Error::WebSocket(1315).into_response();
    }

    if project.is_ai_project() {
        let state = match MultipleQueryState::from_bs64(auth) {
            Ok(p) => p,
            Err(e) => return e.into_response(),
        };
        let v = match serde_json::from_str::<Value>(&body).map_err(|_| Error::Serialize(1142)) {
            Ok(p) => p,
            Err(e) => return e.into_response(),
        };
        return payg_stream(endpoint.endpoint.clone(), v, state, false).await;
    }

    let (data, signature, state_data, limit) = match block.to_str() {
        Ok("multiple") => {
            let state = match MultipleQueryState::from_bs64(auth) {
                Ok(p) => p,
                Err(e) => return e.into_response(),
            };
            match query_multiple_state(
                &deployment,
                body.clone(),
                endpoint.endpoint.clone(),
                state,
                MetricsNetwork::HTTP,
                no_sig,
            )
            .await
            {
                Ok(p) => p,
                Err(e) => return e.into_response(),
            }
        }
        _ => {
            let state = match QueryState::from_bs64_old1(auth) {
                Ok(p) => p,
                Err(e) => return e.into_response(),
            };
            match query_single_state(
                &deployment,
                body.clone(),
                endpoint.endpoint.clone(),
                state,
                MetricsNetwork::HTTP,
                no_sig,
            )
            .await
            {
                Ok(p) => p,
                Err(e) => {
                    warn!("single query_single_state conflict error e : {:?}", e);
                    return e.into_response();
                }
            }
        }
    };

    let (body, mut headers) = match res_fmt.to_str() {
        Ok("inline") => {
            let return_body = if let Ok(return_data) = String::from_utf8(data.clone()) {
                if return_data.is_empty() {
                    let unique_title = format!(
                        "payg ep_query_handler, inline returns empty, because endpoint returns empty, deployment_id: {}, ep_name: {}",
                        deployment, ep_name
                    );
                    let msg = format!(
                        "res_fmt: {:#?}, headers: {:#?}, body: {}, data: {:?}",
                        res_fmt, headers, body, data
                    );
                    make_sentry_message(&unique_title, &msg);
                }
                return_data
            } else {
                let unique_title = format!(
                    "payg ep_query_handler, inline returns empty, deployment_id: {}, ep_name: {}",
                    deployment, ep_name
                );
                let msg = format!(
                    "res_fmt: {:#?}, headers: {:#?}, body: {}, data: {:?}",
                    res_fmt, headers, body, data
                );
                make_sentry_message(&unique_title, &msg);
                "".to_owned()
            };
            (
                return_body,
                vec![
                    ("X-Indexer-Sig", signature.as_str()),
                    ("X-Channel-State", state_data.as_str()),
                    ("X-Indexer-Response-Format", "inline"),
                ],
            )
        }
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
    headers.push(("Access-Control-Max-Age", "600"));

    if let Some((t, u)) = limit {
        headers.push(("X-RateLimit-Limit-Second", t.to_string().leak()));
        headers.push(("X-RateLimit-Remaining-Second", (t - u).to_string().leak()));
    }

    build_response(body, headers).into_response()
}

async fn ws_payg_query(
    headers: HeaderMap,
    ws: WebSocketUpgrade,
    Path((deployment, ep_name)): Path<(String, String)>,
) -> impl IntoResponse {
    ws_handler(
        headers,
        ws,
        deployment,
        ep_name,
        QueryType::PAYG(U256::zero(), U256::zero()),
    )
    .await
    .into_response()
}

async fn payg_pay(body: String) -> Result<String, Error> {
    let state = QueryState::from_bs64(body)?;
    let new_state = pay_channel(state).await?;
    Ok(new_state)
}

#[derive(Deserialize)]
struct ExtendParams {
    price: String,
    expired: i64,
    expiration: i32,
    signature2: String,
}

async fn payg_extend(
    Path(channel): Path<String>,
    Json(payload): Json<ExtendParams>,
) -> Result<Json<Value>, Error> {
    let extend = extend_channel(
        channel,
        string_u256(&payload.price),
        payload.expired,
        payload.expiration,
        payload.signature2,
    )
    .await?;
    Ok(Json(json!({
        "price": payload.price,
        "signature": extend
    })))
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
        "expired_at": state.expiration,
        "conflict_start": state.conflict_start,
        "conflict_times": state.conflict_times
    })))
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RawChannelItem {
    pub id: String,
    pub consumer: String,
    #[serde(rename(deserialize = "deploymentId"))]
    pub deployment: String,
    pub agent: String,
    pub total: String,
    pub spent: String,
    pub remote: String,
    pub price: String,
    #[serde(rename(deserialize = "lastFinal"))]
    pub is_final: bool,
    #[serde(rename(deserialize = "expiredAt"))]
    pub expired: i64,
    #[serde(rename(deserialize = "lastIndexerSign"))]
    pub indexer_sign: String,
    #[serde(rename(deserialize = "lastConsumerSign"))]
    pub consumer_sign: String,
}

async fn payg_state_raw(Path(channel): Path<String>) -> Result<Json<Value>, Error> {
    let mdata = format!(
        r#"query {{
  channel(
    id: "{}"
  ) {{
    id
    consumer
    deploymentId
    agent
    total
    spent
    remote
    price
    lastFinal
    expiredAt
    lastIndexerSign
    lastConsumerSign }}}}"#,
        channel
    );
    let url = COMMAND.graphql_url();
    let query = GraphQLQuery::query(&mdata);
    if let Ok(data) = graphql_request(&url, &query).await {
        if let Some(item) = data.pointer("/data/channel") {
            let channel: RawChannelItem = serde_json::from_str(item.to_string().as_str())
                .map_err(|_e| Error::Serialize(1120))?;
            if let Some(value) = serde_json::to_value(&channel)
                .map_err(|_e| Error::ServiceException(1021))?
                .as_object_mut()
            {
                process_sign(value, "indexer_sign");
                process_sign(value, "consumer_sign");

                return Ok(Json(json!(value)));
            }
        }
    }
    Err(Error::ServiceException(1021))
}

fn process_sign(value: &mut serde_json::Map<String, serde_json::Value>, key: &str) {
    if let Some(sign_value) = value.get_key_value(key) {
        let sign = sign_value.1.to_string().trim_matches('"').to_string();
        if !sign.is_empty() {
            value.insert(key.to_owned(), "******".into());
        }
    }
}

async fn metadata_handler(Path(deployment): Path<String>) -> Result<Response<String>, Error> {
    let body = get_project(&deployment)
        .await?
        .metadata(MetricsNetwork::HTTP)
        .await
        .map(Json)?;
    Ok(build_response(
        body.to_string(),
        vec![("Cache-control", "no-cache")],
    ))
}

async fn healthy_handler() -> Result<Json<Value>, Error> {
    let info = indexer_healthy().await;
    Ok(Json(info))
}

async fn empty_test() -> Result<Json<Value>, Error> {
    Ok(Json(json!({
        "status": "success",
        "message": "Message received"
    })))
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

async fn ws_handler(
    mut headers: HeaderMap,
    ws: WebSocketUpgrade,
    deployment: String,
    ep_name: String,
    query_type: QueryType,
) -> impl IntoResponse {
    let endpoint = match validate_project(&deployment, &ep_name).await {
        Ok(ep) => ep,
        Err(e) => return e.into_response(),
    };

    let res_sig = headers
        .remove("X-SQ-No-Resp-Sig")
        .unwrap_or(HeaderValue::from_static("false"));
    let no_sig = res_sig.to_str().map(|s| s == "true").unwrap_or(false);
    let project = match get_project(&deployment).await {
        Ok(project) => project,
        Err(e) => return e.into_response(),
    };

    let remote_socket = if project.is_subgraph_project() {
        let request = match tokio_tungstenite::tungstenite::http::Request::builder()
            .method("GET")
            .uri(endpoint)
            .header(header::SEC_WEBSOCKET_PROTOCOL, "graphql-ws")
            .header(header::SEC_WEBSOCKET_KEY, "graphql-ws-key")
            .header(header::SEC_WEBSOCKET_VERSION, "13")
            .header(header::HOST, "localhost")
            .header(header::CONNECTION, "Upgrade")
            .header(header::UPGRADE, "websocket")
            .body(())
        {
            Ok(request) => request,
            Err(_) => return Error::WebSocket(1300).into_response(),
        };

        match tokio_tungstenite::connect_async(request).await {
            Ok((socket, _)) => socket,
            Err(_e) => {
                // info!("_e: {:?}", _e);
                return Error::WebSocket(1308).into_response();
            }
        }
    } else {
        match connect_to_project_ws(endpoint).await {
            Ok(socket) => socket,
            Err(e) => return e.into_response(),
        }
    };

    // Handle WebSocket connection
    ws.on_upgrade(move |socket: WebSocket| {
        handle_websocket(remote_socket, socket, deployment, query_type, no_sig)
    })
}

async fn payg_stream(
    endpoint: String,
    v: Value,
    state: MultipleQueryState,
    is_test: bool,
) -> AxumResponse {
    let mut res = StreamBodyAs::text(api_stream(endpoint, v, state, is_test)).into_response();
    res.headers_mut()
        .insert("Content-Type", "text/event-stream".parse().unwrap());
    res.headers_mut()
        .insert("X-Response-Format", "stream".parse().unwrap());
    res
}

// cleanup future
// async fn test_ai(Json(v): Json<Value>) -> AxumResponse {
//     let endpoint = "http://127.0.0.1:11434/v1/chat/completions".to_owned();
//     let state = MultipleQueryState::empty();
//     payg_stream(endpoint, v, state, true).await
// }
