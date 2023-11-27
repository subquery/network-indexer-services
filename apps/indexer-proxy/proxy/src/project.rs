// This file is part of SubQuery.

// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
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

use chrono::Utc;
use digest::Digest;
use ethers::{
    abi::{encode, Address, Tokenizable},
    signers::Signer,
    types::U256,
    utils::keccak256,
};
use once_cell::sync::Lazy;
use redis::{AsyncCommands, RedisResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::{Instant, SystemTime};
use subql_indexer_utils::{
    error::Error,
    payg::{convert_sign_to_string, default_sign},
    request::{graphql_request, graphql_request_raw, GraphQLQuery},
    types::Result,
};
use tdn::types::group::hash_to_group_id;
use tokio::sync::Mutex;

use crate::account::ACCOUNT;
use crate::cli::redis;
use crate::graphql::{poi_with_block, METADATA_QUERY};
use crate::metrics::{add_metrics_query, update_metrics_projects, MetricsNetwork, MetricsQuery};
use crate::p2p::send;
use crate::payg::merket_price;
use crate::primitives::PROJECT_JOIN_TIME;

pub static PROJECTS: Lazy<Mutex<HashMap<String, Project>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Clone)]
pub struct Project {
    pub id: String,
    pub query_endpoint: String,
    pub node_endpoint: String,
    pub rate_limit: Option<i64>,
    pub payg_price: U256,
    pub payg_token: Address,
    pub payg_expiration: u64,
    pub payg_overflow: U256,
}

impl Project {
    pub fn open_payg(&self) -> bool {
        self.payg_price > U256::zero() && self.payg_expiration > 0
    }
}

async fn update_projects(deployments: Vec<Project>) {
    let mut old_deployments = vec![];
    let mut new_deployments = vec![];
    let mut lock = PROJECTS.lock().await;
    for deployment in lock.keys() {
        old_deployments.push(deployment.clone());
    }
    for deployment in deployments.iter() {
        new_deployments.push(deployment.id.clone());
    }

    for o in old_deployments.iter() {
        if new_deployments.contains(o) {
            continue;
        } else {
            let gid = hash_to_group_id(o.as_bytes());
            lock.remove(o);
            // project leave
            tokio::spawn(async move {
                send("project-leave", vec![], gid).await;
            });
        }
    }
    for n in deployments {
        if old_deployments.contains(&n.id) {
            let did = n.id.clone();
            lock.insert(did.clone(), n);
            // project update
            tokio::spawn(async move {
                // waiting a moment for update all projects
                tokio::time::sleep(std::time::Duration::from_secs(PROJECT_JOIN_TIME)).await;
                let gid = hash_to_group_id(did.as_bytes());
                if let Ok(price) = merket_price(Some(did)).await {
                    let data = serde_json::to_string(&price).unwrap();
                    send("project-broadcast-payg", vec![json!(data)], gid).await
                }
            });
        } else {
            let did = n.id.clone();
            lock.insert(did.clone(), n);
            // project join
            tokio::spawn(async move {
                send("project-join", vec![json!(did)], 0).await;
            });
        }
    }
    drop(lock);
}

pub async fn get_project(key: &str) -> Result<Project> {
    let map = PROJECTS.lock().await;
    if let Some(p) = map.get(key) {
        Ok(p.clone())
    } else {
        Err(Error::InvalidProjectId(1032))
    }
}

/// list the projects status, project name & price/1000 query
pub async fn get_projects_status() -> Vec<(String, f64)> {
    let mut projects = vec![];
    let decimal = U256::from_dec_str("1000000000000000000").unwrap(); // 18-decimal
    let map = PROJECTS.lock().await;
    for (k, v) in map.iter() {
        let price = (v.payg_price * U256::from(10000000) / decimal).as_u64() as f64 / 10000f64;
        projects.push((k.clone(), price));
    }
    projects
}

