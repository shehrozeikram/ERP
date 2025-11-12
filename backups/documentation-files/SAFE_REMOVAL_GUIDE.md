# SAFE FILE REMOVAL GUIDE

## 🛡️ Safety Features

This removal process is **100% safe** because:

1. **Files are MOVED, not deleted** - They go to `backups/removed-scripts/`
2. **Organized by category** - Easy to find and restore specific files
3. **Removal log** - Tracks what was removed and when
4. **One-command restore** - Restore everything if needed
5. **Dry-run mode** - Test first without actually removing anything

---

## 📋 Step-by-Step Process

### Step 1: Test First (Dry Run)
```bash
node server/scripts/safe-remove-files.js remove --dry-run
```
This shows what would be removed WITHOUT actually removing anything.

### Step 2: Review the Output
Check the list of files that would be removed. Verify they're all safe to remove.

### Step 3: Actually Remove Files
```bash
node server/scripts/safe-remove-files.js remove
```
This moves files to backup folder.

### Step 4: Test Your Application
- Start your server: `npm start`
- Test critical functionality:
  - Login
  - Leave management
  - Employee management
  - Payroll
  - Any other critical features

### Step 5: If Everything Works
Files are safely backed up. You can delete the backup folder later if you want.

### Step 6: If Something Breaks
```bash
node server/scripts/safe-remove-files.js restore
```
This restores ALL files from backup.

---

## 🔄 What Happens During Removal

1. **Backup folder created**: `backups/removed-scripts/`
2. **Files organized by category**:
   - `backups/removed-scripts/testScripts/`
   - `backups/removed-scripts/oldImportScripts/`
   - `backups/removed-scripts/dataFiles/`
   - etc.
3. **Removal log created**: `backups/removed-scripts/removal-log.json`
4. **Files moved** (not deleted) to backup folders

---

## 📊 Files That Will Be Removed

- **Backup files**: 2 files
- **Test scripts**: 49 files
- **Old import scripts**: 20 files
- **Old data files**: 7 files
- **One-time scripts**: 50+ files
- **Unregistered route**: 1 file (`annualLeave.js`)

**Total: ~130+ files**

---

## ✅ What Happens If Functionality Breaks?

### Scenario 1: Application Won't Start
**Symptom**: Server crashes on startup
**Solution**: 
```bash
node server/scripts/safe-remove-files.js restore
```
All files restored immediately.

### Scenario 2: Missing Feature
**Symptom**: Some feature doesn't work
**Solution**:
1. Check removal log: `cat backups/removed-scripts/removal-log.json`
2. Find the file category
3. Restore specific file manually from backup folder
4. Or restore all: `node server/scripts/safe-remove-files.js restore`

### Scenario 3: Import Script Needed
**Symptom**: Need to import data again
**Solution**: 
- Check `backups/removed-scripts/oldImportScripts/`
- Copy the script back if needed
- Or restore all: `node server/scripts/safe-remove-files.js restore`

---

## 🔍 Verification Commands

### List what's backed up:
```bash
node server/scripts/safe-remove-files.js list
```

### Check backup folder:
```bash
ls -la backups/removed-scripts/
```

### View removal log:
```bash
cat backups/removed-scripts/removal-log.json
```

---

## ⚠️ Important Notes

1. **Files are NOT deleted** - They're moved to backup
2. **Git history preserved** - Files still in git if you need them
3. **Easy restore** - One command restores everything
4. **Test first** - Always use `--dry-run` first
5. **Test application** - After removal, test critical features

---

## 🎯 Recommended Workflow

1. ✅ Run dry-run: `node server/scripts/safe-remove-files.js remove --dry-run`
2. ✅ Review the list
3. ✅ Remove files: `node server/scripts/safe-remove-files.js remove`
4. ✅ Test application thoroughly
5. ✅ If all good, keep backup for a few days
6. ✅ If issues, restore immediately: `node server/scripts/safe-remove-files.js restore`
7. ✅ After confirming everything works, you can delete backup folder later

---

## 📝 Files That Will Be Kept

These files are **NOT** removed (essential):

- ✅ `import-merged-leaves.js` - Current leave import
- ✅ `remove-duplicate-leaves.js` - Current duplicate removal
- ✅ `remove-all-leaves.js` - Current cleanup
- ✅ `merge-leave-files.js` - Utility script
- ✅ `import-all-employees-from-excel.js` - Current employee import
- ✅ `merged-leave-data.csv` - Source data
- ✅ `generateSampleFinanceData.js` - May be useful
- ✅ `generateChartOfAccounts.js` - May be useful
- ✅ `generateRealisticAuditData.js` - May be useful

---

## 🚨 Emergency Restore

If something breaks and you need to restore immediately:

```bash
# Restore all files
node server/scripts/safe-remove-files.js restore

# Or manually restore specific file
cp backups/removed-scripts/[category]/[filename] server/scripts/[filename]
```

---

## ✅ Safety Guarantee

- ✅ Files are moved, not deleted
- ✅ Can restore anytime
- ✅ Organized backup structure
- ✅ Removal log tracks everything
- ✅ Git history still has files
- ✅ Test with dry-run first

**You can always restore if anything breaks!**

