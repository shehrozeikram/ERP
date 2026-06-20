#!/usr/bin/env bash
# Assign employee placementCompany from project rules on PRODUCTION (tovus.net droplet).
# ONLY updates placementCompany — no other employee fields.
#
# From your Mac (repo root):
#   ./scripts/assign-employee-companies-on-droplet.sh --dry-run
#   ./scripts/assign-employee-companies-on-droplet.sh --yes
#   ./scripts/assign-employee-companies-on-droplet.sh --yes --fallback-company "SARDAR GROUP OF COMPANIES"
#
# On the server directly:
#   cd /var/www/sgc-erp
#   NODE_ENV=production node server/scripts/assign-employee-companies-by-project.js --dry-run
#   NODE_ENV=production node server/scripts/assign-employee-companies-by-project.js --yes --fallback-company "SARDAR GROUP OF COMPANIES"

set -euo pipefail

SERVER_USER="${SERVER_USER:-root}"
SERVER_IP="${SERVER_IP:-68.183.215.177}"
SERVER_PATH="${SERVER_PATH:-/var/www/sgc-erp}"

MODE="${1:---dry-run}"
EXTRA_ARGS=()
if [[ "$MODE" != "--dry-run" && "$MODE" != "--yes" && "$MODE" != "--list-projects" ]]; then
  echo "Usage: $0 [--dry-run|--yes|--list-projects] [--fallback-company \"Company Name\"]"
  exit 1
fi
shift || true
while [[ $# -gt 0 ]]; do
  EXTRA_ARGS+=("$1")
  shift
done

echo "==> SSH ${SERVER_USER}@${SERVER_IP}"
echo "    cd ${SERVER_PATH} && NODE_ENV=production node server/scripts/assign-employee-companies-by-project.js ${MODE} ${EXTRA_ARGS[*]:-}"
echo ""

ssh "${SERVER_USER}@${SERVER_IP}" "cd ${SERVER_PATH} && NODE_ENV=production node server/scripts/assign-employee-companies-by-project.js ${MODE} ${EXTRA_ARGS[*]:-}"

echo ""
echo "==> Done."
