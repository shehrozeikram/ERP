# 🚀 Quick Deployment Checklist

## Before Deployment
- [ ] **Backup current state**: `./backup-current-state.sh`
- [ ] **Check git status**: `git status`
- [ ] **Commit any local changes**: `git add . && git commit -m "Update"`
- [ ] **Push to remote**: `git push origin main`

## Initial Deployment (First Time)
- [ ] **Run safe deployment**: `./safe-deploy.sh`
- [ ] **Verify MongoDB connection preserved**
- [ ] **Check PM2 status**: `pm2 status`
- [ ] **Test application functionality**

## Regular Updates (After Initial)
- [ ] **Run simple deployment**: `./simple-git-deploy.sh`
- [ ] **Quick health check**
- [ ] **Verify application running**

## If Issues Occur
- [ ] **Check PM2 logs**: `pm2 logs sgc-erp-backend`
- [ ] **Restore from backup**: `./restore-backup.sh <backup-name>`
- [ ] **Verify system back to working state**

## Post-Deployment
- [ ] ✅ Application starts successfully
- [ ] ✅ MongoDB connection working
- [ ] ✅ All routes accessible
- [ ] ✅ No error logs
- [ ] ✅ System performance normal

---

**Emergency Rollback Command:**
```bash
./restore-backup.sh <backup-name>
```

**Check Available Backups:**
```bash
ls -la ./backups/
```
