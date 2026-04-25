#!/usr/bin/env bash
# Run ON THE DROPLET. Prints a single MONGODB_URI line for app user "admin" -> database sgc_erp.
# Usage: export MONGO_ADMIN_PASSWORD='...'; /root/print-droplet-mongodb-uri.sh

set -euo pipefail
: "${MONGO_ADMIN_PASSWORD:?export MONGO_ADMIN_PASSWORD first (same as for mongorestore)}"

ENC_PASS="$(MONGO_ADMIN_PASSWORD="$MONGO_ADMIN_PASSWORD" python3 -c "import os, urllib.parse; print(urllib.parse.quote(os.environ['MONGO_ADMIN_PASSWORD'], safe=''))")"
echo "MONGODB_URI=mongodb://admin:${ENC_PASS}@127.0.0.1:27017/sgc_erp?authSource=admin"
