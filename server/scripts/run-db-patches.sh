#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INIT_DIR="$SERVER_DIR/volumes/db/init"
MIGRATIONS_DIR="$SERVER_DIR/volumes/db/migrations"
DB_SERVICE="${DB_SERVICE:-db}"
REST_SERVICE="${REST_SERVICE:-rest}"
DB_USER="${DB_USER:-supabase_admin}"
DB_NAME="${DB_NAME:-postgres}"

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    echo "Docker Compose v2 is required, but 'docker compose' is not available." >&2
    exit 1
  fi
}

wait_for_db() {
  local attempt

  for attempt in $(seq 1 30); do
    if compose_cmd exec -T "$DB_SERVICE" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then
      echo "Database is ready"
      return 0
    fi

    echo "Waiting for database... ($attempt/30)"
    sleep 2
  done

  echo "Database did not become ready in time" >&2
  return 1
}

run_sql_file() {
  local file_path=$1
  local file_name

  file_name="$(basename "$file_path")"
  echo "Running database patch: $file_name"
  compose_cmd exec -T "$DB_SERVICE" psql \
    -v ON_ERROR_STOP=1 \
    -U "$DB_USER" \
    -d "$DB_NAME" < "$file_path"
}

run_sql_dir() {
  local dir_path=$1
  local label=$2
  local count=0

  echo ""
  echo "==== $label ===="

  if [[ ! -d "$dir_path" ]]; then
    echo "Directory not found: $dir_path"
    return 0
  fi

  while IFS= read -r file_path; do
    run_sql_file "$file_path"
    count=$((count + 1))
  done < <(find "$dir_path" -maxdepth 1 -type f -name '*.sql' | sort)

  if [[ "$count" -eq 0 ]]; then
    echo "No SQL patches found"
  else
    echo "$label complete: $count file(s)"
  fi
}

cd "$SERVER_DIR"
wait_for_db
run_sql_dir "$INIT_DIR" "Init patches"
run_sql_dir "$MIGRATIONS_DIR" "Migration patches"

if compose_cmd ps -q "$REST_SERVICE" >/dev/null 2>&1; then
  echo ""
  echo "Restarting PostgREST to refresh schema cache"
  compose_cmd restart "$REST_SERVICE"
fi

echo ""
echo "Database patch run complete"

