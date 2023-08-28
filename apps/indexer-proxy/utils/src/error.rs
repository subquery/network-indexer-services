// This file is part of SubQuery.

// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
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
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

/// App error type.
#[derive(Debug)]
pub enum Error {
    AuthCreate(i32),
    AuthVerify(i32),
    AuthExpired(i32),

    GraphQLQuery(i32, String),
    GraphQLInternal(i32, String),

    Permission(i32),
    ServiceException(i32),

    InvalidAuthHeader(i32),
    InvalidProjectId(i32),
    InvalidProjectPrice(i32),
    InvalidProjectExpiration(i32),
    InvalidServiceEndpoint(i32),
    InvalidController(i32),
    InvalidSignature(i32),
    InvalidEncrypt(i32),
    InvalidRequest(i32),

    PaygConflict(i32),
    DailyLimit(i32),
    RateLimit(i32),
    Expired(i32),
    Overflow(i32),

    Serialize(i32),
}

impl Error {
    pub fn to_json(self) -> Value {
        let (_, code, error) = self.to_status_message();

        json!({
            "code": code,
            "error": error
        })
    }

    pub fn to_status_message<'a>(self) -> (StatusCode, i32, &'a str) {
        match self {
            Error::AuthCreate(c) => (StatusCode::UNAUTHORIZED, c, "Auth create failure"),
            Error::AuthVerify(c) => (StatusCode::UNAUTHORIZED, c, "Auth invalid"),
            Error::AuthExpired(c) => (StatusCode::UNAUTHORIZED, c, "Auth expired"),

            Error::GraphQLQuery(c, e) => (
                StatusCode::NOT_FOUND,
                c,
                Box::leak(format!("GraphQL query: {}", e).into_boxed_str()),
            ),
            Error::GraphQLInternal(c, e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                c,
                Box::leak(format!("GraphQL internal: {}", e).into_boxed_str()),
            ),
            Error::Permission(c) => (StatusCode::UNAUTHORIZED, c, "Permission deny"),
            Error::ServiceException(c) => {
                (StatusCode::INTERNAL_SERVER_ERROR, c, "Service exception")
            }
            Error::InvalidAuthHeader(c) => (StatusCode::BAD_REQUEST, c, "Invalid auth header"),
            Error::InvalidProjectId(c) => (StatusCode::BAD_REQUEST, c, "Invalid project id"),
            Error::InvalidProjectPrice(c) => (StatusCode::BAD_REQUEST, c, "Invalid project price"),
            Error::InvalidProjectExpiration(c) => {
                (StatusCode::BAD_REQUEST, c, "Invalid project expiration")
            }
            Error::InvalidServiceEndpoint(c) => (
                StatusCode::BAD_REQUEST,
                c,
                "Invalid coordinator service endpoint",
            ),
            Error::InvalidController(c) => (StatusCode::BAD_REQUEST, c, "Invalid controller"),
            Error::InvalidSignature(c) => (StatusCode::BAD_REQUEST, c, "Invalid signature"),
            Error::InvalidEncrypt(c) => (StatusCode::BAD_REQUEST, c, "Invalid encrypt or decrypt"),
            Error::InvalidRequest(c) => (StatusCode::BAD_REQUEST, c, "Invalid request"),
            Error::PaygConflict(c) => (StatusCode::BAD_REQUEST, c, "PAYG conflict"),
            Error::DailyLimit(c) => (StatusCode::BAD_REQUEST, c, "Exceed daily limit"),
            Error::RateLimit(c) => (StatusCode::BAD_REQUEST, c, "Exceed rate limit"),
            Error::Expired(c) => (StatusCode::BAD_REQUEST, c, "Service expired"),
            Error::Overflow(c) => (StatusCode::BAD_REQUEST, c, "Query overflow"),
            Error::Serialize(c) => (StatusCode::BAD_REQUEST, c, "Invalid serialize"),
        }
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let (status, code, error_message) = self.to_status_message();
        let body = Json(json!({
            "code": code,
            "error": error_message,
        }));
        (status, body).into_response()
    }
}

impl From<hex::FromHexError> for Error {
    fn from(_err: hex::FromHexError) -> Error {
        Error::Serialize(1100)
    }
}

impl From<rustc_hex::FromHexError> for Error {
    fn from(_err: rustc_hex::FromHexError) -> Error {
        Error::Serialize(1101)
    }
}

impl From<uint::FromHexError> for Error {
    fn from(_err: uint::FromHexError) -> Error {
        Error::Serialize(1102)
    }
}

impl From<ethereum_types::FromDecStrErr> for Error {
    fn from(_err: ethereum_types::FromDecStrErr) -> Error {
        Error::Serialize(1103)
    }
}

impl From<ethers::types::SignatureError> for Error {
    fn from(_err: ethers::types::SignatureError) -> Error {
        Error::InvalidSignature(1040)
    }
}

impl From<ethers::signers::WalletError> for Error {
    fn from(_err: ethers::signers::WalletError) -> Error {
        Error::InvalidController(1038)
    }
}
