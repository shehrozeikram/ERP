#!/usr/bin/env bash
#
# SGC ERP — production deploy
# 1) Local: clean repo, HEAD == origin/main, build client
# 2) Server: stage .env → stash if dirty → fetch/pull → npm install
# 3) Local→Server: rsync client/build (after pull so tree is clean)
# 4) Server: rsync --delete static to nginx docroot (drops old main.*.js chunks)
# 5) Server: nginx reload + PM2 restart backend (forced) + smoke + final PM2 + health
#
set -euo pipefail

SERVER_USER="root"
SERVER_IP="68.183.215.177"
SERVER_PATH="/var/www/sgc-erp"
ENV_FILE=".env.production"
AUTO_STASH_SERVER_CHANGES="${AUTO_STASH_SERVER_CHANGES:-1}"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_err() { echo -e "${RED}[ERR]${NC} $1"; }

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
  log_err "Local repo has uncommitted changes. Commit or stash first, then deploy."
  exit 1
fi

log_info "Checking local branch matches origin/main..."
git fetch origin main
LOCAL_COMMIT="$(git rev-parse HEAD)"
REMOTE_COMMIT="$(git rev-parse origin/main)"
if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
  log_err "Local HEAD is not origin/main. Push or pull, then deploy."
  echo "  Local : $LOCAL_COMMIT"
  echo "  Remote: $REMOTE_COMMIT"
  exit 1
fi

log_info "Building React app (production)..."
(cd client && npm run build)

log_info "Uploading $ENV_FILE to server /tmp (outside git repo)..."
scp "$ENV_FILE" "${SERVER_USER}@${SERVER_IP}:/tmp/.sgc-erp-env-deploy"

SSH_BASE=(ssh
  -o "ConnectTimeout=30"
  -o "ServerAliveInterval=20"
  -o "ServerAliveCountMax=30"
  "${SERVER_USER}@${SERVER_IP}"
)

# --- Remote phase A: git + dependencies (no frontend publish yet) ---
log_info "Remote: git sync + npm install..."
"${SSH_BASE[@]}" "cd '${SERVER_PATH}' && export SERVER_PATH='${SERVER_PATH}' && export AUTO_STASH_SERVER_CHANGES='${AUTO_STASH_SERVER_CHANGES}' && bash -s" <<'REMOTE_A'
set -euo pipefail
say() { echo "[server] $*"; }
cd "$SERVER_PATH"
say "Path: $(pwd)"
say "HEAD before: $(git rev-parse --short HEAD) ($(git rev-parse HEAD))"

if [ -n "$(git status --porcelain)" ]; then
  if [ "${AUTO_STASH_SERVER_CHANGES}" = "1" ]; then
    STASH_NAME="deploy-auto-stash-$(date +%Y%m%d_%H%M%S)"
    say "Dirty tree — stashing (tracked + untracked): ${STASH_NAME}"
    git stash push -u -m "${STASH_NAME}" >/dev/null
  else
    say "ERROR: dirty server tree. Set AUTO_STASH_SERVER_CHANGES=1 or clean manually."
    git status --short
    exit 1
  fi
fi

export GIT_TERMINAL_PROMPT=0
say "git fetch origin main..."
git fetch origin main
say "origin/main: $(git rev-parse --short origin/main)"
say "git pull --ff-only..."
git pull --ff-only origin main
say "HEAD after pull: $(git rev-parse --short HEAD) ($(git rev-parse HEAD))"

if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  say "ERROR: HEAD != origin/main after pull."
  exit 1
fi

if [ -f "/tmp/.sgc-erp-env-deploy" ]; then
  mv -f "/tmp/.sgc-erp-env-deploy" ".env"
  say ".env updated from deploy upload."
else
  say "WARN: /tmp/.sgc-erp-env-deploy missing — .env unchanged."
fi

