const mongoose = require('mongoose');
require('dotenv').config();

// Import the Payroll model
const Payroll = require('../models/hr/Payroll');

/**
 * Script to delete all payroll records except August (month = 8)
 * This script will:
 * 1. Show a preview of what will be deleted
 * 2. Ask for confirmation before proceeding
 * 3. Delete payroll records for all months except August
 * 4. Provide a summary of deleted records
 */

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
}

async function previewPayrollsToDelete() {
  console.log('\n📊 PREVIEW: Payroll records that will be deleted (excluding August):');
  console.log('=' .repeat(80));
  
  // Get all payroll records except August
  const payrollsToDelete = await Payroll.find({ month: { $ne: 8 } })
    .populate('employee', 'firstName lastName employeeId')
    .sort({ year: -1, month: -1 });
  
  if (payrollsToDelete.length === 0) {
    console.log('✅ No payroll records found to delete (all records are for August)');
    return { count: 0, records: [] };
  }
  
  // Group by month/year for better display
  const groupedRecords = {};
  payrollsToDelete.forEach(payroll => {
    const key = `${payroll.year}-${payroll.month.toString().padStart(2, '0')}`;
    if (!groupedRecords[key]) {
      groupedRecords[key] = [];
    }
    groupedRecords[key].push(payroll);
  });
  
  // Display grouped records
  Object.keys(groupedRecords).sort().reverse().forEach(key => {
    const records = groupedRecords[key];
    const [year, month] = key.split('-');
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    console.log(`\n📅 ${monthNames[parseInt(month) - 1]} ${year} (${records.length} records):`);
    records.forEach(payroll => {
      const employeeName = payroll.employee ? 
        `${payroll.employee.firstName} ${payroll.employee.lastName} (${payroll.employee.employeeId})` : 
        'Unknown Employee';
      console.log(`   • ${employeeName} - Status: ${payroll.status} - Net Salary: Rs. ${payroll.netSalary?.toFixed(2) || 0}`);
    });
  });
  
  console.log(`\n📈 SUMMARY:`);
  console.log(`   Total records to delete: ${payrollsToDelete.length}`);
  console.log(`   Total months affected: ${Object.keys(groupedRecords).length}`);
  
  return { count: payrollsToDelete.length, records: payrollsToDelete };
}

async function previewAugustRecords() {
  console.log('\n📊 PREVIEW: August payroll records that will be preserved:');
  console.log('=' .repeat(80));
  
  const augustPayrolls = await Payroll.find({ month: 8 })
    .populate('employee', 'firstName lastName employeeId')
    .sort({ year: -1 });
  
  if (augustPayrolls.length === 0) {
    console.log('ℹ️  No August payroll records found');
    return 0;
  }
  
  // Group by year
  const groupedRecords = {};
  augustPayrolls.forEach(payroll => {
    if (!groupedRecords[payroll.year]) {
      groupedRecords[payroll.year] = [];
    }
    groupedRecords[payroll.year].push(payroll);
  });
  
  // Display grouped records
  Object.keys(groupedRecords).sort().reverse().forEach(year => {
    const records = groupedRecords[year];
    console.log(`\n📅 August ${year} (${records.length} records):`);
    records.forEach(payroll => {
      const employeeName = payroll.employee ? 
        `${payroll.employee.firstName} ${payroll.employee.lastName} (${payroll.employee.employeeId})` : 
        'Unknown Employee';
      console.log(`   • ${employeeName} - Status: ${payroll.status} - Net Salary: Rs. ${payroll.netSalary?.toFixed(2) || 0}`);
    });
  });
  
  console.log(`\n📈 SUMMARY:`);
  console.log(`   Total August records preserved: ${augustPayrolls.length}`);
  console.log(`   Total August years: ${Object.keys(groupedRecords).length}`);
  
  return augustPayrolls.length;
}

