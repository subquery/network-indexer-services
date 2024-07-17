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
use std::sync::Arc;
use std::time::{Instant, SystemTime};
use subql_indexer_utils::{
    error::Error,
    payg::{convert_sign_to_string, default_sign},
    request::{
        graphql_request, graphql_request_raw_with_path, post_request_raw_with_path, GraphQLQuery,
    },
    tools::merge_json,
    types::Result,
};
use tdn::types::group::hash_to_group_id;
use tokio::sync::Mutex;

use crate::account::ACCOUNT;
use crate::cli::{redis, COMMAND};
use crate::graphql::project_mainfest;
use crate::metadata::{
    auto_reduce_allocation_enabled, rpc_evm_metadata, rpc_substrate_metadata, subgraph_metadata,
    subquery_metadata,
};
use crate::metrics::{add_metrics_query, update_metrics_projects, MetricsNetwork, MetricsQuery};
use crate::p2p::send;

pub static PROJECTS: Lazy<Mutex<HashMap<String, Project>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Clone)]
pub enum ProjectType {
    Subquery,
    RpcEvm(RpcMainfest),
    RpcSubstrate(RpcMainfest),
    Subgraph,
}

#[derive(Serialize, Clone, Default)]
enum NodeType {
    #[default]
    Full,
    Archive,
}

impl NodeType {
    fn from_str(s: &str) -> NodeType {
        match s {
            "archive" => NodeType::Archive,
            _ => NodeType::Full,
        }
    }
}

//impl Default for NodeType

#[derive(Clone)]
struct ComputeUnit {
    value: u64,
    overflow: u64,
}

#[derive(Clone, Default)]
pub struct RpcMainfest {
    node_type: NodeType,
    feature_flags: Vec<String>,
    rpc_allow_list: Vec<String>,
    rpc_deny_list: Vec<String>,
    compute_unit: HashMap<String, ComputeUnit>,
}

#[derive(Deserialize)]
struct ComputeUnitItem {
    name: String,
    value: u64,
}

#[derive(Deserialize)]
struct RpcMainfestItem {
    #[serde(rename = "nodeType")]
    node_type: String,
    #[serde(rename = "featureFlags")]
    feature_flags: Option<Vec<String>>,
    #[serde(rename = "rpcDenyList")]
    rpc_deny_list: Option<Vec<String>>,
    #[serde(rename = "rpcAllowList")]
    rpc_allow_list: Option<Vec<String>>,
    #[serde(rename = "computeUnit")]
    compute_units: Option<Vec<ComputeUnitItem>>,
}

impl RpcMainfest {
    fn json_values(&self) -> Value {
        json!({
            "nodeType": self.node_type,
            "featureFlags": self.feature_flags,
            "rpcAllowList": self.rpc_allow_list,
            "rpcDenyList": self.rpc_deny_list,
            "computeUnit": self.compute_unit.iter().map(|(m, c)| (m, c.value)).collect::<HashMap<&String, u64>>(),
        })
    }

    async fn fetch(
        url: &str,
        project_type: i64,
        project_id: &str,
        payg_overflow: u64,
    ) -> Result<Self> {
        // fetch mainfest
        let query = GraphQLQuery::query(&project_mainfest(project_type, project_id));
        let value = graphql_request(url, &query).await?;
        let item: RpcMainfestItem = if let Some(v) = value.pointer("/data/getManifest/rpcManifest")
        {
            if v.is_null() {
                return Ok(Default::default());
            }
            serde_json::from_value(v.clone()).map_err(|_| Error::ServiceException(1203))?
        } else {
            return Ok(Default::default());
        };

        let node_type = NodeType::from_str(&item.node_type);

        // compute unit overflow times
        let mut compute_unit = HashMap::new();
        for cu in item.compute_units.unwrap_or(vec![]) {
            let value = cu.value;
            let allowed_times = payg_overflow / value;
            let overflow = if allowed_times < COMMAND.max_unit_overflow {
                if payg_overflow > COMMAND.max_unit_overflow {
                    payg_overflow / COMMAND.max_unit_overflow
                } else {
                    1
                }
            } else {
                payg_overflow
            };
            compute_unit.insert(cu.name, ComputeUnit { value, overflow });
        }

        Ok(Self {
            node_type,
            feature_flags: item.feature_flags.unwrap_or(vec![]),
            rpc_allow_list: item.rpc_allow_list.unwrap_or(vec![]),
            rpc_deny_list: item.rpc_deny_list.unwrap_or(vec![]),
            compute_unit,
        })
    }

