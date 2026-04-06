#!/usr/bin/env bash
# Run ON THE PRODUCTION SERVER as root, from the repo directory after git pull:
#   cd /var/www/sgc-erp && git pull && sudo bash scripts/nginx-production-setup.sh
#
# - Backs up current nginx site configs
# - Removes sites-enabled/default if present (fixes "conflicting server name" with tovus.net)
# - Installs deploy/nginx-sgc-erp.conf → /etc/nginx/sites-available/sgc-erp
# - nginx -t && reload (aborts if test fails — nothing broken)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF_SRC="${REPO_ROOT}/deploy/nginx-sgc-erp.conf"
BACKUP_ROOT="/root/nginx-backups/$(date +%Y%m%d_%H%M%S)"

if [ ! -f "$CONF_SRC" ]; then
  echo "ERROR: Missing ${CONF_SRC}"
  exit 1
fi

if [ "${EUID:-0}" -ne 0 ]; then
  echo "ERROR: Run as root (sudo bash scripts/nginx-production-setup.sh)"
  exit 1
fi

mkdir -p "$BACKUP_ROOT"
echo "Backup directory: $BACKUP_ROOT"

[ -f /etc/nginx/sites-available/sgc-erp ] && cp -a /etc/nginx/sites-available/sgc-erp "$BACKUP_ROOT/sgc-erp.sites-available.bak"
[ -f /etc/nginx/sites-enabled/default ] && cp -a /etc/nginx/sites-enabled/default "$BACKUP_ROOT/default.sites-enabled.bak" 2>/dev/null || true

# Duplicate server_name: default site + sgc-erp both listing tovus.net
if [ -L /etc/nginx/sites-enabled/default ] || [ -f /etc/nginx/sites-enabled/default ]; then
  echo "Removing /etc/nginx/sites-enabled/default (stock site duplicates app hostnames)."
  rm -f /etc/nginx/sites-enabled/default
fi

cp "$CONF_SRC" /etc/nginx/sites-available/sgc-erp
chmod 644 /etc/nginx/sites-available/sgc-erp
ln -sf /etc/nginx/sites-available/sgc-erp /etc/nginx/sites-enabled/sgc-erp

if [ ! -f /etc/letsencrypt/ssl-dhparams.pem ]; then
  echo "NOTE: If nginx -t fails on ssl_dhparam, run: sudo openssl dhparam -dsaparam -out /etc/letsencrypt/ssl-dhparams.pem 2048"
fi

nginx -t
systemctl reload nginx

echo "OK: nginx reloaded. Conflicting server_name warnings should be gone after this."
echo "Restore from: $BACKUP_ROOT  if needed."
