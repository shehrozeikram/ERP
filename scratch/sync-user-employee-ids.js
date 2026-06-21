/**
 * Script to synchronize User.employeeId to match Employee.employeeId for linked records.
 *
 * Local Dev Usage:
 *   node scratch/sync-user-employee-ids.js --dry-run
 *   node scratch/sync-user-employee-ids.js --apply
 *
 * Production Server:
 *   NODE_ENV=production node scratch/sync-user-employee-ids.js --dry-run
 *   NODE_ENV=production node scratch/sync-user-employee-ids.js --apply
 */
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '..');
const envPath = path.join(repoRoot, '.env');
const localPath = path.join(repoRoot, '.env.local');

if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
const prodLike = process.env.NODE_ENV === 'production';
if (!prodLike && fs.existsSync(localPath)) {
  require('dotenv').config({ path: localPath, override: true });
}

const Employee = require('../server/models/hr/Employee');
const User = require('../server/models/User');

const dryRun = !process.argv.includes('--apply');

async function syncEmployeeIds() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local';
  console.log(`🔌 Connecting to database: ${uri.replace(/:([^:@]+)@/, ':****@')}`); // Hide passwords if any in logs
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes will be made)' : 'APPLY (changes will be saved)'}\n`);

  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    // 1. Process users with linkedEmployee
    const users = await User.find({}).lean();
    console.log(`🔍 Scanning ${users.length} user accounts...`);

    let mismatchCount = 0;
    let updateCount = 0;

    for (const user of users) {
      let linkedEmp = null;
      let matchedVia = '';

      if (user.linkedEmployee) {
        linkedEmp = await Employee.findOne({ _id: user.linkedEmployee, isDeleted: { $ne: true } }).lean();
        matchedVia = 'explicit linkedEmployee';
      }

      // If no explicit link, try matching by email or user ID back-link on employee
      if (!linkedEmp) {
        linkedEmp = await Employee.findOne({ user: user._id, isDeleted: { $ne: true } }).lean();
        if (linkedEmp) matchedVia = 'employee.user back-link';
      }

      if (!linkedEmp && user.email) {
        linkedEmp = await Employee.findOne({ email: user.email.toLowerCase(), isDeleted: { $ne: true } }).lean();
        if (linkedEmp) matchedVia = 'matching email';
      }

      if (linkedEmp) {
        const userEmpId = String(user.employeeId || '').trim();
        const correctEmpId = String(linkedEmp.employeeId || '').trim();

        if (userEmpId !== correctEmpId) {
          mismatchCount++;
          console.log(`⚠️  Mismatch found for user "${user.firstName} ${user.lastName || ''}" (${user.email}):`);
          console.log(`   - User employeeId: "${userEmpId}"`);
          console.log(`   - Master Employee employeeId: "${correctEmpId}" (matched via ${matchedVia})`);

          if (!dryRun) {
            // Update User collection
            await User.updateOne({ _id: user._id }, { $set: { employeeId: correctEmpId } });
            // Also ensure link is cached
            await User.updateOne({ _id: user._id }, { $set: { linkedEmployee: linkedEmp._id } });
            // And ensure back-link on Employee is set
            await Employee.updateOne({ _id: linkedEmp._id }, { $set: { user: user._id } });
            updateCount++;
            console.log(`   ✅ Synced successfully!`);
          } else {
            console.log(`   🔍 [Dry Run] Would sync User.employeeId to "${correctEmpId}" and link records.`);
          }
        }
      }
    }

    console.log('\n─────────────────────────────────────────');
    console.log(`  Total user accounts scanned : ${users.length}`);
    console.log(`  Mismatched accounts found   : ${mismatchCount}`);
    console.log(`  Total accounts updated      : ${updateCount}`);
    console.log('─────────────────────────────────────────\n');

  } catch (error) {
    console.error('❌ Error during synchronization:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

syncEmployeeIds();
