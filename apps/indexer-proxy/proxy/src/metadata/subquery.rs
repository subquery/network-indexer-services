use serde_json::{json, Value};
use std::time::Instant;
use subql_indexer_utils::{
    request::{graphql_request, GraphQLQuery},
    types::Result,
};

use crate::graphql::METADATA_QUERY;
use crate::metrics::{add_metrics_query, MetricsNetwork, MetricsQuery};
use crate::project::Project;

pub async fn metadata(project: &Project, network: MetricsNetwork) -> Result<Value> {
    let now = Instant::now();
    let endpoint = project.endpoint("default", true)?;
    let metadata_res =
        graphql_request(&endpoint.endpoint, &GraphQLQuery::query(METADATA_QUERY)).await;
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(
        project.id.clone(),
        Some(time),
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

    Ok(json!({
        "startHeight": start_height,
        "lastHeight": last_height,
        "targetHeight": target_height,
        "lastTime": last_time,
        "genesis": genesis,
        "chainId": chain,
        "subqueryHealthy": subquery_healthy,
        "subqueryNode": subquery_node,
        "subqueryQuery": subquery_query,
        "Cache-control": "no-cache",
    }))
}
