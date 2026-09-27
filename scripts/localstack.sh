#!/usr/bin/env bash
set -euo pipefail

# LocalStack を起動するスクリプト。既定は API key 不要の Community 版。
# Usage:
#   ./scripts/localstack.sh up      # 起動
#   ./scripts/localstack.sh down    # 停止
#   ./scripts/localstack.sh logs    # ログ表示
#   ./scripts/localstack.sh status  # ヘルスチェック

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"
export LOCALSTACK_API_KEY="${LOCALSTACK_API_KEY:-}"
if [[ -n "$LOCALSTACK_API_KEY" ]]; then
  export LOCALSTACK_IMAGE="${LOCALSTACK_IMAGE:-localstack/localstack-pro:latest}"
else
  export LOCALSTACK_IMAGE="${LOCALSTACK_IMAGE:-localstack/localstack:4.14.0}"
fi

print_health() {
  local response

  if ! response=$(curl -fsS http://127.0.0.1:4566/_localstack/health); then
    return 1
  fi

  if command -v jq >/dev/null 2>&1; then
    printf '%s\n' "$response" | jq .
  else
    printf '%s\n' "$response"
  fi
}

case "${1:-up}" in
  up)
    if print_health >/dev/null 2>&1; then
      echo "✅ LocalStack はすでに起動しています"
      print_health
      exit 0
    fi

    echo "🚀 ${LOCALSTACK_IMAGE} を起動..."
    docker compose up -d
    echo "⏳ LocalStack の起動を待機中..."
    docker compose exec localstack bash -c \
      'until curl -sf http://localhost:4566/_localstack/health > /dev/null 2>&1; do sleep 1; done'
    echo "✅ LocalStack が起動しました"
    print_health || true
    ;;
  down)
    docker compose down
    echo "✅ LocalStack を停止したのだ"
    ;;
  logs)
    docker compose logs -f localstack
    ;;
  status)
    print_health || echo "❌ LocalStack が起動していないのだ"
    ;;
  *)
    echo "Usage: $0 {up|down|logs|status}"
    exit 1
    ;;
esac
