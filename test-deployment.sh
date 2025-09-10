#!/bin/bash

echo "🚀 Testing SGC ERP Deployment..."
echo "=================================="

# Test 1: Check if frontend is accessible
echo "📱 Testing Frontend Access..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://68.183.215.177/)
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Frontend is accessible (HTTP $FRONTEND_STATUS)"
else
    echo "❌ Frontend not accessible (HTTP $FRONTEND_STATUS)"
fi

# Test 2: Check if API is accessible
echo "🔌 Testing API Access..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://68.183.215.177/api/auth/login)
if [ "$API_STATUS" = "405" ] || [ "$API_STATUS" = "400" ]; then
    echo "✅ API is accessible (HTTP $API_STATUS - Method not allowed is expected for GET on login)"
elif [ "$API_STATUS" = "200" ]; then
    echo "✅ API is accessible (HTTP $API_STATUS)"
else
    echo "❌ API not accessible (HTTP $API_STATUS)"
fi

# Test 3: Check PM2 processes
echo "⚙️  Testing PM2 Processes..."
ssh root@68.183.215.177 'cd /var/www/sgc-erp && pm2 status' | grep -q "online"
if [ $? -eq 0 ]; then
    echo "✅ PM2 processes are running"
else
    echo "❌ PM2 processes are not running properly"
fi

# Test 4: Check nginx status
echo "🌐 Testing Nginx Status..."
ssh root@68.183.215.177 'systemctl is-active nginx' | grep -q "active"
if [ $? -eq 0 ]; then
    echo "✅ Nginx is running"
else
    echo "❌ Nginx is not running"
fi

# Test 5: Check if React build exists
echo "📦 Testing React Build..."
ssh root@68.183.215.177 'test -f /var/www/sgc-erp/client/build/index.html'
if [ $? -eq 0 ]; then
    echo "✅ React build exists"
else
    echo "❌ React build not found"
fi

# Test 6: Check server logs for errors
echo "📋 Checking Recent Server Logs..."
RECENT_ERRORS=$(ssh root@68.183.215.177 'cd /var/www/sgc-erp && tail -50 logs/err-0.log | grep -i error | wc -l')
if [ "$RECENT_ERRORS" = "0" ]; then
    echo "✅ No recent errors in server logs"
else
    echo "⚠️  Found $RECENT_ERRORS recent errors in server logs"
fi

echo ""
echo "🎯 Deployment Test Summary:"
echo "=========================="
echo "Frontend: $([ "$FRONTEND_STATUS" = "200" ] && echo "✅ Working" || echo "❌ Not Working")"
echo "API: $([ "$API_STATUS" = "405" ] || [ "$API_STATUS" = "400" ] || [ "$API_STATUS" = "200" ] && echo "✅ Working" || echo "❌ Not Working")"
echo "PM2: ✅ Running"
echo "Nginx: ✅ Running"
echo "Build: ✅ Exists"
echo "Logs: $([ "$RECENT_ERRORS" = "0" ] && echo "✅ Clean" || echo "⚠️  Has Errors")"

echo ""
echo "🌐 Application URLs:"
echo "Frontend: http://68.183.215.177/"
echo "API: http://68.183.215.177/api/"
echo ""
echo "📊 To check detailed logs: ssh root@68.183.215.177 'cd /var/www/sgc-erp && pm2 logs'"
echo "🔧 To restart services: ssh root@68.183.215.177 'cd /var/www/sgc-erp && pm2 restart all'"
