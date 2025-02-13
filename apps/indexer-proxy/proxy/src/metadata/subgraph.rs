use serde_json::{json, Value};
use std::time::Instant;
use subql_indexer_utils::{
    request::{graphql_request, GraphQLQuery},
    types::Result,
};

use crate::metrics::{add_metrics_query, MetricsNetwork, MetricsQuery};
use crate::project::Project;

fn metadata_query(id: &str) -> String {
    format!(
        r#"query {{
  indexingStatuses(subgraphs:["{}"]){{
    health
    chains{{
      network
      chainHeadBlock{{
        number
      }}
      earliestBlock{{
        number
      }}
      latestBlock{{
        number
      }}
      lastHealthyBlock{{
        number
      }}
    }}
  }}
}}"#,
        id,
    )
}

pub async fn metadata(project: &Project, network: MetricsNetwork) -> Result<Value> {
    let now = Instant::now();
    let endpoint = project.endpoint("index-node-endpoint", false)?;
    let metadata_res = graphql_request(
        &endpoint.endpoint,
        &GraphQLQuery::query(&metadata_query(&project.id)),
    )
    .await;
    let time = now.elapsed().as_millis() as u64;
    add_metrics_query(
        project.id.clone(),
        Some(time),
        MetricsQuery::Free,
        network,
        metadata_res.is_ok(),
    );
    let metadata = metadata_res?;

    if let Some(data) = metadata.pointer("/data/indexingStatuses") {
        if let Some(data1) = data.as_array() {
            if data1.len() > 0 {
                if let Some(data2) = data1[0]["chains"].as_array() {
                    if data2.len() > 0 {
                        let lastdata = &data2[0];

                        let last_height = match lastdata.pointer("/latestBlock/number") {
                            Some(target) => target.as_str().unwrap_or("0").parse().unwrap_or(0),
                            None => 0,
                        };
                        let target_height = match lastdata.pointer("/chainHeadBlock/number") {
                            Some(data) => data.as_str().unwrap_or("0").parse().unwrap_or(0),
                            None => 0,
                        };
                        let start_height = match lastdata.pointer("/earliestBlock/number") {
                            Some(data) => data.as_str().unwrap_or("0").parse().unwrap_or(0),
                            None => 0,
                        };
                        let chain = match lastdata.pointer("/network") {
                            Some(data) => data.as_str().unwrap_or(""),
                            None => "",
                        };
                        let subquery_healthy = match data1[0].pointer("/health") {
                            Some(data) => data.as_str().unwrap_or("unhealthy") == "healthy",
                            None => false,
                        };

                        return Ok(json!({
                            "startHeight": start_height,
                            "lastHeight": last_height,
                            "targetHeight": target_height,
                            "chainId": chain,
                            "subqueryHealthy": subquery_healthy,
                        }));
                    }
                }
            }
        }
    }

    Ok(json!({
        "startHeight": 0,
        "lastHeight": 0,
        "targetHeight": 0,
        "chainId": "",
        "subqueryHealthy": false,
        "Cache-control": "no-cache",
    }))
}
