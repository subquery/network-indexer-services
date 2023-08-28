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

use once_cell::sync::Lazy;
use prometheus_client::{
    encoding::{text::encode, EncodeLabelSet},
    metrics::{counter::Counter, family::Family},
    registry::Registry,
};
use std::collections::HashMap;
use std::time::Instant;
use sysinfo::{System, SystemExt};
use tokio::sync::Mutex;

const PROXY_VERSION: &str = env!("CARGO_PKG_VERSION");
pub static COORDINATOR_VERSION: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(0));

/// query count
#[derive(Default)]
struct QueryCounter {
    /// total count spent time
    time: u64,
    /// free query from http
    free_http: u64,
    /// free query from p2p
    free_p2p: u64,
    /// close agreement from http count
    ca_http: u64,
    /// close agreement from p2p count
    ca_p2p: u64,
    /// payg from http count
    payg_http: u64,
    /// payg from p2p count
    payg_p2p: u64,
}

/// project => (query_count_http, query_count_p2p, query_time)
static TIMER_COUNTER: Lazy<Mutex<HashMap<String, QueryCounter>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

static UPTIME: Lazy<Instant> = Lazy::new(|| Instant::now());

static OWNER_SUCCESS: Lazy<Mutex<Family<Labels, Counter>>> =
    Lazy::new(|| Mutex::new(Family::default()));

static OWNER_FAILURE: Lazy<Mutex<Family<Labels, Counter>>> =
    Lazy::new(|| Mutex::new(Family::default()));

static OWNER_TIME: Lazy<Mutex<Family<Labels, Counter>>> =
    Lazy::new(|| Mutex::new(Family::default()));

const FIELD_NAME_SUCCESS: &str = "query_success";
const FIELD_NAME_FAILURE: &str = "query_failure";
const FIELD_NAME_TIME: &str = "query_time";

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
struct Labels {
    pub deployment: String,
}

pub async fn update_metrics_projects(new_deployments: Vec<String>) {
    let mut old_deployments = vec![];
    let mut lock = TIMER_COUNTER.lock().await;
    let os_lock = OWNER_SUCCESS.lock().await;
    let of_lock = OWNER_FAILURE.lock().await;
    let ot_lock = OWNER_TIME.lock().await;
    for deployment in lock.keys() {
        old_deployments.push(deployment.clone());
    }

    for o in old_deployments.iter() {
        if new_deployments.contains(o) {
            continue;
        } else {
            lock.remove(o);
            let label = Labels {
                deployment: o.clone(),
            };
            os_lock.remove(&label);
            of_lock.remove(&label);
            ot_lock.remove(&label);
        }
    }
    for n in new_deployments {
        if old_deployments.contains(&n) {
            continue;
        } else {
            lock.insert(n.clone(), QueryCounter::default());
            let label = Labels { deployment: n };
            let _ = os_lock.get_or_create(&label);
            let _ = of_lock.get_or_create(&label);
            let _ = ot_lock.get_or_create(&label);
        }
    }

    drop(lock);
    drop(os_lock);
    drop(of_lock);
    drop(ot_lock);
}

pub async fn get_services_version() -> u64 {
    // proxy: 0.3.3-4
    let mut version = [0u8; 4];
    let slice = PROXY_VERSION.split(".").collect::<Vec<&str>>();
    if slice.len() == 3 {
        version[0] = slice[0].parse().unwrap_or(0);
        version[1] = slice[1].parse().unwrap_or(0);
        let next = slice[2].split("-").collect::<Vec<&str>>();
        version[2] = next[0].parse().unwrap_or(0);
        if next.len() == 2 {
            version[3] = next[1].parse().unwrap_or(0);
        }
    }

    let cv = COORDINATOR_VERSION.lock().await;
    let cv_bytes = cv.to_le_bytes();
    drop(cv);

    let mut versions = [0u8; 8];
    versions[..4].copy_from_slice(&version);
    versions[4..].copy_from_slice(&cv_bytes);

    u64::from_le_bytes(versions)
}

