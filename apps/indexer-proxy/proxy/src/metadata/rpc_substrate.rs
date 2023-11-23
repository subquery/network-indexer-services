use chrono::Utc;
use serde_json::{json, Value};
use std::time::Instant;
use subql_indexer_utils::{request::jsonrpc_request, types::Result};

use crate::metrics::{add_metrics_query, MetricsNetwork, MetricsQuery};
use crate::project::Project;

/// rpc substrate
pub async fn metadata(
    project: &Project,
    block: Option<u64>,
    network: MetricsNetwork,
) -> Result<Value> {
    let url = project.endpoint();

    let now = Instant::now();
    let latest_block = jsonrpc_request(url, "chain_getBlock", vec![]).await?;
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(project.id.clone(), time, MetricsQuery::Free, network, true);

    let last_height = if let Some(item) = latest_block.pointer("/block/header/number") {
        let raw = item.as_str().unwrap_or("0");
        let without_prefix = raw.trim_start_matches("0x");
        i64::from_str_radix(without_prefix, 16).unwrap_or(0)
    } else {
        0
    };

    let (poi_block, poi_hash) = if let Some(b) = block {
        let now = Instant::now();
        let hash = jsonrpc_request(url, "chain_getBlockHash", vec![json!(b)]).await?;
        let time = now.elapsed().as_millis() as u64;
        add_metrics_query(project.id.clone(), time, MetricsQuery::Free, network, true);
        let poi_hash = hash.clone().as_str().unwrap_or("").to_owned();

        let now = Instant::now();
        let poi_block = jsonrpc_request(url, "chain_getBlock", vec![hash]).await?;
        let time = now.elapsed().as_millis() as u64;
        add_metrics_query(project.id.clone(), time, MetricsQuery::Free, network, true);

        (poi_block, poi_hash)
    } else {
        let now = Instant::now();
        let last_hash = jsonrpc_request(url, "chain_getBlockHash", vec![json!(last_height)])
            .await?
            .as_str()
            .unwrap_or("")
            .to_owned();
        let time = now.elapsed().as_millis() as u64;
        add_metrics_query(project.id.clone(), time, MetricsQuery::Free, network, true);

        (latest_block, last_hash)
    };

    let poi_id = if let Some(item) = poi_block.pointer("/block/header/number") {
        let raw = item.as_str().unwrap_or("0");
        let without_prefix = raw.trim_start_matches("0x");
        i64::from_str_radix(without_prefix, 16).unwrap_or(0)
    } else {
        0
    };

    let poi_parent_hash = if let Some(item) = poi_block.pointer("/block/header/parentHash") {
        item.as_str().unwrap_or("")
    } else {
        ""
    };

    let poi_state_root = if let Some(item) = poi_block.pointer("/block/header/stateRoot") {
        item.as_str().unwrap_or("")
    } else {
        ""
    };

    let now = Instant::now();
    let chain = jsonrpc_request(url, "system_chain", vec![])
        .await?
        .as_str()
        .unwrap_or("")
        .to_owned();
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(project.id.clone(), time, MetricsQuery::Free, network, true);

    let now = Instant::now();
    let genesis = jsonrpc_request(url, "chain_getBlockHash", vec![json!(0)])
        .await?
        .as_str()
        .unwrap_or("")
        .to_owned();
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(project.id.clone(), time, MetricsQuery::Free, network, true);

    Ok(json!({
        "startHeight": 1,
        "lastHeight": last_height,
        "targetHeight": last_height,
        "lastTime": Utc::now().timestamp(),
        "genesis": genesis,
        "chainId": chain,
        "poiId": poi_id,
        "poiHash": poi_hash,
        "poiParentHash": poi_parent_hash,
        "poiChainBlockHash": poi_hash,
        "poiOperationHashRoot": poi_state_root,
    }))
}
