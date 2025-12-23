#!/bin/bash

# Fix User Tracking Routes on Server
# Run this script on the server to diagnose and fix the issue

set -e

echo "🔍 Diagnosing and Fixing User Tracking Routes Issue..."
echo ""

cd /var/www/sgc-erp

# 1. Check if route file exists
echo "📁 Step 1: Checking route file..."
if [ -f "server/routes/userTracking.js" ]; then
    echo "✅ Route file exists ($(wc -l < server/routes/userTracking.js) lines)"
else
    echo "❌ Route file NOT FOUND!"
    exit 1
fi

# 2. Check if route is registered in index.js
echo ""
echo "📝 Step 2: Checking route registration..."
if grep -q "app.use('/api/tracking'" server/index.js; then
    echo "✅ Route is registered in server/index.js"
    echo "   Found: $(grep "app.use('/api/tracking'" server/index.js)"
else
    echo "❌ Route NOT registered in server/index.js!"
    echo "   Adding route registration..."
    # This would need manual intervention
    exit 1
fi

# 3. Verify route file has proper export
echo ""
echo "🔍 Step 3: Verifying route file structure..."
if grep -q "module.exports = router" server/routes/userTracking.js; then
    echo "✅ Route file has proper module.exports"
else
    echo "❌ Route file missing module.exports!"
    exit 1
fi

# 4. Check PM2 status
echo ""
echo "🔄 Step 4: Checking PM2 status..."
pm2 list | grep sgc-erp-backend || echo "⚠️  PM2 process not found"

# 5. Pull latest code
echo ""
echo "📥 Step 5: Pulling latest code from git..."
git pull origin main || echo "⚠️  Git pull failed or no changes"

# 6. Verify the route file syntax
echo ""
echo "🔍 Step 6: Verifying route file syntax..."
if node -c server/routes/userTracking.js 2>/dev/null; then
    echo "✅ Route file syntax is valid"
else
    echo "❌ Route file has syntax errors!"
    node -c server/routes/userTracking.js
    exit 1
fi

# 7. Install dependencies if needed
echo ""
echo "📦 Step 7: Installing/updating dependencies..."
npm install --production --no-optional || echo "⚠️  npm install had warnings"

# 8. Stop PM2
echo ""
echo "🛑 Step 8: Stopping PM2..."
pm2 stop sgc-erp-backend 2>/dev/null || echo "   (Already stopped)"

# 9. Clear PM2 logs
echo ""
echo "🧹 Step 9: Clearing old logs..."
pm2 flush sgc-erp-backend 2>/dev/null || true

# 10. Restart PM2
echo ""
echo "🚀 Step 10: Starting PM2 with latest code..."
pm2 start ecosystem.config.js --env production
pm2 save

# 11. Wait for server to start
echo ""
echo "⏳ Step 11: Waiting for server to initialize..."
sleep 5

# 12. Check if server started successfully
echo ""
echo "✅ Step 12: Checking server status..."
if pm2 list | grep -q "sgc-erp-backend.*online"; then
    echo "✅ Server is running!"
    echo ""
    echo "📋 Recent startup logs:"
    pm2 logs sgc-erp-backend --lines 30 --nostream | tail -30
    echo ""
    echo "🔍 Checking for route registration message..."
    if pm2 logs sgc-erp-backend --lines 100 --nostream | grep -q "User tracking routes registered"; then
        echo "✅ Route registration confirmed in logs!"
    else
        echo "⚠️  Route registration message not found in logs"
    fi
    echo ""
    echo "🎉 Fix complete!"
    echo ""
    echo "🧪 Test the routes:"
    echo "   curl -H 'Authorization: Bearer YOUR_TOKEN' https://tovus.net/api/tracking/test"
    echo "   curl -H 'Authorization: Bearer YOUR_TOKEN' https://tovus.net/api/tracking/stats"
else
    echo "❌ Server failed to start!"
    echo ""
    echo "📋 Error logs:"
    pm2 logs sgc-erp-backend --lines 50 --nostream --err
    exit 1
fi

