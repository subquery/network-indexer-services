use ethers::prelude::*;
use serde_json::{json, Value};
use std::time::Instant;
use subql_indexer_utils::{error::Error, types::Result};

use crate::metrics::{add_metrics_query, MetricsNetwork, MetricsQuery};
use crate::project::Project;

/// rpc evm
pub async fn metadata(
    project: &Project,
    block: Option<u64>,
    network: MetricsNetwork,
) -> Result<Value> {
    let provider = Provider::<Http>::try_from(project.endpoint())
        .map_err(|_e| Error::ServiceException(1200))?;

    let now = Instant::now();
    let chain = provider
        .get_chainid()
        .await
        .unwrap_or(U256::zero())
        .as_u64();
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(project.id.clone(), time, MetricsQuery::Free, network, true);

    let block = if let Some(b) = block {
        BlockNumber::Number(b.into())
    } else {
        BlockNumber::Latest
    };
    let now = Instant::now();
    let last_block = provider
        .get_block(block)
        .await
        .map_err(|_| Error::ServiceException(1201))?
        .ok_or(Error::ServiceException(1201))?;
    let last_height = last_block.number.unwrap_or(U64::zero()).as_u64();
    let last_hash = last_block.hash.unwrap_or(H256::default());
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(project.id.clone(), time, MetricsQuery::Free, network, true);

    let now = Instant::now();
    let genesis_block = provider
        .get_block(BlockNumber::Earliest)
        .await
        .map_err(|_| Error::ServiceException(1201))?
        .ok_or(Error::ServiceException(1201))?;
    let start_height = genesis_block.number.unwrap_or(U64::zero()).as_u64();
    let genesis = genesis_block.hash.unwrap_or(H256::default());
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(project.id.clone(), time, MetricsQuery::Free, network, true);

    Ok(json!({
        "startHeight": start_height,
        "lastHeight": last_height,
        "targetHeight": last_height,
        "lastTime": last_block.timestamp.as_u64(),
        "genesis": genesis,
        "chainId": chain,
        "poiId": last_height,
        "poiHash": last_hash,
        "poiParentHash": last_block.parent_hash,
        "poiChainBlockHash": last_hash,
        "poiOperationHashRoot": last_block.state_root,
    }))
}