    // correct times & reasonable overflow times
    pub fn unit_times(&self, method: &String) -> Result<(u64, u64)> {
        for rd in &self.rpc_deny_list {
            if method.starts_with(rd) {
                return Err(Error::InvalidRequest(1060));
            }
        }

        let mut not_allowed = !self.rpc_allow_list.is_empty();
        for ra in &self.rpc_allow_list {
            if method.starts_with(ra) {
                not_allowed = false;
                break;
            }
        }
        if not_allowed {
            return Err(Error::InvalidRequest(1060));
        }

        if let Some(cu) = self.compute_unit.get(method) {
            Ok((cu.value, cu.overflow))
        } else {
            Ok((1, 1))
        }
    }
}

#[derive(Clone)]
pub struct Endpoint {
    pub endpoint: String,
    pub is_internal: bool,
    pub is_ws: bool,
}

#[derive(Clone)]
pub struct Project {
    pub id: String,
    pub ptype: ProjectType,
    // ep_name, endpoint, is_inernal, is_ws
    pub endpoints: HashMap<String, Endpoint>,
    pub rate_limit: Option<i64>,
    pub db_size: Option<u64>,
    pub payg_price: U256,
    pub payg_token: Address,
    pub payg_expiration: u64,
    pub payg_overflow: u64,
}

#[derive(Deserialize)]
struct SimpleJsonrpc {
    id: i64,
    method: String,
}

impl Project {
    pub fn compute_query_method(&self, query: &str) -> Result<((u64, u64), i64)> {
        // compute unit times
        match &self.ptype {
            // TODO if multiple in single query
            ProjectType::Subquery | ProjectType::Subgraph => Ok(((1, 1), 0)),
            ProjectType::RpcEvm(m) | ProjectType::RpcSubstrate(m) => {
                // parse the jsonrpc method
                if let Ok(s) = serde_json::from_str::<SimpleJsonrpc>(query) {
                    let value = m
                        .unit_times(&s.method)
                        .map_err(|e| Error::Jsonrpc(s.id, Arc::new(e)))?;
                    Ok((value, s.id))
                } else {
                    let ss: Vec<SimpleJsonrpc> =
                        serde_json::from_str(query).map_err(|_| Error::Serialize(1141))?;
                    let id = if ss.is_empty() { 0 } else { ss[0].id };

                    if ss.len() > 100 {
                        return Err(Error::Jsonrpc(id, Arc::new(Error::InvalidRequest(1061))));
                    }

                    let mut vv = 0;
                    let mut oo = 0;
                    for s in ss {
                        let (v, o) = m.unit_times(&s.method)?;
                        vv += v;
                        oo += o;
                    }

                    if vv > 1000 {
                        return Err(Error::Jsonrpc(id, Arc::new(Error::InvalidRequest(1062))));
                    }

                    Ok(((vv, oo), id))
                }
            }
        }
    }

