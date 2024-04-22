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

use std::collections::HashMap;
use std::sync::RwLock;
use once_cell::sync::Lazy;
use ethers::prelude::Address;
use std::str::FromStr;
use tokio::time::{sleep, Duration};

use crate::{contracts::check_whitelist_account, primitives::WHITELIST_REFRESH_TIME};

pub struct Whitelist {
    accounts: HashMap<String, bool>,
}

impl Whitelist {
    pub fn new() -> Self {
        Whitelist {
            accounts: HashMap::new(),
        }
    }

    pub fn remove(&mut self, account: &str) {
        self.accounts.remove(account);
    }

    pub fn update_account(&mut self, account: &str, whitelisted: bool) {
        self.accounts.insert(account.to_string(), whitelisted);
    }

    pub fn is_whitelisted(&self, account: &str) -> bool {
        self.accounts.get(account).map_or(false, |v| *v)
    }

    pub fn get_all_accounts(&self) -> Vec<String> {
        self.accounts.keys().cloned().collect()
    }
}

impl Default for Whitelist {
    fn default() -> Self {
        Self::new()
    }
}

pub static WHITELIST: Lazy<RwLock<Whitelist>> = Lazy::new(|| {
    RwLock::new(Whitelist::default())
});

pub fn listen() {
    tokio::spawn(async {
        sleep(Duration::from_secs(WHITELIST_REFRESH_TIME)).await;
        loop {
            // TODO: get the list from subquery project
            
            let accounts = {
                let whitelist = WHITELIST.read().unwrap();
                whitelist.get_all_accounts()
            };
    
            for account in accounts {
                match Address::from_str(&account) {
                    Ok(addr) => {
                        match check_whitelist_account(addr).await {
                            Ok(whitelisted) => {
                                let mut whitelist = WHITELIST.write().unwrap();
                                whitelist.update_account(&account, whitelisted);
                                drop(whitelist);
                            },
                            Err(_) => ()
                        }
                    },
                    Err(_) => {
                        let mut whitelist = WHITELIST.write().unwrap();
                        whitelist.remove(&account);
                        drop(whitelist);
                    }
                }
            }
        }
    });
}
