use chrono::prelude::*;
use ethers::{
    prelude::*,
    types::transaction::eip712::{EIP712Domain, Eip712, Eip712DomainType, TypedData},
};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::env::args;
use subql_contracts::CURRENT_NETWORK;

fn payload_712(indexer: &str, deployment_id: &str, timestamp: i64, chain_id: i64) -> [u8; 32] {
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
    type_data.encode_eip712().unwrap()
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    if args().len() != 5 {
        println!("cargo run --example free-query url indexer deployment CONSUMERSKXXX");
        return Ok(());
    }

    let url = args().nth(1).unwrap();
    let indexer = args().nth(2).unwrap();
    let deployment = args().nth(3).unwrap();
    let private_key = args().nth(4).unwrap();
    let signer = private_key.parse::<LocalWallet>().unwrap();

    if let Ok(token) = get_token(
        url.clone(),
        indexer.clone(),
        deployment.clone(),
        signer.clone(),
    )
    .await
    {
        get_price(url.clone(), token.clone()).await;
        println!();
        println!();
        println!();
        open_channel(url, indexer, deployment, signer, token.clone()).await;
    } else {
        println!("wrong argument, failed to get token");
    }
    Ok(())
}

async fn get_token(
    url: String,
    indexer: String,
    deployment: String,
    signer: LocalWallet,
) -> Result<String, ()> {
    let consumer = format!("{:?}", signer.address());
    let timestamp = Utc::now().timestamp_millis();
    let chain_id = CURRENT_NETWORK.config().chain_id as i64;
    let msg = payload_712(&indexer, &deployment, timestamp, chain_id);
    let sign = hex::encode(signer.sign_hash(msg.into()).unwrap().to_vec());

    let mut payload = HashMap::new();
    payload.insert("indexer", Value::String(indexer));
    payload.insert("consumer", Value::String(consumer));
    payload.insert("deployment_id", Value::String(deployment.clone()));
    payload.insert("signature", Value::String(sign));
    payload.insert("timestamp", timestamp.into());
    payload.insert("chain_id", chain_id.into());

    let client = reqwest::Client::new();
    let token_url = format!("{}/token", url);
    let res = client.post(token_url).json(&payload).send().await.unwrap();
    let token: serde_json::Value = res.json().await.unwrap();
    if token.get("token").is_some() {
        Ok(token["token"].to_string())
    } else {
        Err(())
    }
}

pub async fn open_channel(
    url: String,
    indexer: String,
    deployment: String,
    signer: LocalWallet,
    token: String,
) {
    let query_token = format!("Bearer {}", token);
    let payg_open_url = format!("{}/payg-open", url);
    let timestamp = Utc::now().timestamp_millis();
    let chain_id = CURRENT_NETWORK.config().chain_id as i64;
    let msg = payload_712(&indexer, &deployment, timestamp, chain_id);
    let sign = hex::encode(signer.sign_hash(msg.into()).unwrap().to_vec());

    let mut payload = HashMap::new();
    payload.insert("deployment_id", Value::String(deployment.clone()));
    payload.insert("indexer", Value::String(indexer));
    // TODO
    payload.insert("sign", Value::String(sign.clone()));
    payload.insert("signature", Value::String(sign.clone()));
    payload.insert("timestamp", timestamp.into());
    payload.insert("price_expired", 1000.into());
    payload.insert("price_price", 10000.into());
    payload.insert("price_token", 10000.into());
    payload.insert("price_sign", Value::String(sign));
    payload.insert("price", 100.into());
    payload.insert("expiration", 100.into());

    let client = reqwest::Client::new();
    let r = client
        .post(payg_open_url)
        .header("Authorization", query_token.clone())
        .json(&payload)
        .send()
        .await
        .unwrap();
    let res: serde_json::Value = r.json().await.unwrap();
    println!("Res {}", res);
}

pub async fn extend_channel(
    url: String,
    indexer: String,
    deployment: String,
    token: String,
    channel: String,
) {
    let query_token = format!("Bearer {}", token);
    let extend_channel_url = format!("{}/payg-extend/{}", url, channel);

    let mut payload = HashMap::new();
    payload.insert("deployment_id", Value::String(deployment.clone()));
    payload.insert("indexer", Value::String(indexer));
    // TODO
    payload.insert("price", 1000.into());
    payload.insert("expired", 1000.into());
    payload.insert("expiration", 1000.into());
    payload.insert("signature2", 1000.into());

    let client = reqwest::Client::new();
    let r = client
        .post(extend_channel_url)
        .header("Authorization", query_token.clone())
        .json(&payload)
        .send()
        .await
        .unwrap();
    let res: serde_json::Value = r.json().await.unwrap();
    println!("Res {}", res);
}

async fn get_price(url: String, token: String) {
    let query_token = format!("Bearer {}", token);
    let payg_price_url = format!("{}/payg-price", url);
    let client = reqwest::Client::new();
    let r = client
        .get(payg_price_url)
        .header("Authorization", query_token.clone())
        .send()
        .await
        .unwrap();
    let res: serde_json::Value = r.json().await.unwrap();
    println!("Res {}", res);
}
