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

use http::header::{HeaderName, CONTENT_TYPE, USER_AGENT};
use once_cell::sync::Lazy;

// encode proxy(u32) & coordinator(u32)
pub fn encode_proxy_version(version: [u8; 4]) -> u32 {
    u32::from_le_bytes(version)
}

// decode u32 versiont to string (v0.1.0-0)
pub fn decode_proxy_version(v: u32) -> String {
    if v == 0 {
        return "latest".to_owned();
    }

    let bytes = v.to_le_bytes();
    if bytes[3] == 0 {
        format!("v{}.{}.{}", bytes[0], bytes[1], bytes[2])
    } else {
        format!("v{}.{}.{}-{}", bytes[0], bytes[1], bytes[2], bytes[3])
    }
}

pub const APPLICATION_JSON: &str = "application/json";

pub const KEEP_ALIVE: &str = "Keep-Alive";

pub const AUTHORIZATION: &str = "Authorization";

pub static HEADERS: Lazy<[HeaderName; 5]> = Lazy::new(|| {
    [
        CONTENT_TYPE,
        USER_AGENT,
        HeaderName::from_static("authorization"),
        HeaderName::from_static("agent"),
        HeaderName::from_static("x-apollo-tracing"),
    ]
});

pub const TELEMETRIES_MAINNET: [&str; 2] = [
    "0x41526BE3CDe4b0ff39A4A2908Af3527a703E9fDa", // MAINNET, metrics account
    "0xec373af3d916928a691ce8ade6e5dcac07d29345", // MAINNET, temp metrics account
];

pub const TELEMETRIES_KEPLER: [&str; 1] = [
    "0x740BD38d229C01Fe569071D4132E8851b3011DF0", // KEPLER
];

pub const TELEMETRIES_TESTNET: [&str; 4] = [
    "0x41526BE3CDe4b0ff39A4A2908Af3527a703E9fDa", // TESTNET, metrics account
    "0xb351A9F7e138a37090cA7659816A04c871B15451", // DEV
    "0x293a6d85DD0d7d290A719Fdeef43FaD10240bA77", // DEV
    "0xec373af3d916928a691ce8ade6e5dcac07d29345", // DEV, temp metrics account
];

pub const BOOTSTRAP: [&str; 5] = [
    "/ip4/142.215.53.35/tcp/7370",
    "/ip4/8.219.198.62/tcp/7371",
    "/ip4/8.219.198.62/quic/7370",
    "/ip4/154.91.1.165/tcp/7371",
    "/ip4/154.91.1.165/quic/7370",
];
