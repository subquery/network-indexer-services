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

//! Pay-As-You-Go with state channel helper functions.

use base64::{engine::general_purpose, Engine as _};
use ethers::{
    abi::{encode, Token, Tokenizable},
    signers::Signer,
    types::{Address, Signature, H256, U256},
    utils::keccak256,
};
use rand_chacha::{
    rand_core::{RngCore, SeedableRng},
    ChaChaRng,
};
use serde_json::{json, Value};

use crate::error::Error;
use crate::tools::{cid_deployment, deployment_cid, hex_u256, u256_hex};

pub struct OpenState {
    pub channel_id: U256,
    pub indexer: Address,
    pub consumer: Address,
    pub total: U256,
    pub price: U256,
    pub expiration: U256,
    pub deployment_id: H256,
    pub callback: Vec<u8>,
    pub indexer_sign: Signature,
    pub consumer_sign: Signature,
    pub price_price: U256,
    pub price_token: Address,
    pub price_expired: i64,
    pub price_sign: Signature,
}

impl OpenState {
    pub async fn consumer_generate(
        channel_id: Option<U256>,
        indexer: Address,
        consumer: Address,
        total: U256,
        price: U256,
        expiration: U256,
        deployment_id: H256,
        callback: Vec<u8>,
        price_price: U256,
        price_token: Address,
        price_expired: i64,
        price_sign: Signature,
        key: &impl Signer,
    ) -> Result<Self, Error> {
        let channel_id = if let Some(channel_id) = channel_id {
            channel_id
        } else {
            let mut rng = ChaChaRng::from_entropy();
            let mut id = [0u64; 4]; // u256
            id[0] = rng.next_u64();
            id[1] = rng.next_u64();
            id[2] = rng.next_u64();
            id[3] = rng.next_u64();
            U256(id)
        };
        let mut state = Self {
            channel_id,
            indexer,
            consumer,
            total,
            price,
            expiration,
            deployment_id,
            callback,
            consumer_sign: default_sign(),
            indexer_sign: default_sign(),
            price_price,
            price_token,
            price_expired,
            price_sign,
        };
        state.sign(key, true).await?;
        Ok(state)
    }

    pub fn recover(&self) -> Result<(Address, Address), Error> {
        let payload = encode(&[
            self.channel_id.into_token(),
            self.indexer.into_token(),
            self.consumer.into_token(),
            self.total.into_token(),
            self.price.into_token(),
            self.expiration.into_token(),
            self.deployment_id.into_token(),
            Token::Bytes(self.callback.clone()),
        ]);
        let hash = keccak256(payload);
        let indexer = self.indexer_sign.recover(&hash[..])?;
        let consumer = self.consumer_sign.recover(&hash[..])?;
        Ok((indexer, consumer))
    }

    pub async fn sign(&mut self, key: &impl Signer, is_consumer: bool) -> Result<(), Error> {
        let payload = encode(&[
            self.channel_id.into_token(),
            self.indexer.into_token(),
            self.consumer.into_token(),
            self.total.into_token(),
            self.price.into_token(),
            self.expiration.into_token(),
            self.deployment_id.into_token(),
            Token::Bytes(self.callback.clone()),
        ]);
        let hash = keccak256(payload);
        let sign = key
            .sign_message(hash)
            .await
            .map_err(|_| Error::InvalidSignature(1041))?;
        if is_consumer {
            self.consumer_sign = sign;
        } else {
            self.indexer_sign = sign;
        }
        Ok(())
    }

