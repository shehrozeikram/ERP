const mongoose = require('mongoose');
require('./models/hr/Employee'); // Register Employee model
const Payroll = require('./models/hr/Payroll');

async function checkPayroll() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    // Find payroll for employee with employeeId 6377 in September 2025
    const payrolls = await Payroll.find({ 
      month: 9, 
      year: 2025 
    }).populate('employee', 'firstName lastName employeeId');
    
    // Find the specific payroll for employee 6377
    const targetPayroll = payrolls.find(p => p.employee && p.employee.employeeId === '6377');
    
    if (targetPayroll) {
      console.log('\n=== PAYROLL RECORD FOUND ===');
      console.log('Employee:', targetPayroll.employee?.firstName, targetPayroll.employee?.lastName, `(${targetPayroll.employee?.employeeId})`);
      console.log('Month/Year:', targetPayroll.month, '/', targetPayroll.year);
      console.log('Basic Salary:', targetPayroll.basicSalary);
      console.log('Gross Salary:', targetPayroll.grossSalary);
      console.log('Total Earnings:', targetPayroll.totalEarnings);
      
      console.log('\n=== ALLOWANCES STRUCTURE ===');
      console.log('Allowances object:', JSON.stringify(targetPayroll.allowances, null, 2));
      
      if (targetPayroll.allowances) {
        console.log('\n=== INDIVIDUAL ALLOWANCES ===');
        console.log('Conveyance:', targetPayroll.allowances.conveyance?.isActive ? targetPayroll.allowances.conveyance.amount : 'Inactive');
        console.log('Food:', targetPayroll.allowances.food?.isActive ? targetPayroll.allowances.food.amount : 'Inactive');
        console.log('Vehicle & Fuel:', targetPayroll.allowances.vehicleFuel?.isActive ? targetPayroll.allowances.vehicleFuel.amount : 'Inactive');
        console.log('Medical:', targetPayroll.allowances.medical?.isActive ? targetPayroll.allowances.medical.amount : 'Inactive');
        console.log('Special:', targetPayroll.allowances.special?.isActive ? targetPayroll.allowances.special.amount : 'Inactive');
        console.log('Other:', targetPayroll.allowances.other?.isActive ? targetPayroll.allowances.other.amount : 'Inactive');
      }
      
      console.log('\n=== LEGACY ALLOWANCE FIELDS ===');
      console.log('Conveyance Allowance:', targetPayroll.conveyanceAllowance);
      console.log('Medical Allowance:', targetPayroll.medicalAllowance);
      console.log('Special Allowance:', targetPayroll.specialAllowance);
      console.log('Other Allowance:', targetPayroll.otherAllowance);
      
    } else {
      console.log('No payroll found for employee 6377 in September 2025');
      console.log(`Found ${payrolls.length} payrolls for September 2025`);
      payrolls.forEach(p => {
        console.log(`- Employee ${p.employee?.employeeId}: ${p.employee?.firstName} ${p.employee?.lastName}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

checkPayroll();
