#!/usr/bin/env bash
#
# One-time (or safe repeat) migration: copy CVs from the git checkout into a
# persistent directory, then point production at it via SGC_UPLOADS_DIR.
#
# Run on the droplet as root:
#   cd /var/www/sgc-erp
#   bash scripts/migrate-cvs-to-persistent-dir.sh
#
# Optional:
#   bash scripts/migrate-cvs-to-persistent-dir.sh --write-env
#   bash scripts/migrate-cvs-to-persistent-dir.sh --repo /var/www/sgc-erp --dest /var/lib/sgc-erp/uploads
#
# After migration: pm2 restart sgc-erp-backend --update-env
#
# Note: PDFs that were already deleted from disk cannot be recovered by this script;
#       only files still under server/uploads/cvs are copied.

set -euo pipefail

REPO="/var/www/sgc-erp"
DEST="/var/lib/sgc-erp/uploads"
WRITE_ENV=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --write-env) WRITE_ENV=1; shift ;;
    --repo=*) REPO="${1#*=}"; shift ;;
    --dest=*) DEST="${1#*=}"; shift ;;
    --help|-h)
      echo "Usage: $0 [--write-env] [--repo=PATH] [--dest=PATH]"
      exit 0
      ;;
    *)
      REPO="$1"
      shift
      ;;
  esac
done

ENV_FILE="${REPO}/.env"
SRC="${REPO}/server/uploads/cvs"

if [[ ! -d "$REPO" ]]; then
  echo "ERROR: repo path not found: $REPO"
  exit 1
fi

mkdir -p "${DEST}/cvs"
chmod 755 "${DEST}" "${DEST}/cvs" 2>/dev/null || true

if [[ -d "$SRC" ]]; then
  echo "Copying CVs: $SRC -> ${DEST}/cvs/"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "${SRC}/" "${DEST}/cvs/"
  else
    shopt -s nullglob
    for f in "${SRC}"/*; do
      [[ -f "$f" ]] || continue
      cp -n "$f" "${DEST}/cvs/" || true
    done
  fi
  echo "Done. File count under ${DEST}/cvs:"
  find "${DEST}/cvs" -maxdepth 1 -type f 2>/dev/null | wc -l | xargs echo " "
else
  echo "WARN: source dir missing (nothing to copy): $SRC"
fi

has_sgc_uploads() {
  [[ -f "$ENV_FILE" ]] && grep -qE '^[[:space:]]*SGC_UPLOADS_DIR=' "$ENV_FILE"
}

if has_sgc_uploads; then
  echo "OK: $ENV_FILE already defines SGC_UPLOADS_DIR"
  grep -E '^[[:space:]]*SGC_UPLOADS_DIR=' "$ENV_FILE" | tail -1
else
  echo ""
  echo "Add this line to $ENV_FILE (then restart PM2):"
  echo "  SGC_UPLOADS_DIR=${DEST}"
  if [[ "$WRITE_ENV" -eq 1 ]]; then
    {
      echo ""
      echo "# Persistent CV uploads (added $(date -u +%Y-%m-%dT%H:%MZ) by migrate-cvs-to-persistent-dir.sh)"
      echo "SGC_UPLOADS_DIR=${DEST}"
    } >>"$ENV_FILE"
    echo "Appended SGC_UPLOADS_DIR to $ENV_FILE"
  else
    echo "Re-run with --write-env to append automatically."
  fi
fi

echo ""
echo "Next: pm2 restart sgc-erp-backend --update-env"
echo "Verify: NODE_ENV=production node scripts/list-missing-application-cvs.js | head"