    pub fn from_json(params: &Value) -> Result<Self, Error> {
        let channel_id: U256 =
            hex_u256(params["channelId"].as_str().ok_or(Error::Serialize(1106))?);
        let indexer: Address = params["indexer"]
            .as_str()
            .ok_or(Error::Serialize(1107))?
            .parse()
            .map_err(|_e| Error::Serialize(1107))?;
        let consumer: Address = params["consumer"]
            .as_str()
            .ok_or(Error::Serialize(1108))?
            .parse()
            .map_err(|_e| Error::Serialize(1108))?;
        let total = U256::from_dec_str(params["total"].as_str().ok_or(Error::Serialize(1109))?)
            .map_err(|_e| Error::Serialize(1109))?;
        let price = U256::from_dec_str(params["price"].as_str().ok_or(Error::Serialize(1110))?)
            .map_err(|_e| Error::Serialize(1110))?;
        let expiration = U256::from_dec_str(
            params["expiration"]
                .as_str()
                .ok_or(Error::Serialize(1111))?,
        )
        .map_err(|_e| Error::Serialize(1111))?;
        let deployment_id = cid_deployment(
            params["deploymentId"]
                .as_str()
                .ok_or(Error::Serialize(1112))?,
        );
        if deployment_id == H256::zero() {
            return Err(Error::Serialize(1112));
        }
        let callback = hex::decode(params["callback"].as_str().ok_or(Error::Serialize(1113))?)
            .map_err(|_e| Error::Serialize(1113))?;
        let indexer_sign: Signature = convert_string_to_sign(
            params["indexerSign"]
                .as_str()
                .ok_or(Error::Serialize(1114))?,
        );
        let consumer_sign: Signature = convert_string_to_sign(
            params["consumerSign"]
                .as_str()
                .ok_or(Error::Serialize(1115))?,
        );

        let price_price: U256 = if params.get("pricePrice").is_some() {
            U256::from_dec_str(
                params["pricePrice"]
                    .as_str()
                    .ok_or(Error::Serialize(1110))?,
            )
            .map_err(|_e| Error::Serialize(1110))?
        } else {
            price
        };
        let price_token: Address = if params.get("priceToken").is_some() {
            params["priceToken"]
                .as_str()
                .ok_or(Error::Serialize(1137))?
                .parse()
                .map_err(|_e| Error::Serialize(1137))?
        } else {
            Address::default()
        };

        let price_expired: i64 = if params.get("priceExpired").is_some() {
            params["priceExpired"]
                .as_i64()
                .ok_or(Error::Serialize(1138))?
        } else {
            0
        };

        let price_sign: Signature = if params.get("priceSign").is_some() {
            convert_string_to_sign(params["priceSign"].as_str().ok_or(Error::Serialize(1139))?)
        } else {
            default_sign()
        };

        Ok(Self {
            channel_id,
            indexer,
            consumer,
            total,
            price,
            expiration,
            deployment_id,
            callback,
            indexer_sign,
            consumer_sign,
            price_price,
            price_token,
            price_expired,
            price_sign,
        })
    }

    pub fn to_json(&self) -> Value {
        json!({
            "channelId": u256_hex(&self.channel_id),
            "indexer": format!("{:?}", self.indexer),
            "consumer": format!("{:?}", self.consumer),
            "total": self.total.to_string(),
            "price": self.price.to_string(),
            "expiration": self.expiration.to_string(),
            "deploymentId": deployment_cid(&self.deployment_id),
            "callback": hex::encode(&self.callback),
            "indexerSign": convert_sign_to_string(&self.indexer_sign),
            "consumerSign": convert_sign_to_string(&self.consumer_sign),
            "pricePrice": self.price_price.to_string(),
            "priceToken": format!("{:?}", self.price_token),
            "priceExpired": self.price_expired,
            "priceSign": convert_sign_to_string(&self.price_sign)
        })
    }
}

pub struct QueryState {
    pub channel_id: U256,
    pub indexer: Address,
    pub consumer: Address,
    pub spent: U256,
    pub remote: U256,
    pub is_final: bool,
    pub indexer_sign: Signature,
    pub consumer_sign: Signature,
}

impl QueryState {
    pub async fn consumer_generate(
        channel_id: U256,
        indexer: Address,
        consumer: Address,
        spent: U256,
        is_final: bool,
        key: &impl Signer,
    ) -> Result<Self, Error> {
        let mut state = Self {
            channel_id,
            indexer,
            consumer,
            spent,
            is_final,
            remote: spent,
            consumer_sign: default_sign(),
            indexer_sign: default_sign(),
        };
        state.sign(key, true).await?;
        Ok(state)
    }

    pub fn recover(&self) -> Result<(Address, Address), Error> {
        let payload = encode(&[
            self.channel_id.into_token(),
            self.spent.into_token(),
            self.is_final.into_token(),
        ]);
        let hash = keccak256(payload);
        let indexer = self.indexer_sign.recover(&hash[..])?;
        let consumer = self.consumer_sign.recover(&hash[..])?;
        Ok((indexer, consumer))
    }

    pub async fn sign(&mut self, key: &impl Signer, is_consumer: bool) -> Result<(), Error> {
        let payload = encode(&[
            self.channel_id.into_token(),
            self.spent.into_token(),
            self.is_final.into_token(),
        ]);
        let hash = keccak256(payload);
        let sign = key
            .sign_message(hash)
            .await
            .map_err(|_| Error::InvalidSignature(1041))?;
        if is_consumer {
            self.consumer_sign = sign;
        } else {
            self.indexer_sign = sign;
        }
        Ok(())
    }

