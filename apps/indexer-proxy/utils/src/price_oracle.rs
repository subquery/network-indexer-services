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
use subql_contracts::{price_contract_with_dynamic_address, settings, Network};

use crate::error::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, EthAbiType)]
#[repr(u8)]
pub enum SQContracts {
    SQToken,
    Staking,
    StakingManager,
    IndexerRegistry,
    ProjectRegistry,
    EraManager,
    PlanManager,
    ServiceAgreementRegistry,
    RewardsDistributor,
    RewardsPool,
    RewardsStaking,
    RewardsHelper,
    InflationController,
    Vesting,
    DisputeManager,
    StateChannel,
    ConsumerRegistry,
    PriceOracle,
    Treasury,
    RewardsBooster,
    StakingAllocation,
}

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

    let setting_contract =
        settings(client.clone(), network).map_err(|_| Error::ServiceException(1028))?;

    let price_contract_address: Address = setting_contract
        .method::<_, Address>("getContractAddress", (SQContracts::PriceOracle,))
        .map_err(|_| Error::ServiceException(1028))?
        .call()
        .await
        .map_err(|_| Error::ServiceException(1028))?;
    let price_contract =
        price_contract_with_dynamic_address(client.clone(), price_contract_address)
            .map_err(|_| Error::ServiceException(1028))?;

    price_contract
        .method::<_, U256>("convertPrice", (asset_from, asset_to, amount_from))
        .map_err(|_| Error::ServiceException(1028))?
        .call()
        .await
        .map_err(|_| Error::ServiceException(1028))
}
