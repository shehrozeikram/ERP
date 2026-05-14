#!/usr/bin/env bash

# SGC ERP - safer production deployment script
# - Preflight: clean working tree, local HEAD == origin/main (push before deploy)
# - Builds client locally
# - Server phase 1: scp .env to /tmp → optional stash (tracked only by default) → git fetch/pull → verify HEAD=origin/main → npm install
# - rsync client/build (after pull so static bundle is not lost to stash/pull ordering)
# - Server phase 2: copy build to nginx docroot, PM2 restart (×2), smoke + health

set -euo pipefail

SERVER_USER="root"
SERVER_IP="68.183.215.177"
SERVER_PATH="/var/www/sgc-erp"
ENV_FILE=".env.production"
AUTO_STASH_SERVER_CHANGES="${AUTO_STASH_SERVER_CHANGES:-1}"
# Server auto-stash: 0 = tracked-only (default); 1 = include untracked (`git stash -u`).
AUTO_STASH_INCLUDE_UNTRACKED="${AUTO_STASH_INCLUDE_UNTRACKED:-0}"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

# Cyan + [INFO] so it is not mistaken for a warning (yellow/brown) or error (red).
log_info() { echo -e "${CYAN}[INFO] $1${NC}"; }
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

log_info "Uploading production environment (staged outside repo on server)..."
# Stage env file in /tmp (outside the git repo) so it is not affected by git stash.
scp "$ENV_FILE" "${SERVER_USER}@${SERVER_IP}:/tmp/.sgc-erp-env-deploy"

# ServerAlive* keeps long npm install from timing out; stdbuf line-buffers remote stdout on the server.
SSH_BASE=(ssh
  -o "ConnectTimeout=30"
  -o "ServerAliveInterval=20"
  -o "ServerAliveCountMax=12"
  "${SERVER_USER}@${SERVER_IP}"
)

# --- Phase 1: server repo = origin/main + npm install (NO static copy yet) ---
# Rationale: rsync must run AFTER stash/pull so the freshly built client is never wiped by
# auto-stash or superseded by an old tree; backend code matches the commit you built against.
log_info "Server phase 1: git sync + npm install (remote log line-buffered; 1–3 min)..."
"${SSH_BASE[@]}" "export SERVER_PATH='${SERVER_PATH}'; export AUTO_STASH_SERVER_CHANGES='${AUTO_STASH_SERVER_CHANGES}'; export AUTO_STASH_INCLUDE_UNTRACKED='${AUTO_STASH_INCLUDE_UNTRACKED:-0}'; command -v stdbuf >/dev/null 2>&1 && exec stdbuf -oL -eL bash -s || exec bash -s" <<'ENDSSH1'
set -euo pipefail

SERVER_TS() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
say() { echo "[server $(SERVER_TS)] $*"; }

cd "$SERVER_PATH"
say "Server path: $(pwd)"

BEFORE_FULL="$(git rev-parse HEAD)"
BEFORE_SHORT="$(git rev-parse --short HEAD)"
say "Current commit (before pull): ${BEFORE_SHORT}"
say "Full SHA before: ${BEFORE_FULL}"

if [ -n "$(git status --porcelain)" ]; then
  say "Server working tree is not clean — first lines of git status:"
  git status --short | head -25 || true
  if [ "$AUTO_STASH_SERVER_CHANGES" = "1" ]; then
    HAS_NON_UNTRACKED=""
    if [ -n "$(git status --porcelain | grep -v '^??')" ]; then
      HAS_NON_UNTRACKED=1
    fi
    if [ -n "$HAS_NON_UNTRACKED" ] || [ "${AUTO_STASH_INCLUDE_UNTRACKED:-0}" = "1" ]; then
      STASH_NAME="deploy-auto-stash-$(date +%Y%m%d_%H%M%S)"
      if [ "${AUTO_STASH_INCLUDE_UNTRACKED:-0}" = "1" ]; then
        say "Auto-stashing (tracked + untracked) as ${STASH_NAME}..."
        git stash push -u -m "${STASH_NAME}" >/dev/null
      else
        say "Auto-stashing tracked changes only as ${STASH_NAME} (set AUTO_STASH_INCLUDE_UNTRACKED=1 to add untracked)..."
        git stash push -m "${STASH_NAME}" >/dev/null || {
          say "WARNING: git stash had nothing to save; continuing."
        }
      fi
      say "Auto-stash step finished."
    else
      say "Only untracked files (e.g. logs); skipping stash. client/build is gitignored — pull will not delete it."
    fi
  else
    echo "ERROR: Server working tree is dirty. Clean or stash changes, then redeploy."
    git status --short
    exit 1
  fi
fi

export GIT_TERMINAL_PROMPT=0
say "Fetching origin/main..."
git fetch origin main
REMOTE_FULL="$(git rev-parse origin/main)"
REMOTE_SHORT="$(git rev-parse --short origin/main)"
say "origin/main is: ${REMOTE_SHORT} (${REMOTE_FULL})"
if [ "$BEFORE_FULL" = "$REMOTE_FULL" ]; then
  say "Already at origin/main (no new commits to pull)."
else
  say "Pulling fast-forward to origin/main..."
  git pull --ff-only origin main
fi
AFTER_FULL="$(git rev-parse HEAD)"
AFTER_SHORT="$(git rev-parse --short HEAD)"
say "Server HEAD after pull: ${AFTER_SHORT}"
say "Full SHA after: ${AFTER_FULL}"

ORIGIN_HEAD="$(git rev-parse origin/main)"
if [ "$AFTER_FULL" != "$ORIGIN_HEAD" ]; then
  say "ERROR: HEAD is not origin/main after pull (branch mismatch or partial state)."
  say "HEAD=$(git rev-parse HEAD) origin/main=$(git rev-parse origin/main)"
  exit 1
