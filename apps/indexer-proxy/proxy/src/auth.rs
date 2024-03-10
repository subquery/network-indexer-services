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

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts},
};
use chrono::prelude::*;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use redis::RedisResult;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use subql_indexer_utils::{error::Error, types::Result};

use crate::cli::{redis, COMMAND};
use crate::contracts::check_agreement_and_consumer;

#[derive(Serialize, Deserialize, Debug)]
pub struct Payload {
    /// indexer address
    pub indexer: String,
    /// consumer address
    pub consumer: Option<String>,
    /// service agreement contract address
    pub agreement: Option<String>,
    /// deployment id for the proejct
    pub deployment_id: String,
    /// signature of user
    pub signature: String,
    /// timestamp
    pub timestamp: i64,
    /// chain id
    pub chain_id: i64,
}

#[derive(Serialize, Deserialize)]
struct Claims {
    /// ethereum address
    pub indexer: String,
    /// agreement
    pub agreement: Option<String>,
    /// deployment id for the proejct
    pub deployment_id: String,
    /// issue timestamp
    pub iat: i64,
    /// token expiration
    pub exp: i64,
}

pub async fn create_jwt(
    payload: Payload,
    daily: u64,
    rate: u64,
    free: Option<SocketAddr>,
) -> Result<String> {
    let expiration = Utc::now()
        .checked_add_signed(chrono::Duration::hours(COMMAND.token_duration()))
        .expect("valid timestamp")
        .timestamp_millis();

    if (Utc::now().timestamp_millis() - payload.timestamp).abs() > 120000 {
        return Err(Error::AuthCreate(1000));
    }

    let header = Header::new(Algorithm::HS512);
    let mut claims = Claims {
        indexer: payload.indexer,
        agreement: payload.agreement.clone(),
        deployment_id: payload.deployment_id,
        iat: payload.timestamp,
        exp: expiration,
    };

    if let Some(addr) = free {
        claims.agreement = Some(format!("{}", addr.ip()));
    }

    if let Some(agreement) = &claims.agreement {
        save_agreement(&agreement, daily, rate, None).await;
    }

    encode(
        &header,
        &claims,
        &EncodingKey::from_secret(COMMAND.jwt_secret().as_bytes()),
    )
    .map_err(|_| Error::AuthCreate(1003))
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct AuthQuery(pub String);

#[async_trait]
impl<S> FromRequestParts<S> for AuthQuery
where
    S: Send + Sync,
{
    type Rejection = Error;

    async fn from_request_parts(
        req: &mut Parts,
        _state: &S,
    ) -> std::result::Result<Self, Self::Rejection> {
        let claims = check_jwt(req)?;

        if let Some(agreement) = claims.agreement {
            check_agreement_limit(&agreement).await?;
        }

        Ok(AuthQuery(claims.deployment_id))
    }
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct AuthQueryLimit(pub u64, pub u64, pub u64, pub u64);

#[async_trait]
impl<S> FromRequestParts<S> for AuthQueryLimit
where
    S: Send + Sync,
{
    type Rejection = Error;

    async fn from_request_parts(
        req: &mut Parts,
        _state: &S,
    ) -> std::result::Result<Self, Self::Rejection> {
        let claims = check_jwt(req)?;

        if let Some(agreement) = claims.agreement {
            let (daily_limit, daily_times, rate_limit, rate_times) =
                get_agreement_limit(&agreement).await;
            Ok(AuthQueryLimit(
                daily_limit,
                daily_times,
                rate_limit,
                rate_times,
            ))
        } else {
            Ok(AuthQueryLimit(1, 0, 1, 0))
        }
    }
}

fn check_jwt(req: &mut Parts) -> Result<Claims> {
    // Get authorisation header
    let authorisation = req
        .headers
        .get(AUTHORIZATION)
        .ok_or(Error::Permission(1020))?
        .to_str()
        .map_err(|_| Error::Permission(1020))?;

    // Check that is bearer and jwt
    let split = authorisation.split_once(' ');
    let jwt = match split {
        Some((name, contents)) if name == "Bearer" => Ok(contents),
        _ => Err(Error::InvalidAuthHeader(1030)),
    }?;

    let decoded = decode::<Claims>(
        jwt,
        &DecodingKey::from_secret(COMMAND.jwt_secret().as_bytes()),
        &Validation::new(Algorithm::HS512),
    )
    .map_err(|_| Error::AuthVerify(1005))?;

    if decoded.claims.exp < Utc::now().timestamp_millis() {
        return Err(Error::AuthExpired(1006));
    }

    Ok(decoded.claims)
}

pub async fn check_and_save_agreement(signer: &str, agreement: &str) -> Result<()> {
    check_agreement_with_signer(signer, agreement).await?;

    // check limit is valid
    check_agreement_limit(agreement).await?;

    Ok(())
}

pub async fn check_and_get_agreement_limit(
    signer: &str,
    agreement: &str,
) -> Result<(u64, u64, u64, u64)> {
    check_agreement_with_signer(signer, agreement).await?;

    // get limit
    Ok(get_agreement_limit(agreement).await)
}

async fn check_agreement_with_signer(signer: &str, agreement: &str) -> Result<()> {
    // check already has agreement
    let daily_limit_name = format!("{}-dlimit", agreement);
    let ca_consumer = format!("{}-{}", agreement, signer);
    let mut conn = redis();

    let daily_limit: RedisResult<u64> = redis::cmd("GET")
        .arg(&daily_limit_name)
        .query_async(&mut conn)
        .await;
    let ca_checked: RedisResult<bool> = redis::cmd("GET")
        .arg(&ca_consumer)
        .query_async(&mut conn)
        .await;

    if daily_limit.is_err() {
        // init agreement
        let (checked, daily, rate) = check_agreement_and_consumer(signer, agreement).await?;
        if !checked {
            return Err(Error::AuthCreate(1001));
        }
        save_agreement(agreement, daily, rate, Some(signer)).await;
    } else if ca_checked.is_err() {
        return Err(Error::AuthExpired(1006));
    }

    Ok(())
}

async fn save_agreement(agreement: &str, daily: u64, rate: u64, signer: Option<&str>) {
    let daily_limit = format!("{}-dlimit", agreement);
    let rate_limit = format!("{}-rlimit", agreement);

    // keep the redis expired slower than token.
    let limit_expired = (COMMAND.token_duration() as usize * 3600) * 2;

    // update the limit
    let mut conn = redis();

    let _: RedisResult<()> = redis::cmd("SETEX")
        .arg(&daily_limit)
        .arg(daily)
        .arg(limit_expired)
        .query_async(&mut conn)
        .await;
    let _: RedisResult<()> = redis::cmd("SETEX")
        .arg(&rate_limit)
        .arg(rate)
        .arg(limit_expired)
        .query_async(&mut conn)
        .await;

    if let Some(signer) = signer {
        let ca_consumer = format!("{}-{}", agreement, signer);
        let _: RedisResult<()> = redis::cmd("SETEX")
            .arg(&ca_consumer)
            .arg(true)
            .arg(limit_expired)
            .query_async(&mut conn)
            .await;
    }
}

async fn check_agreement_limit(agreement: &str) -> Result<()> {
    // check limit
    let (daily_limit, daily_times, rate_limit, rate_times) = get_agreement_limit(agreement).await;

    if daily_times + 1 > daily_limit {
        return Err(Error::DailyLimit(1051));
    }

    if rate_times + 1 > rate_limit {
        return Err(Error::RateLimit(1052));
    }

    let mut conn = redis();

    let (date, second) = day_and_second();
    let daily_key = format!("{}-daily-{}", agreement, date);
    let rate_key = format!("{}-rate-{}", agreement, second);

    let _: RedisResult<()> = redis::cmd("SETEX")
        .arg(&daily_key)
        .arg(daily_times + 1)
        .arg(86400)
        .query_async(&mut conn)
        .await;

    let _: RedisResult<()> = redis::cmd("SETEX")
        .arg(&rate_key)
        .arg(rate_times + 1)
        .arg(1)
        .query_async(&mut conn)
        .await;

    Ok(())
}

async fn get_agreement_limit(agreement: &str) -> (u64, u64, u64, u64) {
    // check limit
    let (date, second) = day_and_second();
    let daily_key = format!("{}-daily-{}", agreement, date);
    let rate_key = format!("{}-rate-{}", agreement, second);
    let daily_limit = format!("{}-dlimit", agreement);
    let rate_limit = format!("{}-rlimit", agreement);

    let mut conn = redis();

    let daily_limit: u64 = redis::cmd("GET")
        .arg(&daily_limit)
        .query_async(&mut conn)
        .await
        .unwrap_or(86400);
    let rate_limit: u64 = redis::cmd("GET")
        .arg(&rate_limit)
        .query_async(&mut conn)
        .await
        .unwrap_or(1);

    let daily_times: u64 = redis::cmd("GET")
        .arg(&daily_key)
        .query_async(&mut conn)
        .await
        .unwrap_or(0);
    let rate_times: u64 = redis::cmd("GET")
        .arg(&rate_key)
        .query_async(&mut conn)
        .await
        .unwrap_or(0);

    (daily_limit, daily_times, rate_limit, rate_times)
}

/// current date & second
fn day_and_second() -> (i32, i64) {
    let utc: DateTime<Utc> = Utc::now();
    let date = utc.date_naive().num_days_from_ce();
    let second = utc.timestamp();
    (date, second)
}
