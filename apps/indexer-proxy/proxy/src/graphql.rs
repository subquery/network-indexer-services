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

pub const METADATA_QUERY: &str = r#"query {
  _metadata {
    lastProcessedHeight
    lastProcessedTimestamp
    startHeight
    targetHeight
    chain
    specName
    genesisHash
    indexerHealthy
    indexerNodeVersion
    queryNodeVersion
    indexerHealthy
    chain
  }
}"#;

pub const ACCOUNT_QUERY: &str = "query { accountMetadata { indexer encryptedKey } }";

pub const VERSION_QUERY: &str = "query { getServicesVersion { coordinator } }";

pub const PROJECT_QUERY: &str = "query { getAliveProjects { id queryEndpoint nodeEndpoint } }";

pub const PAYG_QUERY: &str = "query { getAlivePaygs { id price token expiration overflow } }";

pub const CHANNEL_QUERY: &str =
    "query { getAliveChannels { id consumer agent total spent remote price lastFinal expiredAt } }";

pub fn poi_with_block(block: u64) -> String {
    format!(
        r#"query {{
    _poi (id:{}) {{
      id
      chainBlockHash
      hash
      parentHash
      operationHashRoot
    }}
}}"#,
        block
    )
}
