# SGC ERP Deployment Guide

This guide explains how to safely deploy your SGC ERP application while preserving your working MongoDB connection and setting up a simple git-based deployment process.

## 🚨 Important: Current Situation

Your system is currently working with a specific MongoDB configuration. The deployment scripts are designed to:
- **Preserve** your working MongoDB connection
- **Update** all other code from your git repository
- **Provide rollback** capability if anything goes wrong

## 📋 Prerequisites

1. **SSH access** to your Digital Ocean server
2. **Git** installed on your local machine
3. **PM2** installed on your server
4. **Nginx** configured on your server

## 🔒 Step 1: Create Backup of Current Working State

Before any deployment, create a backup of your current working state:

```bash
./backup-current-state.sh
```

This creates a timestamped backup in the `./backups/` directory.

## 🚀 Step 2: Initial Safe Deployment

Use the safe deployment script for the first time to update your code while preserving MongoDB config:

```bash
./safe-deploy.sh
```

**What this script does:**
1. Creates a backup of your current server state
2. Pulls latest code from git
3. **Preserves** your `server/config/database.js` file
4. **Preserves** your `.env` file
5. Updates all other code and dependencies
6. Tests the configuration before starting
7. **Automatically rolls back** if anything fails

## 🔄 Step 3: Future Simple Deployments

After the initial safe deployment, use the simple deployment script for regular updates:

```bash
./simple-git-deploy.sh
```

**What this script does:**
1. Quick backup of critical files
2. Pull latest code from git
3. Preserve MongoDB configuration
4. Quick health check
5. Fast rollback if needed

## 🆘 Rollback (If Something Goes Wrong)

If deployment causes issues, restore from a backup:

```bash
./restore-backup.sh <backup-name>
```

Example:
```bash
./restore-backup.sh sgc-erp-backup-20241201_143022
```

## 📁 Script Details

### `backup-current-state.sh`
- Creates timestamped backups
- Excludes unnecessary files (node_modules, logs, etc.)
- Creates a `latest-backup` symlink

### `safe-deploy.sh`
- **Full backup** before deployment
- **Preserves** MongoDB configuration
- **Comprehensive testing** before starting
- **Automatic rollback** on failure
- Best for major updates or first-time deployment

### `simple-git-deploy.sh`
- **Quick backup** of critical files
- **Fast deployment** for regular updates
- **Quick rollback** if needed
- Best for routine updates after initial deployment

### `restore-backup.sh`
- Restores system to previous working state
- Creates backup of current state before restore
- Restarts PM2 processes

## 🔧 Configuration

Update these variables in the deployment scripts if needed:

```bash
SERVER_USER="root"
SERVER_IP="68.183.215.177"
SERVER_PATH="/var/www/sgc-erp"
GIT_REPO="git@github.com:shehrozeikram/ERP.git"
```

## 📊 Deployment Workflow

```
Current Working State
         ↓
   Create Backup
         ↓
   Safe Deploy
         ↓
   Test & Verify
         ↓
   Success! ✅
         ↓
   Future Updates:
   simple-git-deploy.sh
```

## 🚨 Safety Features

1. **Automatic Backups**: Every deployment creates a backup
2. **Configuration Preservation**: MongoDB config is never overwritten
3. **Health Checks**: Application is tested before going live
4. **Automatic Rollback**: System rolls back if deployment fails
5. **Multiple Backup Types**: Full backups + quick backups

## 📝 Post-Deployment Checklist

After each deployment:

1. ✅ Check PM2 status: `pm2 status`
2. ✅ Check application logs: `pm2 logs sgc-erp-backend`
3. ✅ Test your application functionality
4. ✅ Verify MongoDB connection is working
5. ✅ Check if all routes are accessible

## 🆘 Troubleshooting

### Application Won't Start
```bash
# Check PM2 logs
pm2 logs sgc-erp-backend

# Check if MongoDB is accessible
node -e "require('./server/config/database.js')"

# Restore from backup if needed
./restore-backup.sh <backup-name>
```

### MongoDB Connection Issues
- Your MongoDB config is preserved during deployment
- Check your `.env` file has correct `MONGODB_URI`
- Verify network connectivity to MongoDB Atlas

### Rollback Issues
```bash
# List available backups
ls -la ./backups/

# Restore specific backup
./restore-backup.sh <backup-name>
```

## 🎯 Best Practices

1. **Always backup** before deployment
2. **Test locally** before deploying
3. **Deploy during low-traffic** periods
4. **Monitor logs** after deployment
5. **Keep multiple backups** for safety

## 📞 Support

If you encounter issues:
1. Check the backup directory for available rollback points
2. Review PM2 logs for error details
3. Use the restore script to get back to working state
4. The system is designed to fail safely and rollback automatically

---

**Remember**: Your MongoDB connection is the most critical part. These scripts are designed to preserve it while updating everything else safely.
