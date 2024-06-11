use chrono::Utc;
use serde_json::{json, Value};
use std::time::Instant;
use subql_indexer_utils::{request::jsonrpc_request, types::Result};

use crate::metrics::{add_metrics_query, MetricsNetwork, MetricsQuery};
use crate::project::Project;

/// rpc substrate
pub async fn metadata(project: &Project, network: MetricsNetwork) -> Result<Value> {
    let url = &project.endpoint("default", true)?.endpoint;

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
    }))
}
