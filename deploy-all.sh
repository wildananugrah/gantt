#!/bin/bash
set -e
set -o pipefail

REPO_DIR="/root/repo/gantt-chart-app"
DEPLOY_DIR="/var/www/html/gantt"
LOCK_STAMP="$REPO_DIR/.deploy/last-bun-lock.sha"

mkdir -p "$REPO_DIR/.deploy"

# --- Signal handling ------------------------------------------------------
# Make this script (and everything it spawns) its own process group so a
# single kill on us tears down vite/bun/etc. cleanly. Without this, GitHub
# Actions' cancel just kills the bash wrapper while the build keeps running.
set -m
trap 'echo ""; echo "[!] Caught signal — terminating deploy and all children..."; kill -- -$$ 2>/dev/null || true; exit 130' INT TERM

step() {
  local label="$1"; shift
  local t0=$(date +%s)
  echo ""
  echo "[$(date '+%H:%M:%S')] $label"
  "$@"
  local t1=$(date +%s)
  echo "  -> done in $((t1 - t0))s"
}

START_EPOCH=$(date +%s)
START_HUMAN=$(date '+%Y-%m-%d %H:%M:%S %Z')

echo "============================================"
echo "Deploy started at: $START_HUMAN"
echo "PID: $$ (kill -TERM -$$ to cancel)"
echo "============================================"

install_deps() {
  local current
  current=$(sha256sum "$REPO_DIR/bun.lock" | awk '{print $1}')
  local previous=""
  [ -f "$LOCK_STAMP" ] && previous=$(cat "$LOCK_STAMP")
  if [ "$current" = "$previous" ] && [ -d "$REPO_DIR/node_modules" ]; then
    echo "  (bun.lock unchanged, skipping install)"
    return 0
  fi
  cd "$REPO_DIR"
  bun install --frozen-lockfile
  echo "$current" > "$LOCK_STAMP"
}

step "Installing workspace dependencies"  install_deps
step "Applying database migrations"       bash -c "cd '$REPO_DIR' && bun run db:migrate"
step "Building client (Vite)"             bash -c "cd '$REPO_DIR/packages/client' && bun run build"
step "Restarting Hono server (PM2)"       bash -c "cd '$REPO_DIR/packages/server' && (make down || true) && make up"
step "Publishing client to $DEPLOY_DIR"   bash -c "mkdir -p '$DEPLOY_DIR' && rsync -a --delete '$REPO_DIR/packages/client/dist/' '$DEPLOY_DIR/'"

END_EPOCH=$(date +%s)
END_HUMAN=$(date '+%Y-%m-%d %H:%M:%S %Z')
ELAPSED=$((END_EPOCH - START_EPOCH))
ELAPSED_MIN=$((ELAPSED / 60))
ELAPSED_SEC=$((ELAPSED % 60))

echo ""
echo "============================================"
echo "Done!"
echo "Started:  $START_HUMAN"
echo "Finished: $END_HUMAN"
echo "Elapsed:  ${ELAPSED_MIN}m ${ELAPSED_SEC}s (${ELAPSED} seconds total)"
echo "============================================"
