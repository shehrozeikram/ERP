#!/usr/bin/env bash
# Upload deploy/nginx-sgc-erp.conf to the server and apply (requires SSH key auth).
# Example:
#   scp deploy/nginx-sgc-erp.conf root@YOUR_SERVER:/tmp/sgc-erp-new
#   ssh root@YOUR_SERVER 'cp /tmp/sgc-erp-new /etc/nginx/sites-available/sgc-erp && nginx -t && systemctl reload nginx'
#
# Prefer on-server: cd /var/www/sgc-erp && git pull && sudo bash scripts/nginx-production-setup.sh

set -euo pipefail
echo "Use scripts/nginx-production-setup.sh on the server, or scp + ssh manually."
echo "Do not commit passwords to scripts."
exit 0
