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

use serde::{Deserialize, Serialize};

/// "SubQuery" hash to group id as root group id.
pub const ROOT_GROUP_ID: u64 = 12408845626691334533;

/// Root name for projects
pub const ROOT_NAME: &str = "SubQuery";

#[derive(Serialize, Deserialize, Debug)]
pub struct JoinData(pub Vec<String>);

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Event {
    /// Report project healthy,
    /// params: Json(indexer, controller, version, uptime, os)
    IndexerHealthy(String),
    /// Project join
    ProjectJoin(u64),
    /// Project join response
    ProjectJoinRes,
    /// Project leave
    ProjectLeave,
    /// Request the project poi,
    /// params: project, poi block hash
    ProjectMetadata(String, Option<u64>),
    /// Response project poi
    /// params: project poi
    ProjectMetadataRes(String),
    /// Report indexer services status,
    /// params: project or all
    PaygPrice(Option<String>),
    /// Report indexer services status,
    /// params: payg price/1000 query
    PaygPriceRes(String),
    /// Open the state channel channel,
    /// params: uid, open state
    PaygOpen(u64, String),
    /// Response the channel open,
    /// params: uid, open state
    PaygOpenRes(u64, String),
    /// Query data the by channel,
    /// params: uid, query, ep_name, state
    PaygQuery(u64, String, Option<String>, String),
    /// Response the channel query,
    /// params: uid, data with state
    PaygQueryRes(u64, String),
    /// Query the close agreement limit,
    /// params: uid, agreement id
    CloseAgreementLimit(u64, String),
    /// Response the close agreement limit
    /// params: uid, agreement info
    CloseAgreementLimitRes(u64, String),
    /// Query data by close agreement,
    /// params: uid, agreement, query, ep_name
    CloseAgreementQuery(u64, String, String, Option<String>),
    /// Response the close agreement query,
    /// params: uid, data
    CloseAgreementQueryRes(u64, String),
    /// Report project query log to whitelist use root group id, every 30min, time is ms.
    /// params: indexer, [
    ///   project(String),
    ///   query_total_time(u64),
    ///   query_total_with_time(u64),
    ///   [
    ///     (close_agreement_count_http(u64), close_agreement_count_ws(u64), close_agreement_count_p2p(u64)),
    ///     (payg_count_http(u64), payg_count_ws(u64), payg_count_p2p(u64)),
    ///     (whitelist_http(u64)), whitelitst_ws(u64), whitelist_p2p(u64))
    ///   ],
    /// ]
    MetricsQueryCount(String, Vec<(String, u64, Vec<(u64, u64, u64)>)>),
    /// Report payg conflict info
    /// params: indexer, DeploymentId, channel, total conflict, start time, end time.
    MetricsPaygConflict(String, String, String, i32, i64, i64),
    /// above
    MetricsQueryCount2(String, Vec<(String, u64, u64, Vec<(u64, u64, u64)>)>),
}

impl Event {
    pub fn to_bytes(&self) -> Vec<u8> {
        bincode::serialize(self).unwrap_or(vec![])
    }

    pub fn from_bytes(data: &[u8]) -> std::io::Result<Self> {
        bincode::deserialize(data).map_err(|_| {
            std::io::Error::new(std::io::ErrorKind::Other, "P2P Event deserialize failure")
        })
    }
}