fi
say "Verified: server HEAD matches origin/main."

if [ -f "/tmp/.sgc-erp-env-deploy" ]; then
  mv "/tmp/.sgc-erp-env-deploy" ".env"
  say "Environment file updated from local .env.production (deploy upload)."
else
  say "WARNING: /tmp/.sgc-erp-env-deploy not found — .env NOT updated."
fi

# Easy Apply CVs: when SGC_UPLOADS_DIR is set, ensure persistent tree exists (survives git deploy).
if [ -f ".env" ]; then
  SGC_UP="$(grep -E '^[[:space:]]*SGC_UPLOADS_DIR=' .env 2>/dev/null | tail -1 | sed 's/^[^=]*=//' | tr -d '\r')"
  SGC_UP="${SGC_UP#\"}"
  SGC_UP="${SGC_UP%\"}"
  SGC_UP="${SGC_UP#\'}"
  SGC_UP="${SGC_UP%\'}"
  SGC_UP="$(echo "$SGC_UP" | xargs)"
  if [ -n "$SGC_UP" ]; then
    mkdir -p "${SGC_UP}/cvs"
    say "Persistent CV uploads: ${SGC_UP}/cvs"
  fi
fi

say "========== npm install (omit dev; can take 1–3 min) =========="
npm install --omit=dev --omit=optional
say "========== npm install finished =========="

mkdir -p "client/build"
say "========== Server phase 1 done (awaiting client build rsync) =========="
ENDSSH1

log_info "Uploading client build artifacts (after server git pull)..."
rsync -avz --delete "client/build/" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/client/build/"

# --- Phase 2: publish static + nginx + PM2 + smoke ---
log_info "Server phase 2: static → nginx, PM2, smoke checks..."
"${SSH_BASE[@]}" "export SERVER_PATH='${SERVER_PATH}'; command -v stdbuf >/dev/null 2>&1 && exec stdbuf -oL -eL bash -s || exec bash -s" <<'ENDSSH2'
set -euo pipefail

SERVER_TS() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
say() { echo "[server $(SERVER_TS)] $*"; }

cd "$SERVER_PATH"

say "Syncing frontend build to /var/www/html..."
cp -a client/build/. /var/www/html/

if [ -f "scripts/nginx-production-setup.sh" ]; then
  say "Applying nginx setup script..."
  bash scripts/nginx-production-setup.sh
else
  say "Reloading nginx..."
  systemctl reload nginx
fi

# --- PM2: restart backend (loads new Node code + .env) ---
restart_sgc_backend() {
  local phase="${1:-restart}"
  say "========== PM2 (${phase}): sgc-erp-backend =========="
  mkdir -p logs
  mkdir -p server/uploads/cvs
  if pm2 describe sgc-erp-backend >/dev/null 2>&1; then
    if ! pm2 restart sgc-erp-backend --update-env; then
      say "PM2 restart failed; removing stale process and starting from ecosystem.config.js ..."
      pm2 delete sgc-erp-backend >/dev/null 2>&1 || true
      pm2 start ecosystem.config.js --env production --only sgc-erp-backend
    fi
  else
    say "PM2 app missing; starting sgc-erp-backend from ecosystem.config.js ..."
    pm2 start ecosystem.config.js --env production --only sgc-erp-backend
  fi
  pm2 save
  say "========== PM2 (${phase}) finished =========="
}

restart_sgc_backend "after-deploy"

sleep 3
if [ -z "$(pm2 pid sgc-erp-backend 2>/dev/null)" ]; then
  say "ERROR: sgc-erp-backend has no PID after PM2 restart (not running)."
  pm2 list || true
  exit 1
fi

say "========== Smoke checks =========="
curl -fsS "http://127.0.0.1:5001/api/health" >/dev/null
say "Health: OK"

REJECT_CODE="$(curl -s -o /tmp/reject-route-smoke.json -w '%{http_code}' \
  -X PUT 'http://127.0.0.1:5001/api/procurement/requisitions/000000000000000000000000/reject' \
  -H 'Content-Type: application/json' \
  --data '{"observation":"smoke-test"}')"

if [ "$REJECT_CODE" = "404" ]; then
  say "ERROR: Reject requisition route returned 404 (route missing)."
  cat /tmp/reject-route-smoke.json
  exit 1
fi

say "Reject-route smoke HTTP code: ${REJECT_CODE} (expected non-404)"

# Final PM2 restart: picks up any late file/env consistency; quick no-op if already fresh.
restart_sgc_backend "final"

sleep 3
if [ -z "$(pm2 pid sgc-erp-backend 2>/dev/null)" ]; then
  say "ERROR: sgc-erp-backend has no PID after final PM2 restart."
  pm2 list || true
  exit 1
fi

say "========== Final health (visible) =========="
curl -fsS "http://127.0.0.1:5001/api/health" | tr -d '\r' || { say "ERROR: final health check failed"; exit 1; }
echo ""
say "PM2 describe sgc-erp-backend (excerpt):"
pm2 describe sgc-erp-backend 2>/dev/null | head -n 25 || pm2 list

say "========== Server deploy completed successfully. =========="
ENDSSH2

log_ok "Deployment completed successfully."
log_info "Local commit used for this build: $(git rev-parse --short HEAD) (full $(git rev-parse HEAD)) — should match server after phase 1."
log_info "Remote steps: phase1 git fetch/pull + npm install → rsync client/build → phase2 nginx + PM2 (×2) + smoke + final health."
log_info "Check backend: ssh ${SERVER_USER}@${SERVER_IP} 'cd ${SERVER_PATH} && pm2 status && curl -s http://127.0.0.1:5001/api/health'"
