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

//! Pay-As-You-Go with state channel helper functions.

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts},
};
use base64::{engine::general_purpose, Engine as _};
use chrono::prelude::*;
use ethers::{
    signers::{LocalWallet, Signer},
    types::{Address, U256},
};
use redis::{AsyncCommands, RedisResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use subql_indexer_utils::{
    error::Error,
    payg::{convert_sign_to_string, price_recover, price_sign, OpenState, QueryState},
    request::{graphql_request, GraphQLQuery},
    tools::deployment_cid,
    types::Result,
};

use crate::account::ACCOUNT;
use crate::cli::{redis, COMMAND};
use crate::contracts::{
    check_consumer_controller, check_convert_price, check_state_channel_consumer,
};
use crate::metrics::{MetricsNetwork, MetricsQuery};
use crate::p2p::report_conflict;
use crate::project::{get_project, list_projects, project_query_raw, Project};

pub struct StateCache {
    pub price: U256,
    pub total: U256,
    pub spent: U256,
    pub remote: U256,
    coordi: U256,
    pub conflict: i64,
    signer: ConsumerType,
}

impl StateCache {
    fn from_bytes(bytes: &[u8]) -> Result<StateCache> {
        if bytes.len() < 168 {
            return Err(Error::Serialize(1136));
        }

        let price = U256::from_little_endian(&bytes[0..32]);
        let total = U256::from_little_endian(&bytes[32..64]);
        let spent = U256::from_little_endian(&bytes[64..96]);
        let remote = U256::from_little_endian(&bytes[96..128]);
        let coordi = U256::from_little_endian(&bytes[128..160]);
        let mut conflict_bytes = [0u8; 8];
        conflict_bytes.copy_from_slice(&bytes[160..168]);
        let conflict = i64::from_le_bytes(conflict_bytes);
        let signer = ConsumerType::from_bytes(&bytes[168..])?;

        Ok(StateCache {
            price,
            total,
            spent,
            remote,
            coordi,
            conflict,
            signer,
        })
    }

    fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = vec![];
        let mut u256_bytes = [0u8; 32];
        self.price.to_little_endian(&mut u256_bytes);
        bytes.extend(u256_bytes);
        self.total.to_little_endian(&mut u256_bytes);
        bytes.extend(u256_bytes);
        self.spent.to_little_endian(&mut u256_bytes);
        bytes.extend(u256_bytes);
        self.remote.to_little_endian(&mut u256_bytes);
        bytes.extend(u256_bytes);
        self.coordi.to_little_endian(&mut u256_bytes);
        bytes.extend(u256_bytes);
        bytes.extend(&self.conflict.to_le_bytes());
        bytes.extend(&self.signer.to_bytes());
        bytes
    }
}

/// Supported consumer type.
pub enum ConsumerType {
    /// real account
    Account(Vec<Address>),
    /// use consumer host service. Contract Signer and real account
    Host(Vec<Address>),
}

impl ConsumerType {
    fn contains(&self, s: &Address) -> bool {
        match self {
            ConsumerType::Account(signers) | ConsumerType::Host(signers) => signers.contains(s),
        }
    }

    fn from_bytes(bytes: &[u8]) -> Result<ConsumerType> {
        if bytes.len() < 2 {
            return Err(Error::Serialize(1136));
        }

        let num = bytes[1] as usize;
        let mut signers = vec![];
        if bytes.len() > 3 {
            let a_bytes = &bytes[2..];
            for i in 0..num {
                if a_bytes.len() < 20 * (i + 1) {
                    return Err(Error::Serialize(1136));
                }
                signers.push(Address::from_slice(&a_bytes[20 * i..20 * (i + 1)]));
            }
        }

        match bytes[0] {
            1 => Ok(ConsumerType::Host(signers)),
            _ => Ok(ConsumerType::Account(signers)),
        }
    }

    fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = vec![];
        let signers = match self {
            ConsumerType::Account(signers) => {
                bytes.push(0);
                signers
            }
            ConsumerType::Host(signers) => {
                bytes.push(1);
                signers
            }
        };

