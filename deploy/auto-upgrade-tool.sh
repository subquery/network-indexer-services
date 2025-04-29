#!/bin/bash

set -e

#############################################
# auto-upgrade-tool.sh
#
# Purpose:
#   Update subquerynetwork/indexer-coordinator and indexer-proxy
#   image tags in a docker-compose file with the latest Docker Hub tags.
#
# Features:
#   ✅ Detects current tags automatically.
#   ✅ Only replaces if the latest tag is different.
#   ✅ Creates timestamped backup ONLY if updates occur.
#   ✅ Warns if image line is missing but does not replace.
#   ✅ support Linux and Macos system
#   ✅ support docker compose v1 and v2
#
# Usage:
#   ./auto-upgrade-tool.sh             # Uses docker-compose.yml by default
#   ./auto-upgrade-tool.sh -f my-compose.yml
#
#############################################

# Check dependencies
if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is not installed."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is not installed."
  exit 1
fi

# Default compose file
COMPOSE_FILE="docker-compose.yml"

# Parse options
while getopts "f:" opt; do
  case $opt in
  f)
    COMPOSE_FILE="$OPTARG"
    ;;
  *)
    echo "Usage: $0 [-f compose-file]"
    exit 1
    ;;
  esac
done

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Error: $COMPOSE_FILE not found!"
  exit 1
fi

# Function to get latest tag from Docker Hub
get_latest_tag() {
  local REPO="$1"
  local API_URL="https://hub.docker.com/v2/repositories/${REPO}/tags?page_size=100"
  curl -s --max-time 10 "$API_URL" | jq -r '.results[].name' | sort -Vr | head -n 1
}

latest_coordinator=$(get_latest_tag "subquerynetwork/indexer-coordinator")
latest_proxy=$(get_latest_tag "subquerynetwork/indexer-proxy")

echo "Latest coordinator tag: $latest_coordinator"
echo "Latest proxy tag: $latest_proxy"

# Function to detect docker compose command
detect_docker_compose_cmd() {
  DOCKER_COMPOSE_CMD=""
  if command -v docker >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1; then
      DOCKER_COMPOSE_CMD="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
      DOCKER_COMPOSE_CMD="docker-compose"
    else
      echo "Warning: Neither 'docker compose' nor 'docker-compose' command is available."
      echo "You may need to manually restart your services after this update."
    fi
  fi
}

# Function to run docker compose command
run_docker_compose_cmd() {
  if [[ -n "$DOCKER_COMPOSE_CMD" ]]; then
    echo "🔄 Pulling latest images:"
    echo "    Command    : $DOCKER_COMPOSE_CMD pull"
    echo "    Config file: $COMPOSE_FILE"
    $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" pull

    echo "🔄 Starting services:"
    echo "    Command    : $DOCKER_COMPOSE_CMD up -d"
    echo "    Config file: $COMPOSE_FILE"
    $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" up -d
  else
    echo "⚠️ Unable to automatically start services. Please start manually if needed."
    exit 1
  fi
}

# Check for coordinator line and handle "-dev" detection
coordinator_line=$(grep -v '^[[:space:]]*#' "$COMPOSE_FILE" | grep -E 'subquerynetwork/indexer-coordinator[^:]*:[^[:space:]]+' || true)
proxy_line=$(grep -v '^[[:space:]]*#' "$COMPOSE_FILE" | grep -E 'subquerynetwork/indexer-proxy[^:]*:[^[:space:]]+' || true)

current_coordinator=""
current_proxy=""

if [[ -n "$coordinator_line" ]]; then
  current_coordinator=$(echo "$coordinator_line" | head -n 1 | sed -E 's|.*:||')
else
  echo "⚠️  Warning: No matching coordinator image line found in $COMPOSE_FILE, skipping coordinator update."
fi

if [[ -n "$proxy_line" ]]; then
  current_proxy=$(echo "$proxy_line" | head -n 1 | sed -E 's|.*:||')
else
  echo "⚠️  Warning: No matching proxy image line found in $COMPOSE_FILE, skipping proxy update."
fi

# Determine if update is needed
update_needed=false
coordinator_update=false
proxy_update=false

# Only update coordinator if it is NOT a -dev image (strict match)
if [[ -n "$coordinator_line" && "$coordinator_line" =~ subquerynetwork/indexer-coordinator: && ! "$coordinator_line" =~ subquerynetwork/indexer-coordinator-dev: ]]; then
  if [[ "$current_coordinator" != "$latest_coordinator" ]]; then
    coordinator_update=true
    update_needed=true
  fi
fi

# Only update proxy if it is NOT a -dev image (strict match)
if [[ -n "$proxy_line" && "$proxy_line" =~ subquerynetwork/indexer-proxy: && ! "$proxy_line" =~ subquerynetwork/indexer-proxy-dev: ]]; then
  if [[ "$current_proxy" != "$latest_proxy" ]]; then
    proxy_update=true
    update_needed=true
  fi
fi

if [[ "$coordinator_update" == false && "$proxy_update" == false || ( -z "$latest_coordinator" && -z "$latest_proxy" ) ]]; then
  echo "✅ No update needed. Current tags are already the latest or dev tags are present."
else
  timestamp=$(date +"%Y%m%d_%H%M%S")
  backup_file="${COMPOSE_FILE}.${timestamp}.bak"
  cp "$COMPOSE_FILE" "$backup_file"
  echo "📦 Backup created: $backup_file"

  if [[ "$(uname)" == "Darwin" ]]; then
    SED_INPLACE=(-i '')
  else
    SED_INPLACE=(-i)
  fi

  if [[ "$coordinator_update" == true ]]; then
    # Only replace uncommented coordinator image lines (not lines starting with #)
    sed "${SED_INPLACE[@]}" -E "/^[[:space:]]*#/!s|image:[[:space:]]*subquerynetwork/indexer-coordinator:[^[:space:]]+|image: subquerynetwork/indexer-coordinator:${latest_coordinator}|" "$COMPOSE_FILE"
    echo "✅ Coordinator tag updated to $latest_coordinator."
  fi

  if [[ "$proxy_update" == true ]]; then
    # Only replace uncommented proxy image lines (not lines starting with #)
    sed "${SED_INPLACE[@]}" -E "/^[[:space:]]*#/!s|image:[[:space:]]*subquerynetwork/indexer-proxy:[^[:space:]]+|image: subquerynetwork/indexer-proxy:${latest_proxy}|" "$COMPOSE_FILE"
    echo "✅ Proxy tag updated to $latest_proxy."
  fi

  echo "🎉 $COMPOSE_FILE has been updated to the latest tags."
fi

# Detect docker compose command
detect_docker_compose_cmd

run_docker_compose_cmd
