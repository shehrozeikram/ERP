#!/usr/bin/env bash
# Assign employee placementCompany from project rules on PRODUCTION (tovus.net droplet).
# ONLY updates placementCompany — no other employee fields.
#
# From your Mac (repo root):
#   ./scripts/assign-employee-companies-on-droplet.sh --dry-run
#   ./scripts/assign-employee-companies-on-droplet.sh --yes
#
# On the server directly:
#   cd /var/www/sgc-erp
#   NODE_ENV=production node server/scripts/assign-employee-companies-by-project.js --dry-run
#   NODE_ENV=production node server/scripts/assign-employee-companies-by-project.js --yes

set -euo pipefail

SERVER_USER="${SERVER_USER:-root}"
SERVER_IP="${SERVER_IP:-68.183.215.177}"
SERVER_PATH="${SERVER_PATH:-/var/www/sgc-erp}"

MODE="${1:---dry-run}"
if [[ "$MODE" != "--dry-run" && "$MODE" != "--yes" && "$MODE" != "--list-projects" ]]; then
  echo "Usage: $0 [--dry-run|--yes|--list-projects]"
  exit 1
fi

echo "==> SSH ${SERVER_USER}@${SERVER_IP}"
echo "    cd ${SERVER_PATH} && NODE_ENV=production node server/scripts/assign-employee-companies-by-project.js ${MODE}"
echo ""

ssh "${SERVER_USER}@${SERVER_IP}" "cd ${SERVER_PATH} && NODE_ENV=production node server/scripts/assign-employee-companies-by-project.js ${MODE}"

echo ""
echo "==> Done."
