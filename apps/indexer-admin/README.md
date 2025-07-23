# Indexer Admin App

## Install dependencies

Please check the root readme [indexer-coordinator](https://github.com/subquery/indexer-coordinator)

## Development

1. Create your own `.env.local` file:

```conf
VITE_APP_NETWORK=testnet
VITE_APP_COORDINATOR_SERVICE_URL=http://cyrbuzz.space:8000/graphql
```

2. Start [indexer-coordinator](https://github.com/subquery/network-indexer-services/tree/main/apps/indexer-coordinator) service.
3. Run `pnpm start`(or `yarn`, `npm`, recommend to use `pnpm`).

## Testing with testnet

Start [indexer-coordinator](https://github.com/subquery/network-indexer-services/tree/main/apps/indexer-coordinator) service locally.

Open `localhost:8008` to play with the app.

## Tools

- [moonbeam explorer](https://moonbeam-explorer.netlify.app/?network=MoonbeamDevNode)
- [polkadot explorer](https://polkadot.js.org/apps/#/explorer)

##