        // MAX only store 256 signers
        let num = if signers.len() > 255 {
            255
        } else {
            signers.len()
        };
        bytes.push(num as u8);
        for signer in signers.iter().take(num) {
            bytes.extend(signer.as_bytes());
        }

        bytes
    }
}

async fn build_project_price(
    project: Project,
    expired: i64,
    controller: &LocalWallet,
) -> Result<Value> {
    // sign the price
    let price = project.payg_price;
    let token = project.payg_token;

    // price + price_token + price_expired
    let sign = price_sign(price, token, expired, controller).await?;

    Ok(json!((
        project.id,
        price.to_string(),
        project.payg_expiration.to_string(),
        format!("{:?}", token),
        expired,
        convert_sign_to_string(&sign)
    )))
}

pub async fn merket_price(project_id: Option<String>) -> Result<Value> {
    let account = ACCOUNT.read().await;
    let indexer = account.indexer.clone();
    let controller = account.controller.clone();
    drop(account);
    let mut values = vec![];
    if let Some(pid) = project_id {
        if let Ok(project) = get_project(&pid).await {
            if project.open_payg() {
                let expired = Utc::now().timestamp() + 86400;
                let v = build_project_price(project, expired, &controller).await?;
                values.push(v);
            }
        }
    } else {
        let expired = Utc::now().timestamp() + 86400;
        let projects = list_projects().await;
        for project in projects {
            if project.open_payg() {
                let v = build_project_price(project, expired, &controller).await?;
                values.push(v);
            }
        }
    }

    Ok(json!({
        "endpoint": COMMAND.endpoint(),
        "indexer": format!("{:?}", indexer),
        "controller": format!("{:?}", controller.address()),
        "deployments": values,
    }))
}

pub async fn open_state(body: &Value) -> Result<Value> {
    let mut state = OpenState::from_json(body)?;

    // check project is exists. unify the deployment id store style.
    let project_id = deployment_cid(&state.deployment_id);
    let project = get_project(&project_id).await?;

    // check project price.
    let mut used_price = project.payg_price;
    if used_price < state.price_price {
        let now = Utc::now().timestamp();
        if now < state.price_expired {
            let signer = price_recover(
                state.price_price,
                state.price_token,
                state.price_expired,
                state.price_sign,
            )?;
            let account = ACCOUNT.read().await;
            let controller_account = account.controller.address();
            drop(account);
            if signer != controller_account {
                return Err(Error::InvalidProjectPrice(1048));
            }
            used_price = state.price_price;
        }
    }
    if !check_convert_price(project.payg_token, used_price, state.price).await? {
        return Err(Error::InvalidProjectPrice(1033));
    }

    // check project expiration
    if U256::from(project.payg_expiration) < state.expiration {
        return Err(Error::InvalidProjectExpiration(1035));
    }

    let account = ACCOUNT.read().await;
    let indexer = account.indexer;
    state.sign(&account.controller, false).await?;
    drop(account);

    let (sindexer, sconsumer) = state.recover()?;
    debug!("Open signer: {:?}, {:?}", sindexer, sconsumer);

    // check indexer is own
    if indexer != state.indexer {
        return Err(Error::InvalidRequest(1045));
    }

    debug!("Handle open channel success");
    Ok(state.to_json())
}

