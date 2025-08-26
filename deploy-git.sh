#!/bin/bash

# SGC ERP Git-based Deployment Script
# This script automates deployment using Git workflow

set -e  # Exit on any error

echo "🚀 Starting SGC ERP Git-based deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER_USER="root"
SERVER_IP="68.183.215.177"
SERVER_PATH="/var/www/sgc-erp"
GIT_REPO="https://github.com/shehrozeikram/ERP.git"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   Server: $SERVER_USER@$SERVER_IP"
echo "   Path: $SERVER_PATH"
echo "   Git Repo: $GIT_REPO"
echo ""

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install git first."
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
    
    echo "📁 Setting up project directory..."
    sudo mkdir -p /var/www/sgc-erp
    sudo chown $USER:$USER /var/www/sgc-erp
    
    cd /var/www/sgc-erp
    
    # Clone or pull latest changes
    if [ -d ".git" ]; then
        echo "📥 Pulling latest changes..."
        git pull origin main
    else
        echo "📥 Cloning repository..."
        git clone https://github.com/shehrozeikram/ERP.git .
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
    
    echo "🔄 Restarting PM2 process..."
    pm2 delete sgc-erp-backend 2>/dev/null || true
    pm2 start ecosystem.config.js --env production
    pm2 save
    
    echo "✅ Deployment completed successfully!"
ENDSSH

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "   1. SSH into your server: ssh $SERVER_USER@$SERVER_IP"
echo -e "   2. Create .env file in $SERVER_PATH/"
echo -e "   3. Configure Nginx if not already done"
echo -e "   4. Set up SSL certificates with Let's Encrypt"
echo -e "   5. Test your application"
