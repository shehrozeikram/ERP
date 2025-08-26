#!/bin/bash

# SGC ERP Deployment Script
# This script automates the deployment process to DigitalOcean droplet

set -e  # Exit on any error

echo "🚀 Starting SGC ERP deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="sgc-erp"
SERVER_USER="root"
SERVER_IP="YOUR_DROPLET_IP_HERE"
SERVER_PATH="/var/www/sgc-erp"
DOMAIN="your-domain.com"

# Build the React app
echo -e "${YELLOW}📦 Building React application...${NC}"
cd client
npm run build
cd ..

# Create deployment package
echo -e "${YELLOW}📦 Creating deployment package...${NC}"
tar -czf sgc-erp-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.env' \
    --exclude='uploads' \
    --exclude='logs' \
    --exclude='*.log' \
    .

# Upload to server
echo -e "${YELLOW}📤 Uploading to server...${NC}"
scp sgc-erp-deploy.tar.gz $SERVER_USER@$SERVER_IP:/tmp/

# Execute deployment commands on server
echo -e "${YELLOW}🔧 Executing deployment on server...${NC}"
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
    set -e
    
    echo "📁 Creating project directory..."
    sudo mkdir -p /var/www/sgc-erp
    sudo chown $USER:$USER /var/www/sgc-erp
    
    echo "📦 Extracting deployment package..."
    cd /var/www/sgc-erp
    tar -xzf /tmp/sgc-erp-deploy.tar.gz
    rm /tmp/sgc-erp-deploy.tar.gz
    
    echo "📋 Installing dependencies..."
    npm install --production
    cd client && npm install --production && cd ..
    
    echo "🔧 Setting up environment..."
    if [ ! -f .env ]; then
        echo "⚠️  .env file not found. Please create it manually on the server."
    fi
    
    echo "📁 Creating necessary directories..."
    mkdir -p logs uploads
    
    echo "🔄 Restarting PM2 process..."
    pm2 delete sgc-erp-backend 2>/dev/null || true
    pm2 start ecosystem.config.js --env production
    pm2 save
    
    echo "🔄 Reloading Nginx..."
    sudo nginx -t && sudo systemctl reload nginx
    
    echo "✅ Deployment completed successfully!"
ENDSSH

# Clean up local files
echo -e "${YELLOW}🧹 Cleaning up local files...${NC}"
rm sgc-erp-deploy.tar.gz

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "   1. SSH into your server: ssh $SERVER_USER@$SERVER_IP"
echo -e "   2. Create .env file in /var/www/sgc-erp/"
echo -e "   3. Update domain in nginx.conf and reload nginx"
echo -e "   4. Set up SSL certificates with Let's Encrypt"
echo -e "   5. Test your application at https://$DOMAIN"
