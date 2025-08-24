const mongoose = require('mongoose');
require('./models/hr/Employee'); // Register Employee model
const Payroll = require('./models/hr/Payroll');

async function checkSpecificPayroll() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    // Check the specific payroll record by MongoDB ObjectId
    const payrollId = '68a44a11e924fbed3f169699';
    
    console.log(`\n=== CHECKING PAYROLL ID: ${payrollId} ===`);
    
    const payroll = await Payroll.findById(payrollId).populate('employee', 'firstName lastName employeeId');
    
    if (payroll) {
      console.log('✅ PAYROLL FOUND!');
      console.log('Employee:', payroll.employee?.firstName, payroll.employee?.lastName, `(ID: ${payroll.employee?.employeeId})`);
      console.log('Month/Year:', payroll.month, '/', payroll.year);
      console.log('Basic Salary:', payroll.basicSalary);
      console.log('Gross Salary:', payroll.grossSalary);
      console.log('Total Earnings:', payroll.totalEarnings);
      console.log('Created At:', payroll.createdAt);
      
      console.log('\n=== ALLOWANCES STRUCTURE (JSON) ===');
      console.log(JSON.stringify(payroll.allowances, null, 2));
      
      if (payroll.allowances) {
        console.log('\n=== INDIVIDUAL ALLOWANCES ===');
        console.log('Conveyance:', payroll.allowances.conveyance?.isActive ? payroll.allowances.conveyance.amount : 'Inactive');
        console.log('Food:', payroll.allowances.food?.isActive ? payroll.allowances.food.amount : 'Inactive');
        console.log('Vehicle & Fuel:', payroll.allowances.vehicleFuel?.isActive ? payroll.allowances.vehicleFuel.amount : 'Inactive');
        console.log('Medical:', payroll.allowances.medical?.isActive ? payroll.allowances.medical.amount : 'Inactive');
        console.log('Special:', payroll.allowances.special?.isActive ? payroll.allowances.special.amount : 'Inactive');
        console.log('Other:', payroll.allowances.other?.isActive ? payroll.allowances.other.amount : 'Inactive');
      } else {
        console.log('\n❌ NO ALLOWANCES STRUCTURE FOUND');
      }
      
      console.log('\n=== LEGACY ALLOWANCE FIELDS ===');
      console.log('Conveyance Allowance:', payroll.conveyanceAllowance || 0);
      console.log('Medical Allowance:', payroll.medicalAllowance || 0);
      console.log('Special Allowance:', payroll.specialAllowance || 0);
      console.log('Other Allowance:', payroll.otherAllowance || 0);
      
      console.log('\n=== EMPLOYEE ALLOWANCES (From Employee Record) ===');
      if (payroll.employee) {
        const Employee = mongoose.model('Employee');
        const fullEmployee = await Employee.findById(payroll.employee._id).select('allowances');
        
        if (fullEmployee && fullEmployee.allowances) {
          console.log('Employee allowances structure:');
          console.log(JSON.stringify(fullEmployee.allowances, null, 2));
          
          console.log('\nEmployee Vehicle & Fuel:', fullEmployee.allowances.vehicleFuel?.isActive ? fullEmployee.allowances.vehicleFuel.amount : 'Inactive');
        } else {
          console.log('No allowances found in employee record');
        }
      }
      
    } else {
      console.log('❌ PAYROLL NOT FOUND');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

checkSpecificPayroll();
