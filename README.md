# INDEXER COORDINATOR

## Start with Docker

Start all the services: `db service` `coordinator service` and `proxy service` together with docker compose command.

### Run Docker Compose

```sh
docker-compose up
```

<img width="900" alt="1" src="https://user-images.githubusercontent.com/8177474/157581858-ffe19d45-540b-4eb4-a299-6aeafa0e720a.png">


### Indexer Management with Admin App

For the default configuration, open the indexer admin app with `http://localhost:8000`

<img width="1628" alt="2" src="https://user-images.githubusercontent.com/8177474/157581741-10a1ffb1-604d-4375-b3ca-30cccbea2e0a.png">


## Start With CLI

## Install

`npm install -g  @subql/indexer-coordinator@0.1.1-10`

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

## Development

Run the following command to build the local image for the coordinator updates

- `docker-compose -f docker-compose-dev.yml up` running the postgres and redis

- Add coordinator_db to network hosts. open `/etc/hosts`, add `127.0.0.1 coordinator_db`

- Start services in development:
  - `indexer-admin`: `yarn start`
  - `indexer-coordinator`: `yarn start`
  - `indexer-proxy`: `cargo run`
