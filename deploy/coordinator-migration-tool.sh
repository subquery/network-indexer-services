#!/bin/bash

docker_compose_file="docker-compose.yml"
coordinator_version_default="<to-be-released>"
proxy_version_default="<to-be-released>"

prompt_question() {
  prompt=$1
  default_value=$2

  read -p "$prompt" user_input

  if [ -z "$user_input" ]; then
    echo $default_value
  else
    echo $user_input
  fi
}

ask_for_confirmation() {
  prompt=$1
  default_value=$2

  answer=$(prompt_question "$prompt (y/n, default is $default_value): " "$default_value")

  if [ "$answer" != "y" ]; then
    echo "Operation cancelled."
    exit 1
  fi

  new_line
}

ask_for_input() {
  prompt=$1
  default_value=$2

  answer=$(prompt_question "$prompt (default is $default_value): " "$default_value")

  echo $answer
}

new_line() {
  echo
}

file_exists() {
  filename_exist=$1

  if [ -f "$filename_exist" ]; then
    return 0
  else
    return 1
  fi
}

create_backup() {
  origin_filename=$1
  backup_filename="$origin_filename.bak"

  if file_exists "$origin_filename"; then
    if file_exists "$backup_filename"; then
      answer=$(prompt_question "Backup file $backup_filename already exists. Do you want to overwrite it? (y/n, default is n): " "n")
      if [ "$answer" != "y" ]; then
        echo "Backup creation cancelled."
        new_line
        return
      fi
    fi
    cp "$origin_filename" "$backup_filename"
    echo "Backup of $origin_filename created as $backup_filename"
  else
    echo "File $origin_filename does not exist."
  fi

  new_line
}

assert_file_exists() {
  file_to_check=$1

  if [ ! -f "$file_to_check" ]; then
    echo "$file_to_check does not exist in the current directory. Operation cancelled."
    exit 1
  fi

  new_line
}

check_text_exists() {
  file_to_check=$1
  text_to_search=$2

  if grep -q "$text_to_search" "$file_to_check"; then
    return 0
  else
    return 1
  fi
}

replace_text() {
  file=$1
  text_to_search=$2
  text_to_replace=$3

  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i "" "s/$text_to_search/$text_to_replace/g" "$file"
  else
    # Linux
    sed -i "s/$text_to_search/$text_to_replace/g" "$file"
  fi
}

read_text() {
  file=$1
  text_to_search=$2
  text_to_return=$3

  echo $(sed -n -e "s/$text_to_search/$text_to_return/p" "$file")
}

escape_url() {
  echo "$1" | sed -e 's/[\/&]/\\&/g'
}

backup_database_schema() {
  echo "Backing up database schema..."
  db_user=$(read_text $docker_compose_file "postgres-username=\([^[:space:]]*\)" "\1")
  db_user=${db_user:-postgres}
  db_name=$(read_text $docker_compose_file "postgres-database=\([^[:space:]]*\)" "\1")
  db_name=${db_name:-postgres}
  mount_path=$(read_text $docker_compose_file "- \([^:]*\):\/var\/lib\/postgresql\/data" "\1")
  mount_path=${mount_path:-.data/postgres}

  timestamp=$(date +%Y%m%d%H%M%S)
  backup_filename="database-backup-$timestamp.sql"
  backup_path="/var/lib/postgresql/data/$backup_filename"
  docker-compose exec postgres bash -c "pg_dump -U $db_user -n public $db_name > $backup_path"

  if [ ! -f "$mount_path/$backup_filename" ]; then
    echo "Database schema backup failed. Operation cancelled."
    exit 1
  fi

  echo "Database schema backed up as $mount_path/$backup_filename"

  new_line
}

truncate_database_schema_tables() {
  echo "Truncating database schema tables..."
  db_user=$(read_text $docker_compose_file "postgres-username=\([^[:space:]]*\)" "\1")
  db_user=${db_user:-postgres}
  docker-compose exec postgres psql -U $db_user -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
  echo "Database schema tables truncated."
  new_line
}

modify_coordinator_ws_endpoint() {
  echo "Modifying coordinator ws endpoint..."
  replace_text $docker_compose_file "--ws-endpoint=" "--network-endpoint="
  echo "Coordinator ws endpoint modified."
  new_line
}

modify_network_type() {
  echo "Modifying network type..."
  replace_text $docker_compose_file "--network=[^[:space:]]*" "--network=mainnet"
  echo "Network type updated."
  new_line
}

modify_coordinator_version() {
  echo "Modifying coordinator version..."
  coordinator_version=$(ask_for_input "Enter the coordinator version (Leave empty to use default value)" "$coordinator_version_default")
  replace_text $docker_compose_file "image: subquerynetwork\/indexer-coordinator:[^[:space:]]*" "image: subquerynetwork\/indexer-coordinator:$coordinator_version"
  replace_text $docker_compose_file "image: subquerynetwork\/indexer-coordinator-dev:[^[:space:]]*" "image: subquerynetwork\/indexer-coordinator-dev:$coordinator_version"
  echo "Coordinator version updated."
  new_line
}

modify_proxy_version() {
  echo "Modifying proxy version..."
  proxy_version=$(ask_for_input "Enter the proxy version (Leave empty to use default value)" "$proxy_version_default")
  replace_text $docker_compose_file "image: subquerynetwork\/indexer-proxy:[^[:space:]]*" "image: subquerynetwork\/indexer-proxy:$proxy_version"
  echo "Proxy version updated."
  new_line
}

modify_network_endpoint() {
  echo "Modifying network endpoint..."
  network_endpoint=$(ask_for_input "Enter the network endpoint (Leave empty to use default value)" "https://mainnet.base.org")
  network_endpoint=$(escape_url $network_endpoint)
  replace_text $docker_compose_file "--network-endpoint=[^[:space:]]*" "--network-endpoint=$network_endpoint"
  echo "Network endpoint updated."
  new_line
}

ask_for_confirmation "Are you sure you have already withdrawn controller's MATIC?" "n"
ask_for_confirmation "Are you sure you have already unregistered as an indexer?" "n"
assert_file_exists $docker_compose_file
create_backup $docker_compose_file
backup_database_schema
truncate_database_schema_tables
modify_coordinator_ws_endpoint
modify_network_type
modify_coordinator_version
modify_proxy_version
modify_network_endpoint

echo "Migration completed. Please restart the coordinator services to apply the changes."
