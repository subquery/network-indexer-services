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

use crate::COMMAND;
use cached::{stores::TimedSizedCache, Cached};
use once_cell::sync::Lazy;
use sentry::{protocol::Event, types::protocol::v7::Exception};
use std::sync::Mutex;

static GLOBAL_MSG_SET: Lazy<Mutex<TimedSizedCache<String, ()>>> =
    Lazy::new(|| Mutex::new(TimedSizedCache::with_size_and_lifespan(1000, 600)));
static GLOBAL_HASH_SET: Lazy<Mutex<TimedSizedCache<String, ()>>> =
    Lazy::new(|| Mutex::new(TimedSizedCache::with_size_and_lifespan(1000, 600)));

pub fn make_sentry_message(unique_title: &str, msg: &str) -> String {
    format!("{} ||| {}", unique_title, msg)
}

pub fn before_send(mut event: Event<'static>) -> Option<Event<'static>> {
    if let Some(ref message) = event.message {
        let mut msg_set = GLOBAL_MSG_SET.lock().unwrap();
        let first_part = message.split("|||").next().unwrap_or(message).trim();
        if !msg_set.cache_get(first_part).is_some() {
            msg_set.cache_set(first_part.to_string(), ());
            drop(msg_set);
            add_event_extra_info(&mut event);
            return Some(event);
        }
    }
    if !event.exception.values.is_empty() {
        if let Some(exception_str) = get_first_value_of_exception(&event.exception.values) {
            let mut hash_set = GLOBAL_HASH_SET.lock().unwrap();
            if !hash_set.cache_get(exception_str).is_some() {
                hash_set.cache_set(exception_str.clone(), ());
                drop(hash_set);
                add_event_extra_info(&mut event);
                return Some(event);
            }
        }
    }
    None
}

fn add_event_extra_info(event: &mut Event<'static>) {
    let network_name = format!("{:#?}", COMMAND.network());
    event
        .extra
        .insert("network".to_string(), network_name.into());
}

fn get_first_value_of_exception(values: &[Exception]) -> &Option<String> {
    &values[0].value
}
