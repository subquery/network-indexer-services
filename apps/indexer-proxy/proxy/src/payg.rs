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

//! Pay-As-You-Go with state channel helper functions.

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts},
};
use chrono::prelude::*;
use ethers::{
    signers::LocalWallet,
    types::{Address, H256, U256},
};
use redis::RedisResult;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use subql_indexer_utils::{
    error::Error,
    payg::{
        convert_sign_to_string, convert_string_to_sign, extend_recover2, extend_sign2,
        price_recover, price_sign, MultipleQueryState, MultipleQueryStateActive, OpenState,
        QueryState, MULTIPLE_RANGE_MAX,
    },
    request::{graphql_request, GraphQLQuery},
    tools::{cid_deployment, deployment_cid},
    types::Result,
};

use crate::account::ACCOUNT;
use crate::cli::{redis, COMMAND};
use crate::contracts::{
    check_consumer_controller, check_convert_price, check_state_channel_consumer, get_convert_price,
};
use crate::metrics::{MetricsNetwork, MetricsQuery};
use crate::p2p::report_conflict;
use crate::project::{get_project, list_projects, Project};

const CURRENT_VERSION: u8 = 3;

pub struct StateCache {
    pub expiration: i64,
    pub agent: Address,
    pub deployment: H256,
    pub price: U256,
    pub total: U256,
    pub spent: U256,
    pub remote: U256,
    pub coordi: U256,
    pub conflict_start: i64,
    pub conflict_times: u64,
    signer: ConsumerType,
}

