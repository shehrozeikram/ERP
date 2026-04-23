#!/usr/bin/env bash

# SGC ERP - safer production deployment script
# - Builds client locally
# - Uploads build and production env to server
# - Updates server code from origin/main with preflight checks
# - Restarts PM2 and runs API smoke checks

set -euo pipefail

SERVER_USER="root"
SERVER_IP="68.183.215.177"
SERVER_PATH="/var/www/sgc-erp"
ENV_FILE=".env.production"
AUTO_STASH_SERVER_CHANGES="${AUTO_STASH_SERVER_CHANGES:-1}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${YELLOW}$1${NC}"; }
log_ok() { echo -e "${GREEN}$1${NC}"; }
log_err() { echo -e "${RED}$1${NC}"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_err "Missing required command: $1"
    exit 1
  fi
}

log_info "Starting SGC ERP deployment..."

require_cmd git
require_cmd npm
require_cmd ssh
require_cmd rsync
require_cmd scp

if [ ! -f "$ENV_FILE" ]; then
  log_err "$ENV_FILE not found. Create it from .env.production.example and fill values."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  log_err "Local repo has uncommitted changes. Commit/stash first, then deploy."
  exit 1
fi

log_info "Checking local branch sync with origin/main..."
git fetch origin main
LOCAL_COMMIT="$(git rev-parse HEAD)"
REMOTE_COMMIT="$(git rev-parse origin/main)"
if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
  log_err "Local HEAD is not at origin/main. Pull/rebase/push first, then deploy."
  echo "Local : $LOCAL_COMMIT"
  echo "Remote: $REMOTE_COMMIT"
  exit 1
fi

log_info "Building React app locally..."
(cd client && npm run build)

log_info "Uploading client build artifacts..."
rsync -avz --delete "client/build/" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/client/build/"

log_info "Uploading production environment..."
scp "$ENV_FILE" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/.env.deploy"

log_info "Deploying on server..."
ssh "${SERVER_USER}@${SERVER_IP}" "SERVER_PATH='${SERVER_PATH}' AUTO_STASH_SERVER_CHANGES='${AUTO_STASH_SERVER_CHANGES}' bash -s" <<'ENDSSH'
set -euo pipefail

cd "$SERVER_PATH"
echo "Server path: $(pwd)"

CURRENT_COMMIT="$(git rev-parse --short HEAD)"
echo "Current commit: ${CURRENT_COMMIT}"

if [ -n "$(git status --porcelain)" ]; then
  if [ "$AUTO_STASH_SERVER_CHANGES" = "1" ]; then
    STASH_NAME="deploy-auto-stash-$(date +%Y%m%d_%H%M%S)"
    echo "Dirty server working tree detected. Auto-stashing as ${STASH_NAME}..."
    git stash push -u -m "${STASH_NAME}" >/dev/null
    echo "Auto-stash created."
  else
    echo "ERROR: Server working tree is dirty. Clean or stash changes, then redeploy."
    git status --short
    exit 1
  fi
fi

echo "Pulling latest code from origin/main..."
git pull --ff-only origin main
NEW_COMMIT="$(git rev-parse --short HEAD)"
echo "Updated commit: ${NEW_COMMIT}"

if [ -f ".env.deploy" ]; then
  mv ".env.deploy" ".env"
  echo "Environment file updated from .env.deploy"
fi

echo "Installing production dependencies..."
npm install --omit=dev --omit=optional

mkdir -p "client/build"
echo "Syncing frontend build to /var/www/html..."
cp -a client/build/. /var/www/html/

if [ -f "scripts/nginx-production-setup.sh" ]; then
  echo "Applying nginx setup script..."
  bash scripts/nginx-production-setup.sh
else
  echo "Reloading nginx..."
  systemctl reload nginx
fi

echo "Restarting backend process..."
mkdir -p logs
if pm2 describe sgc-erp-backend >/dev/null 2>&1; then
  if ! pm2 restart sgc-erp-backend --update-env; then
    echo "Restart failed; attempting fresh start from ecosystem file..."
    pm2 delete sgc-erp-backend >/dev/null 2>&1 || true
    pm2 start ecosystem.config.js --env production --only sgc-erp-backend
  fi
else
  pm2 start ecosystem.config.js --env production --only sgc-erp-backend
fi
pm2 save

sleep 3
if ! pm2 list | grep -q "sgc-erp-backend.*online"; then
  echo "ERROR: sgc-erp-backend is not online after restart."
  exit 1
fi

echo "Running smoke checks..."
curl -fsS "http://127.0.0.1:5001/api/health" >/dev/null

REJECT_CODE="$(curl -s -o /tmp/reject-route-smoke.json -w '%{http_code}' \
  -X PUT 'http://127.0.0.1:5001/api/procurement/requisitions/000000000000000000000000/reject' \
  -H 'Content-Type: application/json' \
  --data '{"observation":"smoke-test"}')"

if [ "$REJECT_CODE" = "404" ]; then
  echo "ERROR: Reject requisition route returned 404 (route missing)."
  cat /tmp/reject-route-smoke.json
  exit 1
fi

echo "Reject route smoke response code: $REJECT_CODE"
echo "Server deploy completed successfully."
ENDSSH

log_ok "Deployment completed successfully."
log_info "Check status: ssh ${SERVER_USER}@${SERVER_IP} 'cd ${SERVER_PATH} && pm2 status'"
