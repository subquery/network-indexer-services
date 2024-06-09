use serde_json::{json, Value};
use std::time::Instant;
use subql_indexer_utils::{
    request::{graphql_request, GraphQLQuery},
    types::Result,
};

use crate::metrics::{add_metrics_query, MetricsNetwork, MetricsQuery};
use crate::project::Project;

const METADATA_QUERY: &str = r#"query {
  indexingStatuses(subgraphs:["QmQR5efcF8kTVoPtVEXmZgxBcTaCvR6CRXCbtpgpbevBQu"]){
    health
    chains{
      network
      chainHeadBlock{
        number
      }
      earliestBlock{
        number
      }
      latestBlock{
        number
      }
      lastHealthyBlock{
        number
      }
    }
  }
}"#;

pub async fn metadata(project: &Project, network: MetricsNetwork) -> Result<Value> {
    let now = Instant::now();
    let endpoint = project.endpoint("index-node-endpoint", false)?;
    let metadata_res =
        graphql_request(&endpoint.endpoint, &GraphQLQuery::query(METADATA_QUERY)).await;
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(
        project.id.clone(),
        time,
        MetricsQuery::Free,
        network,
        metadata_res.is_ok(),
    );
    let metadata = metadata_res?;

    let last_height = match metadata.pointer("/data/indexingStatuses/chains/latestBlock/number") {
        Some(target) => target.as_u64().unwrap_or(0),
        None => 0,
    };
    let target_height =
        match metadata.pointer("/data/indexingStatuses/chains/chainHeadBlock/number") {
            Some(data) => data.as_u64().unwrap_or(0),
            None => 0,
        };
    let start_height = match metadata.pointer("/data/indexingStatuses/chains/earliestBlock/number")
    {
        Some(data) => data.as_u64().unwrap_or(0),
        None => 0,
    };
    let chain = match metadata.pointer("/data/indexingStatuses/chains/network") {
        Some(data) => data.as_str().unwrap_or(""),
        None => "",
    };
    let subquery_healthy = match metadata.pointer("/data/indexingStatuses/health") {
        Some(data) => data.as_str().unwrap_or("unhealthy") == "healthy",
        None => false,
    };

    Ok(json!({
        "startHeight": start_height,
        "lastHeight": last_height,
        "targetHeight": target_height,
        "chainId": chain,
        "subqueryHealthy": subquery_healthy,
    }))
}
