#!/usr/bin/env bash
# Run ON YOUR MAC. Opens SSH to the Droplet with a TTY so you can type the ROOT password when prompted.
# Streams remote-complete-migration.sh to the server and executes it there.
#
# Usage:
#   ./scripts/run-remote-migration-via-ssh.sh

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_USER="root"
SERVER_IP="68.183.215.177"

echo "You will be prompted for the Droplet ROOT password (not Mongo)."
echo "Connecting to ${SERVER_USER}@${SERVER_IP} ..."
exec ssh -tt -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_IP}" 'bash -s' <"${REPO_ROOT}/scripts/remote-complete-migration.sh"
