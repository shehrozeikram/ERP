# Files Safe to Remove - Analysis Report

## Summary
This document lists files that can be safely removed without affecting production functionality.

---

## ✅ SAFE TO REMOVE

### 1. BACKUP FILES (3 files)
- `server/routes/procurement.js.bak` - Backup file, original exists
- `client/src/pages/HR/EmployeeForm.js.backup` - Backup file, original exists
- `backups/sgc-erp-backup-20250829_145103.tar.gz` - Old backup (if you have newer backups)

### 2. TEST SCRIPTS (54 files) - All can be removed
These are development/test scripts, not used in production:

**Leave System Tests:**
- `server/scripts/test-employee-leave-system.js`
- `server/scripts/test-carry-forward-employee-3.js`
- `server/scripts/fix-test-employee-3.js`
- `server/scripts/detailed-carry-forward-test.js`
- `server/scripts/test-fix-carry-forward-all.js`
- `server/scripts/test-carry-forward-all-employees.js`
- `server/scripts/test-leave-types-reset.js`
- `server/scripts/test-carry-forward-40-cap.js`
- `server/scripts/test-carry-forward-employee-2120.js`
- `server/scripts/test-carry-forward-anniversary.js`
- `server/scripts/testCasualLeaveCreation.js`
- `server/scripts/testEmployee06031Leave.js`
- `server/scripts/stepByStepCarryForwardTest.js`
- `server/scripts/fixAndTestCarryForward.js`
- `server/scripts/testAutoCarryForwardUpdate.js`
- `server/scripts/comprehensiveCarryForwardTest.js`
- `server/scripts/testLeaveRequestEmployee06387.js`
- `server/scripts/testCarryForwardSimple.js`
- `server/scripts/testCarryForwardEmployee06387.js`
- `server/scripts/testEmployee6387Workflow.js` ⚠️ **USED IN ROUTES** - Check if test endpoints are needed
- `server/scripts/test-hire-date-api.js`
- `server/scripts/test-employee-6031-anniversary-readonly.js`
- `server/scripts/test-carry-forward-expiration.js`
- `server/scripts/test-employee-6031-anniversary.js`
- `server/scripts/test-anniversary-leave-system.js`
- `server/scripts/test-leave-api-endpoint.js`
- `server/scripts/test-leave-api.js`

**API/Connection Tests:**
- `server/scripts/simple-api-test.js`
- `server/scripts/test-api-endpoint.js`
- `server/scripts/test-zkbio-websocket-connection.js`
- `server/scripts/test-image-investigation.js`
- `server/scripts/test-server-status.js`
- `server/scripts/test-realtime-images.js`
- `server/scripts/test-zkbio-enhanced.js`
- `server/scripts/test-socket-connection.js`
- `server/scripts/test-simulate-attendance.js`
- `server/scripts/test-server-zkbio-connection.js`
- `server/scripts/comprehensive-zkbio-test.js`
- `server/scripts/test-zkbio-connection.js`
- `server/scripts/test-hover-tooltips.js`
- `server/scripts/test-realtime-monitoring.js`
- `server/scripts/test-websocket-image-flow.js`
- `server/scripts/test-ultra-beautiful-tooltips.js`
- `server/scripts/test-error-handling-fix.js`
- `server/scripts/test-dashboard-integration.js`

**Other Tests:**
- `server/scripts/test-loan-payroll-integration.js`
- `server/scripts/test-house-allowance-flow.js`
- `server/scripts/test-employee-id.js`
- `server/scripts/test-employee-direct.js`
- `server/scripts/test-time-formatting.js`
- `server/scripts/create-test-employee.js`
- `server/scripts/import-single-employee-test.js`

### 3. OLD/DUPLICATE IMPORT SCRIPTS (15+ files)
These are old versions or duplicates of import functionality:

**Employee Import Scripts (keep only the latest):**
- `server/scripts/import-employees-from-excel.js` - Old version
- `server/scripts/fast-import-employees.js` - Old version
- `server/scripts/improved-import-employees.js` - Old version
- `server/scripts/ultra-fast-import.js` - Old version
- `server/scripts/import-all-employees.js` - Old version
- **KEEP:** `server/scripts/import-all-employees-from-excel.js` (most recent)

