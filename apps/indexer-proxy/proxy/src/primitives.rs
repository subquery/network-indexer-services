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

/// waiting time (seconds) for p2p network restart
pub const P2P_RESTART_TIME: u64 = 5;

/// broadcast healthy time: 1min = 3600s
pub const P2P_BROADCAST_HEALTHY_TIME: u64 = 3600;

/// report metrics time: 1h = 3600s
pub const P2P_METRICS_TIME: u64 = 1200;

/// check stable connections time: 2h = 7200s
pub const P2P_STABLE_TIME: u64 = 7200;

/// init report status to coordinator time: 10s
pub const MONITOR_INIT_TIME: u64 = 10;

/// loop report status to coordinator time: 1min = 60s
pub const MONITOR_LOOP_TIME: u64 = 60;

/// loop report metrics to coordinator time: 3min = 180s
pub const METRICS_LOOP_TIME: u64 = 180;

/// subscriber loop time (no account and projects): 10s
pub const SUBSCRIBER_INIT_TIME: u64 = 10;

/// subscriber loop time (had account and projects): 2min=120s
pub const SUBSCRIBER_LOOP_TIME: u64 = 120;

/// project new to network waiting time: 10s
pub const PROJECT_JOIN_TIME: u64 = 10;
