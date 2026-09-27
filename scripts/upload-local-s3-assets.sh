#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ASSETS_DIR="$PROJECT_ROOT/apps/infra/assets/s3"
GENERATED_ASSETS_DIR="$PROJECT_ROOT/apps/infra/.generated/s3"
VERSION_HISTORY_DIR="$PROJECT_ROOT/apps/infra/assets/s3-version-history"
LOCAL_GENERATED_ASSETS_DIR="$GENERATED_ASSETS_DIR/local"

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

AWS_LOCAL=(aws --endpoint-url http://127.0.0.1:4566)

put_object() {
  local source_file="$1"
  local bucket="$2"
  local key="$3"

  if [[ ! -f "$source_file" ]]; then
    echo "missing asset file: $source_file" >&2
    exit 1
  fi

  echo "[s3 assets] put $source_file -> s3://$bucket/$key"
  "${AWS_LOCAL[@]}" s3api put-object \
    --bucket "$bucket" \
    --key "$key" \
    --body "$source_file" >/dev/null
}

sync_dir() {
  local source_dir="$1"
  local destination="$2"

  if [[ ! -d "$source_dir" ]]; then
    echo "missing asset directory: $source_dir" >&2
    exit 1
  fi

  echo "[s3 assets] sync $source_dir -> $destination"
  "${AWS_LOCAL[@]}" s3 sync "$source_dir" "$destination"
}

sync_dir "$ASSETS_DIR/techvault-public-assets" "s3://techvault-public-assets-local/"
password_hint_file="$(mktemp)"
trap 'rm -f "$password_hint_file"' EXIT

bun run "$PROJECT_ROOT/apps/infra/scripts/generate-s3-assets.ts" local
sed 's#Secret name: tvault/evidence/password#Secret name: tvault/evidence/password-local#' \
  "$VERSION_HISTORY_DIR/techvault-internal-2026/documents/password_hint.txt.v1" \
  > "$password_hint_file"
put_object \
  "$password_hint_file" \
  "techvault-internal-2026-local" \
  "documents/password_hint.txt"
sync_dir "$LOCAL_GENERATED_ASSETS_DIR/techvault-internal-2026" "s3://techvault-internal-2026-local/"
"${AWS_LOCAL[@]}" s3api delete-object \
  --bucket "techvault-internal-2026-local" \
  --key "documents/password_hint.txt" >/dev/null
sync_dir "$LOCAL_GENERATED_ASSETS_DIR/tvault-cto-private/cto-evidence" "s3://tvault-cto-private-7a3f9c-local/cto-evidence/"

echo "[s3 assets] completed"