if [ -f ".env" ]; then
  SGC_UP="$(grep -E '^[[:space:]]*SGC_UPLOADS_DIR=' .env 2>/dev/null | tail -1 | sed 's/^[^=]*=//' | tr -d '\r')"
  SGC_UP="${SGC_UP#\"}"; SGC_UP="${SGC_UP%\"}"; SGC_UP="${SGC_UP#\'}"; SGC_UP="${SGC_UP%\'}"
  SGC_UP="$(echo "$SGC_UP" | xargs)"
  if [ -n "$SGC_UP" ]; then
    mkdir -p "${SGC_UP}/cvs"
    say "CV uploads dir: ${SGC_UP}/cvs"
  fi
fi

say "npm install (production)..."
npm install --omit=dev --omit=optional
mkdir -p client/build
say "Remote phase A done."
REMOTE_A

# --- Upload fresh React build after server code matches GitHub ---
log_info "Rsync client/build → server:${SERVER_PATH}/client/build/ ..."
rsync -avz --delete "client/build/" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/client/build/"

# --- Remote phase B: publish static + nginx + PM2 (backend MUST restart) ---
log_info "Remote: publish frontend + nginx + PM2 backend restart..."
"${SSH_BASE[@]}" "cd '${SERVER_PATH}' && export SERVER_PATH='${SERVER_PATH}' && bash -s" <<'REMOTE_B'
set -euo pipefail
say() { echo "[server] $*"; }
cd "$SERVER_PATH"

say "Sync client/build → /var/www/html (delete stale hashed bundles)..."
mkdir -p /var/www/html
rsync -a --delete "client/build/" "/var/www/html/"

if [ -f "scripts/nginx-production-setup.sh" ]; then
  say "nginx-production-setup.sh"
  bash scripts/nginx-production-setup.sh
else
  say "nginx reload"
  systemctl reload nginx
fi

restart_backend() {
  local label="$1"
  say "======== PM2 ${label}: sgc-erp-backend ========"
  mkdir -p logs server/uploads/cvs
  if pm2 describe sgc-erp-backend >/dev/null 2>&1; then
    if ! pm2 restart sgc-erp-backend --update-env; then
      say "pm2 restart failed — delete + start"
      pm2 delete sgc-erp-backend >/dev/null 2>&1 || true
      pm2 start ecosystem.config.js --env production --only sgc-erp-backend
    fi
  else
    say "pm2 app missing — start"
    pm2 start ecosystem.config.js --env production --only sgc-erp-backend
  fi
  pm2 save
}

restart_backend "after-deploy"
sleep 3
if [ -z "$(pm2 pid sgc-erp-backend 2>/dev/null)" ]; then
  say "ERROR: no PID for sgc-erp-backend"
  pm2 list || true
  exit 1
fi

say "Smoke: GET /api/health"
curl -fsS "http://127.0.0.1:5001/api/health" >/dev/null

REJECT_CODE="$(curl -s -o /tmp/reject-route-smoke.json -w '%{http_code}' \
  -X PUT 'http://127.0.0.1:5001/api/procurement/requisitions/000000000000000000000000/reject' \
  -H 'Content-Type: application/json' \
  --data '{"observation":"smoke-test"}')"
if [ "$REJECT_CODE" = "404" ]; then
  say "ERROR: reject route 404"
  cat /tmp/reject-route-smoke.json
  exit 1
fi
say "Reject-route HTTP: ${REJECT_CODE}"

restart_backend "final"
sleep 3
if [ -z "$(pm2 pid sgc-erp-backend 2>/dev/null)" ]; then
  say "ERROR: backend not running after final restart"
  exit 1
fi

say "Final health:"
curl -fsS "http://127.0.0.1:5001/api/health" | tr -d '\r' || { say "ERROR: final health failed"; exit 1; }
echo ""
say "PM2 (excerpt):"
pm2 describe sgc-erp-backend 2>/dev/null | head -n 20 || pm2 list
say "Remote phase B done."
REMOTE_B

log_ok "Deployment finished."
log_info "Local commit deployed: $(git rev-parse --short HEAD)"
log_info "Check: ssh ${SERVER_USER}@${SERVER_IP} 'cd ${SERVER_PATH} && git rev-parse --short HEAD && pm2 pid sgc-erp-backend'"
