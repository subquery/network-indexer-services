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

use ethers::{
    signers::{LocalWallet, Signer},
    types::{Address, H160},
};
use once_cell::sync::Lazy;
use serde_json::{json, Value};
use subql_indexer_utils::{constants::decode_proxy_version, error::Error, types::Result};
use tdn::prelude::PeerKey;
use tokio::sync::RwLock;

use crate::cli::COMMAND;
use crate::metrics::{get_services_version, get_status};
use crate::p2p::{start_network, stop_network};

// sk = 0, address = 0x7e5f4552091a69125d5dfcb7b8c2659029395bdf
const EMPTY_CONTROLLER: H160 = H160([
    126, 95, 69, 82, 9, 26, 105, 18, 93, 93, 252, 183, 184, 194, 101, 144, 41, 57, 91, 223,
]);

pub struct Account {
    pub indexer: Address,
    pub controller: LocalWallet,
}

impl Account {
    pub fn controller_address(&self) -> Address {
        let address = self.controller.address();
        if address == EMPTY_CONTROLLER {
            Address::default()
        } else {
            address
        }
    }
}

impl Default for Account {
    fn default() -> Self {
        let wallet = "0000000000000000000000000000000000000000000000000000000000000001"
            .parse::<LocalWallet>()
            .unwrap();
        Self {
            indexer: Address::default(),
            controller: wallet,
        }
    }
}

pub static ACCOUNT: Lazy<RwLock<Account>> = Lazy::new(|| RwLock::new(Account::default()));

pub async fn handle_account(value: &Value) -> Result<()> {
    let indexer: Address = value
        .get("indexer")
        .ok_or(Error::InvalidServiceEndpoint(1036))?
        .as_str()
        .unwrap_or("0x0000000000000000000000000000000000000000")
        .trim()
        .parse()
        .unwrap_or(Address::default());

    let fetch_controller = value.get("encryptedKey").and_then(|sk| {
        let data = sk.as_str().unwrap_or("").trim();
        if !data.is_empty() {
            Some(data)
        } else {
            None
        }
    });

    let (controller, peer) = if let Some(sk) = fetch_controller {
        let sk = COMMAND.decrypt(sk)?;

        let controller = sk[2..]
            .parse::<LocalWallet>()
            .map_err(|_| Error::InvalidController(1038))?;
        let peer = PeerKey::from_db_bytes(
            &hex::decode(&sk[2..]).map_err(|_| Error::InvalidController(1039))?,
        )
        .map_err(|_| Error::InvalidController(1039))?;
        (controller, Some(peer))
    } else {
        (
            "0000000000000000000000000000000000000000000000000000000000000001"
                .parse::<LocalWallet>()
                .unwrap(),
            None,
        )
    };
    let new_c = controller.address();

    let new_account = Account {
        indexer,
        controller,
    };
    let mut account = ACCOUNT.write().await;
    let old_c = account.controller.address();
    *account = new_account;
    drop(account);

    if old_c != new_c {
        if let Some(key) = peer {
            info!("Need restart p2p network...");
            tokio::spawn(async move {
                stop_network().await;
                start_network(key).await;
            });
        }
    }

    Ok(())
}

pub async fn get_indexer() -> String {
    format!("{:?}", ACCOUNT.read().await.indexer)
}

pub async fn indexer_healthy() -> Value {
    let lock = ACCOUNT.read().await;
    let controller = lock.controller_address();
    let indexer = lock.indexer.clone();
    drop(lock);

    let (uptime, os) = get_status().await;
    let version = get_services_version().await;
    let v_bytes = version.to_le_bytes();
    let mut p_v = [0u8; 4];
    let mut c_v = [0u8; 4];
    p_v.copy_from_slice(&v_bytes[0..4]);
    c_v.copy_from_slice(&v_bytes[4..8]);
    let proxy_version = decode_proxy_version(u32::from_le_bytes(p_v));
    let coordinator_version = decode_proxy_version(u32::from_le_bytes(c_v));

    json!({
        "indexer": format!("{:?}", indexer),
        "controller": format!("{:?}", controller),
        "uptime": uptime,
        "proxyVersion": proxy_version,
        "coordinatorVersion": coordinator_version,
        "os": os
    })
}
