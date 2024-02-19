#!/bin/bash

docker_compose_file="docker-compose.yml"

prompt_question() {
  prompt=$1
  default_value=$2

  echo -e $prompt >&2
  read user_input

  if [ -z "$user_input" ]; then
    echo $default_value
  else
    echo $user_input
  fi
}

ask_for_confirmation() {
  prompt=$1
  default_value=$2

  answer=$(prompt_question "$prompt (y/n, default is $default_value)" "$default_value")

  if [ "$answer" != "y" ]; then
    echo "Operation cancelled."
    exit 1
  fi

  new_line
}

ask_for_input() {
  prompt=$1
  default_value=$2

  answer=$(prompt_question "$prompt (default is $default_value)" "$default_value")

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
      answer=$(prompt_question "Backup file $backup_filename already exists.\nDo you want to overwrite it? (y/n, default is n)" "n")
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

  sed -i "" "s/$text_to_search/$text_to_replace/g" "$file"
}

escape_url() {
  echo "$1" | sed -e 's/[\/&]/\\&/g'
}

modify_coordinator_ws_endpoint() {
  echo "Modifying coordinator ws endpoint..."
  replace_text $docker_compose_file "--ws-endpoint=" "--network-endpoint="
  echo "Coordinator ws endpoint modified."
  new_line
}

modify_network_type() {
  echo "Modifying network type..."
  replace_text $docker_compose_file "--network-type=kepler" "--network-type=mainnet"
  echo "Network type updated."
  new_line
}

modify_network_endpoint() {
  echo "Modifying network endpoint..."
  network_endpoint=$(ask_for_input "Enter the network endpoint below: (Leave empty to use default value)" "https://mainnet.base.org")
  network_endpoint=$(escape_url $network_endpoint)
  replace_text $docker_compose_file "--network-endpoint=[^[:space:]]*" "--network-endpoint=$network_endpoint"
  echo "Network endpoint updated."
  new_line
}

modify_database_name() {
  echo "Modifying database name..."
  database_name=$(ask_for_input "Enter the database name below: (It SHOULD be different with your current one. If you never changed the previous default db name, you could leave it empty)" "coordinator_db")
  if $(check_text_exists $docker_compose_file "postgres-database"); then
    replace_text $docker_compose_file "postgres-database=[^[:space:]]*" "postgres-database=$database_name"
  else
    replace_text $docker_compose_file "\(.*\)- --postgres-host=[^\n]*" "&\n\1- --postgres-database=$database_name"
  fi
  echo "Database name updated."
  new_line
}

ask_for_confirmation "Are you sure you have already withdrawn controller's MATIC?" "n"
ask_for_confirmation "Are you sure you have already unregistered as an indexer?" "n"
assert_file_exists $docker_compose_file
create_backup $docker_compose_file
modify_coordinator_ws_endpoint
modify_network_type
modify_network_endpoint
modify_database_name

echo "Migration completed. Please restart the coordinator services to apply the changes."
