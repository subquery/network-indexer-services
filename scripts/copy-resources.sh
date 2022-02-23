# copy indexer admin bundle to dist
cp -r ./node_modules/@subql/indexer-admin/build/ ./dist/indexer-admin

cp -r ./src/utils/template.yml ./dist/utils/template.yml

mkdir ./dist/compose-files