    pub fn from_json(params: &Value) -> Result<Self, Error> {
        let channel_id: U256 =
            hex_u256(params["channelId"].as_str().ok_or(Error::Serialize(1106))?);
        let indexer: Address = params["indexer"]
            .as_str()
            .ok_or(Error::Serialize(1107))?
            .parse()
            .map_err(|_e| Error::Serialize(1107))?;
        let consumer: Address = params["consumer"]
            .as_str()
            .ok_or(Error::Serialize(1108))?
            .parse()
            .map_err(|_e| Error::Serialize(1108))?;
        let spent = U256::from_dec_str(params["spent"].as_str().ok_or(Error::Serialize(1116))?)
            .map_err(|_e| Error::Serialize(1116))?;
        let remote = U256::from_dec_str(params["remote"].as_str().ok_or(Error::Serialize(1117))?)
            .map_err(|_e| Error::Serialize(1117))?;
        let is_final = params["isFinal"].as_bool().ok_or(Error::Serialize(1118))?;
        let indexer_sign: Signature = convert_string_to_sign(
            params["indexerSign"]
                .as_str()
                .ok_or(Error::Serialize(1114))?,
        );
        let consumer_sign: Signature = convert_string_to_sign(
            params["consumerSign"]
                .as_str()
                .ok_or(Error::Serialize(1115))?,
        );
        Ok(Self {
            channel_id,
            indexer,
            consumer,
            spent,
            remote,
            is_final,
            indexer_sign,
            consumer_sign,
        })
    }

    pub fn to_json(&self) -> Value {
        json!({
            "channelId": u256_hex(&self.channel_id),
            "indexer": format!("{:?}", self.indexer),
            "consumer": format!("{:?}", self.consumer),
            "spent": self.spent.to_string(),
            "remote": self.remote.to_string(),
            "isFinal": self.is_final,
            "indexerSign": convert_sign_to_string(&self.indexer_sign),
            "consumerSign": convert_sign_to_string(&self.consumer_sign),
        })
    }

    pub fn from_bs64(params: String) -> Result<Self, Error> {
        let raw = general_purpose::STANDARD
            .decode(&params)
            .map_err(|_e| Error::Serialize(1116))?;

        if raw.len() != 267 {
            return Err(Error::Serialize(1116));
        }

        let channel_id = U256::from_big_endian(&raw[0..32]);
        let indexer = Address::from_slice(&raw[32..52]);
        let consumer = Address::from_slice(&raw[52..72]);
        let spent = U256::from_big_endian(&raw[72..104]);
        let remote = U256::from_big_endian(&raw[104..136]);
        let is_final = raw[136] != 0;
        let indexer_sign = convert_bytes_to_sign(raw[137..202].to_vec());
        let consumer_sign = convert_bytes_to_sign(raw[202..267].to_vec());

        Ok(Self {
            channel_id,
            indexer,
            consumer,
            spent,
            remote,
            is_final,
            indexer_sign,
            consumer_sign,
        })
    }

    pub fn to_bs64(&self) -> String {
        let mut bytes = [0u8; 267];
        self.channel_id.to_big_endian(&mut bytes[0..32]);
        bytes[32..52].copy_from_slice(self.indexer.as_fixed_bytes());
        bytes[52..72].copy_from_slice(self.consumer.as_fixed_bytes());
        self.spent.to_big_endian(&mut bytes[72..104]);
        self.remote.to_big_endian(&mut bytes[104..136]);
        bytes[136] = self.is_final as u8;
        bytes[137..202].copy_from_slice(&convert_sign_to_bytes(&self.indexer_sign));
        bytes[202..267].copy_from_slice(&convert_sign_to_bytes(&self.consumer_sign));
        general_purpose::STANDARD.encode(&bytes)
    }

    pub fn from_bs64_old1(auth: String) -> Result<Self, Error> {
        let raw = general_purpose::STANDARD
            .decode(&auth)
            .map(|v| String::from_utf8(v).unwrap_or(auth.clone()))
            .unwrap_or(auth);
        let value =
            serde_json::from_str::<Value>(&raw).map_err(|_| Error::InvalidAuthHeader(1031))?;
        QueryState::from_json(&value)
    }

