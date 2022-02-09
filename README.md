# INDEXER COORDINATOR

## Install

`npm install -g  @subql/indexer-coordinator`

## Start Coordinator Service

### Start a Postgres DB

Need to start a postgres DB server before run the coordinator service. The following is an example to start a service with docker:

```sh
# Install and start the db server
docker run --name "coordinator-server" -e POSTGRES_PASSWORD="postgres" \
    -e PGPASSWORD="postgres" \
    -p 5432:5432 \
    -d postgres

# Create db
docker exec -i "coordinator-server" psql -U postgres -c "create database \"coordinator\""
```

### Run the Coordinator Command

1. Show all the parameters

```sh
# Run the `help` command line
subql-coordinator -help

# All the parameters
Indexer Coordinator
  --network      Network type for the service
            [string] [choices: "local", "testnet", "mainnet"] [default: "local"]
  --ws-endpoint  Specify wss endpoint for this network       [string] [required]
  --port         Port the service will listen on        [number] [default: 8000]

Postgres
  --postgres-host      Postgres host                         [string] [required]
  --postgres-port      Postgres port                    [number] [default: 5432]
  --postgres-username  Postgres username          [string] [default: "postgres"]
  --postgres-password  Postgres password          [string] [default: "postgres"]
  --postgres-database  Postgres database name                [string] [required]

Options:
  --version  Show version number                                       [boolean]
  ---help

```

2. Start coordinator service

```sh
subql-coordinator --network testnet \
    --ws-endpoint 'https://moonbeam-alpha.api.onfinality.io/public' \
    --postgres-host localhost \
    --postgres-database coordinator \
    --postgres-port 5432 \
    --port 8000
```

3. Open Indexer Admin Dapp

Open the indexer-admin app with `http://localhost:8000`.
The domain and port depends on the deployment.
