# SubQuery Network - Indexer Services

Services that Indexers run to connect and serve data to the SubQuery Network

## Install dependencies

`yarn install`

## Change source or something update

Add(remove) for one of the projects(in packages path):

```
cd apps/indexer-admin && rush add -p library-name
cd apps/indexer-admin && rush remove -p library-name

## Build all projects

`yarn build`

## Build one of the projects.

`yarn build:admin`
`yarn build:coordinator`

## Eslint

If use vscode need to add below config in Preference -> setting -> workspace -> eslint -> edit setting.json:

```
{
  "eslint.workingDirectories": [
    "apps/indexer-admin",
    "apps/indexer-coordinator"
  ],
}
```

for support eslint in different workfolder.

## Dev environment

To start a local dev environment, you could look into folder `docker/dev/` and find some useful scripts.
To change the default dev env values, copy the `docker/dev/.env.example` file as `docker/dev/.env`, and change any value as needed.
And there is one value MUST be changed: `LOCAL_IP`.

Make sure you have docker and docker-compose installed and running already.

To start the dev environment, please run `yarn start` to start the dev server.
