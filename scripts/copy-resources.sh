# copy indexer admin bundle to dist
cp -r ./node_modules/@subql/indexer-admin/build/ ./dist/indexer-admin

cp ./src/utils/template.yml ./dist/utils/template.yml

cp ./docker-compose.yml ./dist/docker-compose.yml