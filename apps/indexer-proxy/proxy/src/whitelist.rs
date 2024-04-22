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

pub struct Whitelist {
    accounts: HashMap<String, bool>,
}

impl Whitelist {
    pub fn new() -> Self {
        Whitelist {
            accounts: HashMap::new(),
        }
    }

    pub fn add(&mut self, account: String) {
        self.accounts.insert(account, true);
    }

    pub fn remove(&mut self, account: &str) {
        self.accounts.remove(account);
    }

    pub fn is_whitelisted(&self, account: &str) -> bool {
        self.accounts.get(account).copied().unwrap_or(false)
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
