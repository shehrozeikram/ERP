#!/bin/bash

# SGC ERP Backup Script
# This script creates a backup of the current working state

set -e  # Exit on any error

echo "🔒 Creating backup of current working state..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="sgc-erp-backup-${TIMESTAMP}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}📦 Creating backup: $BACKUP_NAME${NC}"

# Create backup package
tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='uploads' \
    --exclude='logs' \
    --exclude='*.log' \
    --exclude='backups' \
    .

echo -e "${GREEN}✅ Backup created successfully: $BACKUP_DIR/$BACKUP_NAME.tar.gz${NC}"

# Create a symlink to latest backup
rm -f "$BACKUP_DIR/latest-backup"
ln -s "$BACKUP_NAME.tar.gz" "$BACKUP_DIR/latest-backup"

echo -e "${YELLOW}📝 Backup info:${NC}"
echo "   Backup file: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
echo "   Latest backup: $BACKUP_DIR/latest-backup"
echo "   Size: $(du -h "$BACKUP_DIR/$BACKUP_NAME.tar.gz" | cut -f1)"

echo -e "${GREEN}🔒 Current state backed up successfully!${NC}"
echo -e "${YELLOW}💡 To restore this backup, run: ./restore-backup.sh $BACKUP_NAME${NC}"