    pub fn to_bs64_old1(&self) -> String {
        let s = serde_json::to_string(&self.to_json()).unwrap_or("".to_owned());
        general_purpose::STANDARD.encode(s)
    }

    pub fn from_bs64_old2(auth: String) -> Result<Self, Error> {
        let raw = general_purpose::STANDARD.decode(&auth).unwrap_or(vec![]);
        let value =
            serde_json::from_slice::<Value>(&raw).map_err(|_| Error::InvalidAuthHeader(1031))?;
        QueryState::from_json(&value)
    }

    pub fn to_bs64_old2(&self) -> String {
        let json_state = serde_json::to_vec(&self.to_json()).unwrap_or(vec![]);
        general_purpose::STANDARD.encode(json_state)
    }
}

pub async fn fund_sign(
    channel: U256,
    indexer: Address,
    consumer: Address,
    pretotal: U256,
    amount: U256,
    callback: Vec<u8>,
    key: &impl Signer,
) -> Result<Signature, Error> {
    let payload = encode(&[
        channel.into_token(),
        indexer.into_token(),
        consumer.into_token(),
        pretotal.into_token(),
        amount.into_token(),
        Token::Bytes(callback),
    ]);
    let hash = keccak256(payload);
    key.sign_message(hash)
        .await
        .map_err(|_| Error::InvalidSignature(1041))
}

pub fn extend_recover(
    channel: U256,
    indexer: Address,
    consumer: Address,
    preexpiration: U256,
    expiration: U256,
    sign: Signature,
) -> Result<Address, Error> {
    let payload = encode(&[
        channel.into_token(),
        indexer.into_token(),
        consumer.into_token(),
        preexpiration.into_token(),
        expiration.into_token(),
    ]);
    let hash = keccak256(payload);
    Ok(sign.recover(&hash[..])?)
}

pub async fn extend_sign(
    channel: U256,
    indexer: Address,
    consumer: Address,
    preexpiration: U256,
    expiration: U256,
    key: &impl Signer,
) -> Result<Signature, Error> {
    let payload = encode(&[
        channel.into_token(),
        indexer.into_token(),
        consumer.into_token(),
        preexpiration.into_token(),
        expiration.into_token(),
    ]);
    let hash = keccak256(payload);
    key.sign_message(hash)
        .await
        .map_err(|_| Error::InvalidSignature(1041))
}

pub fn default_sign() -> Signature {
    Signature {
        v: 0,
        r: U256::from(0),
        s: U256::from(0),
    }
}

/// Convert eth signature to string.
pub fn convert_sign_to_string(sign: &Signature) -> String {
    let bytes = convert_sign_to_bytes(sign);
    hex::encode(bytes)
}

/// Convert string to eth signature.
pub fn convert_string_to_sign(s: &str) -> Signature {
    let bytes = hex::decode(s).unwrap_or(vec![0u8; 65]); // 32 + 32 + 1
    convert_bytes_to_sign(bytes)
}

/// Convert eth signature to bytes.
pub fn convert_sign_to_bytes(sign: &Signature) -> [u8; 65] {
    let mut bytes = <[u8; 65]>::from(sign);
    let mut recovery_id = match sign.v {
        27 => 0,
        28 => 1,
        v if v >= 35 => ((v - 1) % 2) as u8,
        _ => sign.v as u8,
    };
    recovery_id += 27; // Because in ETH.
    bytes[64] = recovery_id;
    bytes
}

/// Convert bytes to eth signature.
pub fn convert_bytes_to_sign(mut bytes: Vec<u8>) -> Signature {
    if bytes.len() < 65 {
        bytes.extend(vec![0u8; 65 - bytes.len()]);
    }

    let r = U256::from_big_endian(&bytes[0..32]);
    let s = U256::from_big_endian(&bytes[32..64]);
    let v = bytes[64] as u64;
    Signature { r, s, v }
}

pub fn price_recover(
    price: U256,
    token: Address,
    expired: i64,
    sign: Signature,
) -> Result<Address, Error> {
    let payload = encode(&[price.into_token(), token.into_token(), expired.into_token()]);
    let hash = keccak256(payload);
    let signer = sign.recover(&hash[..])?;
    Ok(signer)
}

pub async fn price_sign(
    price: U256,
    token: Address,
    expired: i64,
    key: &impl Signer,
) -> Result<Signature, Error> {
    let payload = encode(&[price.into_token(), token.into_token(), expired.into_token()]);
    let hash = keccak256(payload);
    let sign = key
        .sign_message(hash)
        .await
        .map_err(|_| Error::InvalidSignature(1041))?;
    Ok(sign)
}

