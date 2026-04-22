#!/usr/bin/env bash
# Upload deploy/nginx-sgc-erp.conf and reload nginx on production.
# Same host/path as deploy-simple.sh — run from repo root; enter SSH password when prompted.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_USER="root"
SERVER_IP="68.183.215.177"
SERVER_PATH="/var/www/sgc-erp"

echo "Uploading nginx config to ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/deploy/"
scp "${REPO_ROOT}/deploy/nginx-sgc-erp.conf" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/deploy/nginx-sgc-erp.conf"

echo "Installing site + nginx reload on server..."
ssh "${SERVER_USER}@${SERVER_IP}" "cd ${SERVER_PATH} && bash scripts/nginx-production-setup.sh"

echo "OK: production nginx updated and reloaded."
