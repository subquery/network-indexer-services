URL="Http://127.0.0.1:8000/graphql"

PROJECT_1="QmWbNtPEbXY2id3yc332P4uLyAYwJ7vpBz1TgqxvnNx8xd"
PROJECT_2="QmYDpk94SCgxv4j2PyLkaD8fWJpHwJufMLX2HGjefsNHH4"
PROJECT_3="QmVeDmzmkFDJp1B5biDZ4bFYgWKbwg4de9ZFCyqzmK61H1"

QUERY_SERVICE_URL_1="https://api.subquery.network/sq/darwinia-network/darwinia/graphql"
QUERY_SERVICE_URL_2="https://api.subquery.network/sq/m00nbeans/marketplace-v3/graphql"
QUERY_SERVICE_URL_3="https://api.subquery.network/sq/subvis-io/polkadot-auctions-and-crowdloans/graphql"

add_project() {
  RPOJECT_ID=$1
  curl -v -X POST $URL \
  -H 'Content-Type: application/json' \
  -d "{
    \"query\": \"mutation AddProject(\$id: String!) { addProject(id: \$id) { id } }\",
    \"operationName\": \"AddProject\",
    \"variables\": { \"id\": \"$RPOJECT_ID\" }
  }"
}

start_project() {
  RPOJECT_ID=$1
  SERVICE_URL=$2
  curl -v -X POST $URL \
  -H 'Content-Type: application/json' \
  -d "{
    \"query\": \"mutation StartProject(\$id: String!, \$indexerEndpoint: String!) { startProject(id: \$id, indexerEndpoint: \$indexerEndpoint) { id } }\",
    \"operationName\": \"StartProject\",
    \"variables\": { \"id\": \"$RPOJECT_ID\", \"indexerEndpoint\": \"$SERVICE_URL\" }
  }"
}

publish_project() {
  RPOJECT_ID=$1
  SERVICE_URL=$2
  curl -v -X POST $URL \
  -H 'Content-Type: application/json' \
  -d "{
    \"query\": \"mutation UpdateProjectToReady(\$id: String!, \$queryEndpoint: String!) { updateProjectToReady(id: \$id, queryEndpoint: \$queryEndpoint) { id } }\",
    \"operationName\": \"UpdateProjectToReady\",
    \"variables\": { \"id\": \"$RPOJECT_ID\", \"queryEndpoint\": \"$SERVICE_URL\" }
  }"
}

echo "Add projects..."
add_project $PROJECT_1
add_project $PROJECT_2
add_project $PROJECT_3

echo "Start projects..."
start_project $PROJECT_1 $QUERY_SERVICE_URL_1
start_project $PROJECT_2 $QUERY_SERVICE_URL_2
start_project $PROJECT_3 $QUERY_SERVICE_URL_3


echo "Publish projects to ready..."
publish_project $PROJECT_1 $QUERY_SERVICE_URL_1
publish_project $PROJECT_2 $QUERY_SERVICE_URL_2
publish_project $PROJECT_3 $QUERY_SERVICE_URL_3