    pub fn endpoint<'a>(&'a self, ep_name: &str, no_internal: bool) -> Result<&Endpoint> {
        if let Some(end) = self.endpoints.get(ep_name) {
            if no_internal && end.is_internal {
                Err(Error::InvalidServiceEndpoint(1037))
            } else {
                Ok(end)
            }
        } else {
            Err(Error::InvalidServiceEndpoint(1037))
        }
    }

    pub fn is_rpc_project(&self) -> bool {
        matches!(
            self.ptype,
            ProjectType::RpcEvm(_) | ProjectType::RpcSubstrate(_)
        )
    }

    pub fn open_payg(&self) -> bool {
        self.payg_price > U256::zero() && self.payg_expiration > 0
    }

    pub async fn metadata(&self, network: MetricsNetwork) -> Result<Value> {
        let mut metadata = match &self.ptype {
            ProjectType::Subquery => subquery_metadata(&self, network).await?,
            ProjectType::RpcEvm(m) => {
                let mut data = rpc_evm_metadata(&self, network).await?;
                merge_json(&mut data, &m.json_values());
                data
            }
            ProjectType::RpcSubstrate(m) => {
                let mut data = rpc_substrate_metadata(&self, network).await?;
                merge_json(&mut data, &m.json_values());
                data
            }
            ProjectType::Subgraph => subgraph_metadata(&self, network).await?,
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
            timestamp.into_token(),
        ]);
        let hash = keccak256(payload);

        let sign = controller
            .sign_message(hash)
            .await
            .map_err(|_| Error::InvalidSignature(1041))?;

        let arae = auto_reduce_allocation_enabled().await;
        let common = json!({
            "indexer": format!("{:?}", indexer),
            "controller": format!("{:?}", controller_address),
            "deploymentId": self.id,
            "timestamp": timestamp,
            "rateLimit": self.rate_limit.unwrap_or(1000),
            "dbSize": self.db_size,
            "signature": sign.to_string(),
            "autoReduceAllocation": arae,
        });

        merge_json(&mut metadata, &common);

        Ok(metadata)
    }

    pub async fn check_query(
        &self,
        body: String,
        endpoint: String,
        payment: MetricsQuery,
        network: MetricsNetwork,
        is_limit: bool,
        no_sig: bool,
        path: Option<(String, String)>, // path & method
    ) -> Result<(Vec<u8>, String, Option<(i64, i64)>)> {
        let (_, jid) = self.compute_query_method(&body)?;
        let is_rpc = self.is_rpc_project();

        self.query(body, endpoint, payment, network, is_limit, no_sig, path)
            .await
            .map_err(|e| {
                if is_rpc {
                    Error::Jsonrpc(jid, Arc::new(e))
                } else {
                    e
                }
            })
    }

    pub async fn query(
        &self,
        body: String,
        endpoint: String,
        payment: MetricsQuery,
        network: MetricsNetwork,
        is_limit: bool,
        no_sig: bool,
        path: Option<(String, String)>,
    ) -> Result<(Vec<u8>, String, Option<(i64, i64)>)> {
        let waterlevel = if is_limit {
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

                if used + 1 > limit {
                    return Err(Error::RateLimit(1057));
                }

                let _: core::result::Result<(), ()> = redis::cmd("SETEX")
                    .arg(&used_key)
                    .arg(1)
                    .arg(used + 1)
                    .query_async(&mut conn)
                    .await
                    .map_err(|err| error!("Redis 1 {}", err));
                Some((limit, used + 1))
            } else {
                None
            }
        } else {
            None
        };

        let (d, s) = match self.ptype {
            ProjectType::Subquery | ProjectType::Subgraph => match serde_json::from_str(&body) {
                Ok(query) => {
                    self.subquery_raw(&query, endpoint, payment, network, no_sig, path)
                        .await?
                }
                Err(_e) => {
                    if path.is_some() {
                        self.rpcquery_raw(body, endpoint, payment, network, no_sig, path)
                            .await?
                    } else {
                        return Err(Error::InvalidRequest(1140));
                    }
                }
            },
            ProjectType::RpcEvm(_) => {
                self.rpcquery_raw(body, endpoint, payment, network, no_sig, path)
                    .await?
            }
            ProjectType::RpcSubstrate(_) => {
                self.rpcquery_raw(body, endpoint, payment, network, no_sig, path)
                    .await?
            }
        };

        Ok((d, s, waterlevel))
    }

    pub async fn subquery_raw(
        &self,
        query: &GraphQLQuery,
        endpoint: String,
        payment: MetricsQuery,
        network: MetricsNetwork,
        no_sig: bool,
        path: Option<(String, String)>,
    ) -> Result<(Vec<u8>, String)> {
        let now = Instant::now();

        let res = graphql_request_raw_with_path(&endpoint, query, path).await;
        let time = now.elapsed().as_millis() as u64;

        add_metrics_query(self.id.clone(), Some(time), payment, network, res.is_ok());

        match res {
            Ok(data) => {
                let signature = if no_sig {
                    String::default()
                } else {
                    Self::sign_response(&data).await
                };
                Ok((data, signature))
            }
            Err(err) => Err(err),
        }
    }

    pub async fn rpcquery_raw(
        &self,
        query: String,
        endpoint: String,
        payment: MetricsQuery,
        network: MetricsNetwork,
        no_sig: bool,
        path: Option<(String, String)>,
    ) -> Result<(Vec<u8>, String)> {
        let now = Instant::now();

        let res = post_request_raw_with_path(&endpoint, query, path).await;
        let time = now.elapsed().as_millis() as u64;

        add_metrics_query(self.id.clone(), Some(time), payment, network, res.is_ok());

        match res {
            Ok(data) => {
                let signature = if no_sig {
                    String::default()
                } else {
                    Self::sign_response(&data).await
                };
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
    #[serde(rename = "dbSize")]
    pub db_size: Option<String>,
}

pub async fn handle_projects(projects: Vec<ProjectItem>) -> Result<()> {
    let url = COMMAND.graphql_url();
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
        let db_size = item.db_size.map(|s| s.parse().unwrap_or(0u64));

        let payg_price = U256::from_dec_str(&item.payg_price).unwrap_or(U256::from(0));
        let payg_token: Address = item.payg_token.parse().unwrap_or(Address::zero());
        let payg_overflow = item.payg_overflow.into();
        let payg_expiration = item.payg_expiration;

        let rpc_mainfest =
            RpcMainfest::fetch(&url, item.project_type, &item.id, payg_overflow).await?;
        let mut ptype = match item.project_type {
            0 => ProjectType::Subquery,
            1 => ProjectType::RpcEvm(rpc_mainfest.clone()),
            3 => ProjectType::Subgraph,
            _ => {
                error!("Invalid project type");
                return Ok(());
            }
        };

        let mut endpoints: HashMap<String, Endpoint> = HashMap::new();
        for endpoint in item.project_endpoints {
            let mut e = Endpoint {
                endpoint: endpoint.value,
                is_internal: false,
                is_ws: false,
            };

            match endpoint.key.as_str() {
                "evmHttp" => {
                    ptype = ProjectType::RpcEvm(rpc_mainfest.clone());
                    endpoints.insert("default".to_owned(), e.clone());
                    endpoints.insert(endpoint.key, e);
                }
                "polkadotHttp" => {
                    ptype = ProjectType::RpcSubstrate(rpc_mainfest.clone());
                    endpoints.insert("default".to_owned(), e.clone());
                    endpoints.insert(endpoint.key, e);
                }
                "queryEndpoint" | "http-endpoint" => {
                    endpoints.insert("default".to_owned(), e.clone());
                    endpoints.insert(endpoint.key, e);
                }
                "evmWs" | "polkadotWs" | "wsEndpoint" | "ws-endpoint" => {
                    e.is_ws = true;
                    endpoints.insert("ws".to_owned(), e.clone());
                    endpoints.insert(endpoint.key, e);
                }
                "nodeEndpoint" | "index-node-endpoint" | "adminEndpoint" | "admin-endpoint" => {
                    e.is_internal = true;
                    endpoints.insert(endpoint.key, e);
                }
                _ => {
                    endpoints.insert(endpoint.key, e);
                }
            }
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
            db_size,
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