**Leave Import Scripts (keep only the latest):**
- `server/scripts/import-all-leaves-from-csv.js` - Old version
- `server/scripts/import-first-employee-leaves.js` - Old version
- `server/scripts/import-first-1000-records.js` - Old version
- `server/scripts/import-final-records.js` - Old version
- `server/scripts/import-missing-records.js` - Old version
- `server/scripts/import-all-remaining-records.js` - Old version
- `server/scripts/reimport-historical-leaves.js` - Old version
- `server/scripts/clear-and-import-test-records.js` - Test script
- `server/scripts/test-import-few-records.js` - Test script
- **KEEP:** `server/scripts/import-merged-leaves.js` (most recent)

**Verification Scripts (can remove after verification):**
- `server/scripts/verify-import-complete.js`
- `server/scripts/verify-import-results.js`
- `server/scripts/verify-sample-employees.js`
- `server/scripts/verify-remove-duplicates.js`
- `server/scripts/fix-verify-all-employees-leaves.js`
- `server/scripts/fix-verify-employee-leaves.js`

### 4. OLD CARRY FORWARD SCRIPTS (10+ files)
These were used during development/fixing:

- `server/scripts/apply-carry-forward-employee-3.js`
- `server/scripts/apply-carry-forward-all-employees.js`
- `server/scripts/fix-cf-employee-3.js`
- `server/scripts/applyCarryForwardCap.js`
- `server/scripts/fixAllCarryForwardIssues.js`
- `server/scripts/verify2024CarryForward.js`
- `server/scripts/checkCurrentState.js`

### 5. SPECIFIC EMPLOYEE TEST SCRIPTS (5 files)
These were for testing specific employees:

- `server/scripts/removeEmployee06387Leaves.js`
- `server/scripts/removeEmployee6387Leaves.js`
- `server/scripts/employee6387Manager.js`
- `server/scripts/setupEmployee6387.js`

### 6. OLD REMOVE/DELETE SCRIPTS (5 files)
These were one-time cleanup scripts:

- `server/scripts/removeAllApprovedLeaves.js` - Old version
- `server/scripts/final-remove-duplicates.js` - Old version
- **KEEP:** `server/scripts/remove-duplicate-leaves.js` (current)
- **KEEP:** `server/scripts/remove-all-leaves.js` (current)

### 7. EXAMINE/DEBUG SCRIPTS (8 files)
These were for examining data structures:

- `server/scripts/examine-excel-structure.js`
- `server/scripts/examine-aug-excel.js`
- `server/scripts/examine-aug-excel-v2.js`
- `server/scripts/check-leave-balance-structure.js`
- `server/scripts/check-all-employees.js`
- `server/scripts/check-employees.js`
- `server/scripts/check-cloud-database.js`
- `server/scripts/debug-employee-leave-balance.js`

### 8. FIX SCRIPTS (one-time fixes, can remove after verification)
- `server/scripts/fix-cloud-leave-balance.js`
- `server/scripts/fix-cloud-leave-balance-v2.js`
- `server/scripts/fix-cloud-leave-balance-v3.js`
- `server/scripts/fix-leave-balance-schema.js`
- `server/scripts/fixLeaveBalanceIndexes.js`
- `server/scripts/fix-total-earnings-calculation.js`

### 9. DATA FILES (can remove after import)
- `server/scripts/2023 to 7 july 2025.xls` - Old data file
- `server/scripts/Leave_20251028152804.xlsx` - Already merged
- `server/scripts/leave-data-formatted.csv` - Already merged
- `server/scripts/leave-data-formatted.json` - JSON version of CSV
- `server/scripts/leave-month-summary.csv` - Summary file
- `server/scripts/Master_File_Aug_2025.xlsx` - If already imported
- `server/scripts/Master_File_July-2025.xlsx` - If already imported
- **KEEP:** `server/scripts/merged-leave-data.csv` (source file)
- **KEEP:** `server/scripts/merge-leave-files.js` (utility script)

