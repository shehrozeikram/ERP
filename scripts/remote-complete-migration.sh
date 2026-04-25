#!/usr/bin/env bash
# Run ON THE DROPLET (stdin via: ssh -tt root@IP 'bash -s' < scripts/remote-complete-migration.sh).
# Assumes dump is at /root/mongodump-atlas-sgc_erp/sgc_erp/ and helper scripts are in /root/.
# Sets NODE_ENV=production, replaces MONGODB_URI, removes MONGODB_URI_LOCAL, restarts PM2.

set -euo pipefail

DUMP_PARENT="/root/mongodump-atlas-sgc_erp"
ENV_FILE="/var/www/sgc-erp/.env"

discover_mongo_admin_password() {
  local ADMIN_PASS="${MONGO_ADMIN_PASSWORD:-}"
  if [[ -n "$ADMIN_PASS" ]]; then
    echo "$ADMIN_PASS"
    return 0
  fi
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
          echo "$val"
          return 0
          ;;
      esac
    done <"$f"
  done
  return 1
}

if [[ ! -d "$DUMP_PARENT/sgc_erp" ]]; then
  echo "ERROR: Missing $DUMP_PARENT/sgc_erp — upload dump first."
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Missing $ENV_FILE"
  exit 1
fi

ADMIN_PASS="$(discover_mongo_admin_password)" || {
  echo "ERROR: Could not find Mongo admin password. Export MONGO_ADMIN_PASSWORD then re-run."
  exit 1
}
export MONGO_ADMIN_PASSWORD="$ADMIN_PASS"

chmod +x /root/mongorestore-on-droplet.sh /root/print-droplet-mongodb-uri.sh 2>/dev/null || true

echo "==> mongorestore (sgc_erp, --drop)..."
/root/mongorestore-on-droplet.sh "$DUMP_PARENT"

echo "==> Building MONGODB_URI line..."
/root/print-droplet-mongodb-uri.sh >/tmp/sgc_mongo_line.txt

echo "==> Patching $ENV_FILE (NODE_ENV=production, MONGODB_URI, strip MONGODB_URI_LOCAL)..."
python3 <<'PY'
from pathlib import Path
mongo_line = Path("/tmp/sgc_mongo_line.txt").read_text().strip()
if not mongo_line.startswith("MONGODB_URI="):
    raise SystemExit("Expected MONGODB_URI=... in /tmp/sgc_mongo_line.txt")
p = Path("/var/www/sgc-erp/.env")
lines = p.read_text().splitlines()
out = []
have_mongo = False
have_node = False
for line in lines:
    if line.startswith("MONGODB_URI_LOCAL="):
        continue
    if line.startswith("MONGODB_URI="):
        if not have_mongo:
            out.append(mongo_line)
            have_mongo = True
        continue
    if line.startswith("NODE_ENV="):
        out.append("NODE_ENV=production")
        have_node = True
        continue
    out.append(line)
if not have_node:
    out.insert(0, "NODE_ENV=production")
if not have_mongo:
    insert_at = 1 if out and out[0].startswith("NODE_ENV=") else 0
    out.insert(insert_at, mongo_line)
p.write_text("\n".join(out) + "\n")
print("OK:", p)
PY
rm -f /tmp/sgc_mongo_line.txt

echo "==> pm2 restart..."
cd /var/www/sgc-erp && pm2 restart sgc-erp-backend
echo "==> Recent logs:"
pm2 logs sgc-erp-backend --lines 30 --nostream || true
echo "Done."
