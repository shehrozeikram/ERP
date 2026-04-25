#!/usr/bin/env bash
# Upload a mongodump folder (must contain sgc_erp/) to the Droplet for restore.
# Run from repo root. Uses same host as deploy-simple.sh. You will be prompted for SSH password unless keys are set.
#
# Usage:
#   ./scripts/upload-mongodump-to-droplet.sh
#   ./scripts/upload-mongodump-to-droplet.sh /path/to/mongodump-atlas-YYYYMMDD_HHMMSS
# Env:
#   MONGODUMP_DIR=name inside backups/ (default: mongodump-atlas-20260425_104814)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_USER="root"
SERVER_IP="68.183.215.177"
REMOTE_DIR="/root/mongodump-atlas-sgc_erp"
DEFAULT_NAME="${MONGODUMP_DIR:-mongodump-atlas-20260425_104814}"
DUMP_PATH="${1:-$REPO_ROOT/backups/$DEFAULT_NAME}"

if [[ ! -d "$DUMP_PATH/sgc_erp" ]]; then
  echo "Expected directory: $DUMP_PATH/sgc_erp"
  echo "Pass the full path to your dump folder as the first argument, or set MONGODUMP_DIR and run from repo with backups/<name>."
  exit 1
fi

echo "Uploading $DUMP_PATH/ -> ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/"
rsync -avz --progress "$DUMP_PATH/" "${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/"

echo "Uploading restore helper script to /root/"
scp "${REPO_ROOT}/scripts/mongorestore-on-droplet.sh" "${SERVER_USER}@${SERVER_IP}:/root/mongorestore-on-droplet.sh"
scp "${REPO_ROOT}/scripts/print-droplet-mongodb-uri.sh" "${SERVER_USER}@${SERVER_IP}:/root/print-droplet-mongodb-uri.sh"

echo ""
echo "Next — run these ONLY after:  ssh root@${SERVER_IP}"
echo "  (Do not run /root/... or /var/www/... on your Mac.)"
echo ""
echo "  chmod +x /root/mongorestore-on-droplet.sh /root/print-droplet-mongodb-uri.sh"
echo "  export MONGO_ADMIN_PASSWORD='YOUR_REAL_ADMIN_PASSWORD'"
echo "  /root/mongorestore-on-droplet.sh"
echo "  /root/print-droplet-mongodb-uri.sh"
echo "  nano /var/www/sgc-erp/.env"
echo "    Set NODE_ENV=production, paste MONGODB_URI from print script, remove MONGODB_URI_LOCAL line"
echo "  cd /var/www/sgc-erp && pm2 restart sgc-erp-backend && pm2 logs sgc-erp-backend --lines 30"
