## Subquery Indexer Proxy

API Docs for Subquery Indexer Proxy

------------------------------------------------------------------------------------------

#### General operations

<details>
 <summary><code>POST</code> <code><b>/token</b></code> <code>(create token for query)</code></summary>

##### Parameters

> | name      |  type     | data type               | description                                                           |
> |-----------|-----------|-------------------------|-----------------------------------------------------------------------|
> | indexer      |  Payload | string   | indexer address  |
> | consumer      |  Payload | string   | consumer address  |
> | agreement      |  Payload | string   | service agreement contract address  |
> | deployment_id      |  Payload | string   | deployment id for the proejct  |
> | signature      |  Payload | string   | signature of user  |
> | timestamp      |  Payload | string   |   |
> | chain_id      |  Payload | string   | chain id  |


##### Responses

> | http code     | content-type                      | response                                                            |
> |---------------|-----------------------------------|---------------------------------------------------------------------|
> | `200`         | `application/json`        | `{"token": "string"}`                                |

##### Example cURL

> ```bash
> curl -X POST -H "Content-Type: application/json" -d "indexer=value" http://localhost:8010/token
> ```
</details>

<details>
 <summary><code>POST</code> <code><b>/query/${deployment_id}</b></code> <code>(query with agreement)</code></summary>

##### Parameters

> | name      |  type     | data type               | description                                                           |
> |-----------|-----------|-------------------------|-----------------------------------------------------------------------|
> | `deployment` |  Path | string   | deployment  id to query       | 
> | None      |  Body | Object/json   | ```{"query": ${GraphQL Query}```  |

##### Responses

> | http code     | content-type                      | response                                                            |
> |---------------|-----------------------------------|---------------------------------------------------------------------|
> | `200`         | `application/json`        | GraphQL Data Response                                |

##### Example cURL

> ```bash
> curl -X POST -H "Content-Type: application/json" --data @post.json http://localhost:8010/query/deployment_id
> ```
</details>

<details>
 <summary><code>POST</code> <code><b>/metadata/${deployment_id}</b></code> <code>(query the metadata (indexer, controller, payg-price))</code></summary>

##### Parameters

> | name      |  type     | data type               | description                                                           |
> |-----------|-----------|-------------------------|-----------------------------------------------------------------------|
> | `deployment_id` |  Path | string   | deployment  id   |

##### Responses

> | http code     | content-type                      | response                                                            |
> |---------------|-----------------------------------|---------------------------------------------------------------------|
> | `200`         | `application/json`        |   ```{"data":{"_metadata":{"chain":"Polkadot","genesisHash":"0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3","indexerHealthy":true,"indexerNodeVersion":"0.29.1","lastProcessedHeight":121743,"lastProcessedTimestamp":"1647831789324","queryNodeVersion":"0.12.0","specName":"polkadot","targetHeight":9520539}}}```                              |

##### Example cURL

> ```bash
> curl -X POST -H "Content-Type: application/json" http://localhost:8010/metadata/deployment_id
> ```
</details>

<details>
 <summary><code>GET</code> <code><b>/poi/${deployment_id}</b></code> <code>(query the latest block poi)</code></summary>

##### Parameters

> | name      |  type     | data type               | description                                                           |
> |-----------|-----------|-------------------------|-----------------------------------------------------------------------|
> | `deployment_id` |  Path | string   | deployment  id   |

##### Responses

> | http code     | content-type                      | response                                                            |
> |---------------|-----------------------------------|---------------------------------------------------------------------|
> | `200`         | `application/json`        | ```{"data":{"_poi":{"nodes": [{"chainBlockHash": "\\x7647...64504bb56","createdAt": "2023-03-21T09:54:53.562+00:00",...}])}}```                               |

##### Example cURL

> ```bash
> curl -X GET -H "Content-Type: application/json" http://localhost:8010/poi/deployment_id
> ```
</details>

<details>
 <summary><code>GET</code> <code><b>/poi/${deployment_id}/{blocknumber}</b></code> <code>(query the poi by block number)</code></summary>

##### Parameters

> | name      |  type     | data type               | description                                                           |
> |-----------|-----------|-------------------------|-----------------------------------------------------------------------|
> | `deployment_id` |  Path | string   | deployment  id   |
> | `blocknumber` |  Path | number   | block number   |
##### Responses

