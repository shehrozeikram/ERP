require('dotenv').config();
const fs = require('fs');
const path = require('path');

/**
 * SAFE FILE REMOVAL SCRIPT
 * 
 * This script moves files to a backup folder instead of deleting them permanently.
 * You can restore them if anything breaks.
 */

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups', 'removed-scripts');
const REMOVAL_LOG = path.join(BACKUP_DIR, 'removal-log.json');

// Files to remove (organized by category)
const FILES_TO_REMOVE = {
  backups: [
    'server/routes/procurement.js.bak',
    'client/src/pages/HR/EmployeeForm.js.backup'
  ],
  
  testScripts: [
    'server/scripts/test-employee-leave-system.js',
    'server/scripts/test-carry-forward-employee-3.js',
    'server/scripts/fix-test-employee-3.js',
    'server/scripts/detailed-carry-forward-test.js',
    'server/scripts/test-fix-carry-forward-all.js',
    'server/scripts/test-carry-forward-all-employees.js',
    'server/scripts/test-leave-types-reset.js',
    'server/scripts/test-carry-forward-40-cap.js',
    'server/scripts/test-carry-forward-employee-2120.js',
    'server/scripts/test-carry-forward-anniversary.js',
    'server/scripts/testCasualLeaveCreation.js',
    'server/scripts/testEmployee06031Leave.js',
    'server/scripts/stepByStepCarryForwardTest.js',
    'server/scripts/fixAndTestCarryForward.js',
    'server/scripts/testAutoCarryForwardUpdate.js',
    'server/scripts/comprehensiveCarryForwardTest.js',
    'server/scripts/testLeaveRequestEmployee06387.js',
    'server/scripts/testCarryForwardSimple.js',
    'server/scripts/testCarryForwardEmployee06387.js',
    'server/scripts/testEmployee6387Workflow.js',
    'server/scripts/test-hire-date-api.js',
    'server/scripts/test-employee-6031-anniversary-readonly.js',
    'server/scripts/test-carry-forward-expiration.js',
    'server/scripts/test-employee-6031-anniversary.js',
    'server/scripts/test-anniversary-leave-system.js',
    'server/scripts/test-leave-api-endpoint.js',
    'server/scripts/test-leave-api.js',
    'server/scripts/simple-api-test.js',
    'server/scripts/test-api-endpoint.js',
    'server/scripts/test-zkbio-websocket-connection.js',
    'server/scripts/test-image-investigation.js',
    'server/scripts/test-server-status.js',
    'server/scripts/test-realtime-images.js',
    'server/scripts/test-zkbio-enhanced.js',
    'server/scripts/test-socket-connection.js',
    'server/scripts/test-simulate-attendance.js',
    'server/scripts/test-server-zkbio-connection.js',
    'server/scripts/comprehensive-zkbio-test.js',
    'server/scripts/test-zkbio-connection.js',
    'server/scripts/test-hover-tooltips.js',
    'server/scripts/test-realtime-monitoring.js',
    'server/scripts/test-websocket-image-flow.js',
    'server/scripts/test-ultra-beautiful-tooltips.js',
    'server/scripts/test-error-handling-fix.js',
    'server/scripts/test-dashboard-integration.js',
    'server/scripts/test-loan-payroll-integration.js',
    'server/scripts/test-house-allowance-flow.js',
    'server/scripts/test-employee-id.js',
    'server/scripts/test-employee-direct.js',
    'server/scripts/test-time-formatting.js',
    'server/scripts/create-test-employee.js',
    'server/scripts/import-single-employee-test.js'
  ],
  
  oldImportScripts: [
    'server/scripts/import-employees-from-excel.js',
    'server/scripts/fast-import-employees.js',
    'server/scripts/improved-import-employees.js',
    'server/scripts/ultra-fast-import.js',
    'server/scripts/import-all-employees.js',
    'server/scripts/import-all-leaves-from-csv.js',
    'server/scripts/import-first-employee-leaves.js',
    'server/scripts/import-first-1000-records.js',
    'server/scripts/import-final-records.js',
    'server/scripts/import-missing-records.js',
    'server/scripts/import-all-remaining-records.js',
    'server/scripts/reimport-historical-leaves.js',
    'server/scripts/clear-and-import-test-records.js',
    'server/scripts/test-import-few-records.js',
    'server/scripts/verify-import-complete.js',
    'server/scripts/verify-import-results.js',
    'server/scripts/verify-sample-employees.js',
    'server/scripts/verify-remove-duplicates.js',
    'server/scripts/fix-verify-all-employees-leaves.js',
    'server/scripts/fix-verify-employee-leaves.js'
  ],
  
  oldCarryForwardScripts: [
    'server/scripts/apply-carry-forward-employee-3.js',
    'server/scripts/apply-carry-forward-all-employees.js',
    'server/scripts/fix-cf-employee-3.js',
    'server/scripts/applyCarryForwardCap.js',
    'server/scripts/fixAllCarryForwardIssues.js',
    'server/scripts/verify2024CarryForward.js',
    'server/scripts/checkCurrentState.js'
  ],
  
  employeeTestScripts: [
    'server/scripts/removeEmployee06387Leaves.js',
    'server/scripts/removeEmployee6387Leaves.js',
    'server/scripts/employee6387Manager.js',
    'server/scripts/setupEmployee6387.js'
  ],
  
  oldRemoveScripts: [
    'server/scripts/removeAllApprovedLeaves.js',
    'server/scripts/final-remove-duplicates.js'
  ],
  
  examineScripts: [
    'server/scripts/examine-excel-structure.js',
    'server/scripts/examine-aug-excel.js',
    'server/scripts/examine-aug-excel-v2.js',
    'server/scripts/check-leave-balance-structure.js',
    'server/scripts/check-all-employees.js',
    'server/scripts/check-employees.js',
    'server/scripts/check-cloud-database.js',
    'server/scripts/debug-employee-leave-balance.js'
  ],
  
  fixScripts: [
    'server/scripts/fix-cloud-leave-balance.js',
    'server/scripts/fix-cloud-leave-balance-v2.js',
    'server/scripts/fix-cloud-leave-balance-v3.js',
    'server/scripts/fix-leave-balance-schema.js',
    'server/scripts/fixLeaveBalanceIndexes.js',
    'server/scripts/fix-total-earnings-calculation.js'
  ],
  
  dataFiles: [
    'server/scripts/2023 to 7 july 2025.xls',
    'server/scripts/Leave_20251028152804.xlsx',
    'server/scripts/leave-data-formatted.csv',
    'server/scripts/leave-data-formatted.json',
    'server/scripts/leave-month-summary.csv',
    'server/scripts/Master_File_Aug_2025.xlsx',
    'server/scripts/Master_File_July-2025.xlsx'
  ],
  
  setupScripts: [
    'server/scripts/create-admin-direct.js',
    'server/scripts/create-ceo-user.js',
    'server/scripts/create-default-admin.js',
    'server/scripts/recreate-admin.js',
    'server/scripts/migrateExistingRoles.js',
    'server/scripts/initialize-leave-management.js',
    'server/scripts/seed-staff-types.js',
    'server/scripts/demo-staff-management.js',
    'server/scripts/populate-fbr-tax-slabs-2025.js'
  ],
  
  payrollScripts: [
    'server/scripts/delete-payroll-records.js',
    'server/scripts/delete-payrolls-except-august.js',
    'server/scripts/quick-delete-payrolls-except-august.js',
    'server/scripts/clear-payrolls.js',
    'server/scripts/remove-all-arrears.js',
    'server/scripts/remove-all-increments.js',
    'server/scripts/remove-all-employees.js',
    'server/scripts/clearAllLeaveData.js'
  ],
  
  otherScripts: [
    'server/scripts/update-loan-deductions.js',
    'server/scripts/update-payrolls-from-excel.js',
    'server/scripts/update-employee-gross-salary.js',
    'server/scripts/recalc-tax-05898.js',
    'server/scripts/find-payroll-06382.js',
    'server/scripts/migrate-excel-allowances-to-payrolls.js',
    'server/scripts/restructure-salary-system.js',
    'server/scripts/updateLeavePolicyDefaults.js',
    'server/scripts/initialize-balances-for-work-years.js',
    'server/scripts/optimizeLeaveIndexes.js',
    'server/scripts/delete-unused-collections.js',
    'server/scripts/quick-status-check.js',
    'server/scripts/working-zkbio-connection.js',
    'server/scripts/final-dashboard-verification.js',
    'server/scripts/verify-employee.js',
    'server/scripts/annualLeaveDemo.js'
  ],
  
  unregisteredRoute: [
    'server/routes/annualLeave.js'
  ]
};

