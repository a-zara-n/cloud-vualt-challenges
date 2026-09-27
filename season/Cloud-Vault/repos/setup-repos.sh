#!/usr/bin/env bash
#
# setup-repos.sh — Cloud Vault CTF用Gitリポジトリ生成スクリプト（冪等）
#
# 使い方:
#   cd season/Cloud-Vault/repos
#   bash setup-repos.sh
#
# 生成先: repos/generated/frontend-portal, repos/generated/backend-api
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GENERATED_DIR="${SCRIPT_DIR}/generated"

# 冪等: 既存のgenerated/を削除して再生成
if [ -d "$GENERATED_DIR" ]; then
  echo "[INFO] 既存の generated/ を削除します..."
  rm -rf "$GENERATED_DIR"
fi

mkdir -p "$GENERATED_DIR"

# ─────────────────────────────────────────────────
# ヘルパー関数
# ─────────────────────────────────────────────────

# copy_commit_files <commits_dir>/<commit_name> <repo_dir>
# コミットディレクトリからリポジトリへファイルをコピーする
copy_commit_files() {
  local commit_dir="$1"
  local repo_dir="$2"

  if [ ! -d "$commit_dir" ]; then
    echo "[WARN] コミットディレクトリが見つかりません: $commit_dir"
    return
  fi

  # .removed ファイルがあれば、記載されたファイルを削除
  if [ -f "$commit_dir/.removed" ]; then
    while IFS= read -r line; do
      # コメント行と空行をスキップ
      [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
      local target="$repo_dir/$line"
      if [ -f "$target" ]; then
        git -C "$repo_dir" rm -f "$line" 2>/dev/null || rm -f "$target"
      fi
    done < "$commit_dir/.removed"
  fi

  # .removed以外のファイルをコピー
  (
    cd "$commit_dir"
    find . -type f ! -name '.removed' | while IFS= read -r f; do
      local rel="${f#./}"
      local dest_dir
      dest_dir="$(dirname "$repo_dir/$rel")"
      mkdir -p "$dest_dir"
      cp "$commit_dir/$rel" "$repo_dir/$rel"
    done
  )
}

# make_commit <repo_dir> <date_iso> <author_name> <author_email> <message>
make_commit() {
  local repo_dir="$1"
  local date_iso="$2"
  local author_name="$3"
  local author_email="$4"
  local message="$5"

  git -C "$repo_dir" add -A
  GIT_AUTHOR_DATE="$date_iso" \
  GIT_COMMITTER_DATE="$date_iso" \
  GIT_AUTHOR_NAME="$author_name" \
  GIT_AUTHOR_EMAIL="$author_email" \
  GIT_COMMITTER_NAME="$author_name" \
  GIT_COMMITTER_EMAIL="$author_email" \
  git -C "$repo_dir" commit -m "$message" --allow-empty 2>/dev/null
}

# ─────────────────────────────────────────────────
# frontend-portal リポジトリ
# ─────────────────────────────────────────────────

echo ""
echo "========================================="
echo " frontend-portal リポジトリを生成中..."
echo "========================================="

FP_REPO="${GENERATED_DIR}/frontend-portal"
FP_COMMITS="${SCRIPT_DIR}/frontend-portal/commits"

mkdir -p "$FP_REPO"
git -C "$FP_REPO" init
git -C "$FP_REPO" checkout -b main 2>/dev/null || true

# 著者情報
SUZUKI_NAME="Suzuki Yuki"
SUZUKI_EMAIL="suzuki@techvault.example"
YAMAMOTO_NAME="Yamamoto Rina"
YAMAMOTO_EMAIL="yamamoto@techvault.example"
TANAKA_NAME="Tanaka Taro"
TANAKA_EMAIL="tanaka@techvault.example"

# コミット01: initial commit
copy_commit_files "$FP_COMMITS/01-initial" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-01T09:00:00+09:00" "$SUZUKI_NAME" "$SUZUKI_EMAIL" "feat: initial commit"
echo "[01/14] feat: initial commit"

# コミット02: dashboard and login pages
copy_commit_files "$FP_COMMITS/02-dashboard-login" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-01T09:35:00+09:00" "$SUZUKI_NAME" "$SUZUKI_EMAIL" "feat: add dashboard and login pages"
echo "[02/14] feat: add dashboard and login pages"

# コミット03: shared UI components
copy_commit_files "$FP_COMMITS/03-ui-components" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-01T10:10:00+09:00" "$YAMAMOTO_NAME" "$YAMAMOTO_EMAIL" "feat: add shared UI components"
echo "[03/14] feat: add shared UI components"

# コミット04: Tailwind CSS configuration
copy_commit_files "$FP_COMMITS/04-tailwind" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-01T10:45:00+09:00" "$YAMAMOTO_NAME" "$YAMAMOTO_EMAIL" "style: add Tailwind CSS configuration"
echo "[04/14] style: add Tailwind CSS configuration"

# コミット05: API client and auth service
copy_commit_files "$FP_COMMITS/05-api-client" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-01T11:20:00+09:00" "$SUZUKI_NAME" "$SUZUKI_EMAIL" "feat: add API client and auth service"
echo "[05/14] feat: add API client and auth service"

# コミット06: deployment config（★.envにAWSキー+フラグ）
copy_commit_files "$FP_COMMITS/06-deploy-config" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-01T13:30:00+09:00" "$TANAKA_NAME" "$TANAKA_EMAIL" "chore: add deployment config"
echo "[06/14] chore: add deployment config ★.envにAWSキー含む"

# コミット07: remove credentials（.envを削除）
copy_commit_files "$FP_COMMITS/07-remove-creds" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-01T14:05:00+09:00" "$TANAKA_NAME" "$TANAKA_EMAIL" "fix: remove credentials from repository"
echo "[07/14] fix: remove credentials from repository"

# コミット08: .env.example
copy_commit_files "$FP_COMMITS/08-env-example" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-01T14:35:00+09:00" "$TANAKA_NAME" "$TANAKA_EMAIL" "chore: add .env.example for developers"
echo "[08/14] chore: add .env.example for developers"

# コミット09: AI chat interface
copy_commit_files "$FP_COMMITS/09-chat" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-01T15:10:00+09:00" "$SUZUKI_NAME" "$SUZUKI_EMAIL" "feat: add AI chat interface"
echo "[09/14] feat: add AI chat interface"

# コミット10: responsive layout
copy_commit_files "$FP_COMMITS/10-responsive" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-01T15:45:00+09:00" "$YAMAMOTO_NAME" "$YAMAMOTO_EMAIL" "style: improve responsive layout"
echo "[10/14] style: improve responsive layout"

# コミット11: error boundary
copy_commit_files "$FP_COMMITS/11-error-boundary" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-01T16:20:00+09:00" "$SUZUKI_NAME" "$SUZUKI_EMAIL" "fix: add error boundary and loading states"
echo "[11/14] fix: add error boundary and loading states"

# コミット12: footer with github link
copy_commit_files "$FP_COMMITS/12-footer-update" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-01T17:00:00+09:00" "$SUZUKI_NAME" "$SUZUKI_EMAIL" "feat: update footer with github link"
echo "[12/14] feat: update footer with github link"

# コミット13: README
copy_commit_files "$FP_COMMITS/13-readme" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-02T09:30:00+09:00" "$TANAKA_NAME" "$TANAKA_EMAIL" "docs: update README with setup instructions"
echo "[13/14] docs: update README with setup instructions"

# コミット14: CI fix
copy_commit_files "$FP_COMMITS/14-ci-fix" "$FP_REPO"
make_commit "$FP_REPO" "2026-02-02T10:15:00+09:00" "$SUZUKI_NAME" "$SUZUKI_EMAIL" "fix: update CI workflow node version"
echo "[14/14] fix: update CI workflow node version"

echo ""
echo "[OK] frontend-portal: $(git -C "$FP_REPO" rev-list --count HEAD) コミット"
echo ""

# ─────────────────────────────────────────────────
# backend-api リポジトリ
# ─────────────────────────────────────────────────

echo "========================================="
echo " backend-api リポジトリを生成中..."
echo "========================================="

BA_REPO="${GENERATED_DIR}/backend-api"
BA_MAIN_COMMITS="${SCRIPT_DIR}/backend-api/commits/main"
BA_BRANCH_COMMITS="${SCRIPT_DIR}/backend-api/commits/feature-old-auth"

SATO_NAME="Sato Hiroshi"
SATO_EMAIL="sato@techvault.example"

mkdir -p "$BA_REPO"
git -C "$BA_REPO" init
git -C "$BA_REPO" checkout -b main 2>/dev/null || true

# main コミット01: initial Express.js setup
copy_commit_files "$BA_MAIN_COMMITS/01-initial" "$BA_REPO"
make_commit "$BA_REPO" "2026-02-01T09:10:00+09:00" "$SUZUKI_NAME" "$SUZUKI_EMAIL" "feat: initial Express.js setup"
echo "[main 01/10] feat: initial Express.js setup"

# main コミット02: JWT verification middleware
copy_commit_files "$BA_MAIN_COMMITS/02-auth-middleware" "$BA_REPO"
make_commit "$BA_REPO" "2026-02-01T09:50:00+09:00" "$SUZUKI_NAME" "$SUZUKI_EMAIL" "feat: add JWT verification middleware"
echo "[main 02/10] feat: add JWT verification middleware"

# main コミット03: Cognito authentication
copy_commit_files "$BA_MAIN_COMMITS/03-cognito" "$BA_REPO"
make_commit "$BA_REPO" "2026-02-01T10:30:00+09:00" "$SATO_NAME" "$SATO_EMAIL" "feat: integrate Cognito authentication"
echo "[main 03/10] feat: integrate Cognito authentication"

# ★ ここで feature/old-auth ブランチを分岐
BRANCH_POINT=$(git -C "$BA_REPO" rev-parse HEAD)
echo ""
echo "[INFO] feature/old-auth ブランチを分岐: $BRANCH_POINT"

# main コミット04〜10 を先に進める
copy_commit_files "$BA_MAIN_COMMITS/04-data-endpoints" "$BA_REPO"
make_commit "$BA_REPO" "2026-02-01T11:20:00+09:00" "$SATO_NAME" "$SATO_EMAIL" "feat: add data processing endpoints"
echo "[main 04/10] feat: add data processing endpoints"

copy_commit_files "$BA_MAIN_COMMITS/05-error-handling" "$BA_REPO"
make_commit "$BA_REPO" "2026-02-01T12:10:00+09:00" "$SUZUKI_NAME" "$SUZUKI_EMAIL" "fix: improve error handling and logging"
echo "[main 05/10] fix: improve error handling and logging"

copy_commit_files "$BA_MAIN_COMMITS/06-lambda-deploy" "$BA_REPO"
make_commit "$BA_REPO" "2026-02-01T13:00:00+09:00" "$SUZUKI_NAME" "$SUZUKI_EMAIL" "feat: add Lambda deployment config"
echo "[main 06/10] feat: add Lambda deployment config"

copy_commit_files "$BA_MAIN_COMMITS/07-health-check" "$BA_REPO"
make_commit "$BA_REPO" "2026-02-01T13:40:00+09:00" "$SATO_NAME" "$SATO_EMAIL" "feat: add health check endpoint"
echo "[main 07/10] feat: add health check endpoint"

copy_commit_files "$BA_MAIN_COMMITS/08-rate-limit" "$BA_REPO"
make_commit "$BA_REPO" "2026-02-01T14:20:00+09:00" "$YAMAMOTO_NAME" "$YAMAMOTO_EMAIL" "feat: add rate limiting middleware"
echo "[main 08/10] feat: add rate limiting middleware"

copy_commit_files "$BA_MAIN_COMMITS/09-tests" "$BA_REPO"
make_commit "$BA_REPO" "2026-02-01T15:05:00+09:00" "$SUZUKI_NAME" "$SUZUKI_EMAIL" "test: add unit tests for auth"
echo "[main 09/10] test: add unit tests for auth"

copy_commit_files "$BA_MAIN_COMMITS/10-docs" "$BA_REPO"
make_commit "$BA_REPO" "2026-02-02T09:00:00+09:00" "$SATO_NAME" "$SATO_EMAIL" "docs: update API documentation"
echo "[main 10/10] docs: update API documentation"

echo ""
echo "[OK] backend-api main: $(git -C "$BA_REPO" rev-list --count HEAD) コミット"

# feature/old-auth ブランチを作成（コミット03から分岐）
echo ""
echo "[INFO] feature/old-auth ブランチを作成中..."
git -C "$BA_REPO" checkout -b "feature/old-auth" "$BRANCH_POINT"

# ブランチ コミット01: legacy auth migration（★フラグ含む）
copy_commit_files "$BA_BRANCH_COMMITS/01-legacy-auth" "$BA_REPO"
make_commit "$BA_REPO" "2026-02-01T11:05:00+09:00" "$SATO_NAME" "$SATO_EMAIL" "feat: add legacy auth migration"
echo "[feature/old-auth 01/03] feat: add legacy auth migration ★フラグ含む"

# ブランチ コミット02: auth migration notes
copy_commit_files "$BA_BRANCH_COMMITS/02-auth-docs" "$BA_REPO"
make_commit "$BA_REPO" "2026-02-01T11:35:00+09:00" "$SATO_NAME" "$SATO_EMAIL" "docs: add auth migration notes"
echo "[feature/old-auth 02/03] docs: add auth migration notes"

# ブランチ コミット03: clean up
copy_commit_files "$BA_BRANCH_COMMITS/03-cleanup" "$BA_REPO"
make_commit "$BA_REPO" "2026-02-01T12:05:00+09:00" "$SATO_NAME" "$SATO_EMAIL" "chore: clean up unused imports"
echo "[feature/old-auth 03/03] chore: clean up unused imports"

echo ""
echo "[OK] backend-api feature/old-auth: $(git -C "$BA_REPO" rev-list --count HEAD) コミット"

# main ブランチに戻す
git -C "$BA_REPO" checkout main

# ─────────────────────────────────────────────────
# 検証
# ─────────────────────────────────────────────────

echo ""
echo "========================================="
echo " 検証"
echo "========================================="

echo ""
echo "--- frontend-portal git log ---"
git -C "$FP_REPO" log --oneline --format="%h %ai %an: %s"

echo ""
echo "--- backend-api main git log ---"
git -C "$BA_REPO" log --oneline --format="%h %ai %an: %s"

echo ""
echo "--- backend-api feature/old-auth git log ---"
git -C "$BA_REPO" log --oneline --format="%h %ai %an: %s" "feature/old-auth"

# Stage 1C 検証: .envがコミット06に存在することを確認
echo ""
echo "--- Stage 1C 検証: .env in commit 06 ---"
FP_COMMIT_06=$(git -C "$FP_REPO" log --oneline --format="%h" --grep="add deployment config" | head -1)
if [ -n "$FP_COMMIT_06" ]; then
  echo "コミット: $FP_COMMIT_06"
  echo "--- .env 内容 ---"
  git -C "$FP_REPO" show "${FP_COMMIT_06}:.env" 2>/dev/null || echo "[ERROR] .env が見つかりません"
else
  echo "[ERROR] deployment config コミットが見つかりません"
fi

# Stage 2F 検証: legacy.jsにフラグが含まれることを確認
echo ""
echo "--- Stage 2F 検証: legacy.js in feature/old-auth ---"
echo "--- legacy.js 内容 ---"
git -C "$BA_REPO" show "feature/old-auth:src/auth/legacy.js" 2>/dev/null || echo "[ERROR] legacy.js が見つかりません"

echo ""
echo "========================================="
echo " 生成完了!"
echo "========================================="
echo ""
echo "リポジトリ:"
echo "  frontend-portal: $FP_REPO"
echo "  backend-api:     $BA_REPO"
echo ""
