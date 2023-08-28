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

use ethers::types::{
    transaction::eip712::{EIP712Domain, Eip712, Eip712DomainType, TypedData},
    Signature,
};
use std::collections::BTreeMap;

use crate::error::Error;

pub fn recover_signer(message: String, sign_str: &str) -> Result<String, Error> {
    let signature: Signature = sign_str.parse().map_err(|_| Error::Serialize(1104))?;
    let address = signature.recover(message);
    Ok(format!("{:02x?}", address))
}

pub fn recover_indexer_token_payload(
    indexer: &str,
    deployment_id: &str,
    timestamp: i64,
    chain_id: i64,
    sign_str: &str,
) -> Result<String, Error> {
    let mut types = BTreeMap::new();
    types.insert(
        "EIP712Domain".to_owned(),
        vec![
            Eip712DomainType {
                name: "name".to_owned(),
                r#type: "string".to_owned(),
            },
            Eip712DomainType {
                name: "chainId".to_owned(),
                r#type: "uint256".to_owned(),
            },
        ],
    );
    types.insert(
        "messageType".to_owned(),
        vec![
            Eip712DomainType {
                name: "indexer".to_owned(),
                r#type: "address".to_owned(),
            },
            Eip712DomainType {
                name: "timestamp".to_owned(),
                r#type: "uint256".to_owned(),
            },
            Eip712DomainType {
                name: "deploymentId".to_owned(),
                r#type: "string".to_owned(),
            },
        ],
    );
    let mut message = BTreeMap::new();
    message.insert("indexer".to_owned(), indexer.into());
    message.insert("timestamp".to_owned(), timestamp.into());
    message.insert("deploymentId".to_owned(), deployment_id.into());

    let signature: Signature = sign_str.parse().map_err(|_| Error::Serialize(1104))?;

    let type_data = TypedData {
        types,
        message,
        domain: EIP712Domain {
            name: Some("Subquery".to_owned()),
            version: None,
            chain_id: Some(chain_id.into()),
            verifying_contract: None,
            salt: None,
        },
        primary_type: "messageType".to_owned(),
    };
    let msg = type_data
        .encode_eip712()
        .map_err(|_| Error::Serialize(1105))?;
    let address = signature
        .recover(msg)
        .map_err(|_| Error::InvalidSignature(1040))?;
    Ok(format!("{:02x?}", address))
}

pub fn recover_consumer_token_payload(
    consumer: &str,
    indexer: &str,
    agreement: &str,
    deployment_id: &str,
    timestamp: i64,
    chain_id: i64,
    sign_str: &str,
) -> Result<String, Error> {
    let mut types = BTreeMap::new();
    types.insert(
        "EIP712Domain".to_owned(),
        vec![
            Eip712DomainType {
                name: "name".to_owned(),
                r#type: "string".to_owned(),
            },
            Eip712DomainType {
                name: "chainId".to_owned(),
                r#type: "uint256".to_owned(),
            },
        ],
    );
    types.insert(
        "messageType".to_owned(),
        vec![
            Eip712DomainType {
                name: "consumer".to_owned(),
                r#type: "address".to_owned(),
            },
            Eip712DomainType {
                name: "indexer".to_owned(),
                r#type: "address".to_owned(),
            },
            Eip712DomainType {
                name: "agreement".to_owned(),
                r#type: "string".to_owned(),
            },
            Eip712DomainType {
                name: "timestamp".to_owned(),
                r#type: "uint256".to_owned(),
            },
            Eip712DomainType {
                name: "deploymentId".to_owned(),
                r#type: "string".to_owned(),
            },
        ],
    );
    let mut message = BTreeMap::new();
    message.insert("consumer".to_owned(), consumer.into());
    message.insert("indexer".to_owned(), indexer.into());
    message.insert("agreement".to_owned(), agreement.into());
    message.insert("timestamp".to_owned(), timestamp.into());
    message.insert("deploymentId".to_owned(), deployment_id.into());

    let signature: Signature = sign_str.parse().map_err(|_| Error::Serialize(1104))?;

    let type_data = TypedData {
        types,
        message,
        domain: EIP712Domain {
            name: Some("Subquery".to_owned()),
            version: None,
            chain_id: Some(chain_id.into()),
            verifying_contract: None,
            salt: None,
        },
        primary_type: "messageType".to_owned(),
    };
    let msg = type_data
        .encode_eip712()
        .map_err(|_| Error::Serialize(1105))?;
    let address = signature
        .recover(msg)
        .map_err(|_| Error::InvalidSignature(1040))?;
    Ok(format!("{:02x?}", address))
}

#[test]
fn test_recover() {
    let agreement = "11";
    let chain_id = 80001;
    let consumer = "0x58C67330ab1b9A26897E5357EE4d92E6eF631Bb4";
    let deployment_id = "QmSjjRjfjXXEfSUTheNwvWcBaH54pWoToTHPDsJRby955X";
    let indexer = "0xCef192586b70e3Fc2FAD76Dd1D77983a30d38D04";
    let signature = "6b8c92cf933971345e0b0ba958a1f6412f2803e9a1a0bdb37301ebf45ce7d12146b8b6eb2e17beebfc54194d4ade58c923729887adbd84370c9e4bf87fe54c9c1b";
    let timestamp = 1678332289052;

    let signer = recover_consumer_token_payload(
        consumer,
        indexer,
        agreement,
        deployment_id,
        timestamp,
        chain_id,
        signature,
    )
    .unwrap();
    assert_eq!(signer.to_lowercase(), consumer.to_lowercase());
}
