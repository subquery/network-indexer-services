# Package manage

`pnpm@8.6.3`.

The version and package manager specify in `rush.json`.

# Install dependencies

`npm install -g @microsoft/rush`

`rush update` or `rush install`

# Add a new dependency & remove a dependency

Add(remove) for all projects(in root path):

```
rush add -p library-name --all
rush remove -p library-name --all
```

Add(remove) for one of the projects(in packages path):

```
cd apps/indexer-admin && rush add -p library-name
cd apps/indexer-admin && rush remove -p library-name
```

# Remove cache

```
rush purge
```

# Remove & re-build pnpm lock file

In `common/config/rush`, remove `pnpm-lock.yaml` and run `rush update`.

# Build all projects

`rush build`

# Build one of the projects.

`rush build -o @subql/indexer-coordinator`

# Add a new project

In `rush.json`:

```
projects: [
    {
      "packageName": "@subql/indexer-admin",
      "projectFolder": "apps/indexer-admin"
    }
]
```

# Eslint

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

# Husky

Define at `common/config/rush/command-line.json`, `common/git-hooks/pre-commit` and `common/autoinstallers/rush-husky`.