impl StateCache {
    pub fn from_bytes(bytes: &[u8]) -> Result<StateCache> {
        if bytes[0] != CURRENT_VERSION {
            return Err(Error::Serialize(1136));
        }

        if bytes.len() < 237 {
            return Err(Error::Serialize(1136));
        }

        let mut expiration_bytes = [0u8; 8];
        expiration_bytes.copy_from_slice(&bytes[1..9]);
        let expiration = i64::from_le_bytes(expiration_bytes);
        let agent = Address::from_slice(&bytes[9..29]);
        let deployment = H256::from_slice(&bytes[29..61]);

        let price = U256::from_little_endian(&bytes[61..93]);
        let total = U256::from_little_endian(&bytes[93..125]);
        let spent = U256::from_little_endian(&bytes[125..157]);
        let remote = U256::from_little_endian(&bytes[157..189]);
        let coordi = U256::from_little_endian(&bytes[189..221]);

        let mut conflict_start_bytes = [0u8; 8];
        conflict_start_bytes.copy_from_slice(&bytes[221..229]);
        let conflict_start = i64::from_le_bytes(conflict_start_bytes);

        let mut conflict_times_bytes = [0u8; 8];
        conflict_times_bytes.copy_from_slice(&bytes[229..237]);
        let conflict_times = u64::from_le_bytes(conflict_times_bytes);

        let signer = ConsumerType::from_bytes(&bytes[237..])?;

        Ok(StateCache {
            expiration,
            agent,
            deployment,
            price,
            total,
            spent,
            remote,
            coordi,
            conflict_start,
            conflict_times,
            signer,
        })
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = vec![CURRENT_VERSION];

        bytes.extend(&self.expiration.to_le_bytes());
        bytes.extend(self.agent.as_fixed_bytes());
        bytes.extend(self.deployment.as_fixed_bytes());

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
        bytes.extend(&self.conflict_start.to_le_bytes());
        bytes.extend(&self.conflict_times.to_le_bytes());
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
    fn is_empty(&self) -> bool {
        match self {
            ConsumerType::Account(signers) | ConsumerType::Host(signers) => signers.is_empty(),
        }
    }

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
    let controller_address = account.controller_address();
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
        "indexer": format!("{:?}", indexer),
        "controller": format!("{:?}", controller_address),
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
            let controller_account = account.controller_address();
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

// query with single state mode
pub async fn before_query_signle_state(
    project: &Project,
    mut state: QueryState,
    unit_times: u64,
    uint_overflow: u64,
) -> Result<(QueryState, String, StateCache)> {
    debug!("Start handle query channel");

    // check channel state
    let channel_id = state.channel_id;
    let (mut state_cache, keyname) = fetch_channel_cache(channel_id).await?;
    debug!("Got channel cache");

    // check signer
    let account = ACCOUNT.read().await;
    state.sign(&account.controller, false).await?;
    drop(account);
    let (_, signer) = state.recover()?;

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

    let conflict = project.payg_overflow;
    let total = state_cache.total;
    let price = state_cache.price;
    let local_prev = state_cache.spent;
    let remote_prev = state_cache.remote;
    let used_amount = price * unit_times;

    let local_next = local_prev + used_amount;
    let remote_next = state.spent;

    // check spent & conflict
    if remote_prev < remote_next && remote_prev + used_amount > remote_next {
        warn!(
            "remote prev: {} remote next: {}, should: {}",
            remote_prev,
            remote_next,
            remote_prev + price
        );
        // price invalid
        return Err(Error::InvalidProjectPrice(1034));
    }

    if local_next > total {
        // overflow the total
        return Err(Error::Overflow(1056));
    }

    if local_next > remote_next + used_amount {
        // mark conflict is happend
        if state_cache.conflict_times <= 1 {
            state_cache.conflict_start = Utc::now().timestamp();
        }
        state_cache.conflict_times += uint_overflow;
    }

    if state_cache.conflict_times > conflict {
        warn!(
            "CONFLICT: local_next: {}, remote_next: {}, price: {}, conflict: {}",
            local_next, remote_next, price, state_cache.conflict_times
        );

        let project_id = project.id.clone();
        let channel = format!("{:#x}", channel_id);
        let times = state_cache.conflict_times;
        let start = state_cache.conflict_start;
        let end = Utc::now().timestamp();
        tokio::spawn(report_conflict(project_id, channel, times, start, end));

        // overflow the conflict
        return Err(Error::PaygConflict(1050));
    }

    debug!("Verified channel, start query");

    Ok((state, keyname, state_cache))
}

pub async fn post_query_signle_state(
    mut state: QueryState,
    mut state_cache: StateCache,
    keyname: String,
) -> Result<QueryState> {
    let local_next = state_cache.spent + state_cache.price;
    let remote_next = state.spent;

    // update redis cache
    state_cache.spent = local_next;
    state_cache.remote = remote_next;
    let mut conn = redis();
    if state.is_final {
        // close
        let _: RedisResult<()> = redis::cmd("DEL").arg(&keyname).query_async(&mut conn).await;
    } else {
        // update, missing KEEPTTL, so use two operation.
        let exp: RedisResult<usize> = redis::cmd("TTL").arg(&keyname).query_async(&mut conn).await;
        let _: core::result::Result<(), ()> = redis::cmd("SETEX")
            .arg(&keyname)
            .arg(exp.unwrap_or(86400))
            .arg(state_cache.to_bytes())
            .query_async(&mut conn)
            .await
            .map_err(|err| error!("Redis 1: {}", err));
    }

    // async to coordiantor
    let channel_id = state.channel_id;
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
        channel_id, // use default u256 hex style with other library
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

    state.remote = local_next;

    Ok(state)
}

pub async fn query_single_state(
    project_id: &str,
    query: String,
    endpoint: String,
    state: QueryState,
    network_type: MetricsNetwork,
    no_sig: bool,
) -> Result<(Vec<u8>, String, String)> {
    let project: Project = get_project(project_id).await?;

    // compute unit count times
    let (unit_times, unit_overflow) = project.compute_query_method(&query)?;

    let (before_state, keyname, state_cache) =
        before_query_signle_state(&project, state, unit_times, unit_overflow).await?;

    // query the data
    let (data, signature) = project
        .query(
            query,
            endpoint,
            MetricsQuery::PAYG,
            network_type,
            true,
            no_sig,
        )
        .await?;

    let post_state = post_query_signle_state(before_state, state_cache, keyname).await?;

    debug!("Handle query channel success");
    Ok((data, signature, post_state.to_bs64_old2()))
}

// query with multiple state mode
pub async fn before_query_multiple_state(
    mut state: MultipleQueryState,
    unit_times: u64,
) -> Result<(MultipleQueryState, String, StateCache, bool)> {
    debug!("Start handle query channel");
    let signer = state.recover()?;

    // check channel state
    let channel_id = state.channel_id;
    let (mut state_cache, keyname) = fetch_channel_cache(channel_id).await?;
    debug!("Got channel cache");

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

    // check spent
    let mpqsa = check_multiple_state_balance(&state_cache, unit_times, state.start, state.end)?;

    // update state cache
    state_cache.spent = state_cache.spent + state_cache.price * unit_times;

    // sign the state
    let account = ACCOUNT.read().await;
    state.sign(&account.controller, mpqsa).await?;
    drop(account);

    Ok((state, keyname, state_cache, mpqsa.is_inactive()))
}

pub fn check_multiple_state_balance(
    state_cache: &StateCache,
    unit_times: u64,
    start: U256,
    end: U256,
) -> Result<MultipleQueryStateActive> {
    // check spent
    let total = state_cache.total;
    let price = state_cache.price;
    let remote_prev = state_cache.remote;
    let used_amount = price * unit_times;

    let local_next = state_cache.spent + used_amount;

    if local_next > total {
        // overflow the total
        return Err(Error::Overflow(1056));
    }

    let range = end - start;
    if range > MULTIPLE_RANGE_MAX {
        return Err(Error::Overflow(1059));
    }

    let middle = start + range / 2;
    let mut mpqsa = if local_next < middle {
        MultipleQueryStateActive::Active
    } else if local_next > end {
        MultipleQueryStateActive::Inactive2
    } else {
        MultipleQueryStateActive::Inactive1
    };

    if start > range && remote_prev < start - range {
        mpqsa = MultipleQueryStateActive::Inactive2;
    }

    Ok(mpqsa)
}

pub async fn post_query_multiple_state(keyname: String, state_cache: StateCache) {
    let mut conn = redis();
    let exp: RedisResult<usize> = redis::cmd("TTL").arg(&keyname).query_async(&mut conn).await;
    let _: core::result::Result<(), ()> = redis::cmd("SETEX")
        .arg(&keyname)
        .arg(exp.unwrap_or(86400))
        .arg(state_cache.to_bytes())
        .query_async(&mut conn)
        .await
        .map_err(|err| error!("Redis 1: {}", err));
}

pub async fn query_multiple_state(
    project_id: &str,
    query: String,
    endpoint: String,
    state: MultipleQueryState,
    network_type: MetricsNetwork,
    no_sig: bool,
) -> Result<(Vec<u8>, String, String)> {
    let project = get_project(project_id).await?;

    // compute unit count times
    let (unit_times, _unit_overflow) = project.compute_query_method(&query)?;

    let (state, keyname, state_cache, inactive) =
        before_query_multiple_state(state, unit_times).await?;
    if inactive {
        return Ok((vec![], "".to_owned(), state.to_bs64()));
    }

    // query the data.
    let (data, signature) = project
        .query(
            query,
            endpoint,
            MetricsQuery::PAYG,
            network_type,
            true,
            no_sig,
        )
        .await?;

    post_query_multiple_state(keyname, state_cache).await;

    debug!("Handle query channel success");
    Ok((data, signature, state.to_bs64()))
}

pub async fn extend_channel(
    channel: String,
    new_price: U256,
    expired: i64,
    expiration: i32,
    signature: String,
) -> Result<String> {
    // check channel & signature
    let channel_id = U256::from_str_radix(&channel.trim_start_matches("0x"), 16)
        .map_err(|_e| Error::Serialize(1120))?;
    let sign = convert_string_to_sign(&signature);

    let (state_cache, _keyname) = fetch_channel_cache(channel_id).await?;

    // check price
    let project_id = deployment_cid(&state_cache.deployment);
    let project = get_project(&project_id).await?;

    let payg_sqt_price = get_convert_price(project.payg_token, project.payg_price).await?;
    if payg_sqt_price > new_price {
        return Err(Error::InvalidProjectPrice(1049));
    }

    let gap = if expired > state_cache.expiration {
        expired - state_cache.expiration
    } else {
        state_cache.expiration - expired
    };
    if gap > 600 {
        return Err(Error::InvalidProjectPrice(1049));
    }

    let account = ACCOUNT.read().await;
    let indexer = account.indexer;
    drop(account);

    let signer = extend_recover2(
        channel_id,
        indexer,
        state_cache.agent,
        new_price,
        U256::from(expired),
        U256::from(expiration),
        sign,
    )?;

    // check signer
    if !state_cache.signer.contains(&signer) {
        warn!(
            "Extend: {:?} {} {:?} {:?} {} {} {}",
            signer,
            channel_id,
            indexer,
            state_cache.agent,
            state_cache.expiration,
            expiration,
            convert_sign_to_string(&sign)
        );
        return Err(Error::InvalidSignature(1055));
    }

    // send to coordinator
    let expired_at = expired + expiration as i64;
    let mdata = format!(
        r#"mutation {{
             channelExtend(
               id:"{:#X}",
               expiration:{},
               price:"{}",
             )
           {{ id, expiredAt }}
        }}"#,
        channel_id, new_price, expired_at
    );
    let url = COMMAND.graphql_url();
    let query = GraphQLQuery::query(&mdata);
    graphql_request(&url, &query).await.map_err(|e| {
        error!("{:?}", e);
        Error::ServiceException(1202)
    })?;

