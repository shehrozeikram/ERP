#!/usr/bin/env bash
# One command CAM backup — run on production: ./cam-backup-now.sh
set -e
cd "$(dirname "$0")"
mkdir -p server/backups
URI="$(grep -E '^MONGODB_URI=' .env 2>/dev/null | sed 's/^MONGODB_URI=//' | tr -d '\r' | head -1)"
if [ -z "$URI" ]; then
  URI="$(grep -E '^MONGODB_URI_LOCAL=' .env 2>/dev/null | sed 's/^MONGODB_URI_LOCAL=//' | tr -d '\r' | head -1)"
fi
if [ -z "$URI" ]; then echo "ERROR: No MONGODB_URI in .env"; exit 1; fi
FILE="server/backups/cam-backup-$(date +%Y%m%d-%H%M%S).json"
mongoexport --uri="$URI" --collection=propertyinvoices --out="$FILE"
echo "BACKUP DONE: $(pwd)/$FILE"
ls -lh "$FILE"
