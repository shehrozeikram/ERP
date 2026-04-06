#!/usr/bin/env bash
# Quick inspection (run on server).
set -euo pipefail
echo "=== sites-enabled ==="
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true
echo "=== duplicate server_name (should be empty after cleanup) ==="
grep -r "server_name" /etc/nginx/sites-enabled/ 2>/dev/null | grep -E "tovus|68\.183" || true
nginx -t 2>&1
