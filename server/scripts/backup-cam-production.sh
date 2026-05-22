#!/usr/bin/env bash
#
# PRODUCTION — backup CAM invoices before running repair-cam-production.sh
#
#   cd /var/www/sgc-erp
#   chmod +x server/scripts/backup-cam-production.sh
#   ./server/scripts/backup-cam-production.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export NODE_ENV=production

if [ ! -f ".env" ] && [ -f "/tmp/.sgc-env" ]; then
  cp /tmp/.sgc-env .env
fi

echo "=== CAM invoice backup (production) ==="
echo "Project: $ROOT"
echo ""

node server/scripts/backup-cam-repair.js

echo ""
echo "Next: run repair only after you saved the backup path above."
echo "  ./server/scripts/repair-cam-production.sh --dryRun"
echo "  ./server/scripts/repair-cam-production.sh"
