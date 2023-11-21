use serde_json::{json, Value};
use std::time::Instant;
use subql_indexer_utils::{
    request::{graphql_request, GraphQLQuery},
    types::Result,
};

use crate::graphql::{poi_with_block, METADATA_QUERY};
use crate::metrics::{add_metrics_query, MetricsNetwork, MetricsQuery};
use crate::project::Project;

pub async fn metadata(
    project: &Project,
    block: Option<u64>,
    network: MetricsNetwork,
) -> Result<Value> {
    let now = Instant::now();
    let metadata_res =
        graphql_request(project.endpoint(), &GraphQLQuery::query(METADATA_QUERY)).await;
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(
        project.id.clone(),
        time,
        MetricsQuery::Free,
        network,
        metadata_res.is_ok(),
    );
    let metadata = metadata_res?;

    let last_height = match metadata.pointer("/data/_metadata/lastProcessedHeight") {
        Some(target) => target.as_u64().unwrap_or(0),
        None => 0,
    };
    let last_time = match metadata.pointer("/data/_metadata/lastProcessedTimestamp") {
        Some(data) => data.as_u64().unwrap_or(0),
        None => 0,
    };
    let poi_height = if let Some(b) = block { b } else { last_height };

    let now = Instant::now();
    let poi_res = graphql_request(
        project.endpoint(),
        &GraphQLQuery::query(&poi_with_block(poi_height)),
    )
    .await;
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(
        project.id.clone(),
        time,
        MetricsQuery::Free,
        network,
        poi_res.is_ok(),
    );
    let poi = poi_res?;

    let target_height = match metadata.pointer("/data/_metadata/targetHeight") {
        Some(data) => data.as_u64().unwrap_or(0),
        None => 0,
    };
    let start_height = match metadata.pointer("/data/_metadata/startHeight") {
        Some(data) => data.as_u64().unwrap_or(0),
        None => 0,
    };
    let genesis = match metadata.pointer("/data/_metadata/genesisHash") {
        Some(data) => data.as_str().unwrap_or(""),
        None => "",
    };
    let chain = match metadata.pointer("/data/_metadata/chain") {
        Some(data) => data.as_str().unwrap_or(""),
        None => "",
    };
    let subquery_healthy = match metadata.pointer("/data/_metadata/indexerHealthy") {
        Some(data) => data.as_bool().unwrap_or(false),
        None => false,
    };
    let subquery_node = match metadata.pointer("/data/_metadata/indexerNodeVersion") {
        Some(data) => data.as_str().unwrap_or(""),
        None => "",
    };
    let subquery_query = match metadata.pointer("/data/_metadata/queryNodeVersion") {
        Some(data) => data.as_str().unwrap_or(""),
        None => "",
    };

    let poi_id = match poi.pointer("/data/_poi/id") {
        Some(data) => data.as_u64().unwrap_or(0),
        None => 0,
    };

    let poi_hash = match poi.pointer("/data/_poi/hash") {
        Some(data) => data.as_str().unwrap_or(""),
        None => "",
    };
    let poi_parent_hash = match poi.pointer("/data/_poi/parentHash") {
        Some(data) => data.as_str().unwrap_or(""),
        None => "",
    };
    let poi_chain_block_hash = match poi.pointer("/data/_poi/chainBlockHash") {
        Some(data) => data.as_str().unwrap_or(""),
        None => "",
    };
    let poi_operation_root = match poi.pointer("/data/_poi/operationHashRoot") {
        Some(data) => data.as_str().unwrap_or(""),
        None => "",
    };

    Ok(json!({
        "startHeight": start_height,
        "lastHeight": last_height,
        "targetHeight": target_height,
        "lastTime": last_time,
        "genesis": genesis,
        "chainId": chain,
        "poiId": poi_id,
        "poiHash": poi_hash,
        "poiParentHash": poi_parent_hash,
        "poiChainBlockHash": poi_chain_block_hash,
        "poiOperationHashRoot": poi_operation_root,
        "subqueryHealthy": subquery_healthy,
        "subqueryNode": subquery_node,
        "subqueryQuery": subquery_query,
    }))
}
