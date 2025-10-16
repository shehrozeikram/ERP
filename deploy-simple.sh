#!/bin/bash

# 🚀 SGC ERP - Simple Deployment Script (Memory-Safe)
# Builds locally and deploys to server without server-side build

set -e

echo "🚀 Starting SGC ERP deployment (Memory-Safe Mode)..."

# Configuration
SERVER_USER="root"
SERVER_IP="68.183.215.177"
SERVER_PATH="/var/www/sgc-erp"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Build React app locally
echo -e "${YELLOW}📦 Building React app locally...${NC}"
cd client && npm run build && cd ..

# Commit and push changes
echo -e "${YELLOW}📤 Pushing to git...${NC}"
git add .
git commit -m "Deploy: $(date)" || echo "No changes to commit"
git push origin main

# Deploy to server
echo -e "${YELLOW}🚀 Deploying to server...${NC}"
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
    cd /var/www/sgc-erp
    
    # Quick backup
    mkdir -p quick-backups
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_DB="quick-backups/database.js.$TIMESTAMP"
    BACKUP_ENV="quick-backups/.env.$TIMESTAMP"
    
    # Backup critical files
    if [ -f "server/config/database.js" ]; then
        cp -f server/config/database.js "$BACKUP_DB"
        echo "✅ Database config backed up"
    fi
    if [ -f ".env" ]; then
        cp -f .env "$BACKUP_ENV"
        echo "✅ Environment file backed up"
    fi
    
    # Stop app
    pm2 stop sgc-erp-backend 2>/dev/null || true
    
    # Pull latest code
    git pull origin main
    
    # Restore critical files
    if [ -f "$BACKUP_DB" ]; then
        cp -f "$BACKUP_DB" server/config/database.js
        echo "✅ Database config restored"
    fi
    if [ -f "$BACKUP_ENV" ]; then
        cp -f "$BACKUP_ENV" .env
        echo "✅ Environment file restored"
    fi
    
    # Install only server dependencies (skip client build)
    echo "📦 Installing server dependencies..."
    npm install --production --no-optional
    
    # Start app
    echo "🚀 Starting application..."
    pm2 start ecosystem.config.js --env production
    pm2 save
    
    # Quick health check
    sleep 5
    if pm2 list | grep -q "sgc-erp-backend.*online"; then
        echo "✅ App started successfully"
    else
        echo "❌ App failed to start - rolling back..."
        pm2 stop sgc-erp-backend 2>/dev/null || true
        if [ -f "$BACKUP_DB" ]; then
            cp -f "$BACKUP_DB" server/config/database.js
        fi
        if [ -f "$BACKUP_ENV" ]; then
            cp -f "$BACKUP_ENV" .env
        fi
        pm2 start ecosystem.config.js --env production
        pm2 save
        echo "✅ Rollback completed"
        exit 1
    fi
ENDSSH

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${YELLOW}📝 Check status: ssh $SERVER_USER@$SERVER_IP 'cd $SERVER_PATH && pm2 status'${NC}"
