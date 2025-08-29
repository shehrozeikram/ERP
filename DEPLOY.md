# 🚀 SGC ERP - Super Simple Deployment

## 📋 **What Was Fixed**
- ✅ Missing Public directory files (login now works)
- ✅ CORS issues (production domain tovus.net now accessible)
- ✅ Complete deployment system with rollback

## 🚀 **Future Deployments (ONE COMMAND!)**

### **Deploy Everything**
```bash
./deploy.sh
```

**That's it!** This script does everything:
- 📦 Builds React app
- 📤 Pushes to git
- 🚀 Deploys to server
- 🔒 Protects MongoDB config
- ✅ Verifies deployment
- 🔄 Auto-rollback if needed

## 🆘 **Emergency Commands**

### **Check Server Status**
```bash
ssh root@68.183.215.177 "cd /var/www/sgc-erp && pm2 status"
```

### **View Logs**
```bash
ssh root@68.183.215.177 "cd /var/www/sgc-erp && pm2 logs sgc-erp-backend"
```

## 🎯 **That's It!**
- **Deploy**: `./deploy.sh`
- **Status**: `ssh root@68.183.215.177 "cd /var/www/sgc-erp && pm2 status"`

**Your system is fully operational with automatic MongoDB protection and rollback capability!** 🚀
