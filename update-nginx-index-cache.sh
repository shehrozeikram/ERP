#!/bin/bash
# Updates nginx on server to prevent index.html caching
# Run locally: ./update-nginx-index-cache.sh (you will be prompted for SSH password)

SERVER="root@68.183.215.177"

echo "Connecting to server to update nginx config..."
ssh -t $SERVER 'bash -s' << 'ENDREMOTE'
set -e

# Find nginx config
for f in /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/* /etc/nginx/conf.d/default.conf; do
  [ -f "$f" ] && NGINX_CONF="$f" && break
done
[ -z "$NGINX_CONF" ] && NGINX_CONF="/etc/nginx/sites-enabled/default"

if [ ! -f "$NGINX_CONF" ]; then
  echo "Nginx config not found."
  ls -la /etc/nginx/sites-enabled/ 2>/dev/null || ls -la /etc/nginx/conf.d/ 2>/dev/null || true
  exit 1
fi

echo "Using config: $NGINX_CONF"

if grep -q "location = /index.html" "$NGINX_CONF"; then
  echo "index.html no-cache block already exists. Done."
  exit 0
fi

cp "$NGINX_CONF" "${NGINX_CONF}.bak.$(date +%Y%m%d_%H%M%S)"
echo "Backup created"

# Use /var/www/html (deploy script copies build there)
ROOT="/var/www/html"

# Insert block BEFORE first "location /" (only first match)
awk -v root="$ROOT" '
/^\s*location \/ \s*\{/ && !done {
  print "    # Never cache index.html - ensures users get latest app after deploy"
  print "    location = /index.html {"
  print "        root " root ";"
  print "        add_header Cache-Control \"no-cache, no-store, must-revalidate\";"
  print "        add_header Pragma \"no-cache\";"
  print "    }"
  print ""
  done=1
}
{ print }
' "$NGINX_CONF" > "${NGINX_CONF}.new" && mv "${NGINX_CONF}.new" "$NGINX_CONF"

echo "Config updated. Testing nginx..."
nginx -t

echo "Reloading nginx..."
systemctl reload nginx

echo "Done. index.html will no longer be cached."
ENDREMOTE
