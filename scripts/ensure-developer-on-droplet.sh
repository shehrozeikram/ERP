#!/usr/bin/env bash
# Create/update developer@tovus.net on the PRODUCTION MongoDB (same host as deploy-simple.sh).
# Deploying the app does NOT insert users — you must run this once (or after DB restore).
#
# Usage (from your Mac, repo root):
#   ./scripts/ensure-developer-on-droplet.sh
# Optional:
#   SERVER_IP=1.2.3.4 SERVER_USER=root SERVER_PATH=/var/www/sgc-erp ./scripts/ensure-developer-on-droplet.sh

set -euo pipefail

SERVER_USER="${SERVER_USER:-root}"
SERVER_IP="${SERVER_IP:-68.183.215.177}"
SERVER_PATH="${SERVER_PATH:-/var/www/sgc-erp}"

echo "==> SSH ${SERVER_USER}@${SERVER_IP}"
echo "    cd ${SERVER_PATH} && NODE_ENV=production node server/scripts/ensure-developer-user.js"
echo "    (Set DEVELOPER_PASSWORD on the server before running if you want a custom password.)"
echo ""

ssh "${SERVER_USER}@${SERVER_IP}" "cd ${SERVER_PATH} && NODE_ENV=production node server/scripts/ensure-developer-user.js"

echo ""
echo "==> Done. Sign in at production with:"
echo "    Email:    developer@tovus.net"
echo "    Password: default is in CONFIG in server/scripts/ensure-developer-user.js (or set DEVELOPER_PASSWORD on the server and re-run the script there)."
