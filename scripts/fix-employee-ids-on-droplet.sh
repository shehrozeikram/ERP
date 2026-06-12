#!/usr/bin/env bash
# Restore the 7 employee IDs on PRODUCTION MongoDB (tovus.net droplet).
#
# Usage (from your Mac, repo root):
#   ./scripts/fix-employee-ids-on-droplet.sh --dry-run
#   ./scripts/fix-employee-ids-on-droplet.sh
#
# Optional:
#   SERVER_IP=1.2.3.4 SERVER_USER=root SERVER_PATH=/var/www/sgc-erp ./scripts/fix-employee-ids-on-droplet.sh

set -euo pipefail

SERVER_USER="${SERVER_USER:-root}"
SERVER_IP="${SERVER_IP:-68.183.215.177}"
SERVER_PATH="${SERVER_PATH:-/var/www/sgc-erp}"

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
fi

echo "==> SSH ${SERVER_USER}@${SERVER_IP}"
echo "    cd ${SERVER_PATH} && NODE_ENV=production node server/scripts/fix-employee-ids-production.js ${DRY_RUN}"
echo ""

ssh "${SERVER_USER}@${SERVER_IP}" "cd ${SERVER_PATH} && NODE_ENV=production node server/scripts/fix-employee-ids-production.js ${DRY_RUN}"

echo ""
echo "==> Done."