    let account = ACCOUNT.read().await;
    let indexer_sign = extend_sign2(
        channel_id,
        indexer,
        state_cache.agent,
        new_price,
        U256::from(expired),
        U256::from(expiration),
        &account.controller,
    )
    .await?;
    drop(account);

    Ok(convert_sign_to_string(&indexer_sign))
}

pub async fn pay_channel(mut state: QueryState) -> Result<String> {
    debug!("Start pay channel");
    // check channel state
    let channel_id = state.channel_id;
    let (mut state_cache, keyname) = fetch_channel_cache(channel_id).await?;
    debug!("Got channel cache");

    // check signer
    let account = ACCOUNT.read().await;
    state.sign(&account.controller, false).await?;
    drop(account);
    let (_, signer) = state.recover()?;

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

    // check spent is more than middle
    let total = state_cache.total;
    let local_spent = state_cache.spent;
    let remote_spent = state.spent;
    state.remote = local_spent;

    if remote_spent > total {
        return Err(Error::Overflow(1056));
    }

    // fetch current paid in coordinator
    let mdata = format!(
        r#"query {{ channel( id:"{:#X}") {{ spent }} }}"#,
        channel_id, // use default u256 hex style with other library
    );

    // query the state.
    let url = COMMAND.graphql_url();
    let query = GraphQLQuery::query(&mdata);
    let data = graphql_request(&url, &query).await.map_err(|e| {
        error!("{:?}", e);
        Error::Serialize(1123)
    })?;
    if let Some(p) = data.pointer("/data/channel/spent") {
        let paid =
            U256::from_dec_str(p.as_str().unwrap_or("")).map_err(|_e| Error::Serialize(1123))?;
        if remote_spent <= paid {
            return Ok(state.to_bs64());
        }
    } else {
        return Err(Error::Serialize(1123));
    }

    // update redis cache
    if state_cache.remote < remote_spent {
        state_cache.remote = remote_spent;
        let mut conn = redis();
        if state.is_final {
            // close
            let _: RedisResult<()> = redis::cmd("DEL").arg(&keyname).query_async(&mut conn).await;
        } else {
            // update, missing KEEPTTL, so use two operation.
            let exp: RedisResult<usize> =
                redis::cmd("TTL").arg(&keyname).query_async(&mut conn).await;
            let _: core::result::Result<(), ()> = redis::cmd("SETEX")
                .arg(&keyname)
                .arg(exp.unwrap_or(86400))
                .arg(state_cache.to_bytes())
                .query_async(&mut conn)
                .await
                .map_err(|err| error!("Redis 1: {}", err));
        }
    }

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
        channel_id, // use default u256 hex style with other library
        remote_spent,
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

    debug!("Pay channel success");
    Ok(state.to_bs64())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ChannelItem {
    pub id: String,
    pub consumer: String,
    #[serde(rename = "deploymentId")]
    pub deployment: String,
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
    info!("handle channel change");
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
    let deployment: H256 = cid_deployment(&channel.deployment);
    let agent: Address = channel.agent.parse().unwrap_or(Address::zero());
    let total = U256::from_dec_str(&channel.total).map_err(|_e| Error::Serialize(1122))?;
    let spent = U256::from_dec_str(&channel.spent).map_err(|_e| Error::Serialize(1123))?;
    let remote = U256::from_dec_str(&channel.remote).map_err(|_e| Error::Serialize(1124))?;
    let price = U256::from_dec_str(&channel.price).map_err(|_e| Error::Serialize(1125))?;

    let mut keybytes = [0u8; 32];
    channel_id.to_little_endian(&mut keybytes);
    let keyname = format!("{}-channel", hex::encode(keybytes));

    let mut conn = redis();

    let now = Utc::now().timestamp();

    if channel.is_final || now > channel.expired {
        // delete from cache
        let _: RedisResult<()> = redis::cmd("DEL").arg(&keyname).query_async(&mut conn).await;
    } else {
        let cache_bytes: RedisResult<Vec<u8>> =
            redis::cmd("GET").arg(&keyname).query_async(&mut conn).await;

        let cache_ok = cache_bytes
            .ok()
            .and_then(|v| if v.is_empty() { None } else { Some(v) });

        let state_cache_op = if let Some(bytes) = cache_ok {
            StateCache::from_bytes(&bytes).ok()
        } else {
            None
        };
        let state_cache = if let Some(mut state_cache) = state_cache_op {
            state_cache.expiration = channel.expired;
            state_cache.total = total;
            state_cache.price = price;
            if state_cache.remote != remote {
                debug!(
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

            if state_cache.signer.is_empty() {
                state_cache.signer = check_state_channel_consumer(consumer, agent).await?;
            }

            state_cache
        } else {
            let signer = check_state_channel_consumer(consumer, agent).await?;
            StateCache {
                expiration: channel.expired,
                agent,
                deployment,
                price,
                total,
                spent,
                remote,
                signer,
                coordi: spent,
                conflict_start: now,
                conflict_times: 0,
            }
        };

        let exp = (channel.expired - now) as usize;

        let _: core::result::Result<(), ()> = redis::cmd("SETEX")
            .arg(&keyname)
            .arg(exp)
            .arg(state_cache.to_bytes())
            .query_async(&mut conn)
            .await
            .map_err(|err| error!("Redis 2: {}", err));
    }

    Ok(())
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct AuthPayg(pub String);

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

        Ok(Self(authorisation))
    }
}

pub fn channel_id_to_keyname(channel_id: U256) -> String {
    let mut keybytes = [0u8; 32];
    channel_id.to_little_endian(&mut keybytes);
    format!("{}-channel", hex::encode(keybytes))
}

pub async fn fetch_channel_cache(channel_id: U256) -> Result<(StateCache, String)> {
    let keyname = channel_id_to_keyname(channel_id);

    let mut conn = redis();
    let cache_bytes: RedisResult<Vec<u8>> =
        redis::cmd("GET").arg(&keyname).query_async(&mut conn).await;

    if let Err(err) = cache_bytes {
        error!("Redis 3: {}", err);
        return Err(Error::ServiceException(1021));
    }
    let cache_raw_bytes = cache_bytes.unwrap();
    if cache_raw_bytes.is_empty() {
        return Err(Error::Expired(1054));
    }
    Ok((StateCache::from_bytes(&cache_raw_bytes)?, keyname))
}
