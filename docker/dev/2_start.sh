#!/bin/bash

pwd

SCRIPT_DIR="$(dirname "$0")"
cd $SCRIPT_DIR
pwd

source .env.example
if [ -e ".env" ]; then
  source .env
fi

docker-compose -f docker-compose.yml up -d

cd ../../
pwd

if [ -z "$2" ]; then
  echo "bypass rush build"
else
  rush build
fi

FE_DIR="apps/indexer-admin/build"
BE_DIR="apps/indexer-coordinator/dist/indexer-admin"
rm -rf $BE_DIR && cp -R $FE_DIR $BE_DIR

cd apps/indexer-coordinator
pwd

yarn start:docker \
  --postgres-host $LOCAL_IP \
  --postgres-username $POSTGRES_USERNAME \
  --postgres-password $POSTGRES_PASSWORD \
  --network $NETWORK \
  --ws-endpoint $WS_ENDPOINT \
  --use-prerelease \
  --debug \
  --dev \
  --port 8000 \
  --ipfs http://$LOCAL_IP:8080/api/v0/ \
  --mmrPath $MMRPATH \
  --compose-file-directory ../../docker/dev/.data
