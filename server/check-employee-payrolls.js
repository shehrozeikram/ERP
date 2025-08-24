const mongoose = require('mongoose');
require('./models/hr/Employee'); // Register Employee model
const Payroll = require('./models/hr/Payroll');

async function checkEmployeePayrolls() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    // Find all payrolls for employee 6377
    const payrolls = await Payroll.find({}).populate('employee', 'firstName lastName employeeId');
    
    // Filter for employee 6377
    const employee6377Payrolls = payrolls.filter(p => p.employee && p.employee.employeeId === '6377');
    
    if (employee6377Payrolls.length > 0) {
      console.log(`\n=== FOUND ${employee6377Payrolls.length} PAYROLLS FOR EMPLOYEE 6377 ===`);
      
      employee6377Payrolls.forEach(p => {
        console.log(`\n--- Month: ${p.month}, Year: ${p.year} ---`);
        console.log('Employee:', p.employee?.firstName, p.employee?.lastName, `(${p.employee?.employeeId})`);
        console.log('Basic Salary:', p.basicSalary);
        console.log('Gross Salary:', p.grossSalary);
        console.log('Total Earnings:', p.totalEarnings);
        
        if (p.allowances) {
          console.log('\n=== ALLOWANCES ===');
          console.log('Conveyance:', p.allowances.conveyance?.isActive ? p.allowances.conveyance.amount : 'Inactive');
          console.log('Food:', p.allowances.food?.isActive ? p.allowances.food.amount : 'Inactive');
          console.log('Vehicle & Fuel:', p.allowances.vehicleFuel?.isActive ? p.allowances.vehicleFuel.amount : 'Inactive');
          console.log('Medical:', p.allowances.medical?.isActive ? p.allowances.medical.amount : 'Inactive');
          console.log('Special:', p.allowances.special?.isActive ? p.allowances.special.amount : 'Inactive');
          console.log('Other:', p.allowances.other?.isActive ? p.allowances.other.amount : 'Inactive');
        }
        
        console.log('\n=== LEGACY ALLOWANCE FIELDS ===');
        console.log('Conveyance Allowance:', p.conveyanceAllowance);
        console.log('Medical Allowance:', p.medicalAllowance);
        console.log('Special Allowance:', p.specialAllowance);
        console.log('Other Allowance:', p.otherAllowance);
      });
      
    } else {
      console.log('\nNo payrolls found for employee 6377');
      
      // Check if employee 6377 exists
      const Employee = mongoose.model('Employee');
      const employee = await Employee.findOne({ employeeId: '6377' }).select('firstName lastName employeeId');
      
      if (employee) {
        console.log(`\nEmployee 6377 exists: ${employee.firstName} ${employee.lastName}`);
        console.log('But no payrolls have been created for this employee yet.');
      } else {
        console.log('\nEmployee 6377 does not exist in the system.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

checkEmployeePayrolls();
