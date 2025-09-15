#!/bin/bash

# 🚀 SGC ERP - One Simple Deployment Script
# This script does everything: backup, deploy, and verify

set -e

echo "🚀 Starting SGC ERP deployment..."

# Configuration
SERVER_USER="root"
SERVER_IP="68.183.215.177"
SERVER_PATH="/var/www/sgc-erp"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Build React app
echo -e "${YELLOW}📦 Building React app...${NC}"
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
    cp -f server/config/database.js "quick-backups/database.js.$TIMESTAMP"
    cp -f .env "quick-backups/.env.$TIMESTAMP" 2>/dev/null || echo "No .env to backup"
    
    # Stop app
    pm2 stop sgc-erp-backend 2>/dev/null || true
    
    # Pull latest code
    git pull origin main
    
    # Restore critical files
    cp -f "quick-backups/database.js.$TIMESTAMP" server/config/database.js
    if [ -f "quick-backups/.env.$TIMESTAMP" ]; then
        cp -f "quick-backups/.env.$TIMESTAMP" .env
    fi
    
    # Install dependencies
    npm install --production
    cd client && npm install --production && npm run build && cd ..
    
    # Start app
    pm2 start ecosystem.config.js --env production
    pm2 save
    
    # Quick health check
    sleep 5
    if pm2 list | grep -q "sgc-erp-backend.*online"; then
        echo "✅ App started successfully"
        
        # Test ZKBio Time connection
        echo "🧪 Testing ZKBio Time connection..."
        if node server/scripts/test-zkbio-connection.js; then
            echo "✅ ZKBio Time connection test passed"
        else
            echo "⚠️  ZKBio Time connection test failed - check logs"
        fi
    else
        echo "❌ App failed to start - rolling back..."
        pm2 stop sgc-erp-backend 2>/dev/null || true
        cp -f "quick-backups/database.js.$TIMESTAMP" server/config/database.js
        if [ -f "quick-backups/.env.$TIMESTAMP" ]; then
            cp -f "quick-backups/.env.$TIMESTAMP" .env
        fi
        pm2 start ecosystem.config.js --env production
        pm2 save
        echo "✅ Rollback completed"
        exit 1
    fi
ENDSSH

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${YELLOW}📝 Check status: ssh $SERVER_USER@$SERVER_IP 'cd $SERVER_PATH && pm2 status'${NC}"
