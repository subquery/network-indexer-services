use chrono::prelude::*;
use ethers::{
    prelude::*,
    types::transaction::eip712::{EIP712Domain, Eip712, Eip712DomainType, TypedData},
};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::env::args;
use subql_contracts::CURRENT_NETWORK;
use subql_indexer_utils::request::GraphQLQuery;

const METADATA_QUERY: &str = r#"query {
  _metadata { indexerHealthy }
}"#;

fn payload_712(
    consumer: &str,
    indexer: &str,
    deployment_id: &str,
    agreement: &str,
    timestamp: i64,
    chain_id: i64,
) -> [u8; 32] {
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
    message.insert("indexer".to_owned(), indexer.into());
    message.insert("consumer".to_owned(), consumer.into());
    message.insert("timestamp".to_owned(), timestamp.into());
    message.insert("agreement".to_owned(), agreement.into());
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
    if args().len() != 7 && args().len() != 8 {
        println!("cargo run --example agreement-query url indexer consumer deployment agreement CONSUMERSKXXX query_times");
        return Ok(());
    }

    let url = args().nth(1).unwrap();
    let indexer = args().nth(2).unwrap();
    let consumer = args().nth(3).unwrap();
    let deployment = args().nth(4).unwrap();
    let agreement = args().nth(5).unwrap();
    let signer = args().nth(6).unwrap().parse::<LocalWallet>().unwrap();
    let query_times: usize = args().nth(7).unwrap_or("0".to_owned()).parse().unwrap();

    let timestamp = Utc::now().timestamp_millis();
    let chain_id = CURRENT_NETWORK.config().chain_id as i64;
    let msg = payload_712(
        &consumer,
        &indexer,
        &deployment,
        &agreement,
        timestamp,
        chain_id,
    );
    let sign = hex::encode(signer.sign_hash(msg.into()).unwrap().to_vec());

    let mut payload = HashMap::new();
    payload.insert("indexer", Value::String(indexer));
    payload.insert("consumer", Value::String(consumer));
    payload.insert("deployment_id", Value::String(deployment.clone()));
    payload.insert("signature", Value::String(sign));
    payload.insert("timestamp", timestamp.into());
    payload.insert("chain_id", chain_id.into());
    payload.insert("agreement", Value::String(agreement));
    println!("{:?}", payload);

    let client = reqwest::Client::new();
    let token_url = format!("{}/token", url);
    let res = client.post(token_url).json(&payload).send().await.unwrap();
    let token: serde_json::Value = res.json().await.unwrap();
    if token.get("token").is_some() {
        println!("Got token, start query ... {} times", query_times);
        println!("{}", token["token"]);
    } else {
        println!("Error: {}", token);
        return Ok(());
    }

    let query_token = format!("Bearer {}", token["token"].as_str().unwrap());
    let query_url = format!("{}/query/{}", url, deployment);
    let _query_body = serde_json::to_string(&GraphQLQuery::query(METADATA_QUERY)).unwrap();
    let query_body =
        r#"{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}"#;

    if query_times == 0 {
        println!("Loop to query, preiod: 100ms");
        let mut i = 1;
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            let now = std::time::Instant::now();
            let r = client
                .post(&query_url)
                .header("Authorization", query_token.clone())
                .body(query_body)
                .send()
                .await
                .unwrap();
            let res: serde_json::Value = r.json().await.unwrap();
            println!(
                "Res {} {} s: {}",
                i,
                now.elapsed().as_millis() as f32 / 1000f32,
                res
            );
            i += 1;
        }
    } else {
        for i in 0..query_times {
            let tmp_token = query_token.clone();
            let tmp_url = query_url.clone();
            let tmp_body = query_body;
            tokio::spawn(async move {
                let client = reqwest::Client::new();
                let now = std::time::Instant::now();
                let r = client
                    .post(tmp_url)
                    .header("Authorization", tmp_token)
                    .body(tmp_body)
                    .send()
                    .await
                    .unwrap();
                let res: serde_json::Value = r.json().await.unwrap();
                println!(
                    "Res {} {} s: {}",
                    i + 1,
                    now.elapsed().as_millis() as f32 / 1000f32,
                    res
                );
            });
        }

        println!("Start waiting 10s to receive all response");
        tokio::time::sleep(std::time::Duration::from_secs(10)).await;
    }

    Ok(())
}
