use ethers::prelude::*;
use serde_json::{json, Value};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{bs58, commitment_config::CommitmentConfig};
use std::time::Instant;
use subql_indexer_utils::{error::Error, types::Result};

use crate::{
    metrics::{add_metrics_query, MetricsNetwork, MetricsQuery},
    project::{Endpoint, Project},
};

/// rpc evm
pub async fn metadata(project: &Project, network: MetricsNetwork) -> Result<Value> {
    let endpoint = project.endpoint("default", true)?;
    match endpoint.rpc_family[0].as_str() {
        "solana" => solana_metadata(project, endpoint, network).await,
        _ => evm_metadata(project, endpoint, network).await,
    }
}

// evm metadata
pub async fn evm_metadata(
    project: &Project,
    endpoint: &Endpoint,
    network: MetricsNetwork,
) -> Result<Value> {
    let provider = Provider::<Http>::try_from(&endpoint.endpoint)
        .map_err(|_e| Error::ServiceException(1200))?;

    let now = Instant::now();
    let chain = provider
        .get_chainid()
        .await
        .unwrap_or(U256::zero())
        .as_u64();
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(
        project.id.clone(),
        Some(time),
        MetricsQuery::Free,
        network,
        true,
    );

    let now = Instant::now();
    let last_block = provider
        .get_block(BlockNumber::Latest)
        .await
        .map_err(|_| Error::ServiceException(1201))?
        .ok_or(Error::ServiceException(1201))?;
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(
        project.id.clone(),
        Some(time),
        MetricsQuery::Free,
        network,
        true,
    );

    let last_height = last_block.number.unwrap_or(U64::zero()).as_u64();
    let last_time = last_block.timestamp.as_u64();

    let now = Instant::now();
    let genesis_block = provider
        .get_block(BlockNumber::Earliest)
        .await
        .map_err(|_| Error::ServiceException(1201))?
        .ok_or(Error::ServiceException(1201))?;
    let start_height = genesis_block.number.unwrap_or(U64::zero()).as_u64();
    let genesis = genesis_block.hash.unwrap_or(H256::default());
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(
        project.id.clone(),
        Some(time),
        MetricsQuery::Free,
        network,
        true,
    );

    Ok(json!({
        "startHeight": start_height,
        "lastHeight": last_height,
        "targetHeight": last_height,
        "lastTime": last_time,
        "genesis": genesis,
        "chainId": chain,
    }))
}

// solana metadata
pub async fn solana_metadata(
    project: &Project,
    endpoint: &Endpoint,
    network: MetricsNetwork,
) -> Result<Value> {
    let client =
        RpcClient::new_with_commitment(endpoint.endpoint.clone(), CommitmentConfig::confirmed());

    let now = Instant::now();
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(
        project.id.clone(),
        Some(time),
        MetricsQuery::Free,
        network,
        true,
    );

    let now = Instant::now();

    let (last_height, last_time) = solana_get_latest_block_height_and_time(&client).await?;
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(
        project.id.clone(),
        Some(time),
        MetricsQuery::Free,
        network,
        true,
    );
    let now = Instant::now();
    // let genesis_block = client
    //     .get_block(0)
    //     .map_err(|_| Error::ServiceException(1201))
    //     .unwrap_or_default();
    let start_height = 0;
    let genesis = client
        .get_genesis_hash()
        .map_err(|_| Error::ServiceException(1201))?;
    let base58_hash = bs58::encode(genesis.to_bytes()).into_string();
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(
        project.id.clone(),
        Some(time),
        MetricsQuery::Free,
        network,
        true,
    );
    Ok(json!({
        "startHeight": start_height,
        "lastHeight": last_height,
        "targetHeight": last_height,
        "lastTime": last_time,
        "genesis": base58_hash,
        "chainId": 0,
    }))
}

async fn solana_get_latest_block_height_and_time(client: &RpcClient) -> Result<(u64, i64)> {
    match client.get_latest_blockhash_with_commitment(CommitmentConfig::confirmed()) {
        Ok((_hash, height)) => {
            if let Ok(slot) = client.get_slot() {
                if let Ok(block_time) = client.get_block_time(slot) {
                    return Ok((height, block_time));
                }
            }
            Err(Error::ServiceException(1201))
        }
        Err(_err) => Err(Error::ServiceException(1201)),
    }
}