pub async fn query_state(
    project_id: &str,
    query: &GraphQLQuery,
    state: &Value,
    network_type: MetricsNetwork,
) -> Result<(Vec<u8>, String, String)> {
    let project = get_project(project_id).await?;
    let mut state = QueryState::from_json(state)?;

    let account = ACCOUNT.read().await;
    state.sign(&account.controller, false).await?;
    drop(account);
    let (_, signer) = state.recover()?;

    // check channel state
    let (mut state_cache, keyname) = fetch_channel_cache(state.channel_id).await?;

    // check signer
    if !state_cache.signer.contains(&signer) {
        // check if it is consumer controller
        match state_cache.signer {
            ConsumerType::Account(ref mut signers) => {
                if check_consumer_controller(signers[0], signer).await? {
                    signers.push(signer);
                } else {
                    return Err(Error::InvalidSignature(1055));
                }
            }
            _ => return Err(Error::InvalidSignature(1055)),
        }
    }

    let total = state_cache.total;
    let price = state_cache.price;
    let local_prev = state_cache.spent;
    let remote_prev = state_cache.remote;
    let remote_next = state.spent;
    let conflict = project.payg_overflow;

    if remote_prev < remote_next && remote_prev + price > remote_next {
        // price invalid
        return Err(Error::InvalidProjectPrice(1034));
    }

    if remote_next >= total + price {
        // overflow the total
        return Err(Error::Overflow(1056));
    }

    if local_prev > remote_prev + price {
        // mark conflict is happend
        let times = ((local_prev - remote_prev) / price).as_u32() as i32;
        let now = Utc::now().timestamp();
        if times <= 1 {
            state_cache.conflict = now;
        }
        let channel = format!("{:#x}", state.channel_id);
        report_conflict(&project.id, &channel, times, state_cache.conflict, now).await;
    }

    if local_prev > remote_prev + price * conflict {
        warn!(
            "CONFLICT: local_prev: {}, remote_prev: {}, price: {}, conflict: {}",
            local_prev, remote_prev, price, conflict
        );
        // overflow the conflict
        return Err(Error::PaygConflict(1050));
    }

    // query the data.
    let (data, signature) =
        project_query_raw(project_id, query, MetricsQuery::PAYG, network_type, true).await?;

    state_cache.spent = local_prev + remote_next - remote_prev;
    state_cache.remote = remote_next;

    let conn = redis();
    let mut conn_lock = conn.lock().await;
    if state.is_final {
        // close
        let _: RedisResult<()> = conn_lock.del(&keyname).await;
    } else {
        // update, missing KEEPTTL, so use two operation.
        let exp: RedisResult<usize> = conn_lock.ttl(&keyname).await;
        let _: RedisResult<()> = conn_lock
            .set_ex(&keyname, state_cache.to_bytes(), exp.unwrap_or(86400))
            .await;
    }
    drop(conn_lock);

    // async to coordiantor
    let mdata = format!(
        r#"mutation {{
             channelUpdate(
               id:"{:#X}",
               spent:"{}",
               isFinal:{},
               indexerSign:"0x{}",
               consumerSign:"0x{}")
           {{ id, spent }}
        }}"#,
        state.channel_id, // use default u256 hex style with other library
        remote_next,
        state.is_final,
        convert_sign_to_string(&state.indexer_sign),
        convert_sign_to_string(&state.consumer_sign),
    );
    tokio::spawn(async move {
        // query the state.
        let url = COMMAND.graphql_url();
        let query = GraphQLQuery::query(&mdata);
        let _ = graphql_request(&url, &query)
            .await
            .map_err(|e| error!("{:?}", e));
    });

    state.remote = state_cache.spent;
    debug!("Handle query channel success");
    let state_bytes = serde_json::to_vec(&state.to_json()).unwrap_or(vec![]);
    let state_string = general_purpose::STANDARD.encode(&state_bytes);
    Ok((data, signature, state_string))
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ChannelItem {
    pub id: String,
    pub consumer: String,
    pub agent: String,
    pub total: String,
    pub spent: String,
    pub remote: String,
    pub price: String,
    #[serde(rename = "expiredAt")]
    pub expired: i64,
    #[serde(rename = "lastFinal")]
    pub is_final: bool,
}

