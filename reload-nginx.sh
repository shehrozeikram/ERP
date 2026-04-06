#!/usr/bin/env bash
# On server: sudo nginx -t && sudo systemctl reload nginx
# Remote:     ssh user@host 'sudo nginx -t && sudo systemctl reload nginx'
set -euo pipefail
echo "Run on server: sudo nginx -t && sudo systemctl reload nginx"
