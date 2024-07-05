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

use once_cell::sync::Lazy;
use reqwest::{
    header::{CONNECTION, CONTENT_TYPE},
    Client, RequestBuilder,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use serde_with::skip_serializing_none;
use std::time::Duration;

use crate::{
    constants::{APPLICATION_JSON, AUTHORIZATION, KEEP_ALIVE},
    error::Error,
};

pub static REQUEST_CLIENT: Lazy<Client> = Lazy::new(reqwest::Client::new);

const REQUEST_TIMEOUT: u64 = 40;

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug)]
pub struct GraphQLQuery {
    /// The GraphQL query, as a string.
    pub query: String,
    ///  The GraphQL query variables
    pub variables: Option<Value>,
    /// The GraphQL operation name, as a string.
    #[serde(rename = "operationName")]
    pub operation_name: Option<Value>,
}

impl GraphQLQuery {
    pub fn query(query: &str) -> Self {
        GraphQLQuery {
            query: query.to_owned(),
            variables: None,
            operation_name: None,
        }
    }
}

// Request to graphql service.
pub async fn graphql_request(uri: &str, query: &GraphQLQuery) -> Result<Value, Error> {
    let response_result = REQUEST_CLIENT
        .post(uri)
        .timeout(Duration::from_secs(REQUEST_TIMEOUT))
        .header(CONTENT_TYPE, APPLICATION_JSON)
        .header(CONNECTION, KEEP_ALIVE)
        .body(serde_json::to_string(query).unwrap_or("".to_owned()))
        .send()
        .await;

    let res = match response_result {
        Ok(res) => res,
        Err(_e) => {
            return Err(Error::GraphQLInternal(
                1010,
                "Service exception or timeout".to_owned(),
            ))
        }
    };

    let json_result = res.json().await;
    let json_data: Value = match json_result {
        Ok(res) => res,
        Err(e) => return Err(Error::GraphQLQuery(1011, e.to_string())),
    };

    Ok(json_data)
}

// Request to graphql service and response raw bytes.
pub async fn graphql_request_raw(uri: &str, query: &GraphQLQuery) -> Result<Vec<u8>, Error> {
    post_request_raw(uri, serde_json::to_string(query).unwrap_or("".to_owned())).await
}

// Request to graphql service and response raw bytes with path and method.
pub async fn graphql_request_raw_with_path(
    uri: &str,
    query: &GraphQLQuery,
    path: Option<(String, String)>,
) -> Result<Vec<u8>, Error> {
    post_request_raw_with_path(
        uri,
        serde_json::to_string(query).unwrap_or("".to_owned()),
        path,
    )
    .await
}

// request post raw with path and method
pub async fn post_request_raw_with_path(
    uri: &str,
    query: String,
    path: Option<(String, String)>,
) -> Result<Vec<u8>, Error> {
    let (url, is_post) = if let Some((path, method)) = path {
        let url = format!("{}{}", uri, path);
        (url, method.to_lowercase() == "post")
    } else {
        (uri.to_owned(), true)
    };

    if is_post {
        handle_request_raw(REQUEST_CLIENT.post(url), query).await
    } else {
        handle_request_raw(REQUEST_CLIENT.get(url), query).await
    }
}

// request post raw
pub async fn post_request_raw(uri: &str, query: String) -> Result<Vec<u8>, Error> {
    handle_request_raw(REQUEST_CLIENT.post(uri), query).await
}

// handle request
#[inline]
async fn handle_request_raw(request: RequestBuilder, query: String) -> Result<Vec<u8>, Error> {
    let response_result = request
        .timeout(Duration::from_secs(REQUEST_TIMEOUT))
        .header(CONTENT_TYPE, APPLICATION_JSON)
        .header(CONNECTION, KEEP_ALIVE)
        .body(query.to_owned())
        .send()
        .await;

    let res = match response_result {
        Ok(res) => res,
        Err(_e) => {
            return Err(Error::GraphQLInternal(
                1010,
                "Service exception or timeout".to_owned(),
            ))
        }
    };

    let status = res.status();
    let body = res
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|e| Error::GraphQLQuery(1011, e.to_string()))?;

    // 200~299
    if status.is_success() {
        Ok(body)
    } else {
        let err = String::from_utf8(body).unwrap_or("Internal request error".to_owned());
        Err(Error::GraphQLInternal(1011, err))
    }
}