### 10. ONE-TIME SETUP SCRIPTS (can remove after setup)
- `server/scripts/create-admin-direct.js`
- `server/scripts/create-ceo-user.js`
- `server/scripts/create-default-admin.js`
- `server/scripts/recreate-admin.js`
- `server/scripts/migrateExistingRoles.js`
- `server/scripts/initialize-leave-management.js`
- `server/scripts/seed-staff-types.js`
- `server/scripts/demo-staff-management.js`
- `server/scripts/populate-fbr-tax-slabs-2025.js`

### 11. PAYROLL CLEANUP SCRIPTS (one-time)
- `server/scripts/delete-payroll-records.js`
- `server/scripts/delete-payrolls-except-august.js`
- `server/scripts/quick-delete-payrolls-except-august.js`
- `server/scripts/clear-payrolls.js`
- `server/scripts/remove-all-arrears.js`
- `server/scripts/remove-all-increments.js`
- `server/scripts/remove-all-employees.js`
- `server/scripts/clearAllLeaveData.js`

### 12. OTHER ONE-TIME SCRIPTS
- `server/scripts/update-loan-deductions.js`
- `server/scripts/update-payrolls-from-excel.js`
- `server/scripts/update-employee-gross-salary.js`
- `server/scripts/recalc-tax-05898.js`
- `server/scripts/find-payroll-06382.js`
- `server/scripts/migrate-excel-allowances-to-payrolls.js`
- `server/scripts/restructure-salary-system.js`
- `server/scripts/updateLeavePolicyDefaults.js`
- `server/scripts/initialize-balances-for-work-years.js`
- `server/scripts/optimizeLeaveIndexes.js`
- `server/scripts/delete-unused-collections.js`
- `server/scripts/quick-status-check.js`
- `server/scripts/working-zkbio-connection.js`
- `server/scripts/final-dashboard-verification.js`
- `server/scripts/verify-employee.js`
- `server/scripts/annualLeaveDemo.js`

---

## ⚠️ CHECK BEFORE REMOVING

### Scripts Used in Routes:
- `server/scripts/testEmployee6387Workflow.js` - Used in `server/routes/annualLeave.js` (lines 5, 231, 252)
  - **Action:** Check if test endpoints are still needed. If not, remove both script and route references.

---

## ✅ KEEP (Essential Scripts)

### Current/Active Scripts:
- `server/scripts/import-merged-leaves.js` - Current leave import script
- `server/scripts/remove-duplicate-leaves.js` - Current duplicate removal
- `server/scripts/remove-all-leaves.js` - Current cleanup script
- `server/scripts/merge-leave-files.js` - Utility for merging files
- `server/scripts/import-all-employees-from-excel.js` - Current employee import
- `server/scripts/merged-leave-data.csv` - Source data file

### Utility Scripts:
- `server/scripts/generateSampleFinanceData.js` - May be useful
- `server/scripts/generateChartOfAccounts.js` - May be useful
- `server/scripts/generateRealisticAuditData.js` - May be useful

---

## 📊 STATISTICS

- **Total files analyzed:** ~145+ files
- **Safe to remove:** ~130+ files
- **Check before removing:** 1 file
- **Keep:** ~14 files

---

## 🗑️ RECOMMENDED DELETION ORDER

1. **First:** Backup files (.bak, .backup)
2. **Second:** Test scripts (all test-*.js files)
3. **Third:** Old data files (after verifying import)
4. **Fourth:** Old import scripts (keep only latest)
5. **Fifth:** One-time fix/setup scripts (after verification)
6. **Last:** Check and remove testEmployee6387Workflow if test endpoints not needed

---

## ⚠️ IMPORTANT NOTES

1. **Backup first:** Create a backup before deleting files
2. **Verify imports:** Ensure all data has been imported before removing data files
3. **Test endpoints:** Check if test endpoints in annualLeave.js are still needed
4. **Git history:** Files are still in git history, so can be recovered if needed