pub async fn handle_channel(value: &Value) -> Result<()> {
    debug!("handle channel change");
    let channel: ChannelItem =
        serde_json::from_str(value.to_string().as_str()).map_err(|_e| Error::Serialize(1120))?;

    // coordinator use bignumber or hex to store channel id
    let channel_id = if channel.id.starts_with("0x") {
        U256::from_str_radix(&channel.id[2..], 16).map_err(|_e| Error::Serialize(1120))?
    } else {
        U256::from_dec_str(&channel.id).map_err(|_e| Error::Serialize(1120))?
    };
    let consumer: Address = channel
        .consumer
        .parse()
        .map_err(|_e| Error::Serialize(1121))?;
    let agent: Address = channel.agent.parse().unwrap_or(Address::zero());
    let total = U256::from_dec_str(&channel.total).map_err(|_e| Error::Serialize(1122))?;
    let spent = U256::from_dec_str(&channel.spent).map_err(|_e| Error::Serialize(1123))?;
    let remote = U256::from_dec_str(&channel.remote).map_err(|_e| Error::Serialize(1124))?;
    let price = U256::from_dec_str(&channel.price).map_err(|_e| Error::Serialize(1125))?;

    let mut keybytes = [0u8; 32];
    channel_id.to_little_endian(&mut keybytes);
    let keyname = format!("{}-channel", hex::encode(keybytes));

    let conn = redis();
    let mut conn_lock = conn.lock().await;

    let now = Utc::now().timestamp();

    if channel.is_final || now > channel.expired {
        // delete from cache
        let _: RedisResult<()> = conn_lock.del(&keyname).await;
    } else {
        let cache_bytes: RedisResult<Vec<u8>> = conn_lock.get(&keyname).await;
        let cache_ok = cache_bytes
            .ok()
            .and_then(|v| if v.is_empty() { None } else { Some(v) });

        let state_cache_op = if let Some(bytes) = cache_ok {
            StateCache::from_bytes(&bytes).ok()
        } else {
            None
        };
        let state_cache = if let Some(mut state_cache) = state_cache_op {
            state_cache.total = total;
            if state_cache.remote != remote {
                warn!(
                    "Proxy remote: {}, coordinator remote: {}",
                    state_cache.remote, remote
                );
            }
            state_cache.remote = std::cmp::max(state_cache.remote, remote);
            // spent = max(cache_spent - (spent - cache_coordi), spent)
            // let fixed = state_cache.spent + state_cache.coordi - spent;
            // if fixed != spent {
            //     warn!(
            //         "Fixed spent: {}, proxy spent: {}, coordinator old: {}, coordinator new: {}",
            //         fixed, state_cache.spent, state_cache.coordi, spent
            //     );
            // }
            state_cache.spent = std::cmp::max(state_cache.spent, spent);
            state_cache.coordi = spent;

            state_cache
        } else {
            let signer = check_state_channel_consumer(consumer, agent).await?;
            StateCache {
                price,
                total,
                spent,
                remote,
                signer,
                coordi: spent,
                conflict: now,
            }
        };

        let exp = (channel.expired - now) as usize;
        let _: RedisResult<()> = conn_lock
            .set_ex(&keyname, state_cache.to_bytes(), exp)
            .await;
    }

    Ok(())
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct AuthPayg(pub Value);

#[async_trait]
impl<S> FromRequestParts<S> for AuthPayg
where
    S: Send + Sync,
{
    type Rejection = Error;

    async fn from_request_parts(
        req: &mut Parts,
        _state: &S,
    ) -> std::result::Result<Self, Self::Rejection> {
        // Get authorisation header
        let authorisation = req
            .headers
            .get(AUTHORIZATION)
            .ok_or(Error::Permission(1020))?
            .to_str()
            .map_err(|_| Error::Permission(1020))?
            .to_owned();

        // check auth is base64 or json string
        let raw = general_purpose::STANDARD
            .decode(&authorisation)
            .map(|v| String::from_utf8(v).unwrap_or(authorisation.clone()))
            .unwrap_or(authorisation);

        serde_json::from_str::<Value>(&raw)
            .map(AuthPayg)
            .map_err(|_| Error::InvalidAuthHeader(1031))
    }
}

pub async fn fetch_channel_cache(channel_id: U256) -> Result<(StateCache, String)> {
    let mut keybytes = [0u8; 32];
    channel_id.to_little_endian(&mut keybytes);
    let keyname = format!("{}-channel", hex::encode(keybytes));

    let conn = redis();
    let mut conn_lock = conn.lock().await;
    let cache_bytes: RedisResult<Vec<u8>> = conn_lock.get(&keyname).await;
    drop(conn_lock);
    if cache_bytes.is_err() {
        return Err(Error::ServiceException(1021));
    }
    let cache_raw_bytes = cache_bytes.unwrap();
    if cache_raw_bytes.is_empty() {
        return Err(Error::Expired(1054));
    }
    Ok((StateCache::from_bytes(&cache_raw_bytes)?, keyname))
}
