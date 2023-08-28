pub const METADATA_QUERY: &str = r#"query {
  _metadata {
    lastProcessedHeight
    lastProcessedTimestamp
    startHeight
    targetHeight
    chain
    specName
    genesisHash
    indexerHealthy
    indexerNodeVersion
    queryNodeVersion
    indexerHealthy
    chain
  }
}"#;

pub const ACCOUNT_QUERY: &str = "query { accountMetadata { indexer encryptedKey } }";

pub const VERSION_QUERY: &str = "query { getServicesVersion { coordinator } }";

pub const PROJECT_QUERY: &str = "query { getAliveProjects { id queryEndpoint nodeEndpoint } }";

pub const PAYG_QUERY: &str = "query { getAlivePaygs { id price expiration overflow } }";

pub const CHANNEL_QUERY: &str =
    "query { getAliveChannels { id consumer agent total spent remote price lastFinal expiredAt } }";
