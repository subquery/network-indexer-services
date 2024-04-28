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

use ethers::{
    abi::Token,
    providers::{Http, Provider},
    types::{Address, U256},
};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use subql_contracts::{
    consumer_host, consumer_host_parse, consumer_registry, l2_sqtoken_parse, plan_manager,
    service_agreement_registry,
};
use subql_indexer_utils::{error::Error, price_oracle::convert_price};
use tdn::prelude::PeerId;

use crate::cli::COMMAND;
use crate::payg::ConsumerType;

pub async fn check_agreement_and_consumer(
    signer: &str,
    aid: &str,
) -> Result<(bool, u64, u64), Error> {
    let client = Arc::new(
        Provider::<Http>::try_from(COMMAND.network_endpoint())
            .map_err(|_| Error::ServiceException(1022))?,
    );

    let plan = plan_manager(client.clone(), COMMAND.network())
        .map_err(|_| Error::ServiceException(1023))?;
    let agreement = service_agreement_registry(client, COMMAND.network())
        .map_err(|_| Error::ServiceException(1023))?;
    let agreement_id = U256::from_dec_str(aid).map_err(|_| Error::Serialize(1126))?;

    let info: Token = agreement
        .method::<_, Token>("getClosedServiceAgreement", (agreement_id,))
        .map_err(|_| Error::ServiceException(1024))?
        .call()
        .await
        .map_err(|_| Error::ServiceException(1024))?;
    let infos = match info {
        Token::Tuple(infos) => infos,
        _ => vec![],
    };
    // ClosedServiceAgreementInfo(
    //  consumer, indexer, deploymentId, lockedAmount, startDate, period, planId, plainTemplateId
    // )
    if infos.len() < 6 {
        return Err(Error::Serialize(1127));
    }
    let consumer = infos[0]
        .clone()
        .into_address()
        .ok_or(Error::Serialize(1128))?;
    let start = infos[4]
        .clone()
        .into_uint()
        .ok_or(Error::Serialize(1129))?
        .as_u64();
    let period = infos[5]
        .clone()
        .into_uint()
        .ok_or(Error::Serialize(1130))?
        .as_u64();
    let template_id = infos[7].clone().into_uint().ok_or(Error::Serialize(1137))?;
    let chain_consumer = format!("{:?}", consumer).to_lowercase();

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|s| s.as_secs())
        .unwrap_or(0);

    // check allowlist
    let allow = if chain_consumer != signer.to_lowercase() {
        let signer_address: Address = signer.parse().unwrap_or(Address::zero());
        check_consumer_controller(consumer, signer_address).await?
    } else {
        true
    };

    let checked = start <= now && now <= (start + period) && allow;
    let (daily, rate) = if checked {
        let plan_info: Token = plan
            .method::<_, Token>("getPlanTemplate", (template_id,))
            .map_err(|_| Error::ServiceException(1026))?
            .call()
            .await
            .map_err(|_| Error::ServiceException(1026))?;
        let infos = match plan_info {
            Token::Tuple(infos) => infos,
            _ => vec![],
        };
        // (_period, dailyReqCap, rateLimit, priceToken, _metadata, _active) = planManager.getPlanTemplate(_planTemplateId);
        if infos.len() < 3 {
            return Err(Error::Serialize(1133));
        }
        let daily = infos[1]
            .clone()
            .into_uint()
            .ok_or(Error::Serialize(1134))?
            .as_u64();
        let rate = infos[2]
            .clone()
            .into_uint()
            .ok_or(Error::Serialize(1135))?
            .as_u64();
        (daily, rate)
    } else {
        (0, 0)
    };

    Ok((checked, daily, rate))
}

pub async fn check_state_channel_consumer(
    consumer: Address,
    agent: Address,
) -> Result<ConsumerType, Error> {
    let (_abi, contract) =
        consumer_host_parse(COMMAND.network()).map_err(|_| Error::ServiceException(1023))?;

    if contract == agent {
        let client = Arc::new(
            Provider::<Http>::try_from(COMMAND.network_endpoint())
                .map_err(|_| Error::ServiceException(1022))?,
        );
        let host =
            consumer_host(client, COMMAND.network()).map_err(|_| Error::ServiceException(1023))?;

        let mut signers: Vec<Address> = vec![];
        signers.push(consumer);

        let token: Token = host
            .method::<_, Token>("getSigners", ())
            .map_err(|_| Error::ServiceException(1028))?
            .call()
            .await
            .map_err(|_| Error::ServiceException(1028))?;

        if let Some(ts) = token.into_array() {
            for t in ts {
                if let Some(address) = t.into_address() {
                    signers.push(address);
                }
            }
        }

        if !signers.is_empty() {
            Ok(ConsumerType::Host(signers))
        } else {
            Err(Error::Expired(1053))
        }
    } else {
        Ok(ConsumerType::Account(vec![consumer]))
    }
}

pub async fn get_consumer_host_peer() -> Result<PeerId, Error> {
    let client = Arc::new(
        Provider::<Http>::try_from(COMMAND.network_endpoint())
            .map_err(|_| Error::ServiceException(1022))?,
    );
    let host =
        consumer_host(client, COMMAND.network()).map_err(|_| Error::ServiceException(1023))?;

    let mut signers: Vec<Address> = vec![];
    let token: Token = host
        .method::<_, Token>("getSigners", ())
        .map_err(|_| Error::ServiceException(1028))?
        .call()
        .await
        .map_err(|_| Error::ServiceException(1028))?;

    if let Some(ts) = token.into_array() {
        for t in ts {
            if let Some(address) = t.into_address() {
                signers.push(address);
            }
        }
    }

    if !signers.is_empty() {
        let peer_id =
            PeerId::from_bytes(signers[0].as_bytes()).map_err(|_| Error::ServiceException(1023))?;
        Ok(peer_id)
    } else {
        Err(Error::ServiceException(1023))
    }
}

pub async fn check_consumer_controller(consumer: Address, signer: Address) -> Result<bool, Error> {
    let client = Arc::new(
        Provider::<Http>::try_from(COMMAND.network_endpoint())
            .map_err(|_| Error::ServiceException(1022))?,
    );

    let consumer_contract =
        consumer_registry(client, COMMAND.network()).map_err(|_| Error::ServiceException(1023))?;

    let is_controller: bool = consumer_contract
        .method::<_, bool>("isController", (consumer, signer))
        .map_err(|_| Error::ServiceException(1025))?
        .call()
        .await
        .map_err(|_| Error::ServiceException(1025))?;
    Ok(is_controller)
}

pub async fn check_convert_price(
    asset_from: Address,
    amount_from: U256,
    amount_to: U256,
) -> Result<bool, Error> {
    let client = Arc::new(
        Provider::<Http>::try_from(COMMAND.network_endpoint())
            .map_err(|_| Error::ServiceException(1022))?,
    );
    let network = COMMAND.network();

    let (_, sqt) = l2_sqtoken_parse(network).map_err(|_| Error::ServiceException(1023))?;
    let check_amount = convert_price(asset_from, sqt, amount_from, client, network).await?;

    Ok(amount_to >= check_amount)
}
