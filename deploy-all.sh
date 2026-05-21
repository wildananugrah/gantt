#!/bin/bash
set -e

REPO_DIR="/root/repo/gantt-chart-app"
DEPLOY_DIR="/var/www/html/gantt"

START_EPOCH=$(date +%s)
START_HUMAN=$(date '+%Y-%m-%d %H:%M:%S %Z')

echo "============================================"
echo "Deploy started at: $START_HUMAN"
echo "============================================"

echo ""
echo "[$(date '+%H:%M:%S')] Installing workspace dependencies..."
cd "$REPO_DIR"
bun install

echo ""
echo "[$(date '+%H:%M:%S')] Applying database migrations..."
bun run db:migrate

echo ""
echo "[$(date '+%H:%M:%S')] Building client (Vite production bundle)..."
cd "$REPO_DIR/packages/client"
bun run build

echo ""
echo "[$(date '+%H:%M:%S')] Restarting Hono server..."
cd "$REPO_DIR/packages/server"
make down; make up;

echo ""
echo "[$(date '+%H:%M:%S')] Publishing client to $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR"
rsync -a --delete "$REPO_DIR/packages/client/dist/" "$DEPLOY_DIR/"

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
