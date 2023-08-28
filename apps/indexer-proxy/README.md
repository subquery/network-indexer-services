# Indexer Proxy

## Run Locally

### Start dependent services

- In [indexer services](https://github.com/subquery/indexer-services), run `docker-compose -f docker-compose-dev.yml up`
- In [coordinator service](https://github.com/subquery/indexer-coordinator), run `yarn start`

### Start proxy service

- `cargo run -- --jwt-secret randomkey --secret-key your-key-same-with-coordinator ` with `debug` mode.

If you want to run with `production` mode, use official [indexer services](https://github.com/subquery/indexer-services).

### Command

```sh
Indexer Proxy 0.3.0
Command line for starting indexer proxy server

USAGE:
    subql-proxy [FLAGS] [OPTIONS] --jwt-secret <jwt-secret> --secret-key <secret-key>

FLAGS:
    -a, --auth       Enable auth
    -d, --debug      Enable debug mode
    -h, --help       Prints help information
    -V, --version    Prints version information

OPTIONS:
        --bootstrap <bootstrap>...                     Bootstrap seeds for p2p network with MultiAddr style
        --endpoint <endpoint>                          Endpoint of this service [default: http://127.0.0.1:80]
        --free-plan <free-limit>                       Free query for consumer limit everyday [default: 60]
        --host <host>                                  IP address for the server [default: 127.0.0.1]
    -j, --jwt-secret <jwt-secret>                      Secret key for generate auth token
        --metrics-allowlist <metrics-allowlist>        AllowList to report metrics [default: ]
        --network <network>                            Blockchain network type [default: ]
        --network-endpoint <network-endpoint>          Blockchain network endpoint [default: ]
        --p2p-port <p2p-port>                          port of p2p network
    -p, --port <port>                                  Port the service will listen on [default: 80]
        --pushgateway-endpoint <pushgateway-endpoint>  The pushgateway endpoint to report indexer's query status
        --redis-endpoint <redis-endpoint>              Redis client address [default: redis://127.0.0.1/]
        --secret-key <secret-key>                      Secret key for decrypt key
        --service-url <service-url>                    Coordinator service endpoint [default: http://127.0.0.1:8000]
        --token-duration <token-duration>              Auth token duration hours [default: 12]
```

## APIs
APIs and services provide HTTP and P2P.

### POST `/token`

```
Request:
{
  "indexer": "...0xAddress...",
  "consumer": "...0xAddress...",
  "agreement": "1", // Optional value, if not, use free mode
  "deployment_id": "...Deployment ID...",
  "signature": "...Signature hex string...", // EIP712 style signature
  "timestamp": 1650447316245,
  "chain_id": 137
}

Response:
{
  "token": "...TOKEN..."
}

```

Add this token to `Authorization: Bearer $TOKEN` when query.

### GET `/metadata/${deployment_id}`

```
Request:

Response:
{"data":
  {"_metadata":{
    "chain":"Polkadot",
    "genesisHash":"0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3",
    "indexerHealthy":true,
    "indexerNodeVersion":"0.29.1",
    "lastProcessedHeight":121743,
    "lastProcessedTimestamp":"1647831789324",
    "queryNodeVersion":"0.12.0",
    "specName":"polkadot",
    "targetHeight":9520539
    }
  }
}
```

### GET `/poi/${deployment_id}`

```
Request:

Response:
{"data":
  {"_poi":
    {"nodes": [
      {
        "chainBlockHash": "\\x7647...64504bb56",
        "createdAt": "2023-03-21T09:54:53.562+00:00",
        ...
      }
    ])
  }
}

Request: GET `/poi/${deployment_id}/{chainBlockHash}`

Response:
{"data":
  {"_poiByChainBlockHash":
    {
      "chainBlockHash": "\\x7647...64504bb56",
      "createdAt": "2023-03-21T09:54:53.562+00:00",
      ...
    }
  }
}
```

### GET `/healthy`

```
Request:

Response:
{
  "indexer": "...0xAddress..."
}
```

### Query with API token

#### POST `/query/${deployment_id}`

```
// Normal Query
Request:
{
  "query": "query { _metadata { indexerHealthy chain} }"
}

Response:
{
  "data":{
    "_metadata": {
      "chain":"Polkadot",
      "indexerHealthy": false
    }
  }
}

// Query with `operation_name` and `variables`
Request:
{
  "query": "query GetAccounts($first: Int!) { accounts (first: $first) { nodes { id }}}",
  "variables": {"first": 5},
  "operationName": "GetAccounts"
}"
Response:
{"data":{
  "accounts":{
    "nodes":[
      {"id":"2oacrSFsNu31PvuUDfULWE6oMHhSjtEk81moPCxX2SYXUuNE"},
      {"id":"2oafaTyZ9a9aoh8Cnhcr3e1LNrAiQdwi4kbeGmTCSTBARRHn"},
      {"id":"2oakar8GYiNytA4U68kKrfS2qpLfdGPEZjSCUVLYC8izRAGj"},
      {"id":"2oAserkFvEk5p4HMJaqRoDnedjaHzJLNPvyN5JaRLPhn4zpW"},
      {"id":"2oaY38m69Ditx8Rft5kdXPZgtzwuvpx42oFnLBeUyzfa2XfH"}
]}}}
```

#### GET `/query-limit`

```
Request:

Response:
{
  "daily_limit": daily_limit,
  "daily_used": daily_used,
  "rate_limit": rate_limit,
  "rate_used": rate_used
}
```

### Flex Plan (PAYG)
Flex plan is a pay-as-you-go payment mode, which is charged by the number of query times.

#### POST `/open`

```
// Create a new flex plan
Request:
{
  "channel_id": "...1a2b3f...",  // random u256 hex string
  "indexer": "...0xAddress...",
  "consumer": "..0xAddress...",
  "total": "...100...",          // u256 number (no decimal)
  "price": "...100...",          // u256 number (no decimal)
  "expiration": "...3600...",    // expiration time
  "deployment_id": "...Qm...",
  "callback": "0x1a2b3f...",     // hex data, if not, set ""
  "indexer_sign": "0x1a2b3f...", // hex data, if not, set ""
  "consumer_sign": "0x1a2b3f..." // hex_data, if not, set ""
}

Response:
{
  "channel_id": "...1a2b3f...",
  "indexer": "...0xAddress...",
  "consumer": "..0xAddress...",
  "total": "...100...",
  "price": "...100...",
  "expiration": "...3600...",
  "deployment_id": "...Qm...",
  "callback": "0x1a2b3f...",
  "indexer_sign": "0x1a2b3f...",
  "consumer_sign": "0x1a2b3f..."
}
```

#### POST `/payg/:deployment_id`
```
QueryState:
{
  "channel_id": "...1a2b3f...",  // random u256 hex string
  "indexer": "...0xAddress...",
  "consumer": "..0xAddress...",
  "spent": "...100...",          // u256 number (no decimal)
  "remote": "...100...",         // u256 number (no decimal)
  "is_final": false,
  "indexer_sign": "0x1a2b3f...", // hex data, if not, set ""
  "consumer_sign": "0x1a2b3f..." // hex data, if not, set ""
}
Set the QueryState to `Authorization: $QueryStateString`.

Request:
{
  "query": "...",
  "variables": {...},
  "operationName": "..."
}

Response:
[
  { "data":{ ... } },
  { ...QueryState... },
]

```