// Request to indexer/consumer proxy
pub async fn proxy_request(
    method: &str,
    url: &str,
    path: &str,
    token: &str,
    query: String,
    headers: Vec<(String, String)>,
) -> Result<Value, Value> {
    let url = format!("{}/{}", url, path);
    let token = format!("Bearer {}", token);

    let res = match method.to_lowercase().as_str() {
        "get" => {
            let mut req = REQUEST_CLIENT
                .get(url)
                .timeout(Duration::from_secs(REQUEST_TIMEOUT));
            let mut no_auth = true;
            for (k, v) in headers {
                if k.to_lowercase() == "authorization" {
                    no_auth = false;
                }
                req = req.header(k, v);
            }
            if no_auth {
                req = req.header(AUTHORIZATION, token);
            }
            req.send().await
        }
        _ => {
            let mut req = REQUEST_CLIENT
                .post(url)
                .timeout(Duration::from_secs(REQUEST_TIMEOUT))
                .header("content-type", "application/json");
            let mut no_auth = true;
            for (k, v) in headers {
                if k.to_lowercase() == "authorization" {
                    no_auth = false;
                }
                req = req.header(k, v);
            }
            if no_auth {
                req = req.header(AUTHORIZATION, token);
            }

            req.body(query).send().await
        }
    };

    match res {
        Ok(res) => {
            let res_status = res.status();
            let value = match res.text().await {
                Ok(data) => match serde_json::from_str(&data) {
                    Ok(data) => data,
                    Err(_err) => json!(data),
                },
                Err(_err) => json!(format!("Status: {}", res_status)),
            };

            if res_status.is_success() {
                Ok(value)
            } else {
                Err(value)
            }
        }
        Err(err) => Err(json!(err.to_string())),
    }
}

// Request to jsonrpc service.(P2P channel RPC)
pub fn jsonrpc_params(id: u64, method: &str, params: Vec<Value>) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": method,
        "params": params
    })
}

pub async fn jsonrpc_request(uri: &str, method: &str, params: Vec<Value>) -> Result<Value, Error> {
    let query = jsonrpc_params(1, method, params);
    let response_result = REQUEST_CLIENT
        .post(uri)
        .timeout(Duration::from_secs(REQUEST_TIMEOUT))
        .header(CONTENT_TYPE, APPLICATION_JSON)
        .header(CONNECTION, KEEP_ALIVE)
        .body(serde_json::to_string(&query).unwrap_or("".to_owned()))
        .send()
        .await;

    let res = match response_result {
        Ok(res) => res,
        Err(_e) => {
            return Err(Error::GraphQLInternal(
                1010,
                "Service exception or timeout".to_owned(),
            ))
        }
    };

    let json_result = res.json().await;
    let mut data: Value = match json_result {
        Ok(res) => res,
        Err(e) => return Err(Error::GraphQLQuery(1011, e.to_string())),
    };

    if data.get("result").is_some() {
        return Ok(data["result"].take());
    } else if data.get("error").is_some() {
        return Err(Error::GraphQLQuery(
            1012,
            data["error"]["message"].to_string(),
        ));
    }

    Err(Error::GraphQLQuery(
        1012,
        "Invalid jsonrpc response".to_owned(),
    ))
}

pub fn jsonrpc_response(res: Result<Value, Error>) -> Result<Value, Value> {
    match res {
        Ok(data) => {
            if data.get("result").is_some() {
                if data["result"].is_array() {
                    let mut res = vec![];
                    for i in data["result"].as_array().unwrap() {
                        let i_str = i.as_str().unwrap();
                        match serde_json::from_str::<Value>(i_str) {
                            Ok(r) => res.push(r),
                            Err(_) => res.push(Value::from(i_str)),
                        }
                    }
                    Ok(json!(res))
                } else {
                    let res = data["result"].as_str().unwrap_or("");
                    if let Ok(json) = serde_json::from_str::<Value>(res) {
                        if json.get("errors").is_some() {
                            Err(json)
                        } else {
                            Ok(json)
                        }
                    } else {
                        Ok(json!(res))
                    }
                }
            } else if data.get("error").is_some() {
                Err(json!(data["error"]["message"]))
            } else {
                Ok(json!("ok"))
            }
        }
        Err(err) => Err(err.to_json()),
    }
}