/// list the project id and price
pub async fn list_projects() -> Vec<Project> {
    let mut projects = vec![];
    let map = PROJECTS.lock().await;
    for (_k, p) in map.iter() {
        projects.push(p.clone());
    }
    projects
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProjectItem {
    pub id: String,
    #[serde(rename = "queryEndpoint")]
    pub query_endpoint: String,
    #[serde(rename = "nodeEndpoint")]
    pub node_endpoint: String,
    #[serde(rename = "rateLimit")]
    pub project_rate_limit: Option<i64>,
    #[serde(rename = "price")]
    pub payg_price: String,
    #[serde(rename = "token")]
    pub payg_token: String,
    #[serde(rename = "expiration")]
    pub payg_expiration: u64,
    #[serde(rename = "overflow")]
    pub payg_overflow: u64,
}

pub async fn handle_projects(projects: Vec<ProjectItem>) -> Result<()> {
    let mut project_ids = vec![];
    let mut new_projects = vec![];
    for item in projects {
        let rate_limit = item.project_rate_limit;

        let payg_price = U256::from_dec_str(&item.payg_price).unwrap_or(U256::from(0));
        let payg_token: Address = item.payg_token.parse().unwrap_or(Address::zero());
        let payg_overflow = item.payg_overflow.into();

        project_ids.push(item.id.clone());
        let project = Project {
            id: item.id,
            query_endpoint: item.query_endpoint,
            node_endpoint: item.node_endpoint,
            rate_limit,
            payg_price,
            payg_token,
            payg_expiration: item.payg_expiration,
            payg_overflow,
        };
        new_projects.push(project);
    }

    update_projects(new_projects).await;
    update_metrics_projects(project_ids).await;

    Ok(())
}

pub async fn project_metadata(id: &str, network: MetricsNetwork) -> Result<Value> {
    project_query(
        id,
        &GraphQLQuery::query(METADATA_QUERY),
        MetricsQuery::Free,
        network,
        true,
    )
    .await
}

pub async fn project_status(id: &str, network: MetricsNetwork) -> Result<Value> {
    let lock = ACCOUNT.read().await;
    let controller = lock.controller.clone();
    let indexer = lock.indexer.clone();
    drop(lock);

    let poi = project_poi(id, None, network).await?;
    let mmr = poi
        .get("mmrRoot")
        .cloned()
        .unwrap_or(json!(""))
        .as_str()
        .unwrap_or("")
        .to_owned();
    let height: i64 = poi
        .get("height")
        .cloned()
        .unwrap_or(json!(0))
        .as_i64()
        .unwrap_or(0);
    let metadata = project_metadata(id, network).await?;
    let target: i64 = if let Some(target) = metadata.pointer("/data/_metadata/targetHeight") {
        target.as_i64().unwrap_or(0)
    } else {
        0
    };

    let timestamp: u64 = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let payload = encode(&[
        timestamp.into_token(),
        id.to_owned().into_token(),
        mmr.clone().into_token(),
        height.into_token(),
        target.into_token(),
        indexer.into_token(),
        controller.address().into_token(),
    ]);
    let hash = keccak256(payload);
    let sign = controller
        .sign_message(hash)
        .await
        .map_err(|_| Error::InvalidSignature(1041))?;

    Ok(json!({
        "timestamp": timestamp,
        "deploymentId": id,
        "poi": mmr,
        "blockHeight": height,
        "targetHeight": target,
        "indexer": format!("{:?}", indexer),
        "controller": format!("{:?}", controller.address()),
        "signature": sign.to_string(),
    }))
}

pub async fn project_poi(id: &str, block: Option<u64>, network: MetricsNetwork) -> Result<Value> {
    let last_block = if let Some(block) = block {
        block
    } else {
        let data = project_metadata(id, network).await?;
        if let Some(target) = data.pointer("/data/_metadata/lastProcessedHeight") {
            target.as_u64().unwrap_or(0)
        } else {
            0
        }
    };

    project_query(
        id,
        &GraphQLQuery::query(&poi_with_block(last_block)),
        MetricsQuery::Free,
        network,
        true,
    )
    .await
}

pub async fn project_query(
    id: &str,
    query: &GraphQLQuery,
    payment: MetricsQuery,
    network: MetricsNetwork,
    is_limit: bool,
) -> Result<Value> {
    let project = get_project(id).await?;

    if let Some(limit) = project.rate_limit {
        // project rate limit
        let conn = redis();
        let mut conn_lock = conn.lock().await;
        let second = Utc::now().timestamp();
        let used_key = format!("{}-rate-{}", project.id, second);

        let used: i64 = conn_lock.get(&used_key).await.unwrap_or(0);
        if is_limit && used + 1 > limit {
            return Err(Error::RateLimit(1057));
        }
        let _: RedisResult<()> = conn_lock.set_ex(&used_key, used + 1, 1).await;
        drop(conn_lock);
    }

    let now = Instant::now();
    let res = graphql_request(&project.query_endpoint, query).await;
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(id.to_owned(), time, payment, network, res.is_ok());

    res
}

pub async fn project_query_raw(
    id: &str,
    query: &GraphQLQuery,
    payment: MetricsQuery,
    network: MetricsNetwork,
    is_limit: bool,
) -> Result<(Vec<u8>, String)> {
    let project = get_project(id).await?;

    if let Some(limit) = project.rate_limit {
        // project rate limit
        let conn = redis();
        let mut conn_lock = conn.lock().await;
        let second = Utc::now().timestamp();
        let used_key = format!("{}-rate-{}", project.id, second);

        let used: i64 = conn_lock.get(&used_key).await.unwrap_or(0);
        if is_limit && used + 1 > limit {
            return Err(Error::RateLimit(1057));
        }
        let _: RedisResult<()> = conn_lock.set_ex(&used_key, used + 1, 1).await;
        drop(conn_lock);
    }

    let now = Instant::now();
    let res = graphql_request_raw(&project.query_endpoint, query).await;
    let time = now.elapsed().as_millis() as u64;

    add_metrics_query(id.to_owned(), time, payment, network, res.is_ok());

    match res {
        Ok(data) => {
            let mut hasher = sha2::Sha256::new();
            hasher.update(&data);
            let bytes = hasher.finalize().to_vec();

            // sign the response
            let lock = ACCOUNT.read().await;
            let controller = lock.controller.clone();
            let indexer = lock.indexer.clone();
            drop(lock);

            let timestamp = Utc::now().timestamp();
            let payload = encode(&[
                indexer.into_token(),
                bytes.into_token(),
                timestamp.into_token(),
            ]);
            let hash = keccak256(payload);
            let sign = controller
                .sign_message(hash)
                .await
                .unwrap_or(default_sign());
            let signature = format!("{} {}", timestamp, convert_sign_to_string(&sign));

            Ok((data, signature))
        }
        Err(err) => Err(err),
    }
}
