URL="Http://127.0.0.1:8000/graphql"

PROJECT_1="0x7aa3510fe0f76233d377cce09631fb1b0093de258ca0036afb7dc704c7c1d15e"
PROJECT_2="0x92d5267833fed349c8b617404cd8d01bcfffcb609eb00bdb1e45acc59c27314b"
PROJECT_3="0x6c8212408c3c62fc78cbfa9d6fe5ff39348c1009114a6315b1e2256459135348"

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