// Flatten all files into one array
const getAllFilesToRemove = () => {
  return Object.values(FILES_TO_REMOVE).flat();
};

// Create backup directory structure
const createBackupStructure = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  // Create category folders
  Object.keys(FILES_TO_REMOVE).forEach(category => {
    const categoryDir = path.join(BACKUP_DIR, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }
  });
  
  console.log(`✅ Backup directory created: ${BACKUP_DIR}`);
};

// Move file to backup (safe removal)
const moveToBackup = (filePath, category) => {
  try {
    const fullPath = path.join(__dirname, '..', '..', filePath);
    
    if (!fs.existsSync(fullPath)) {
      return { success: false, reason: 'File does not exist' };
    }
    
    const fileName = path.basename(filePath);
    const backupPath = path.join(BACKUP_DIR, category, fileName);
    
    // If file already exists in backup, add timestamp
    if (fs.existsSync(backupPath)) {
      const timestamp = Date.now();
      const ext = path.extname(fileName);
      const nameWithoutExt = path.basename(fileName, ext);
      const newBackupPath = path.join(BACKUP_DIR, category, `${nameWithoutExt}-${timestamp}${ext}`);
      fs.renameSync(fullPath, newBackupPath);
      return { success: true, backupPath: newBackupPath };
    }
    
    fs.renameSync(fullPath, backupPath);
    return { success: true, backupPath };
  } catch (error) {
    return { success: false, reason: error.message };
  }
};

