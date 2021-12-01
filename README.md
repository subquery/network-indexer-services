## Installation

```bash
$ npm install
```

## Running the app

Make sure `docker` start

- Start postgres db

```
yarn start:db
```

- Start the service

```
yarn start:prod --network testnet --ws-endpoint 'https://moonbeam-alpha.api.onfinality.io/public' --postgres-host localhost --postgres-database coordinator --port 8000
```
