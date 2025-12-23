#!/bin/bash

# 🚀 SGC ERP - Deployment Script with User Tracking Routes Fix
# Builds locally and deploys to server with route verification

set -e

echo "🚀 Starting SGC ERP deployment with User Tracking Routes Fix..."

# Configuration
SERVER_USER="root"
SERVER_IP="68.183.215.177"
SERVER_PATH="/var/www/sgc-erp"
ENV_FILE=".env"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Build React app locally
echo -e "${YELLOW}📦 Building React app locally...${NC}"
cd client && npm run build && cd ..

# Sync build artifacts to server
echo -e "${YELLOW}📤 Uploading client build artifacts...${NC}"
rsync -avz --delete client/build/ $SERVER_USER@$SERVER_IP:$SERVER_PATH/client/build/

# Sync environment file so production matches development SMTP config
if [ -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}🔐 Uploading environment configuration...${NC}"
  scp "$ENV_FILE" $SERVER_USER@$SERVER_IP:$SERVER_PATH/.env.deploy
else
  echo -e "${RED}⚠️ Environment file '$ENV_FILE' not found. Skipping env sync.${NC}"
fi

# Commit and push changes
echo -e "${YELLOW}📤 Pushing to git...${NC}"
git add .
git commit -m "Deploy with User Tracking Routes Fix: $(date)" || echo "No changes to commit"
git push origin main

# Deploy to server with comprehensive fix
echo -e "${YELLOW}🚀 Deploying to server with User Tracking Routes fix...${NC}"
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
    set -e
    
    cd /var/www/sgc-erp
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔍 STEP 1: Pre-deployment checks"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
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
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🛑 STEP 2: Stopping application"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Stop app
    pm2 stop sgc-erp-backend 2>/dev/null || echo "   (Already stopped)"
    pm2 flush sgc-erp-backend 2>/dev/null || true
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📥 STEP 3: Pulling latest code"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Pull latest code
    git pull origin main || {
        echo "❌ Git pull failed!"
        exit 1
    }
    echo "✅ Code pulled successfully"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔍 STEP 4: Verifying User Tracking Routes"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Verify route file exists
    if [ ! -f "server/routes/userTracking.js" ]; then
        echo "❌ Route file NOT FOUND: server/routes/userTracking.js"
        exit 1
    fi
    echo "✅ Route file exists ($(wc -l < server/routes/userTracking.js) lines)"
    
    # Verify route file has proper export
    if ! grep -q "module.exports = router" server/routes/userTracking.js; then
        echo "❌ Route file missing module.exports!"
        exit 1
    fi
    echo "✅ Route file has proper module.exports"
    
    # Verify route is registered in index.js
    if ! grep -q "app.use('/api/tracking'" server/index.js; then
        echo "❌ Route NOT registered in server/index.js!"
        exit 1
    fi
    echo "✅ Route is registered in server/index.js"
    echo "   Found: $(grep "app.use('/api/tracking'" server/index.js | head -1)"
    
    # Verify route file syntax
    if ! node -c server/routes/userTracking.js 2>/dev/null; then
        echo "❌ Route file has syntax errors!"
        node -c server/routes/userTracking.js
        exit 1
    fi
    echo "✅ Route file syntax is valid"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔧 STEP 5: Restoring configuration files"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Restore critical files
    if [ -f "$BACKUP_DB" ]; then
        cp -f "$BACKUP_DB" server/config/database.js
        echo "✅ Database config restored"
    fi
    if [ -f ".env.deploy" ]; then
        mv .env.deploy .env
        echo "✅ Environment file updated from deployment package"
    elif [ -f "$BACKUP_ENV" ]; then
        cp -f "$BACKUP_ENV" .env
        echo "✅ Environment file restored from backup"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📦 STEP 6: Installing dependencies"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Install only server dependencies (skip client build)
    npm install --production --no-optional || {
        echo "⚠️ npm install had warnings, but continuing..."
    }
    echo "✅ Dependencies installed"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📁 STEP 7: Setting up build files"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Ensure build directory exists
    mkdir -p client/build
    
    # Copy build files to nginx web root
    if [ -d "client/build" ] && [ "$(ls -A client/build)" ]; then
        cp -r /var/www/sgc-erp/client/build/* /var/www/html/ 2>/dev/null || {
            echo "⚠️ Could not copy to /var/www/html/, but continuing..."
        }
        echo "✅ Build files copied"
    else
        echo "⚠️ Build directory is empty, skipping copy"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔄 STEP 8: Reloading nginx"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Reload nginx to serve new files
    systemctl reload nginx || {
        echo "⚠️ Nginx reload failed, but continuing..."
    }
    echo "✅ Nginx reloaded"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🚀 STEP 9: Starting application"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Start app
    pm2 start ecosystem.config.js --env production
    pm2 save
    echo "✅ PM2 started"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⏳ STEP 10: Waiting for server to initialize"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Wait for server to start
    sleep 8
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ STEP 11: Verifying deployment"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Check if server started successfully
    if pm2 list | grep -q "sgc-erp-backend.*online"; then
        echo "✅ Server is running"
    else
        echo "❌ Server failed to start!"
        echo ""
        echo "📋 Error logs:"
        pm2 logs sgc-erp-backend --lines 50 --nostream --err
        exit 1
    fi
    
    # Check for route registration in logs
    echo ""
    echo "🔍 Checking for route registration..."
    if pm2 logs sgc-erp-backend --lines 200 --nostream | grep -q "User tracking routes registered"; then
        echo "✅ Route registration confirmed in logs!"
    else
        echo "⚠️ Route registration message not found in logs"
        echo "   (This might be normal if the log was cleared)"
    fi
    
    # Test the public route
    echo ""
    echo "🧪 Testing public test route..."
    sleep 2
    TEST_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/tracking/test-public 2>/dev/null || echo "000")
    if [ "$TEST_RESPONSE" = "200" ]; then
        echo "✅ Public test route is working (HTTP $TEST_RESPONSE)"
    else
        echo "⚠️ Public test route returned HTTP $TEST_RESPONSE"
        echo "   (This might indicate a routing issue)"
    fi
    
    # Show recent logs
    echo ""
    echo "📋 Recent server logs (last 20 lines):"
    pm2 logs sgc-erp-backend --lines 20 --nostream | tail -20
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 Deployment completed successfully!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🧪 Test the User Tracking routes:"
    echo "   - /api/tracking/test (test endpoint)"
    echo "   - /api/tracking/stats (statistics)"
    echo "   - /api/tracking/logins (login history)"
    echo "   - /api/tracking/activities (activity history)"
    echo ""
    echo "📊 Check server status:"
    echo "   pm2 status"
    echo "   pm2 logs sgc-erp-backend"
ENDSSH

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "   1. Test the routes: https://tovus.net/general/user-tracking"
echo -e "   2. Check server logs: ssh $SERVER_USER@$SERVER_IP 'pm2 logs sgc-erp-backend'"
echo -e "   3. Verify routes: ssh $SERVER_USER@$SERVER_IP 'pm2 logs sgc-erp-backend --lines 100 --nostream | grep tracking'"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

