#!/usr/bin/env bash
#
# SGC ERP — production deploy
#  1) Local preflight: clean tree, local HEAD == origin/main
#  2) Build React locally
#  3) rsync client/build + scp .env to server
#  4) Single SSH session on server:
#       stash if dirty → git pull → npm install
#       → copy build to /var/www/html (delete old chunks)
#       → nginx reload → PM2 restart (forced, with fallback)
#       → smoke checks → final PM2 restart → health check
#
set -euo pipefail

SERVER_USER="root"
SERVER_IP="68.183.215.177"
SERVER_PATH="/var/www/sgc-erp"
ENV_FILE=".env.production"
AUTO_STASH="${AUTO_STASH:-1}"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[ OK ]${NC} $*"; }
err()  { echo -e "${RED}[ ERR]${NC} $*"; }

need() {
  command -v "$1" >/dev/null 2>&1 || { err "Missing: $1"; exit 1; }
}

info "SGC ERP deployment starting..."
need git; need npm; need ssh; need rsync; need scp

[ -f "$ENV_FILE" ] || { err "$ENV_FILE not found."; exit 1; }

if [ -n "$(git status --porcelain)" ]; then
  err "Local repo has uncommitted changes. Commit/stash first."
  exit 1
fi

info "Checking local HEAD == origin/main..."
git fetch origin main
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
if [ "$LOCAL" != "$REMOTE" ]; then
  err "Local HEAD is not origin/main. Push your commits first."
  echo "  local : $LOCAL"
  echo "  remote: $REMOTE"
  exit 1
fi
info "Local HEAD: $(git rev-parse --short HEAD)"

# ── 1. Build React ──────────────────────────────────────────────────────────
info "Building React (production)..."
(cd client && npm run build)
ok "React build complete."

# ── 2. Upload .env to /tmp so stash never touches it ────────────────────────
info "Uploading $ENV_FILE to server /tmp..."
scp -o ConnectTimeout=30 "$ENV_FILE" "${SERVER_USER}@${SERVER_IP}:/tmp/.sgc-env"

# ── 3. Upload React build ────────────────────────────────────────────────────
info "Uploading client build to server..."
rsync -az --delete --checksum \
  -e "ssh -o ConnectTimeout=30 -o ServerAliveInterval=20 -o ServerAliveCountMax=30" \
  "client/build/" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/client/build/"
ok "Build uploaded."

# ── 4. Remote deploy ─────────────────────────────────────────────────────────
info "Running remote deploy on server..."
ssh \
  -o ConnectTimeout=30 \
  -o ServerAliveInterval=20 \
  -o ServerAliveCountMax=30 \
  "${SERVER_USER}@${SERVER_IP}" \
  "SERVER_PATH='${SERVER_PATH}' AUTO_STASH='${AUTO_STASH}' bash -s" <<'ENDSSH'

S="$SERVER_PATH"
say() { echo "[server $(date -u +%H:%M:%S)] $*"; }

say "=== cd $S ==="
cd "$S"
say "pwd: $(pwd)"
say "HEAD before: $(git rev-parse --short HEAD)"

# --- stash if dirty (tracked + untracked so pull never fails) ---
if [ -n "$(git status --porcelain)" ]; then
  if [ "$AUTO_STASH" = "1" ]; then
    SNAME="deploy-stash-$(date +%Y%m%d_%H%M%S)"
    say "Dirty tree — stashing as $SNAME ..."
    git stash push -u -m "$SNAME"
    say "Stash done."
  else
    say "ERROR: dirty server tree and AUTO_STASH!=1"
    git status --short
    exit 1
  fi
fi

# --- pull latest code ---
say "git pull origin main..."
export GIT_TERMINAL_PROMPT=0
git pull --ff-only origin main
say "HEAD after: $(git rev-parse --short HEAD)"

# --- move .env into place ---
if [ -f /tmp/.sgc-env ]; then
  mv -f /tmp/.sgc-env "$S/.env"
  say ".env installed."
else
  say "WARNING: /tmp/.sgc-env not found — .env unchanged"
fi

# --- ensure persistent uploads dir ---
if [ -f "$S/.env" ]; then
  UP="$(grep -E '^[[:space:]]*SGC_UPLOADS_DIR=' "$S/.env" 2>/dev/null | tail -1 | sed 's/^[^=]*=//' | tr -d '\r' | xargs)"
  UP="${UP#\"}"; UP="${UP%\"}"; UP="${UP#\'}"; UP="${UP%\'}"
  [ -n "$UP" ] && { mkdir -p "$UP/cvs"; say "Uploads dir: $UP/cvs"; }
fi

# --- npm install ---
say "npm install --omit=dev..."
cd "$S"
npm install --omit=dev --omit=optional
say "npm install done."


# --- publish static files (remove stale hashed JS/CSS chunks) ---
say "Syncing build → /var/www/html..."
mkdir -p /var/www/html
rsync -a --delete "$S/client/build/" /var/www/html/
say "Static files synced."

# --- nginx ---
if [ -f "$S/scripts/nginx-production-setup.sh" ]; then
  say "Running nginx-production-setup.sh..."
  bash "$S/scripts/nginx-production-setup.sh"
else
  say "Reloading nginx..."
  systemctl reload nginx
fi

# --- PM2 restart helper ---
pm2_restart() {
  local lbl="$1"
  say "--- PM2 $lbl: sgc-erp-backend ---"
  mkdir -p "$S/logs" "$S/server/uploads/cvs"
  if pm2 describe sgc-erp-backend >/dev/null 2>&1; then
    pm2 restart sgc-erp-backend --update-env || {
      say "restart failed — deleting and starting fresh"
      pm2 delete sgc-erp-backend 2>/dev/null || true
      pm2 start "$S/ecosystem.config.js" --env production --only sgc-erp-backend
    }
  else
    say "app not in PM2 list — starting fresh"
    pm2 start "$S/ecosystem.config.js" --env production --only sgc-erp-backend
  fi
  pm2 save --force
  say "--- PM2 $lbl done ---"
}

pm2_restart "restart-1"
sleep 4

# check it's running
if ! pm2 list | grep -q "sgc-erp-backend.*online"; then
  say "ERROR: sgc-erp-backend not online after restart-1"
  pm2 list
  exit 1
fi

# --- smoke checks ---
say "Health check..."
curl -fsS "http://127.0.0.1:5001/api/health" >/dev/null && say "Health OK"

CODE="$(curl -s -o /tmp/smoke.json -w '%{http_code}' \
  -X PUT http://127.0.0.1:5001/api/procurement/requisitions/000000000000000000000000/reject \
  -H 'Content-Type: application/json' \
  --data '{"observation":"smoke"}')"
[ "$CODE" = "404" ] && { say "ERROR: reject route 404"; cat /tmp/smoke.json; exit 1; }
say "Reject-route HTTP: $CODE  (OK)"

pm2_restart "restart-2"
sleep 3

if ! pm2 list | grep -q "sgc-erp-backend.*online"; then
  say "ERROR: sgc-erp-backend not online after restart-2"
  pm2 list
  exit 1
fi

say "Final health check..."
curl -fsS "http://127.0.0.1:5001/api/health" | tr -d '\r'
echo ""

say "=== PM2 status ==="
pm2 list

say "=== DEPLOY COMPLETE === HEAD=$(git rev-parse --short HEAD)"
ENDSSH

ok "Deployment finished!"
info "Deployed commit: $(git rev-parse --short HEAD)"
info "Verify: ssh ${SERVER_USER}@${SERVER_IP} 'pm2 list && curl -s http://127.0.0.1:5001/api/health'"
