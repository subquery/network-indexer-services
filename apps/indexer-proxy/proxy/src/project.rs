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
use crate::cli::redis;
use crate::metadata::{rpc_evm_metadata, rpc_substrate_metadata, subquery_metadata};
use crate::metrics::{add_metrics_query, update_metrics_projects, MetricsNetwork, MetricsQuery};
use crate::p2p::send;

pub static PROJECTS: Lazy<Mutex<HashMap<String, Project>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Clone)]
pub enum ProjectType {
    Subquery,
    RpcEvm,
    RpcSubstrate,
}

#[derive(Clone)]
pub struct Project {
    pub id: String,
    pub ptype: ProjectType,
    pub endpoints: Vec<(String, String)>,
    pub rate_limit: Option<i64>,
    pub payg_price: U256,
    pub payg_token: Address,
    pub payg_expiration: u64,
    pub payg_overflow: U256,
}

impl Project {
    pub fn endpoint<'a>(&'a self) -> &'a str {
        &self.endpoints[0].1
    }

    pub fn open_payg(&self) -> bool {
        self.payg_price > U256::zero() && self.payg_expiration > 0
    }

    pub async fn metadata(&self, block: Option<u64>, network: MetricsNetwork) -> Result<Value> {
        let mut metadata = match self.ptype {
            ProjectType::Subquery => subquery_metadata(&self, block, network).await?,
            ProjectType::RpcEvm => rpc_evm_metadata(&self, block, network).await?,
            ProjectType::RpcSubstrate => rpc_substrate_metadata(&self, block, network).await?,
        };

        let timestamp: u64 = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let lock = ACCOUNT.read().await;
        let controller = lock.controller.clone();
        let controller_address = lock.controller_address();
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
            "controller": format!("{:?}", controller_address),
            "deploymentId": self.id,
            "timestamp": timestamp,
            "signature": sign.to_string(),
        });

        merge_json(&mut metadata, &common);
        Ok(metadata)
    }

    pub async fn query(
        &self,
        body: String,
        ep_name: Option<String>,
        payment: MetricsQuery,
        network: MetricsNetwork,
        is_limit: bool,
    ) -> Result<(Vec<u8>, String)> {
        if let Some(limit) = self.rate_limit {
            // project rate limit
            let mut conn = redis();
            let second = Utc::now().timestamp();
            let used_key = format!("{}-rate-{}", self.id, second);

            let used: i64 = redis::cmd("GET")
                .arg(&used_key)
                .query_async(&mut conn)
                .await
                .unwrap_or(0);

            if is_limit && used + 1 > limit {
                return Err(Error::RateLimit(1057));
            }

            let _: core::result::Result<(), ()> = redis::cmd("SETEX")
                .arg(&used_key)
                .arg(1)
                .arg(used + 1)
                .query_async(&mut conn)
                .await
                .map_err(|err| error!("Redis 1 {}", err));
        }

        match self.ptype {
            ProjectType::Subquery => {
                let query = serde_json::from_str(&body).map_err(|_| Error::InvalidRequest(1140))?;
                self.subquery_raw(&query, payment, network).await
            }
            ProjectType::RpcEvm => {
                // TODO filter the methods
                self.rpcquery_raw(body, ep_name, payment, network).await
            }
            ProjectType::RpcSubstrate => {
                // TODO filter the methods
                self.rpcquery_raw(body, ep_name, payment, network).await
            }
        }
    }

    pub async fn _subquery(
        &self,
        query: &GraphQLQuery,
        payment: MetricsQuery,
        network: MetricsNetwork,
    ) -> Result<Value> {
        let now = Instant::now();
        let res = graphql_request(self.endpoint(), query).await;

        let time = now.elapsed().as_millis() as u64;
        add_metrics_query(self.id.clone(), time, payment, network, res.is_ok());

        res
    }

    pub async fn _rpcquery(
        &self,
        query: String,
        payment: MetricsQuery,
        network: MetricsNetwork,
    ) -> Result<Value> {
        let now = Instant::now();
        let res = proxy_request("POST", self.endpoint(), "/", "", query, vec![])
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
        let res = graphql_request_raw(self.endpoint(), query).await;
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
        ep_name: Option<String>,
        payment: MetricsQuery,
        network: MetricsNetwork,
    ) -> Result<(Vec<u8>, String)> {
        let now = Instant::now();
        let mut endpoint = self.endpoint();
        if let Some(ename) = ep_name {
            for (k, v) in &self.endpoints {
                if k == &ename {
                    endpoint = v;
                }
            }
        }

        let res = post_request_raw(endpoint, query).await;
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
        let did = n.id.clone();
        lock.insert(did.clone(), n);
        // project join
        tokio::spawn(async move {
            send("project-join", vec![json!(did)], 0).await;
        });
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
pub struct ProjectEndpointItem {
    key: String,
    value: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProjectItem {
    pub id: String,
    #[serde(rename = "projectType")]
    pub project_type: i64,
    #[serde(rename = "serviceEndpoints")]
    pub project_endpoints: Vec<ProjectEndpointItem>,
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
        let id = item.id.clone();
        let rate_limit = if let Some(n) = item.project_rate_limit {
            if n > 0 {
                Some(n)
            } else {
                None
            }
        } else {
            None
        };

        let payg_price = U256::from_dec_str(&item.payg_price).unwrap_or(U256::from(0));
        let payg_token: Address = item.payg_token.parse().unwrap_or(Address::zero());
        let payg_overflow = item.payg_overflow.into();
        let payg_expiration = item.payg_expiration;

        let mut ptype = match item.project_type {
            0 => ProjectType::Subquery,
            1 => ProjectType::RpcEvm,
            _ => {
                error!("Invalid project type");
                return Ok(());
            }
        };

        let mut endpoints: Vec<(String, String)> = vec![];
        for endpoint in item.project_endpoints {
            match endpoint.key.as_str() {
                "evmHttp" => {
                    ptype = ProjectType::RpcEvm;
                    // push query to endpoint index 0
                    endpoints.insert(0, (endpoint.key, endpoint.value));
                    continue;
                }
                "substrateHttp" => {
                    ptype = ProjectType::RpcSubstrate;
                    // push query to endpoint index 0
                    endpoints.insert(0, (endpoint.key, endpoint.value));
                    continue;
                }
                "queryEndpoint" => {
                    // push query to endpoint index 0
                    endpoints.insert(0, (endpoint.key, endpoint.value));
                    continue;
                }
                _ => (),
            }

            endpoints.push((endpoint.key, endpoint.value));
        }
        if endpoints.is_empty() {
            error!("Project {} with no endpoints", id);
            return Ok(());
        }

        project_ids.push(id.clone());
        let project = Project {
            id,
            ptype,
            endpoints,
            rate_limit,
            payg_price,
            payg_token,
            payg_expiration,
            payg_overflow,
        };

        new_projects.push(project);
    }

    update_projects(new_projects).await;
    update_metrics_projects(project_ids).await;

    Ok(())
}