// Restore file from backup
const restoreFromBackup = (filePath, category) => {
  try {
    const fileName = path.basename(filePath);
    const backupPath = path.join(BACKUP_DIR, category, fileName);
    
    if (!fs.existsSync(backupPath)) {
      // Try to find with timestamp
      const files = fs.readdirSync(path.join(BACKUP_DIR, category));
      const matchingFile = files.find(f => f.startsWith(fileName.split('.')[0]));
      if (!matchingFile) {
        return { success: false, reason: 'Backup file not found' };
      }
      const foundBackupPath = path.join(BACKUP_DIR, category, matchingFile);
      const originalPath = path.join(__dirname, '..', '..', filePath);
      fs.copyFileSync(foundBackupPath, originalPath);
      return { success: true, restoredFrom: matchingFile };
    }
    
    const originalPath = path.join(__dirname, '..', '..', filePath);
    fs.copyFileSync(backupPath, originalPath);
    return { success: true };
  } catch (error) {
    return { success: false, reason: error.message };
  }
};

// Load removal log
const loadRemovalLog = () => {
  if (fs.existsSync(REMOVAL_LOG)) {
    return JSON.parse(fs.readFileSync(REMOVAL_LOG, 'utf-8'));
  }
  return { removedFiles: [], timestamp: null };
};

// Save removal log
const saveRemovalLog = (log) => {
  fs.writeFileSync(REMOVAL_LOG, JSON.stringify(log, null, 2));
};

