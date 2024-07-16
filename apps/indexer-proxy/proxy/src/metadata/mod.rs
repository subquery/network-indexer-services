mod rpc_evm;
mod rpc_substrate;
mod subgraph;
mod subquery;

pub use rpc_evm::metadata as rpc_evm_metadata;
pub use rpc_substrate::metadata as rpc_substrate_metadata;
pub use subgraph::metadata as subgraph_metadata;
pub use subquery::metadata as subquery_metadata;

use crate::cli::COMMAND;
use crate::graphql::AUTO_REDUCE_ALLOCATION;
use subql_indexer_utils::request::{graphql_request, GraphQLQuery};

pub async fn auto_reduce_allocation_enabled() -> Option<bool> {
    let url = COMMAND.graphql_url();
    let arae_res = graphql_request(&url, &GraphQLQuery::query(AUTO_REDUCE_ALLOCATION)).await;
    match arae_res {
        Ok(arae) => match arae.pointer("/data/_metadata/lastProcessedHeight") {
            Some(target) => target.as_bool(),
            None => None,
        },
        Err(_) => None,
    }
}
