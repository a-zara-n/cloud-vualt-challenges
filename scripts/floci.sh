#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENDPOINT="${AWS_ENDPOINT_URL:-http://127.0.0.1:4566}"

cd "$PROJECT_ROOT"

print_health() {
  local response
  response=$(curl -fsS "$ENDPOINT/_floci/health") || return 1
  if command -v jq >/dev/null 2>&1; then
    printf '%s\n' "$response" | jq -r '"Floci \(.version) (\(.edition)); \(.services | length) services"'
  else
    echo "Floci health endpoint responded"
  fi
}

case "${1:-up}" in
  up)
    if print_health >/dev/null 2>&1; then
      echo "Floci はすでに起動しています"
      print_health
      exit 0
    fi
    if curl -fsS "$ENDPOINT/_localstack/health" >/dev/null 2>&1; then
      echo "Port 4566 is occupied by LocalStack. Stop cloud-vault-localstack before starting Floci." >&2
      exit 1
    fi
    docker compose up -d floci
    for _ in {1..60}; do
      if print_health >/dev/null 2>&1; then
        echo "Floci が起動しました"
        print_health
        exit 0
      fi
      sleep 2
    done
    docker compose logs --tail=50 floci
    echo "Floci did not become healthy" >&2
    exit 1
    ;;
  down)
    docker compose stop floci
    echo "Floci を停止しました"
    ;;
  logs)
    docker compose logs -f floci
    ;;
  status)
    print_health || { echo "Floci が起動していません" >&2; exit 1; }
    ;;
  *)
    echo "Usage: $0 {up|down|logs|status}" >&2
    exit 1
    ;;
esac
