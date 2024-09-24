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
#![allow(clippy::or_fun_call)]

#[macro_use]
extern crate tracing;

mod account;
mod ai;
mod auth;
mod cli;
mod contracts;
mod graphql;
mod metadata;
mod metrics;
mod monitor;
mod p2p;
mod payg;
mod primitives;
mod project;
mod response;
mod sentry_log;
mod server;
mod subscriber;
mod websocket;
mod whitelist;

use cli::COMMAND;
use sentry_log::before_send;
use std::sync::Arc;
use tracing::Level;

const GITHUB_SENTRY_DSN: Option<&'static str> = option_env!("SECRETS_SENTRY_DSN");

fn main() {
    if let Some(sentry_dsn) = GITHUB_SENTRY_DSN {
        let sentry_option = sentry::ClientOptions {
            before_send: Some(Arc::new(Box::new(before_send))),
            release: sentry::release_name!(),
            debug: false,
            auto_session_tracking: true,
            attach_stacktrace: true,
            ..Default::default()
        };

        let _sentry = sentry::init((sentry_dsn, sentry_option));

        start_tokio_main();
    } else {
        start_tokio_main();
    }
}

fn start_tokio_main() {
    let body = async {
        let port = COMMAND.port();
        let debug = COMMAND.debug();

        let log_filter = if debug { Level::DEBUG } else { Level::WARN };
        tracing_subscriber::fmt().with_max_level(log_filter).init();

        cli::init_redis().await;

        subscriber::subscribe();
        monitor::listen();
        p2p::listen();
        metrics::listen();
        whitelist::listen();

        tokio::spawn(check_sentry_status());

        server::start_server(port).await;
    };

    #[allow(clippy::expect_used, clippy::diverging_sub_expression)]
    {
        return tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Failed building the Runtime")
            .block_on(body);
    }
}

async fn check_sentry_status() {
    if let Some(sentry_dsn) = GITHUB_SENTRY_DSN {
        if sentry_dsn.len() > 20 {
            info!(
                "sentry is enabled, sentry_dsn top 20 characters is {}",
                &sentry_dsn[0..20]
            );
        } else {
            info!("sentry is enabled, sentry_dsn is {}", sentry_dsn);
        }
        // loop {
        //     tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        //     let sentry_msg = format!(
        //         "ep_query_handler, not inline or wrapped, ep_name: {} ||| sabc",
        //         "test_end_point"
        //     );
        //     sentry::capture_message(&sentry_msg, sentry::Level::Error);

        //     tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        //     let maybe_number: Result<i32, &str> = Err("This will crash");
        //     let _number = maybe_number.unwrap(); // This will panic
        // }
    } else {
        info!("sentry is disabled");
    }
}
