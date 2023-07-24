# install

`npm install -g @microsoft/rush`

`rush update` or `rush install`

# build

`rush build`

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
