#!/bin/bash

# SGC ERP Restore Script
# This script restores the system to a previous working state

set -e  # Exit on any error

echo "🔄 Restoring system to previous working state..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if backup name is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Please provide backup name${NC}"
    echo "Usage: ./restore-backup.sh <backup-name>"
    echo "Example: ./restore-backup.sh sgc-erp-backup-20241201_143022"
    echo ""
    echo "Available backups:"
    ls -la ./backups/*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_NAME="$1"
BACKUP_FILE="./backups/$BACKUP_NAME.tar.gz"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Error: Backup file not found: $BACKUP_FILE${NC}"
    echo "Available backups:"
    ls -la ./backups/*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: This will overwrite your current code!${NC}"
echo -e "${YELLOW}📦 Restoring from: $BACKUP_NAME${NC}"
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Restore cancelled${NC}"
    exit 1
fi

# Create a backup of current state before restoring
echo -e "${YELLOW}🔒 Creating backup of current state before restore...${NC}"
./backup-current-state.sh

# Stop PM2 processes if running
echo -e "${YELLOW}🛑 Stopping PM2 processes...${NC}"
pm2 stop sgc-erp-backend 2>/dev/null || true

# Extract backup
echo -e "${YELLOW}📦 Extracting backup...${NC}"
tar -xzf "$BACKUP_FILE" --strip-components=0

# Reinstall dependencies
echo -e "${YELLOW}📋 Reinstalling dependencies...${NC}"
npm install --production
cd client && npm install --production && cd ..

# Restart PM2
echo -e "${YELLOW}🔄 Restarting PM2 process...${NC}"
pm2 start ecosystem.config.js --env production
pm2 save

echo -e "${GREEN}✅ System restored successfully from backup: $BACKUP_NAME${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "   1. Check if the application is running: pm2 status"
echo "   2. Check logs: pm2 logs sgc-erp-backend"
echo "   3. Test your application"