pub async fn get_status() -> (u64, String) {
    let uptime = UPTIME.elapsed().as_secs();
    let sys = System::new();
    let name = sys.name().unwrap_or("NULL".to_owned());
    let os = sys.os_version().unwrap_or("NULL".to_owned());
    let cpu_count = sys
        .physical_core_count()
        .map(|v| v.to_string())
        .unwrap_or("NULL".to_owned());
    let info = format!("{} {} {}-CPU", name, os, cpu_count);

    (uptime, info)
}

pub async fn get_timer_metrics() -> Vec<(String, u64, Vec<(u64, u64, u64)>)> {
    let mut counter = TIMER_COUNTER.lock().await;
    let mut results = vec![];
    for (project, count) in counter.iter_mut() {
        results.push((
            project.clone(),
            count.time,
            vec![
                (count.free_http, 0, count.free_p2p),
                (count.ca_http, 0, count.ca_p2p),
                (count.payg_http, 0, count.payg_p2p),
            ],
        ));
        *count = QueryCounter::default(); // only report need clear
    }

    results
}

pub async fn get_owner_metrics() -> String {
    let mut registry = Registry::default();

    let family = OWNER_SUCCESS.lock().await;
    registry.register(FIELD_NAME_SUCCESS, "Count of success", (*family).clone());
    drop(family);

    let family = OWNER_FAILURE.lock().await;
    registry.register(FIELD_NAME_FAILURE, "Count of failure", (*family).clone());
    drop(family);

    let family = OWNER_TIME.lock().await;
    registry.register(FIELD_NAME_TIME, "Time of requests", (*family).clone());
    drop(family);

    let mut body = String::new();
    let _ = encode(&mut body, &registry);
    body
}

#[derive(Eq, PartialEq, Clone, Copy)]
pub enum MetricsQuery {
    Free,
    CloseAgreement,
    PAYG,
}

#[derive(Eq, PartialEq, Clone, Copy)]
pub enum MetricsNetwork {
    HTTP,
    P2P,
}

pub fn add_metrics_query(
    deployment: String,
    time: u64,
    query_type: MetricsQuery,
    network_type: MetricsNetwork,
    success: bool,
) {
    tokio::spawn(async move {
        #[rustfmt::skip]
        let (f0, f1, c0, c1, p0, p1) = match (query_type, network_type) {
            (MetricsQuery::Free, MetricsNetwork::HTTP)           => (1, 0, 0, 0, 0, 0),
            (MetricsQuery::Free, MetricsNetwork::P2P)            => (0, 1, 0, 0, 0, 0),
            (MetricsQuery::CloseAgreement, MetricsNetwork::HTTP) => (0, 0, 1, 0, 0, 0),
            (MetricsQuery::CloseAgreement, MetricsNetwork::P2P)  => (0, 0, 0, 1, 0, 0),
            (MetricsQuery::PAYG, MetricsNetwork::HTTP)           => (0, 0, 0, 0, 1, 0),
            (MetricsQuery::PAYG, MetricsNetwork::P2P)            => (0, 0, 0, 0, 0, 1),
        };
        let mut counter = TIMER_COUNTER.lock().await;
        counter
            .entry(deployment.clone())
            .and_modify(|f| {
                f.time += time;
                f.free_http += f0;
                f.free_p2p += f1;
                f.ca_http += c0;
                f.ca_p2p += c1;
                f.payg_http += p0;
                f.payg_p2p += p1;
            })
            .or_insert(QueryCounter {
                time,
                free_http: f0,
                free_p2p: f1,
                ca_http: c0,
                ca_p2p: c1,
                payg_http: p0,
                payg_p2p: p1,
            });
        drop(counter);

        let label = Labels { deployment };

        if success {
            let family = OWNER_SUCCESS.lock().await;
            family.get_or_create(&label).inc();
            drop(family);
        } else {
            let family = OWNER_FAILURE.lock().await;
            family.get_or_create(&label).inc();
            drop(family);
        }

        let family = OWNER_TIME.lock().await;
        family.get_or_create(&label).inc_by(time);
        drop(family);
    });
}
