const mongoose = require('mongoose');
require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/database');
const Employee = require('../models/hr/Employee');
const Payroll = require('../models/hr/Payroll');

/**
 * Script to remove all arrears records from the cloud Atlas database
 * This script will:
 * 1. Reset all arrears fields in Employee records to default values
 * 2. Set all arrears amounts to 0 in Payroll records
 * 3. Regenerate current month payrolls to reflect cleared arrears
 */

const removeAllArrears = async () => {
  try {
    console.log('🚀 Starting arrears removal process...');
    
    // Connect to database
    await connectDB();
    
    // Step 1: Reset arrears in Employee records
    console.log('\n📋 Step 1: Resetting arrears in Employee records...');
    
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const defaultArrearsStructure = {
      salaryAdjustment: { isActive: false, amount: 0, month: currentMonth, year: currentYear, description: '', status: 'Pending', createdDate: new Date() },
      bonusPayment: { isActive: false, amount: 0, month: currentMonth, year: currentYear, description: '', status: 'Pending', createdDate: new Date() },
      overtimePayment: { isActive: false, amount: 0, month: currentMonth, year: currentYear, description: '', status: 'Pending', createdDate: new Date() },
      allowanceAdjustment: { isActive: false, amount: 0, month: currentMonth, year: currentYear, description: '', status: 'Pending', createdDate: new Date() },
      deductionReversal: { isActive: false, amount: 0, month: currentMonth, year: currentYear, description: '', status: 'Pending', createdDate: new Date() },
      other: { isActive: false, amount: 0, month: currentMonth, year: currentYear, description: '', status: 'Pending', createdDate: new Date() }
    };
    
    // Update all employees to reset their arrears structure
    const employeeUpdateResult = await Employee.updateMany(
      {},
      { $set: { arrears: defaultArrearsStructure } }
    );
    
    console.log(`✅ Updated ${employeeUpdateResult.modifiedCount} employee records`);
    
    // Step 2: Reset arrears amounts in Payroll records
    console.log('\n💰 Step 2: Resetting arrears amounts in Payroll records...');
    
    const payrollUpdateResult = await Payroll.updateMany(
      { arrears: { $gt: 0 } }, // Only update payrolls that have arrears > 0
      { $set: { arrears: 0 } }
    );
    
    console.log(`✅ Updated ${payrollUpdateResult.modifiedCount} payroll records`);
    
    // Step 3: Regenerate current month payrolls to reflect cleared arrears
    console.log('\n🔄 Step 3: Regenerating current month payrolls...');
    
    console.log(`📅 Regenerating payrolls for ${currentMonth}/${currentYear}...`);
    
    // Find all payrolls for current month
    const currentMonthPayrolls = await Payroll.find({
      month: currentMonth,
      year: currentYear
    });
    
    console.log(`📋 Found ${currentMonthPayrolls.length} payrolls for current month`);
    
    // Regenerate each payroll to reflect cleared arrears
    let regeneratedCount = 0;
    for (const payroll of currentMonthPayrolls) {
      try {
        // Get the employee to recalculate arrears (which should now be 0)
        const employee = await Employee.findById(payroll.employee);
        if (!employee) {
          console.log(`⚠️  Employee not found for payroll ${payroll._id}`);
          continue;
        }
        
        // Recalculate arrears (should be 0 now)
        let employeeArrears = 0;
        if (employee.arrears) {
          const arrearsTypes = ['salaryAdjustment', 'bonusPayment', 'overtimePayment', 'allowanceAdjustment', 'deductionReversal', 'other'];
          
          for (const arrearsType of arrearsTypes) {
            const arrearsData = employee.arrears[arrearsType];
            if (arrearsData && arrearsData.isActive && 
                arrearsData.month === currentMonth && 
                arrearsData.year === currentYear && 
                arrearsData.status !== 'Paid' && 
                arrearsData.status !== 'Cancelled') {
              employeeArrears += arrearsData.amount || 0;
            }
          }
        }
        
        // Update payroll with new arrears amount and recalculate totals
        const oldArrears = payroll.arrears;
        const arrearsDifference = employeeArrears - oldArrears;
        
        // Update payroll fields
        payroll.arrears = employeeArrears;
        payroll.totalEarnings = payroll.totalEarnings - arrearsDifference;
        payroll.netSalary = payroll.netSalary - arrearsDifference;
        
        await payroll.save();
        regeneratedCount++;
        
        if (arrearsDifference !== 0) {
          console.log(`✅ Updated payroll for ${employee.firstName} ${employee.lastName}: Arrears ${oldArrears} → ${employeeArrears}`);
        }
        
      } catch (error) {
        console.error(`❌ Error updating payroll ${payroll._id}:`, error.message);
      }
    }
    
    console.log(`✅ Regenerated ${regeneratedCount} payrolls for current month`);
    
    // Step 4: Verification
    console.log('\n🔍 Step 4: Verification...');
    
    // Count employees with active arrears
    const employeesWithActiveArrears = await Employee.countDocuments({
      $or: [
        { 'arrears.salaryAdjustment.isActive': true },
        { 'arrears.bonusPayment.isActive': true },
        { 'arrears.overtimePayment.isActive': true },
        { 'arrears.allowanceAdjustment.isActive': true },
        { 'arrears.deductionReversal.isActive': true },
        { 'arrears.other.isActive': true }
      ]
    });
    
    // Count payrolls with arrears > 0
    const payrollsWithArrears = await Payroll.countDocuments({
      arrears: { $gt: 0 }
    });
    
    // Count current month payrolls with arrears > 0
    const currentMonthPayrollsWithArrears = await Payroll.countDocuments({
      month: currentMonth,
      year: currentYear,
      arrears: { $gt: 0 }
    });
    
    console.log(`📊 Verification Results:`);
    console.log(`   - Employees with active arrears: ${employeesWithActiveArrears}`);
    console.log(`   - All payrolls with arrears > 0: ${payrollsWithArrears}`);
    console.log(`   - Current month payrolls with arrears > 0: ${currentMonthPayrollsWithArrears}`);
    
    if (employeesWithActiveArrears === 0 && currentMonthPayrollsWithArrears === 0) {
      console.log('\n🎉 SUCCESS: All arrears records have been successfully removed and payrolls updated!');
    } else {
      console.log('\n⚠️  WARNING: Some arrears records may still exist. Please check manually.');
    }
    
  } catch (error) {
    console.error('❌ Error removing arrears:', error);
    throw error;
  } finally {
    // Disconnect from database
    await disconnectDB();
    console.log('\n✅ Database connection closed');
  }
};

// Run the script
if (require.main === module) {
  removeAllArrears()
    .then(() => {
      console.log('\n🏁 Arrears removal process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Arrears removal process failed:', error);
      process.exit(1);
    });
}

module.exports = removeAllArrears;
