PACKAGE_VERSION=$(cat ./apps/indexer-coordinator/package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')


echo "::set-output name=COORDINATOR_VERSION::$PACKAGE_VERSION"
