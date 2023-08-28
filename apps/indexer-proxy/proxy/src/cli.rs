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

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm,
};
use digest::{generic_array::GenericArray, Digest};
use once_cell::sync::Lazy;
use redis::aio::Connection;
use std::net::SocketAddr;
use structopt::StructOpt;
use subql_contracts::Network;
use subql_utils::{
    constants::{BOOTSTRAP, TELEMETRIES_MAINNET, TELEMETRIES_TESTNET},
    error::Error,
};
use tdn::prelude::PeerId;
use tokio::sync::{Mutex, OnceCell};

const DEFAULT_P2P_ADDR: &str = "0.0.0.0:7370";

pub static REDIS: OnceCell<Mutex<Connection>> = OnceCell::const_new();

pub fn redis<'a>() -> &'a Mutex<Connection> {
    REDIS.get().expect("REDIS lost connections")
}

pub async fn init_redis() {
    let client = redis::Client::open(COMMAND.redis_endpoint()).unwrap();
    let conn = Mutex::new(client.get_async_connection().await.unwrap());
    REDIS
        .set(conn)
        .map_err(|_e| "redis connection failure")
        .unwrap();
}

pub static COMMAND: Lazy<CommandLineArgs> = Lazy::new(CommandLineArgs::from_args);

#[derive(Debug, StructOpt)]
#[structopt(
    name = "Indexer Proxy",
    about = "Command line for starting indexer proxy server"
)]
pub struct CommandLineArgs {
    /// Endpoint of this service
    #[structopt(long = "endpoint", default_value = "http://0.0.0.0:8080")]
    pub endpoint: String,
    /// IP address for the server
    #[structopt(long = "host", default_value = "0.0.0.0")]
    pub host: String,
    /// Port the service will listen on
    #[structopt(short = "p", long = "port", default_value = "8080")]
    pub port: u16,
    /// Coordinator service endpoint
    #[structopt(long = "service-url", default_value = "http://127.0.0.1:8000")]
    pub service_url: String,
    /// Secret key for decrypt key
    #[structopt(long = "secret-key", default_value = "ThisIsYourSecret")]
    pub secret_key: String,
    /// Enable auth
    #[structopt(short = "a", long = "auth")]
    pub auth: bool,
    /// Auth token duration hours
    #[structopt(long = "token-duration", default_value = "12")]
    pub token_duration: i64,
    /// Enable debug mode
    #[structopt(short = "d", long = "debug")]
    pub debug: bool,
    /// port of p2p network.
    #[structopt(long = "p2p-port")]
    pub p2p_port: Option<u16>,
    /// Secret key for generate auth token
    #[structopt(short = "j", long = "jwt-secret", default_value = "ThisIsYourJWT")]
    pub jwt_secret: String,
    /// Blockchain network type
    #[structopt(long = "network", default_value = "")]
    pub network: String,
    /// Blockchain network endpoint
    #[structopt(long = "network-endpoint", default_value = "")]
    pub network_endpoint: String,
    /// Redis client address
    #[structopt(long = "redis-endpoint", default_value = "redis://127.0.0.1/")]
    pub redis_endpoint: String,
    /// Bootstrap seeds for p2p network with MultiAddr style
    #[structopt(long = "bootstrap")]
    pub bootstrap: Vec<String>,
    /// Free query for consumer limit everyday
    #[structopt(long = "free-plan", default_value = "60")]
    pub free_limit: u64,
    /// Open telemetry for SubQuery
    #[structopt(long = "telemetry", parse(try_from_str), default_value = "true")]
    pub telemetry: bool,
    /// The auth bearer for prometheus fetch metrics
    #[structopt(long = "metrics-token", default_value = "thisismyAuthtoken")]
    pub metrics_token: String,
}

impl CommandLineArgs {
    pub fn endpoint(&self) -> &str {
        &self.endpoint
    }

    pub fn host(&self) -> &str {
        &self.host
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn graphql_url(&self) -> String {
        self.service_url.clone() + "/graphql"
    }

    pub fn decrypt(&self, ct: &str) -> Result<String, Error> {
        let ct = if ct.starts_with("0x") { &ct[2..] } else { ct };
        let ct_bytes = hex::decode(ct).map_err(|_| Error::InvalidEncrypt(1042))?;
        let ct_len = ct_bytes.len();
        if ct_len < 28 {
            return Err(Error::InvalidEncrypt(1042));
        }

        let iv = &ct_bytes[ct_len - 12..];
        let content = &ct_bytes[..ct_len - 12];
        let nonce = GenericArray::from_slice(&iv);

        let mut hasher = sha2::Sha256::new();
        hasher.update(&self.secret_key.as_bytes());
        let gcm = Aes256Gcm::new_from_slice(hasher.finalize().as_slice())
            .map_err(|_| Error::InvalidEncrypt(1043))?;

        let ptext = gcm
            .decrypt(nonce, content)
            .map_err(|_| Error::InvalidEncrypt(1043))?;

        String::from_utf8(ptext).map_err(|_| Error::InvalidEncrypt(1044))
    }

    pub fn debug(&self) -> bool {
        self.debug
    }

    pub fn auth(&self) -> bool {
        self.auth
    }

    pub fn token_duration(&self) -> i64 {
        self.token_duration
    }

    pub fn p2p(&self) -> SocketAddr {
        if let Some(port) = self.p2p_port {
            format!("0.0.0.0:{}", port).parse().unwrap()
        } else {
            DEFAULT_P2P_ADDR.parse().unwrap()
        }
    }

    pub fn jwt_secret(&self) -> &str {
        &self.jwt_secret
    }

    pub fn network_endpoint(&self) -> String {
        let current_endpoint = self.network_endpoint.trim();
        if current_endpoint.is_empty() {
            let network = self.network();
            network.config().rpc_urls[0].clone()
        } else {
            current_endpoint.to_owned()
        }
    }

    pub fn network(&self) -> Network {
        Network::from_str(&self.network)
    }

    pub fn redis_endpoint(&self) -> &str {
        &self.redis_endpoint
    }

    pub fn bootstrap(&self) -> Vec<String> {
        let mut seeds = self.bootstrap.clone();
        seeds.extend(BOOTSTRAP.iter().map(|v| v.to_string()));
        seeds
    }

    pub fn telemetries(&self) -> Vec<PeerId> {
        if self.telemetry {
            match self.network() {
                Network::Kepler | Network::Mainnet => TELEMETRIES_MAINNET
                    .iter()
                    .filter_map(|p| PeerId::from_hex(p.trim()).ok())
                    .collect(),
                _ => TELEMETRIES_TESTNET
                    .iter()
                    .filter_map(|p| PeerId::from_hex(p.trim()).ok())
                    .collect(),
            }
        } else {
            vec![]
        }
    }
}
