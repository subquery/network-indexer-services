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

use ethers::prelude::Address;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::str::FromStr;
use tokio::sync::Mutex;
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

    pub async fn is_whitelisted(&mut self, account: &str) -> bool {
        if let Some(is_whitelist) = self.accounts.get(account) {
            *is_whitelist
        } else {
            match Address::from_str(account) {
                Ok(addr) => match check_whitelist_account(addr).await {
                    Ok(is_whitelist) => {
                        self.accounts.insert(account.to_owned(), is_whitelist);
                        is_whitelist
                    }
                    Err(_) => false,
                },
                Err(_) => false,
            }
        }
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

pub static WHITELIST: Lazy<Mutex<Whitelist>> = Lazy::new(|| Mutex::new(Whitelist::default()));

pub fn listen() {
    tokio::spawn(async {
        sleep(Duration::from_secs(WHITELIST_REFRESH_TIME)).await;
        loop {
            let accounts = {
                let whitelist = WHITELIST.lock().await;
                let accounts = whitelist.get_all_accounts();
                drop(whitelist);
                accounts
            };

            let mut deletes = vec![];
            for account in accounts {
                match Address::from_str(&account) {
                    Ok(addr) => match check_whitelist_account(addr).await {
                        Ok(whitelisted) => {
                            if !whitelisted {
                                deletes.push(account)
                            }
                        }
                        Err(_) => continue,
                    },
                    Err(_) => {
                        deletes.push(account);
                    }
                };
            }

            let mut whitelist = WHITELIST.lock().await;
            for delete in deletes {
                whitelist.remove(&delete);
            }
            drop(whitelist);
        }
    });
}
