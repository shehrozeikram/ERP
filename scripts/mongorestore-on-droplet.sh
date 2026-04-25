#!/usr/bin/env bash
# Run ON THE DIGITALOCEAN DROPLET as root (after upload-mongodump-to-droplet.sh).
# Restores BSON dump into database sgc_erp on localhost MongoDB (--drop replaces existing collections).
#
# Requires: mongorestore (MongoDB Database Tools), python3 for password URL-encoding.
# Auth: set MONGO_ADMIN_PASSWORD (DigitalOcean MERN "admin" user). Optional: discovered from DO password files.

set -euo pipefail

DUMP_PARENT="${1:-/root/mongodump-atlas-sgc_erp}"
ADMIN_PASS="${MONGO_ADMIN_PASSWORD:-}"

if [[ ! -d "$DUMP_PARENT/sgc_erp" ]]; then
  echo "Missing $DUMP_PARENT/sgc_erp. Upload the dump first."
  exit 1
fi

if ! command -v mongorestore >/dev/null 2>&1; then
  echo "mongorestore not found. Install: https://www.mongodb.com/try/download/database-tools"
  exit 1
fi

if [[ -z "$ADMIN_PASS" ]]; then
  for f in /root/.digitalocean_password /root/.digitalocean_passwords; do
    [[ -f "$f" ]] || continue
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      line="${line#"${line%%[![:space:]]*}"}"
      [[ "${line}" = export\ * ]] && line="${line#export}"
      line="${line#"${line%%[![:space:]]*}"}"
      [[ "$line" != *=* ]] && continue
      key="${line%%=*}"
      key="${key//[[:space:]]/}"
      val="${line#*=}"
      val="${val//\"/}"
      val="${val//\'/}"
      val="${val//$'\r'/}"
      case "$key" in
        *mongo*|*MONGO*)
          ADMIN_PASS="$val"
          break 2
          ;;
      esac
    done <"$f"
  done
fi

if [[ -z "$ADMIN_PASS" ]]; then
  echo "Set Mongo admin password, then run again:"
  echo "  export MONGO_ADMIN_PASSWORD='(from /root/.digitalocean_passwords or MERN MOTD)'"
  echo "  $0 [dump_parent]"
  exit 1
fi

ENC_PASS="$(MONGO_ADMIN_PASSWORD="$ADMIN_PASS" python3 -c "import os, urllib.parse; print(urllib.parse.quote(os.environ['MONGO_ADMIN_PASSWORD'], safe=''))")"
URI="mongodb://admin:${ENC_PASS}@127.0.0.1:27017/?authSource=admin"

echo "Restoring into sgc_erp from $DUMP_PARENT (collections will be dropped if they exist)..."
mongorestore --uri="$URI" --drop "$DUMP_PARENT"

echo ""
echo "Restore finished. Collection count check:"
mongosh "$URI" --quiet --eval 'db.getSiblingDB("sgc_erp").getCollectionNames().length' || true
echo ""
echo "Next:"
echo "  /root/print-droplet-mongodb-uri.sh"
echo "  nano /var/www/sgc-erp/.env   # NODE_ENV=production, MONGODB_URI=..., remove MONGODB_URI_LOCAL"
echo "  cd /var/www/sgc-erp && pm2 restart sgc-erp-backend"
