#!/usr/bin/env bash
# ============================================================
#  FULL MIGRATION: MongoDB Atlas  →  Droplet local MongoDB
#  Run FROM YOUR MAC.  You will be prompted for the SSH password once.
#
#  What this does (entirely on the droplet — your Mac touches nothing):
#    1. Dumps live Atlas database  (sgc_erp)  into /root/fresh-atlas-dump/
#    2. Confirms collection count before restore (safety check)
#    3. Restores the dump into local MongoDB on the droplet   (--drop)
#    4. Confirms collection count after restore
#    5. Rewrites /var/www/sgc-erp/.env:
#         NODE_ENV=production
#         MONGODB_URI=mongodb://admin:...@127.0.0.1:27017/sgc_erp?authSource=admin
#         MONGODB_URI_LOCAL removed
#    6. Restarts PM2
#    7. Prints PM2 startup logs so you can confirm OK
#
#  Safety:  Atlas is NEVER written to.  A pre-restore backup of .env is saved.
#           To rollback: paste old MONGODB_URI back and pm2 restart.
# ============================================================

set -euo pipefail

SERVER_USER="root"
SERVER_IP="68.183.215.177"
ATLAS_URI='mongodb://shehroze:Cricket%23007@ac-pqbby5q-shard-00-00.fss65hf.mongodb.net:27017,ac-pqbby5q-shard-00-01.fss65hf.mongodb.net:27017,ac-pqbby5q-shard-00-02.fss65hf.mongodb.net:27017/sgc_erp?retryWrites=true&w=majority&ssl=true&authSource=admin'
DUMP_DIR="/root/fresh-atlas-dump"
ENV_FILE="/var/www/sgc-erp/.env"
APP_DIR="/var/www/sgc-erp"
PM2_APP="sgc-erp-backend"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   SGC ERP  —  Atlas  →  Droplet MongoDB  Migration      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Server : ${SERVER_USER}@${SERVER_IP}"
echo "Target : /var/www/sgc-erp"
echo ""
echo "You will be prompted for the SSH password."
echo ""

ssh -tt -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_IP}" bash <<REMOTE
set -euo pipefail

ATLAS_URI='${ATLAS_URI}'
DUMP_DIR='${DUMP_DIR}'
ENV_FILE='${ENV_FILE}'
APP_DIR='${APP_DIR}'
PM2_APP='${PM2_APP}'

echo ""
echo ">>> [1/7] Checking tools on droplet..."
for tool in mongodump mongorestore mongosh python3 pm2; do
  if ! command -v \$tool >/dev/null 2>&1; then
    echo "ERROR: \$tool not found on droplet. Install it first."
    exit 1
  fi
done
echo "    All tools present."

echo ""
echo ">>> [2/7] Discovering local MongoDB admin password..."
ADMIN_PASS=""
for f in /root/.digitalocean_password /root/.digitalocean_passwords; do
  [ -f "\$f" ] || continue
  while IFS= read -r line || [ -n "\$line" ]; do
    line="\${line#"\${line%%[![:space:]]*}"}"
    [ "\${line}" = "export \${line#export}" ] && line="\${line#export }"
    [[ "\$line" != *=* ]] && continue
    key="\${line%%=*}"; key="\${key//[[:space:]]/}"
    val="\${line#*=}"; val="\${val//\"/}"; val="\${val//\'/}"; val="\${val//\$'\r'/}"
    case "\$key" in *mongo*|*MONGO*) ADMIN_PASS="\$val"; break 2;; esac
  done <"\$f"
done
if [ -z "\$ADMIN_PASS" ]; then
  echo "ERROR: Could not auto-discover Mongo admin password."
  echo "Run:  export MONGO_ADMIN_PASSWORD='your_password'  then re-run this script."
  exit 1
fi
ENC_PASS="\$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "\$ADMIN_PASS")"
LOCAL_URI="mongodb://admin:\${ENC_PASS}@127.0.0.1:27017/?authSource=admin"
FINAL_MONGODB_URI="mongodb://admin:\${ENC_PASS}@127.0.0.1:27017/sgc_erp?authSource=admin"
echo "    Password found."

echo ""
echo ">>> [3/7] Taking FRESH dump from Atlas into \$DUMP_DIR ..."
rm -rf "\$DUMP_DIR"
mkdir -p "\$DUMP_DIR"
mongodump --uri="\$ATLAS_URI" --out="\$DUMP_DIR" 2>&1
ATLAS_COLS=\$(ls "\$DUMP_DIR/sgc_erp/"*.bson 2>/dev/null | wc -l || echo 0)
echo "    Dump complete. Collections dumped: \$ATLAS_COLS"
if [ "\$ATLAS_COLS" -lt 5 ]; then
  echo "ERROR: Dump looks too small (\$ATLAS_COLS collections). Aborting to protect data."
  exit 1
fi

echo ""
echo ">>> [4/7] Restoring dump into local MongoDB (sgc_erp) ..."
mongorestore --uri="\$LOCAL_URI" --drop "\$DUMP_DIR" 2>&1
LOCAL_COLS=\$(mongosh "\$LOCAL_URI" --quiet --eval 'db.getSiblingDB("sgc_erp").getCollectionNames().length' 2>/dev/null || echo 0)
echo "    Restore complete. Collections in local MongoDB: \$LOCAL_COLS"
if [ "\$LOCAL_COLS" -lt "\$ATLAS_COLS" ]; then
  echo "ERROR: Local collection count (\$LOCAL_COLS) < Atlas dump count (\$ATLAS_COLS). Aborting."
  exit 1
fi
echo "    Collection count OK (\$LOCAL_COLS >= \$ATLAS_COLS)."

echo ""
echo ">>> [5/7] Backing up .env then switching MONGODB_URI to droplet..."
cp "\$ENV_FILE" "\${ENV_FILE}.bak-before-migration-\$(date +%Y%m%d_%H%M%S)"
python3 <<PY
from pathlib import Path
env_path = Path("${ENV_FILE}")
lines = env_path.read_text().splitlines()
out = []
have_uri = False
have_node = False
for line in lines:
    if line.startswith("MONGODB_URI_LOCAL="):
        continue
    if line.startswith("MONGODB_URI="):
        if not have_uri:
            out.append("MONGODB_URI=\${FINAL_MONGODB_URI}")
            have_uri = True
        continue
    if line.startswith("NODE_ENV="):
        out.append("NODE_ENV=production")
        have_node = True
        continue
    out.append(line)
if not have_node:
    out.insert(0, "NODE_ENV=production")
if not have_uri:
    idx = 1 if out and out[0].startswith("NODE_ENV=") else 0
    out.insert(idx, "MONGODB_URI=\${FINAL_MONGODB_URI}")
env_path.write_text("\\n".join(out) + "\\n")
print("    .env updated OK")
PY

echo ""
echo ">>> [6/7] Restarting PM2..."
cd "\$APP_DIR"
pm2 restart "\$PM2_APP" 2>&1
sleep 4

echo ""
echo ">>> [7/7] Verifying startup logs..."
pm2 logs "\$PM2_APP" --lines 25 --nostream 2>/dev/null || true

echo ""
echo ">>> Final check — MONGODB_URI in .env:"
grep "^MONGODB_URI" "\$ENV_FILE"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              MIGRATION COMPLETE                          ║"
echo "║   Production is now on Droplet MongoDB (127.0.0.1)      ║"
echo "║   Atlas data is untouched (you can cancel Atlas later)  ║"
echo "║   Rollback: restore .env.bak-before-migration and       ║"
echo "║             pm2 restart sgc-erp-backend                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
REMOTE