// Main removal function
const safeRemoveFiles = async (dryRun = false) => {
  console.log('🔍 Safe File Removal Script\n');
  console.log('='.repeat(80));
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be moved\n');
  } else {
    console.log('⚠️  LIVE MODE - Files will be moved to backup\n');
  }
  
  createBackupStructure();
  
  const allFiles = getAllFilesToRemove();
  const log = loadRemovalLog();
  const results = {
    success: [],
    failed: [],
    skipped: []
  };
  
  console.log(`📊 Total files to process: ${allFiles.length}\n`);
  
  for (const filePath of allFiles) {
    const category = Object.keys(FILES_TO_REMOVE).find(cat => 
      FILES_TO_REMOVE[cat].includes(filePath)
    ) || 'other';
    
    const fullPath = path.join(__dirname, '..', '..', filePath);
    
    if (!fs.existsSync(fullPath)) {
      results.skipped.push({ file: filePath, reason: 'File does not exist' });
      continue;
    }
    
    if (dryRun) {
      console.log(`   [DRY RUN] Would move: ${filePath}`);
      results.success.push({ file: filePath, category });
    } else {
      const result = moveToBackup(filePath, category);
      if (result.success) {
        console.log(`   ✅ Moved: ${filePath}`);
        results.success.push({ file: filePath, category, backupPath: result.backupPath });
      } else {
        console.log(`   ❌ Failed: ${filePath} - ${result.reason}`);
        results.failed.push({ file: filePath, reason: result.reason });
      }
    }
  }
  
  if (!dryRun) {
    log.removedFiles = [...(log.removedFiles || []), ...results.success];
    log.lastRemoval = new Date().toISOString();
    saveRemovalLog(log);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 Summary:');
  console.log(`   ✅ Successfully processed: ${results.success.length}`);
  console.log(`   ❌ Failed: ${results.failed.length}`);
  console.log(`   ⏭️  Skipped: ${results.skipped.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed Files:');
    results.failed.forEach(f => {
      console.log(`   - ${f.file}: ${f.reason}`);
    });
  }
  
  if (!dryRun) {
    console.log(`\n💾 Backup location: ${BACKUP_DIR}`);
    console.log(`📝 Removal log: ${REMOVAL_LOG}`);
    console.log('\n✅ Files moved to backup. You can restore them if needed.');
  }
  
  return results;
};

// Restore function
const restoreFiles = async () => {
  console.log('🔄 Restoring Files from Backup\n');
  console.log('='.repeat(80));
  
  const log = loadRemovalLog();
  
  if (!log.removedFiles || log.removedFiles.length === 0) {
    console.log('⚠️  No removal log found. Nothing to restore.');
    return;
  }
  
  console.log(`📋 Found ${log.removedFiles.length} files in removal log\n`);
  
  const results = {
    restored: [],
    failed: []
  };
  
  for (const fileInfo of log.removedFiles) {
    const result = restoreFromBackup(fileInfo.file, fileInfo.category);
    if (result.success) {
      console.log(`   ✅ Restored: ${fileInfo.file}`);
      results.restored.push(fileInfo.file);
    } else {
      console.log(`   ❌ Failed: ${fileInfo.file} - ${result.reason}`);
      results.failed.push({ file: fileInfo.file, reason: result.reason });
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 Restore Summary:');
  console.log(`   ✅ Restored: ${results.restored.length}`);
  console.log(`   ❌ Failed: ${results.failed.length}`);
  
  return results;
};

// List backed up files
const listBackedUpFiles = () => {
  console.log('📋 Backed Up Files\n');
  console.log('='.repeat(80));
  
  const log = loadRemovalLog();
  
  if (!log.removedFiles || log.removedFiles.length === 0) {
    console.log('⚠️  No files have been backed up yet.');
    return;
  }
  
  console.log(`Last removal: ${log.lastRemoval || 'N/A'}\n`);
  
  const byCategory = {};
  log.removedFiles.forEach(fileInfo => {
    const category = fileInfo.category || 'other';
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(fileInfo.file);
  });
  
  Object.keys(byCategory).forEach(category => {
    console.log(`\n📁 ${category.toUpperCase()} (${byCategory[category].length} files):`);
    byCategory[category].forEach(file => {
      console.log(`   - ${file}`);
    });
  });
};

// CLI interface
const command = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (require.main === module) {
  if (command === 'remove' || command === 'rm') {
    safeRemoveFiles(dryRun)
      .then(() => {
        console.log('\n✅ Process completed!');
        if (!dryRun) {
          console.log('\n⚠️  IMPORTANT: Test your application now to ensure everything works.');
          console.log('   If anything breaks, run: node safe-remove-files.js restore');
        }
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
      });
  } else if (command === 'restore' || command === 'rs') {
    restoreFiles()
      .then(() => {
        console.log('\n✅ Restore completed!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
      });
  } else if (command === 'list' || command === 'ls') {
    listBackedUpFiles();
    process.exit(0);
  } else {
    console.log('🔍 Safe File Removal Script\n');
    console.log('Usage:');
    console.log('  node safe-remove-files.js remove [--dry-run]  - Move files to backup');
    console.log('  node safe-remove-files.js restore            - Restore files from backup');
    console.log('  node safe-remove-files.js list               - List backed up files\n');
    console.log('Examples:');
    console.log('  node safe-remove-files.js remove --dry-run   - See what would be removed');
    console.log('  node safe-remove-files.js remove             - Actually remove files');
    console.log('  node safe-remove-files.js restore            - Restore if something breaks\n');
    process.exit(0);
  }
}

module.exports = { safeRemoveFiles, restoreFiles, listBackedUpFiles };

