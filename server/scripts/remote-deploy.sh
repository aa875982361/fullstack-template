#!/usr/bin/env bash

set -euo pipefail

VERSION="${VERSION:-}"
SERVER_HOST="${SERVER_HOST:-}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PATH="${SERVER_PATH:-/opt/lutra-fullstack-template/server}"
SSH_KEY_PATH="${SSH_KEY_PATH:-}"
REGISTRY="${IMAGE_REGISTRY:-ghcr.io}"
NAMESPACE="${IMAGE_NAMESPACE:-lutra-template}"

usage() {
  echo "Usage: $0 --version <tag> --host <host> --ssh-key <path> [--user root] [--path /opt/app/server]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --host)
      SERVER_HOST="$2"
      shift 2
      ;;
    --user)
      SERVER_USER="$2"
      shift 2
      ;;
    --path)
      SERVER_PATH="$2"
      shift 2
      ;;
    --ssh-key)
      SSH_KEY_PATH="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$VERSION" || -z "$SERVER_HOST" || -z "$SSH_KEY_PATH" ]]; then
  usage >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOTE="$SERVER_USER@$SERVER_HOST"
SSH_OPTS=(-i "$SSH_KEY_PATH" -o StrictHostKeyChecking=accept-new)

ssh "${SSH_OPTS[@]}" "$REMOTE" "mkdir -p '$SERVER_PATH'"
scp "${SSH_OPTS[@]}" "$SERVER_DIR/docker-compose.yml" "$REMOTE:$SERVER_PATH/docker-compose.yml"
ssh "${SSH_OPTS[@]}" "$REMOTE" "mkdir -p '$SERVER_PATH/volumes'"
scp -r "${SSH_OPTS[@]}" "$SERVER_DIR/volumes/api" "$SERVER_DIR/volumes/db" "$REMOTE:$SERVER_PATH/volumes/"
ssh "${SSH_OPTS[@]}" "$REMOTE" "mkdir -p '$SERVER_PATH/scripts'"
scp "${SSH_OPTS[@]}" "$SERVER_DIR/scripts/run-db-patches.sh" "$REMOTE:$SERVER_PATH/scripts/run-db-patches.sh"

ssh "${SSH_OPTS[@]}" "$REMOTE" "
  set -euo pipefail
  cd '$SERVER_PATH'
  export IMAGE_REGISTRY='$REGISTRY'
  export IMAGE_NAMESPACE='$NAMESPACE'
  export IMAGE_TAG='$VERSION'
  docker compose pull
  docker compose up -d --remove-orphans
  chmod +x scripts/run-db-patches.sh
  scripts/run-db-patches.sh
  docker compose ps
"
