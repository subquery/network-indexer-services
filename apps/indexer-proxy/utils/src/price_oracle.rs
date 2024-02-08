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

use ethers::prelude::*;
use std::sync::Arc;
use subql_contracts::{price_oracle, Network};

use crate::error::Error;

pub async fn convert_price<M: Middleware>(
    asset_from: Address,
    asset_to: Address,
    amount_from: U256,
    client: Arc<M>,
    network: Network,
) -> Result<U256, Error> {
    if asset_from == Address::default() || asset_from == asset_to {
        return Ok(amount_from);
    }

    let contract = price_oracle(client, network).map_err(|_| Error::ServiceException(1023))?;

    contract
        .method::<_, U256>("convertPrice", (asset_from, asset_to, amount_from))
        .map_err(|_| Error::ServiceException(1028))?
        .call()
        .await
        .map_err(|_| Error::ServiceException(1028))
}
