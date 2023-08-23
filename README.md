# SubQuery Network - Indexer Services

Services that Indexers run to connect and serve data to the SubQuery Network

## Package management

`pnpm@8.6.3`.

The version and package manager specify in `rush.json`.

## Install dependencies

`npm install -g @microsoft/rush`

`rush update` or `rush install`

## Add a new dependency & remove a dependency

Add(remove) for all projects(in root path):

```
rush add -p library-name --all
rush remove -p library-name --all
```

## Change source or something update

e.g: When you update the `common/config/.npmrc`. Please run `rush update` first or delete `common/temp` manually.

Add(remove) for one of the projects(in packages path):

```
cd apps/indexer-admin && rush add -p library-name
cd apps/indexer-admin && rush remove -p library-name
```

## Remove cache

```
rush purge
```

## Remove & re-build pnpm lock file

In `common/config/rush`, remove `pnpm-lock.yaml` and run `rush update`.

## Build all projects

`rush build`

## Build one of the projects.

`rush build -o @subql/indexer-coordinator`

## Add a new project

In `rush.json`:

```
projects: [
    {
      "packageName": "@subql/indexer-admin",
      "projectFolder": "apps/indexer-admin"
    }
]
```

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

## Husky

Define at `common/config/rush/command-line.json`, `common/git-hooks/pre-commit` and `common/autoinstallers/rush-husky`.

## Dev environment

To start a local dev environment, you could look into folder `docker/dev/` and find some useful scripts.
To change the default dev env values, copy the `docker/dev/.env.example` file as `docker/dev/.env`, and change any value as needed.
And there is one value MUST be changed: `LOCAL_IP`.

Make sure you have docker and docker-compose installed and running already.

To start the dev environment, please run `bash docker/dev/1_install.sh` to install node modules and `bash docker/dev/2_start.sh` to start the dev server.
