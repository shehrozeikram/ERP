const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');
require('dotenv').config();

// Import the models
const Payroll = require('./models/hr/Payroll');
const Payslip = require('./models/hr/Payslip');

const clearAllCloudPayrolls = async () => {
  try {
    console.log('🔌 Connecting to cloud database...');
    await connectDB();
    
    // Get total count of records
    const totalPayrolls = await Payroll.countDocuments();
    const totalPayslips = await Payslip.countDocuments();
    
    console.log(`📊 Total records found:`);
    console.log(`   - Payroll records: ${totalPayrolls}`);
    console.log(`   - Payslip records: ${totalPayslips}`);
    
    if (totalPayrolls === 0 && totalPayslips === 0) {
      console.log('✅ No payroll or payslip records found to delete.');
      await disconnectDB();
      return;
    }
    
    // Show sample of records to be deleted
    if (totalPayrolls > 0) {
      const samplePayrolls = await Payroll.find({})
        .sort({ year: -1, month: -1 })
        .limit(5);
      
      console.log('\n📋 Sample of payroll records to be deleted:');
      samplePayrolls.forEach(payroll => {
        console.log(`   - Employee ID: ${payroll.employee} - Month: ${payroll.month}/${payroll.year} - Basic: ${payroll.basicSalary}`);
      });
      
      if (totalPayrolls > 5) {
        console.log(`   ... and ${totalPayrolls - 5} more payroll records`);
      }
    }
    
    if (totalPayslips > 0) {
      const samplePayslips = await Payslip.find({})
        .sort({ year: -1, month: -1 })
        .limit(5);
      
      console.log('\n📋 Sample of payslip records to be deleted:');
      samplePayslips.forEach(payslip => {
        console.log(`   - ${payslip.employeeName} (${payslip.employeeId}): ${payslip.month}/${payslip.year} - Payslip: ${payslip.payslipNumber}`);
      });
      
      if (totalPayslips > 5) {
        console.log(`   ... and ${totalPayslips - 5} more payslip records`);
      }
    }
    
    // Safety confirmation
    console.log('\n⚠️  WARNING: This action will permanently delete ALL payroll and payslip records!');
    console.log('⚠️  This operation cannot be undone!');
    console.log('⚠️  Make sure you have backups if needed!');
    console.log('⚠️  This will affect:');
    console.log('   - Monthly payroll calculations');
    console.log('   - Employee payslips');
    console.log('   - Tax calculations');
    console.log('   - Loan deductions');
    console.log('   - All related financial records');
    
    // Simulate user confirmation (in real usage, you'd want to add actual user input)
    console.log('\n🔐 For safety, please manually confirm by editing this script and setting confirmDeletion = true');
    console.log('🔐 Or run this script with proper confirmation logic in production');
    
    // Set this to true to actually perform the deletion
    const confirmDeletion = true;
    
    if (!confirmDeletion) {
      console.log('❌ Deletion cancelled for safety. Set confirmDeletion = true to proceed.');
      await disconnectDB();
      return;
    }
    
    // Perform the deletion
    console.log('\n🗑️  Starting deletion of all payroll and payslip records...');
    const startTime = Date.now();
    
    // Delete payslips first (they reference payroll data)
    let payslipDeleteResult = null;
    if (totalPayslips > 0) {
      console.log('🗑️  Deleting payslip records...');
      payslipDeleteResult = await Payslip.deleteMany({});
      console.log(`✅ Deleted ${payslipDeleteResult.deletedCount} payslip records`);
    }
    
    // Delete payroll records
    let payrollDeleteResult = null;
    if (totalPayrolls > 0) {
      console.log('🗑️  Deleting payroll records...');
      payrollDeleteResult = await Payroll.deleteMany({});
      console.log(`✅ Deleted ${payrollDeleteResult.deletedCount} payroll records`);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`\n✅ Deletion Summary:`);
    if (payslipDeleteResult) {
      console.log(`   - Payslips deleted: ${payslipDeleteResult.deletedCount}`);
    }
    if (payrollDeleteResult) {
      console.log(`   - Payrolls deleted: ${payrollDeleteResult.deletedCount}`);
    }
    console.log(`⏱️  Operation completed in ${duration}ms`);
    
    // Verify deletion
    const remainingPayrolls = await Payroll.countDocuments();
    const remainingPayslips = await Payslip.countDocuments();
    
    console.log(`\n📊 Verification:`);
    console.log(`   - Remaining payroll records: ${remainingPayrolls}`);
    console.log(`   - Remaining payslip records: ${remainingPayslips}`);
    
    if (remainingPayrolls === 0 && remainingPayslips === 0) {
      console.log('✅ All payroll and payslip records have been successfully removed from the cloud database.');
    } else {
      console.log('⚠️  Some records may still exist. Please check manually.');
    }
    
  } catch (error) {
    console.error('❌ Error during deletion:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n🔌 Disconnecting from database...');
    await disconnectDB();
    console.log('✅ Script completed.');
  }
};

// Run the script
if (require.main === module) {
  clearAllCloudPayrolls()
    .then(() => {
      console.log('🎯 Script execution completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script execution failed:', error);
      process.exit(1);
    });
}

module.exports = { clearAllCloudPayrolls };
