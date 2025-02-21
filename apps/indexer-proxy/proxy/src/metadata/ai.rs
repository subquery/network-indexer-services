use serde_json::{json, Value};
use subql_indexer_utils::types::Result;

use crate::project::Project;

pub async fn metadata(_project: &Project) -> Result<Value> {
    Ok(json!({
        "ai": "TODO",
    }))
}
