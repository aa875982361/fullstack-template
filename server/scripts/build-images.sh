#!/usr/bin/env bash

set -euo pipefail

VERSION="${VERSION:-}"
REGISTRY="${IMAGE_REGISTRY:-${REGISTRY:-ghcr.io}}"
NAMESPACE="${IMAGE_NAMESPACE:-${NAMESPACE:-lutra-template}}"
SERVICES="${SERVICES:-api-service,deepseek-service,h5}"
PUSH=false

usage() {
  echo "Usage: $0 --version <tag> [--services api-service,deepseek-service,h5] [--push]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --services)
      SERVICES="$2"
      shift 2
      ;;
    --push)
      PUSH=true
      shift
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

if [[ -z "$VERSION" ]]; then
  echo "Missing --version" >&2
  usage >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$SERVER_DIR"

IFS=',' read -ra SERVICE_LIST <<< "$SERVICES"

for service in "${SERVICE_LIST[@]}"; do
  image="$REGISTRY/$NAMESPACE/$service:$VERSION"
  echo "Building $image"
  if [[ "$service" == "h5" ]]; then
    docker build -t "$image" "../frontend"
  else
    docker build -t "$image" "./$service"
  fi

  if [[ "$PUSH" == "true" ]]; then
    echo "Pushing $image"
    docker push "$image"
  fi
done