#[derive(Copy, Clone, Debug)]
pub enum MultipleQueryStateActive {
    Active,
    Inactive1,
    Inactive2,
}

impl MultipleQueryStateActive {
    pub fn is_inactive(&self) -> bool {
        match self {
            MultipleQueryStateActive::Active => false,
            MultipleQueryStateActive::Inactive1 => false,
            MultipleQueryStateActive::Inactive2 => true,
        }
    }

    pub fn to_byte(&self) -> u8 {
        match self {
            MultipleQueryStateActive::Active => 0,
            MultipleQueryStateActive::Inactive1 => 1,
            MultipleQueryStateActive::Inactive2 => 2,
        }
    }

    pub fn from_byte(byte: u8) -> Self {
        match byte {
            0u8 => MultipleQueryStateActive::Active,
            1u8 => MultipleQueryStateActive::Inactive1,
            _ => MultipleQueryStateActive::Inactive2,
        }
    }
}

// 100 000000000000000000 (100 SQT)
pub const MULTIPLE_RANGE_MAX: U256 = U256([7766279631452241920, 5, 0, 0]);

#[derive(Debug)]
pub struct MultipleQueryState {
    pub active: MultipleQueryStateActive,
    pub channel_id: U256,
    pub start: U256,
    pub end: U256,
    pub sign: Signature,
}

impl MultipleQueryState {
    pub async fn consumer_generate(
        channel_id: U256,
        start: U256,
        end: U256,
        key: &impl Signer,
    ) -> Result<Self, Error> {
        let mut state = Self {
            active: MultipleQueryStateActive::Active,
            channel_id,
            start,
            end,
            sign: default_sign(),
        };
        state.sign(key, MultipleQueryStateActive::Active).await?;
        Ok(state)
    }

    pub async fn indexer_generate(
        active: MultipleQueryStateActive,
        channel_id: U256,
        start: U256,
        end: U256,
        key: &impl Signer,
    ) -> Result<Self, Error> {
        let mut state = Self {
            active,
            channel_id,
            start,
            end,
            sign: default_sign(),
        };
        state.sign(key, active).await?;
        Ok(state)
    }

    pub fn recover(&self) -> Result<Address, Error> {
        let payload = encode(&[
            self.active.to_byte().into_token(),
            self.channel_id.into_token(),
            self.start.into_token(),
            self.end.into_token(),
        ]);
        let hash = keccak256(payload);
        let signer = self.sign.recover(&hash[..])?;
        Ok(signer)
    }

    pub async fn sign(
        &mut self,
        key: &impl Signer,
        active: MultipleQueryStateActive,
    ) -> Result<(), Error> {
        self.active = active;
        let payload = encode(&[
            self.active.to_byte().into_token(),
            self.channel_id.into_token(),
            self.start.into_token(),
            self.end.into_token(),
        ]);
        let hash = keccak256(payload);
        let sign = key
            .sign_message(hash)
            .await
            .map_err(|_| Error::InvalidSignature(1041))?;
        self.sign = sign;
        Ok(())
    }

    pub fn from_bs64(params: String) -> Result<Self, Error> {
        let raw = general_purpose::STANDARD
            .decode(&params)
            .map_err(|_e| Error::Serialize(1116))?;

        if raw.len() != 162 {
            return Err(Error::Serialize(1116));
        }

        let active = MultipleQueryStateActive::from_byte(raw[0]);
        let channel_id = U256::from_big_endian(&raw[1..33]);
        let start = U256::from_big_endian(&raw[33..65]);
        let end = U256::from_big_endian(&raw[65..97]);
        let sign = convert_bytes_to_sign(raw[97..].to_vec());

        Ok(Self {
            active,
            channel_id,
            start,
            end,
            sign,
        })
    }

    pub fn to_bs64(&self) -> String {
        let mut bytes = [0u8; 162];
        bytes[0] = self.active.to_byte();
        self.channel_id.to_big_endian(&mut bytes[1..33]);
        self.start.to_big_endian(&mut bytes[33..65]);
        self.end.to_big_endian(&mut bytes[65..97]);
        bytes[97..].copy_from_slice(&convert_sign_to_bytes(&self.sign));

        general_purpose::STANDARD.encode(&bytes)
    }
}
