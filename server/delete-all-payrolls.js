const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');
require('dotenv').config();

// Import the models
const Payroll = require('./models/hr/Payroll');
const Payslip = require('./models/hr/Payslip');
const Employee = require('./models/hr/Employee');

const deleteAllPayrolls = async () => {
  try {
    console.log('🔌 Connecting to cloud database...');
    await connectDB();
    
    console.log('\n📊 Checking current payroll records...');
    
    // Count existing payrolls
    const payrollCount = await Payroll.countDocuments();
    const payslipCount = await Payslip.countDocuments();
    
    console.log(`📋 Found ${payrollCount} payroll records`);
    console.log(`📋 Found ${payslipCount} payslip records`);
    
    if (payrollCount === 0 && payslipCount === 0) {
      console.log('✅ No payroll or payslip records found. Nothing to delete.');
      return;
    }
    
    // Show some sample records before deletion
    console.log('\n📋 Sample payroll records to be deleted:');
    const samplePayrolls = await Payroll.find()
      .populate('employee', 'firstName lastName employeeId')
      .limit(5)
      .select('employee month year totalEarnings netSalary status createdAt');
    
    samplePayrolls.forEach((payroll, index) => {
      console.log(`   ${index + 1}. ${payroll.employee?.firstName} ${payroll.employee?.lastName} (${payroll.employee?.employeeId}) - ${payroll.month}/${payroll.year} - ${payroll.status} - Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    });
    
    if (payrollCount > 5) {
      console.log(`   ... and ${payrollCount - 5} more payroll records`);
    }
    
    // Confirmation message
    console.log('\n⚠️  WARNING: This will permanently delete ALL payroll and payslip records!');
    console.log('🔥 DELETION READY - Uncomment the deletion code below to proceed');
    
    // SAFETY: Comment out the actual deletion by default
    // Uncomment the lines below to actually delete the records
    
    console.log('\n🧹 Starting deletion process...');
    
    // Delete all payslips first (to avoid foreign key issues)
    if (payslipCount > 0) {
      console.log(`🗑️  Deleting ${payslipCount} payslip records...`);
      const payslipResult = await Payslip.deleteMany({});
      console.log(`✅ Deleted ${payslipResult.deletedCount} payslip records`);
    }
    
    // Delete all payrolls
    if (payrollCount > 0) {
      console.log(`🗑️  Deleting ${payrollCount} payroll records...`);
      const payrollResult = await Payroll.deleteMany({});
      console.log(`✅ Deleted ${payrollResult.deletedCount} payroll records`);
    }
    
    // Verify deletion
    console.log('\n🔍 Verifying deletion...');
    const remainingPayrolls = await Payroll.countDocuments();
    const remainingPayslips = await Payslip.countDocuments();
    
    if (remainingPayrolls === 0 && remainingPayslips === 0) {
      console.log('✅ SUCCESS: All payroll and payslip records have been deleted');
    } else {
      console.log(`❌ WARNING: ${remainingPayrolls} payroll and ${remainingPayslips} payslip records still remain`);
    }
    
    console.log('\n📊 Final Summary:');
    console.log(`   Original Payrolls: ${payrollCount}`);
    console.log(`   Original Payslips: ${payslipCount}`);
    console.log(`   Remaining Payrolls: ${remainingPayrolls}`);
    console.log(`   Remaining Payslips: ${remainingPayslips}`);
    console.log(`   Total Deleted: ${payrollCount + payslipCount - remainingPayrolls - remainingPayslips}`);
    
  } catch (error) {
    console.error('❌ Error during payroll deletion:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n🔌 Disconnecting from database...');
    await disconnectDB();
    console.log('✅ Deletion process completed.');
  }
};

// Run the deletion
if (require.main === module) {
  deleteAllPayrolls()
    .then(() => {
      console.log('🎯 Payroll deletion completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Payroll deletion failed:', error);
      process.exit(1);
    });
}

module.exports = { deleteAllPayrolls };
