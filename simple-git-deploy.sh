#!/bin/bash

# SGC ERP Simple Git Deployment Script
# Use this script for regular updates after initial safe deployment

set -e  # Exit on any error

echo "🚀 Starting SGC ERP Simple Git Deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SERVER_USER="root"
SERVER_IP="68.183.215.177"
SERVER_PATH="/var/www/sgc-erp"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   Server: $SERVER_USER@$SERVER_IP"
echo "   Path: $SERVER_PATH"
echo ""

# Check if git is available
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git is not installed. Please install git first.${NC}"
    exit 1
fi

# Build the React app locally
echo -e "${YELLOW}📦 Building React application...${NC}"
cd client
npm run build
cd ..

# Commit and push changes (if any)
echo -e "${YELLOW}📤 Checking for changes to commit...${NC}"
if [[ -n $(git status --porcelain) ]]; then
    echo "📝 Changes detected, committing and pushing..."
    git add .
    git commit -m "Update: $(date)"
    git push origin main
else
    echo "✅ No changes to commit"
fi

# Deploy to server
echo -e "${YELLOW}🚀 Deploying to server...${NC}"
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
    set -e
    
    echo "📁 Navigating to project directory..."
    cd /var/www/sgc-erp
    
    # Create quick backup of critical files
    echo "🔒 Creating quick backup of critical files..."
    mkdir -p quick-backups
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    cp -f server/config/database.js "quick-backups/database.js.$TIMESTAMP"
    cp -f .env "quick-backups/.env.$TIMESTAMP" 2>/dev/null || echo "⚠️  .env file not found"
    
    # Stop PM2 process
    echo "🛑 Stopping PM2 process..."
    pm2 stop sgc-erp-backend 2>/dev/null || true
    
    # Pull latest changes
    echo "📥 Pulling latest changes..."
    git stash  # Stash any local changes
    git pull origin main
    git stash pop 2>/dev/null || true  # Restore stashed changes if any
    
    # Restore critical configuration files
    echo "🔒 Restoring critical configuration files..."
    cp -f "quick-backups/database.js.$TIMESTAMP" server/config/database.js
    if [ -f "quick-backups/.env.$TIMESTAMP" ]; then
        cp -f "quick-backups/.env.$TIMESTAMP" .env
    fi
    
    echo "📋 Installing backend dependencies..."
    npm install --production
    
    echo "📋 Installing frontend dependencies and building..."
    cd client
    npm install --production
    npm run build
    cd ..
    
    echo "📁 Creating necessary directories..."
    mkdir -p logs uploads
    
    # Start PM2 process
    echo "🔄 Starting PM2 process..."
    pm2 start ecosystem.config.js --env production
    pm2 save
    
    # Quick health check
    sleep 3
    if pm2 list | grep -q "sgc-erp-backend.*online"; then
        echo "✅ Application started successfully"
    else
        echo "❌ Application failed to start"
        echo "🔄 Quick rollback..."
        pm2 stop sgc-erp-backend 2>/dev/null || true
        cp -f "quick-backups/database.js.$TIMESTAMP" server/config/database.js
        if [ -f "quick-backups/.env.$TIMESTAMP" ]; then
            cp -f "quick-backups/.env.$TIMESTAMP" .env
        fi
        pm2 start ecosystem.config.js --env production
        pm2 save
        echo "✅ Quick rollback completed"
        exit 1
    fi
    
    echo "✅ Deployment completed successfully!"
ENDSSH

echo -e "${GREEN}🎉 Simple deployment completed successfully!${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "   1. SSH into your server: ssh $SERVER_USER@$SERVER_IP"
echo -e "   2. Check application status: pm2 status"
echo -e "   3. Test your application"
echo -e "   4. If issues occur, check logs: pm2 logs sgc-erp-backend"