async function deletePayrollsExceptAugust() {
  console.log('\n🗑️  DELETING payroll records (excluding August)...');
  console.log('=' .repeat(80));
  
  // Delete all payroll records except August (month = 8)
  const deleteResult = await Payroll.deleteMany({ month: { $ne: 8 } });
  
  console.log(`✅ Deletion completed:`);
  console.log(`   Records deleted: ${deleteResult.deletedCount}`);
  
  return deleteResult.deletedCount;
}

async function verifyDeletion() {
  console.log('\n🔍 VERIFICATION: Checking remaining payroll records...');
  console.log('=' .repeat(80));
  
  // Check remaining records
  const remainingRecords = await Payroll.find({})
    .populate('employee', 'firstName lastName employeeId')
    .sort({ year: -1, month: -1 });
  
  if (remainingRecords.length === 0) {
    console.log('ℹ️  No payroll records remaining');
    return;
  }
  
  // Group by month/year
  const groupedRecords = {};
  remainingRecords.forEach(payroll => {
    const key = `${payroll.year}-${payroll.month.toString().padStart(2, '0')}`;
    if (!groupedRecords[key]) {
      groupedRecords[key] = [];
    }
    groupedRecords[key].push(payroll);
  });
  
  console.log(`\n📅 Remaining payroll records (${remainingRecords.length} total):`);
  Object.keys(groupedRecords).sort().reverse().forEach(key => {
    const records = groupedRecords[key];
    const [year, month] = key.split('-');
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    console.log(`   ${monthNames[parseInt(month) - 1]} ${year}: ${records.length} records`);
  });
  
  // Verify only August records remain
  const nonAugustRecords = remainingRecords.filter(p => p.month !== 8);
  if (nonAugustRecords.length > 0) {
    console.log(`\n⚠️  WARNING: ${nonAugustRecords.length} non-August records still exist!`);
    nonAugustRecords.forEach(payroll => {
      const employeeName = payroll.employee ? 
        `${payroll.employee.firstName} ${payroll.employee.lastName}` : 
        'Unknown Employee';
      console.log(`   • ${employeeName} - ${payroll.month}/${payroll.year}`);
    });
  } else {
    console.log(`\n✅ SUCCESS: Only August records remain (${remainingRecords.length} records)`);
  }
}

async function main() {
  try {
    console.log('🚀 Starting payroll cleanup script...');
    console.log('📋 This script will delete ALL payroll records EXCEPT August (month = 8)');
    console.log('⚠️  This action is IRREVERSIBLE!');
    
    await connectToDatabase();
    
    // Step 1: Preview records to be deleted
    const { count: recordsToDelete } = await previewPayrollsToDelete();
    
    // Step 2: Preview August records that will be preserved
    const augustCount = await previewAugustRecords();
    
    if (recordsToDelete === 0) {
      console.log('\n✅ No action needed - all payroll records are already for August only');
      process.exit(0);
    }
    
    // Step 3: Confirmation prompt
    console.log('\n' + '=' .repeat(80));
    console.log('⚠️  CONFIRMATION REQUIRED');
    console.log('=' .repeat(80));
    console.log(`📊 Records to DELETE: ${recordsToDelete}`);
    console.log(`📊 August records to PRESERVE: ${augustCount}`);
    console.log('\n⚠️  This action cannot be undone!');
    console.log('\nTo proceed, run this script with --confirm flag:');
    console.log('node delete-payrolls-except-august.js --confirm');
    
    // Check for confirmation flag
    const args = process.argv.slice(2);
    if (!args.includes('--confirm')) {
      console.log('\n❌ Operation cancelled - confirmation required');
      process.exit(0);
    }
    
    console.log('\n✅ Confirmation received - proceeding with deletion...');
    
    // Step 4: Perform deletion
    const deletedCount = await deletePayrollsExceptAugust();
    
    // Step 5: Verify deletion
    await verifyDeletion();
    
    console.log('\n🎉 Payroll cleanup completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   • Records deleted: ${deletedCount}`);
    console.log(`   • August records preserved: ${augustCount}`);
    
  } catch (error) {
    console.error('❌ Error during payroll cleanup:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from database');
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  previewPayrollsToDelete,
  previewAugustRecords,
  deletePayrollsExceptAugust,
  verifyDeletion
};