> | http code     | content-type                      | response                                                            |
> |---------------|-----------------------------------|---------------------------------------------------------------------|
> | `200`         | `application/json`        | ```{"offset":2391,"height":"100001","mmrRoot":"0x87e6d37b577b8e8a2fc289c47d63185244d8f313888d73d92a65bc1fb581c450","hash":"0x0000000000000000000000000000000000000000000000000000000000000001"}```                               |

##### Example cURL

> ```bash
> curl -X GET -H "Content-Type: application/json" http://localhost:8010/poi/deployment_id/100
> ```
</details>

<details>
 <summary><code>GET</code> <code><b>/healthy</b></code> <code>(query the service in running success (response the indexer))</code></summary>

##### Parameters

> None

##### Responses

> | http code     | content-type                      | response                                                            |
> |---------------|-----------------------------------|---------------------------------------------------------------------|
> | `200`         | `application/json`        | ```{"indexer": "...0xAddress..."}```                               |

##### Example cURL

> ```bash
> curl -X GET -H "Content-Type: application/json" http://localhost:8010/healthy
> ```
</details>

<details>
 <summary><code>GET</code> <code><b>/query-limit</b></code> <code>(query limit times with agreement)</code></summary>

##### Parameters

> None

##### Responses

> | http code     | content-type                      | response                                                            |
> |---------------|-----------------------------------|---------------------------------------------------------------------|
> | `200`         | `application/json`        | ```{"daily_limit": daily_limit,"daily_used": daily_used,"rate_limit": rate_limit,"rate_used": rate_used}```                               |

##### Example cURL

> ```bash
> curl -X GET -H "Content-Type: application/json" http://localhost:8010/query-limit
> ```
</details>

<details>
 <summary><code>POST</code> <code><b>/payg-open</b></code> <code>(open a state channel for payg)</code></summary>

##### Parameters

> | name      |  type     | data type               | description                                                           |
> |-----------|-----------|-------------------------|-----------------------------------------------------------------------|
> | channelId      |  Payload | string   | channel id  |
> | indexer      |  Payload | string   | indexer address  |
> | consumer      |  Payload | string   | consumer address  |
> | total      |  Payload | string   | total SQT amount  |
> | price      |  Payload | string   | price in SQT  |
> | expiration      |  Payload | string   | expiration time  |
> | deploymentId      |  Payload | string   | deployment id  |
> | callback      |  Payload | string   | hex data, if not, set ""  |
> | indexerSign      |  Payload | string   | hex data, if not, set ""  |
> | consumerSign      |  Payload | string   | hex data, if not, set ""  |


##### Responses

> | http code     | content-type                      | response                                                            |
> |---------------|-----------------------------------|---------------------------------------------------------------------|
> | `200`         | `application/json`        | `{"channelId": "...1a2b3f...","indexer": "...0xAddress...","consumer": "..0xAddress...","total": "...100...","price": "...100...","expiration": "...3600...","deploymentId": "...Qm...","callback": "0x1a2b3f...","indexerSign": "0x1a2b3f...","consumerSign": "0x1a2b3f..."}` |

##### Example cURL

> ```bash
> curl -X POST -H "Content-Type: application/json" -d "indexer=value" http://localhost:8010/payg-open
> ```
</details>

<details>
 <summary><code>POST</code> <code><b>/payg/${deployment_id}</b></code> <code>(query with Pay-As-You-Go with state channel)</code></summary>

##### Parameters

> | name      |  type     | data type               | description                                                           |
> |-----------|-----------|-------------------------|-----------------------------------------------------------------------|
> | deployment_id      |  Path | string   | deployment id  |
> | None      |  Body | Object/json   | `{"query": "...","variables": {...},"operationName": "..."}`  |
> | Authorization      |  Header | string   | `QueryState:{"channelId": "...1a2b3f...","indexer": "...0xAddress...","consumer": "..0xAddress...","spent": "...100...", "remote": "...100...", "isFinal": false,"indexerSign": "0x1a2b3f...", "consumerSign": "0x1a2b3f..." }`  |



##### Responses

> | http code     | content-type                      | response                                                            |
> |---------------|-----------------------------------|---------------------------------------------------------------------|
> | `200`         | `application/json`        | `{ "data":{ ... }, state: { ...QueryState... } }`                                |

##### Example cURL

> ```bash
> curl -X POST -H "Content-Type: application/json" -d "indexer=value" http://localhost:8010/payg/deployment_id
> ```
</details>
