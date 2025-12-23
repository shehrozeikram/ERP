# Server Fix Commands for User Tracking Routes

## Quick Fix (Run these commands on your server via SSH):

```bash
ssh root@68.183.215.177
```

Then run:

```bash
cd /var/www/sgc-erp && \
git pull origin main && \
npm install --production --no-optional && \
pm2 stop sgc-erp-backend && \
pm2 flush sgc-erp-backend && \
pm2 start ecosystem.config.js --env production && \
pm2 save && \
sleep 5 && \
pm2 logs sgc-erp-backend --lines 50 --nostream | grep -i "tracking\|route\|error" | tail -20
```

## Or use the fix script:

```bash
ssh root@68.183.215.177
cd /var/www/sgc-erp
git pull origin main
chmod +x fix-user-tracking.sh
./fix-user-tracking.sh
```

## Verify the fix worked:

After running the commands, check:
1. Server is running: `pm2 list | grep sgc-erp-backend`
2. Routes are registered: `pm2 logs sgc-erp-backend --lines 100 --nostream | grep "User tracking routes registered"`
3. Test the route (from your local machine with a valid token):
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" https://tovus.net/api/tracking/test
   ```

## What was fixed:

1. ✅ Added console logging to verify route registration
2. ✅ Ensured route is registered before 404 handler
3. ✅ Verified route file syntax is correct
4. ✅ Route file properly exports the router

The routes should now be accessible at:
- `/api/tracking/test` - Test endpoint
- `/api/tracking/stats` - Statistics
- `/api/tracking/logins` - Login history
- `/api/tracking/activities` - Activity history
- `/api/tracking/sessions` - Active sessions

