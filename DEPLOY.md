# 🚀 SGC ERP - Simple Deployment Guide

## 📋 **What Was Fixed**
- ✅ Missing Public directory files (login now works)
- ✅ CORS issues (production domain tovus.net now accessible)
- ✅ Complete deployment system with rollback

## 🚀 **Future Deployments (Simple!)**

### **Regular Updates (Most Common)**
```bash
# 1. Push changes to git
git add .
git commit -m "Update description"
git push origin main

# 2. Deploy to server (ONE COMMAND!)
./simple-git-deploy.sh
```

### **Major Updates**
```bash
# 1. Backup first
./backup-current-state.sh

# 2. Deploy safely
./safe-deploy.sh
```

## 🆘 **Emergency Commands**

### **Check Server Status**
```bash
ssh root@68.183.215.177 "cd /var/www/sgc-erp && pm2 status"
```

### **If Something Goes Wrong**
```bash
# List backups
ls -la ./backups/

# Restore system
./restore-backup.sh <backup-name>
```

## 📁 **Available Scripts**
- **`./simple-git-deploy.sh`** ⚡ Fast deployment for regular updates
- **`./safe-deploy.sh`** 🛡️ Safe deployment for major changes
- **`./backup-current-state.sh`** 💾 Create backup before deployment
- **`./restore-backup.sh`** 🔄 Emergency rollback

## 🎯 **That's It!**
- **Regular updates**: `./simple-git-deploy.sh`
- **Server status**: `ssh root@68.183.215.177 "cd /var/www/sgc-erp && pm2 status"`
- **Emergency**: `./restore-backup.sh <backup-name>`

**Your system is fully operational with automatic MongoDB protection and rollback capability!** 🚀
