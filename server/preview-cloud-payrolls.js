const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');
require('dotenv').config();

// Import the models
const Payroll = require('./models/hr/Payroll');
const Payslip = require('./models/hr/Payslip');
const Employee = require('./models/hr/Employee');

const previewCloudPayrolls = async () => {
  try {
    console.log('🔌 Connecting to cloud database...');
    await connectDB();
    
    // Get total count of records
    const totalPayrolls = await Payroll.countDocuments();
    const totalPayslips = await Payslip.countDocuments();
    
    console.log(`\n📊 DATABASE OVERVIEW:`);
    console.log(`   - Payroll records: ${totalPayrolls}`);
    console.log(`   - Payslip records: ${totalPayslips}`);
    console.log(`   - Total records: ${totalPayrolls + totalPayslips}`);
    
    if (totalPayrolls === 0 && totalPayslips === 0) {
      console.log('\n✅ No payroll or payslip records found in the database.');
      await disconnectDB();
      return;
    }
    
    // Show payroll records by year/month
    if (totalPayrolls > 0) {
      console.log('\n📋 PAYROLL RECORDS BY PERIOD:');
      const payrollPeriods = await Payroll.aggregate([
        {
          $group: {
            _id: { year: '$year', month: '$month' },
            count: { $sum: 1 },
            totalBasicSalary: { $sum: '$basicSalary' }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } }
      ]);
      
      payrollPeriods.forEach(period => {
        console.log(`   - ${period._id.month}/${period._id.year}: ${period.count} records (Total Basic: ${period.totalBasicSalary.toLocaleString()})`);
      });
      
      // Show sample payroll records
      const samplePayrolls = await Payroll.find({})
        .populate('employee', 'employeeId firstName lastName')
        .sort({ year: -1, month: -1 })
        .limit(10);
      
      console.log('\n📋 SAMPLE PAYROLL RECORDS:');
      samplePayrolls.forEach(payroll => {
        const employeeName = payroll.employee ? 
          `${payroll.employee.firstName} ${payroll.employee.lastName} (${payroll.employee.employeeId})` : 
          'Unknown Employee';
        console.log(`   - ${employeeName}: ${payroll.month}/${payroll.year} - Basic: ${payroll.basicSalary.toLocaleString()}`);
      });
      
      if (totalPayrolls > 10) {
        console.log(`   ... and ${totalPayrolls - 10} more payroll records`);
      }
    }
    
    // Show payslip records by year/month
    if (totalPayslips > 0) {
      console.log('\n📋 PAYSLIP RECORDS BY PERIOD:');
      const payslipPeriods = await Payslip.aggregate([
        {
          $group: {
            _id: { year: '$year', month: '$month' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } }
      ]);
      
      payslipPeriods.forEach(period => {
        console.log(`   - ${period._id.month}/${period._id.year}: ${period.count} payslips`);
      });
      
      // Show sample payslip records
      const samplePayslips = await Payslip.find({})
        .sort({ year: -1, month: -1 })
        .limit(10);
      
      console.log('\n📋 SAMPLE PAYSLIP RECORDS:');
      samplePayslips.forEach(payslip => {
        console.log(`   - ${payslip.employeeName} (${payslip.employeeId}): ${payslip.month}/${payslip.year} - Payslip: ${payslip.payslipNumber}`);
      });
      
      if (totalPayslips > 10) {
        console.log(`   ... and ${totalPayslips - 10} more payslip records`);
      }
    }
    
    // Show total financial impact
    if (totalPayrolls > 0) {
      const totalFinancials = await Payroll.aggregate([
        {
          $group: {
            _id: null,
            totalBasicSalary: { $sum: '$basicSalary' },
            totalAllowances: { $sum: { $add: ['$allowances.conveyance.amount', '$allowances.food.amount', '$allowances.vehicleFuel.amount', '$allowances.medical.amount', '$allowances.special.amount', '$allowances.other.amount'] } },
            totalHouseRent: { $sum: '$houseRentAllowance' }
          }
        }
      ]);
      
      if (totalFinancials.length > 0) {
        const financials = totalFinancials[0];
        console.log('\n💰 FINANCIAL SUMMARY:');
        console.log(`   - Total Basic Salary: ${financials.totalBasicSalary.toLocaleString()}`);
        console.log(`   - Total Allowances: ${financials.totalAllowances.toLocaleString()}`);
        console.log(`   - Total House Rent: ${financials.totalHouseRent.toLocaleString()}`);
        console.log(`   - Total Payroll Value: ${(financials.totalBasicSalary + financials.totalAllowances + financials.totalHouseRent).toLocaleString()}`);
      }
    }
    
    console.log('\n⚠️  WARNING: If you proceed with deletion, ALL of these records will be permanently removed!');
    console.log('⚠️  This operation cannot be undone!');
    console.log('⚠️  Make sure you have backups if needed!');
    
  } catch (error) {
    console.error('❌ Error during preview:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n🔌 Disconnecting from database...');
    await disconnectDB();
    console.log('✅ Preview completed.');
  }
};

// Run the script
if (require.main === module) {
  previewCloudPayrolls()
    .then(() => {
      console.log('🎯 Preview completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Preview failed:', error);
      process.exit(1);
    });
}

module.exports = { previewCloudPayrolls };
