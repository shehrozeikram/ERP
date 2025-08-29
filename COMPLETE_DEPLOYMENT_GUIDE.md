# 🚀 SGC ERP Complete Deployment Guide

## 📋 **What Was Fixed in This Session**

### 1. **Missing Public Directory Files** ✅
- **Problem**: `Public` directory files weren't tracked in git due to `.gitignore` issues
- **Solution**: Fixed `.gitignore` and added missing files to git
- **Files Added**: `JobApplication.js`, `PublicApproval.js`, `OfferAcceptance.js`, `PublicEmployeeOnboarding.js`, `PublicJoiningDocument.js`

### 2. **CORS Configuration** ✅
- **Problem**: Production domain `https://tovus.net` was blocked by CORS policy
- **Solution**: Updated CORS to allow production domains while maintaining security
- **Result**: Login and all API endpoints now work from production

### 3. **Deployment System** ✅
- **Created**: Complete safe deployment system with automatic rollback
- **Features**: MongoDB config preservation, automatic backups, health checks

---

## 🚀 **Future Deployment Workflow**

### **Step 1: Local Development & Git**
```bash
# 1. Make your code changes
# 2. Test locally
# 3. Commit changes
git add .
git commit -m "Your update description"
git push origin main
```

### **Step 2: Deploy to Server**

#### **Option A: Simple Update (Recommended for regular updates)**
```bash
./simple-git-deploy.sh
```

#### **Option B: Safe Deploy (For major changes or first time)**
```bash
./safe-deploy.sh
```

---

## 📁 **Available Deployment Scripts**

### **`./simple-git-deploy.sh`** ⚡ **FAST**
- **Use**: Regular updates after initial deployment
- **Speed**: Quick deployment with minimal downtime
- **Safety**: Quick backup + rollback if needed
- **Best for**: Daily/weekly updates

### **`./safe-deploy.sh`** 🛡️ **SAFE**
- **Use**: Major updates or first-time deployment
- **Speed**: Slower but maximum safety
- **Safety**: Full backup + comprehensive testing + auto-rollback
- **Best for**: Major features, security updates, first deployment

### **`./backup-current-state.sh`** 💾 **BACKUP**
- **Use**: Before any deployment (recommended)
- **Creates**: Timestamped backup of current working state
- **Safety**: Always have a rollback point

### **`./restore-backup.sh`** 🔄 **ROLLBACK**
- **Use**: If something goes wrong
- **Action**: Restores system to previous working state
- **Safety**: Your emergency recovery tool

---

## 🔄 **Complete Deployment Commands**

### **For Regular Updates (Most Common)**
```bash
# 1. Create backup (recommended)
./backup-current-state.sh

# 2. Deploy update
./simple-git-deploy.sh

# 3. Verify deployment
ssh root@68.183.215.177 "cd /var/www/sgc-erp && pm2 status"
```

### **For Major Updates**
```bash
# 1. Create backup
./backup-current-state.sh

# 2. Safe deployment
./safe-deploy.sh

# 3. Verify deployment
ssh root@68.183.215.177 "cd /var/www/sgc-erp && pm2 status"
```

---

## 🆘 **Emergency Commands**

### **If Something Goes Wrong**
```bash
# 1. Check available backups
ls -la ./backups/

# 2. Restore from backup
./restore-backup.sh <backup-name>

# Example:
./restore-backup.sh sgc-erp-backup-20250829_145103
```

### **Server Status Commands**
```bash
# Check if app is running
ssh root@68.183.215.177 "cd /var/www/sgc-erp && pm2 status"

# View logs
ssh root@68.183.215.177 "cd /var/www/sgc-erp && pm2 logs sgc-erp-backend"

# Restart if needed
ssh root@68.183.215.177 "cd /var/www/sgc-erp && pm2 restart sgc-erp-backend"
```

---

## 📊 **Deployment Checklist**

### **Before Deployment**
- [ ] **Backup current state**: `./backup-current-state.sh`
- [ ] **Test locally**: Ensure code works on your machine
- [ ] **Commit changes**: `git add . && git commit -m "message"`
- [ ] **Push to git**: `git push origin main`

### **During Deployment**
- [ ] **Run deployment script**: `./simple-git-deploy.sh` or `./safe-deploy.sh`
- [ ] **Monitor output**: Watch for any errors
- [ ] **Wait for completion**: Don't interrupt the process

### **After Deployment**
- [ ] **Check PM2 status**: `pm2 status` (should show online)
- [ ] **Test login**: Try logging in from production
- [ ] **Test key features**: Verify main functionality works
- [ ] **Check logs**: `pm2 logs sgc-erp-backend` for any errors

---

## 🔧 **Configuration Details**

### **Server Information**
- **IP**: `68.183.215.177`
- **User**: `root`
- **Path**: `/var/www/sgc-erp`
- **PM2 Process**: `sgc-erp-backend`

### **CORS Configuration**
```javascript
// Now allows these origins:
- http://localhost:3000 (development)
- https://tovus.net (production)
- https://www.tovus.net (production www)
```

### **MongoDB Protection**
- **Config File**: `server/config/database.js`
- **Status**: ✅ **NEVER OVERWRITTEN** during deployment
- **Safety**: Your working connection is always preserved

---

## 🚨 **Important Notes**

### **What's Protected**
- ✅ MongoDB configuration
- ✅ Environment variables (.env)
- ✅ Database connections
- ✅ Server settings

### **What Gets Updated**
- ✅ Application code
- ✅ Dependencies
- ✅ Frontend build
- ✅ API routes

### **Safety Features**
- ✅ Automatic backups before every deployment
- ✅ Health checks before going live
- ✅ Automatic rollback on failure
- ✅ Multiple backup types (full + quick)

---

## 📞 **Quick Reference Commands**

### **Daily Operations**
```bash
# Deploy update
./simple-git-deploy.sh

# Check server status
ssh root@68.183.215.177 "cd /var/www/sgc-erp && pm2 status"

# View logs
ssh root@68.183.215.177 "cd /var/www/sgc-erp && pm2 logs sgc-erp-backend"
```

### **Emergency Recovery**
```bash
# List backups
ls -la ./backups/

# Restore system
./restore-backup.sh <backup-name>

# Restart server
ssh root@68.183.215.177 "cd /var/www/sgc-erp && pm2 restart sgc-erp-backend"
```

---

## 🎯 **Best Practices**

1. **Always backup** before deployment
2. **Test locally** before pushing to git
3. **Use simple deploy** for regular updates
4. **Use safe deploy** for major changes
5. **Monitor logs** after deployment
6. **Keep multiple backups** for safety

---

## 🏆 **You're All Set!**

Your SGC ERP system now has:
- ✅ **Working production deployment**
- ✅ **CORS issues resolved**
- ✅ **Complete backup system**
- ✅ **Safe deployment process**
- ✅ **Emergency rollback capability**

**For future updates, just run: `./simple-git-deploy.sh`**

---

*Last Updated: August 29, 2025*
*System Status: ✅ Fully Operational*
