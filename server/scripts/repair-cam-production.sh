#!/usr/bin/env bash
#
# PRODUCTION — one script: backup then repair CAM invoices (Mar 2026 bad batch onward).
#
#   cd /var/www/sgc-erp
#   git pull origin main
#   chmod +x server/scripts/repair-cam-production.sh
#   ./server/scripts/repair-cam-production.sh --dryRun
#   ./server/scripts/repair-cam-production.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export NODE_ENV=production

if [ ! -f ".env" ] && [ -f "/tmp/.sgc-env" ]; then
  cp /tmp/.sgc-env .env
fi

SKIP_BACKUP=0
ARGS=()
for a in "$@"; do
  if [ "$a" = "--skipBackup" ]; then SKIP_BACKUP=1; else ARGS+=("$a"); fi
done

echo "=== CAM repair (production) ==="
cd "$ROOT"

if [ "$SKIP_BACKUP" -eq 0 ] && [[ ! " ${ARGS[*]} " =~ " --dryRun " ]]; then
  echo "Step 1/2: Backup..."
  node server/scripts/backup-cam-repair.js
  echo ""
fi

echo "Step 2/2: Repair..."
node server/scripts/repair-cam-invoice-chain.js --allBadBatch "${ARGS[@]}"
