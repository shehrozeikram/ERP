#!/bin/bash

# SGC ERP Safe Deployment Script
# This script safely deploys latest code while preserving MongoDB configuration

set -e  # Exit on any error

echo "🚀 Starting SGC ERP Safe Deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SERVER_USER="root"
SERVER_IP="68.183.215.177"
SERVER_PATH="/var/www/sgc-erp"
GIT_REPO="git@github.com:shehrozeikram/ERP.git"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   Server: $SERVER_USER@$SERVER_IP"
echo "   Path: $SERVER_PATH"
echo "   Git Repo: $GIT_REPO"
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
    git commit -m "Deploy: $(date)"
    git push origin main
else
    echo "✅ No changes to commit"
fi

# Deploy to server
echo -e "${YELLOW}🚀 Deploying to server...${NC}"
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
    set -e
    
    echo "🔒 Creating backup of current working state..."
    cd /var/www/sgc-erp
    
    # Create backup directory
    mkdir -p backups
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_NAME="sgc-erp-backup-${TIMESTAMP}"
    
    # Create backup of current state
    tar -czf "backups/$BACKUP_NAME.tar.gz" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='uploads' \
        --exclude='logs' \
        --exclude='*.log' \
        --exclude='backups' \
        .
    
    echo "✅ Backup created: backups/$BACKUP_NAME.tar.gz"
    
    # Stop PM2 process
    echo "🛑 Stopping PM2 process..."
    pm2 stop sgc-erp-backend 2>/dev/null || true
    
    # Backup critical files
    echo "🔒 Backing up critical configuration files..."
    cp -f server/config/database.js "backups/database.js.backup"
    cp -f .env "backups/.env.backup" 2>/dev/null || echo "⚠️  .env file not found"
    
    # Clone or pull latest changes
    if [ -d ".git" ]; then
        echo "📥 Pulling latest changes..."
        git stash  # Stash any local changes
        git pull origin main
        git stash pop 2>/dev/null || true  # Restore stashed changes if any
    else
        echo "📥 Cloning repository..."
        git clone git@github.com:shehrozeikram/ERP.git .
    fi
    
    # Restore critical configuration files
    echo "🔒 Restoring critical configuration files..."
    cp -f "backups/database.js.backup" server/config/database.js
    if [ -f "backups/.env.backup" ]; then
        cp -f "backups/.env.backup" .env
    fi
    
    echo "📋 Installing backend dependencies..."
    npm install --production
    
    echo "📋 Installing frontend dependencies and building..."
    cd client
    npm install --production
    npm run build
    cd ..
    
    echo "🔧 Setting up environment..."
    if [ ! -f .env ]; then
        echo "⚠️  .env file not found. Please create it manually on the server."
        echo "   You can copy from env.production.example"
    fi
    
    echo "📁 Creating necessary directories..."
    mkdir -p logs uploads
    
    # Test the application before starting
    echo "🧪 Testing application configuration..."
    if node -e "require('./server/config/database.js'); console.log('✅ Database config loaded successfully');" 2>/dev/null; then
        echo "✅ Configuration test passed"
    else
        echo "❌ Configuration test failed"
        echo "🔄 Rolling back to previous state..."
        tar -xzf "backups/$BACKUP_NAME.tar.gz" --strip-components=0
        pm2 start ecosystem.config.js --env production
        pm2 save
        echo "✅ Rollback completed"
        exit 1
    fi
    
    echo "🔄 Starting PM2 process..."
    pm2 start ecosystem.config.js --env production
    pm2 save
    
    # Wait a moment and check if the app is running
    sleep 5
    if pm2 list | grep -q "sgc-erp-backend.*online"; then
        echo "✅ Application started successfully"
    else
        echo "❌ Application failed to start"
        echo "🔄 Rolling back to previous state..."
        pm2 stop sgc-erp-backend 2>/dev/null || true
        tar -xzf "backups/$BACKUP_NAME.tar.gz" --strip-components=0
        pm2 start ecosystem.config.js --env production
        pm2 save
        echo "✅ Rollback completed"
        exit 1
    fi
    
    echo "✅ Deployment completed successfully!"
ENDSSH

echo -e "${GREEN}🎉 Safe deployment completed successfully!${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "   1. SSH into your server: ssh $SERVER_USER@$SERVER_IP"
echo -e "   2. Check application status: pm2 status"
echo -e "   3. Check logs: pm2 logs sgc-erp-backend"
echo -e "   4. Test your application"
echo -e "   5. If issues occur, restore from backup: ./restore-backup.sh <backup-name>"
