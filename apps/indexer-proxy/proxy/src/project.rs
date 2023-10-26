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
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::{Instant, SystemTime};
use subql_indexer_utils::{
    error::Error,
    payg::{convert_sign_to_string, default_sign},
    request::{
        graphql_request, graphql_request_raw, post_request_raw, proxy_request, GraphQLQuery,
    },
    tools::merge_json,
    types::Result,
};
use tdn::types::group::hash_to_group_id;
use tokio::sync::Mutex;

use crate::account::ACCOUNT;
use crate::metadata::{rpc_evm_metadata, subquery_metadata};
use crate::metrics::{add_metrics_query, update_metrics_projects, MetricsNetwork, MetricsQuery};
use crate::p2p::send;
use crate::payg::merket_price;
use crate::primitives::PROJECT_JOIN_TIME;

pub static PROJECTS: Lazy<Mutex<HashMap<String, Project>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Clone)]
pub enum ProjectType {
    Subquery,
    RpcEvm,
}

#[derive(Clone)]
pub struct Project {
    pub id: String,
    pub ptype: ProjectType,
    pub query_endpoint: String,
    pub node_endpoint: String,
    pub payg_price: U256,
    pub payg_token: Address,
    pub payg_expiration: u64,
    pub payg_overflow: U256,
}

impl Project {
    pub fn open_payg(&self) -> bool {
        self.payg_price > U256::zero() && self.payg_expiration > 0
    }

    pub async fn metadata(&self, block: Option<u64>, network: MetricsNetwork) -> Result<Value> {
        let mut metadata = match self.ptype {
            ProjectType::Subquery => subquery_metadata(&self, block, network).await?,
            ProjectType::RpcEvm => rpc_evm_metadata(&self, block, network).await?,
        };

        let timestamp: u64 = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let lock = ACCOUNT.read().await;
        let controller = lock.controller.clone();
        let indexer = lock.indexer.clone();
        drop(lock);

        let payload = encode(&[
            indexer.clone().into_token(),
            self.id.clone().into_token(),
            metadata["lastHeight"].as_i64().unwrap_or(0).into_token(),
            metadata["targetHeight"].as_i64().unwrap_or(0).into_token(),
            metadata["poiId"].as_i64().unwrap_or(0).into_token(),
            metadata["poiHash"]
                .as_str()
                .unwrap_or("")
                .to_owned()
                .into_token(),
            timestamp.into_token(),
        ]);
        let hash = keccak256(payload);

        let sign = controller
            .sign_message(hash)
            .await
            .map_err(|_| Error::InvalidSignature(1041))?;

        let common = json!({
            "indexer": format!("{:?}", indexer),
            "controller": format!("{:?}", controller.address()),
            "deploymentId": self.id,
            "timestamp": timestamp,
            "signature": sign.to_string(),
        });

        merge_json(&mut metadata, &common);
        Ok(metadata)
    }

    pub async fn query(&self, body: String, network: MetricsNetwork) -> Result<(Vec<u8>, String)> {
        match self.ptype {
            ProjectType::Subquery => {
                let query = serde_json::from_str(&body).map_err(|_| Error::InvalidRequest(1140))?;
                self.subquery_raw(&query, MetricsQuery::CloseAgreement, network)
                    .await
            }
            ProjectType::RpcEvm => {
                self.rpcquery_raw(body, MetricsQuery::CloseAgreement, network)
                    .await
            }
        }
    }

    pub async fn subquery(
        &self,
        query: &GraphQLQuery,
        payment: MetricsQuery,
        network: MetricsNetwork,
    ) -> Result<Value> {
        let now = Instant::now();
        let res = graphql_request(&self.query_endpoint, query).await;

        let time = now.elapsed().as_millis() as u64;
        add_metrics_query(self.id.clone(), time, payment, network, res.is_ok());

        res
    }

    pub async fn rpcquery(
        &self,
        query: String,
        payment: MetricsQuery,
        network: MetricsNetwork,
    ) -> Result<Value> {
        let now = Instant::now();
        let res = proxy_request("POST", &self.query_endpoint, "/", "", query, vec![])
            .await
            .map_err(|err| {
                Error::GraphQLQuery(
                    1012,
                    serde_json::to_string(&err).unwrap_or("RPC query error".to_owned()),
                )
            });

        let time = now.elapsed().as_millis() as u64;
        add_metrics_query(self.id.clone(), time, payment, network, res.is_ok());

        res
    }

    pub async fn subquery_raw(
        &self,
        query: &GraphQLQuery,
        payment: MetricsQuery,
        network: MetricsNetwork,
    ) -> Result<(Vec<u8>, String)> {
        let now = Instant::now();
        let res = graphql_request_raw(&self.query_endpoint, query).await;
        let time = now.elapsed().as_millis() as u64;

        add_metrics_query(self.id.clone(), time, payment, network, res.is_ok());

        match res {
            Ok(data) => {
                let signature = Self::sign_response(&data).await;
                Ok((data, signature))
            }
            Err(err) => Err(err),
        }
    }

    pub async fn rpcquery_raw(
        &self,
        query: String,
        payment: MetricsQuery,
        network: MetricsNetwork,
    ) -> Result<(Vec<u8>, String)> {
        let now = Instant::now();
        let res = post_request_raw(&self.query_endpoint, query).await;
        let time = now.elapsed().as_millis() as u64;

        add_metrics_query(self.id.clone(), time, payment, network, res.is_ok());

        match res {
            Ok(data) => {
                let signature = Self::sign_response(&data).await;
                Ok((data, signature))
            }
            Err(err) => Err(err),
        }
    }

    async fn sign_response(data: &[u8]) -> String {
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
        format!("{} {}", timestamp, convert_sign_to_string(&sign))
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
        let payg_price = U256::from_dec_str(&item.payg_price).unwrap_or(U256::from(0));
        let payg_token: Address = item.payg_token.parse().unwrap_or(Address::zero());
        let payg_overflow = item.payg_overflow.into();
        project_ids.push(item.id.clone());
        let project = Project {
            id: item.id,
            ptype: ProjectType::Subquery, // TODO
            query_endpoint: item.query_endpoint,
            node_endpoint: item.node_endpoint,
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
