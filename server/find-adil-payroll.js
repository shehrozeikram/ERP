const mongoose = require('mongoose');
require('./models/hr/Employee'); // Register Employee model
const Payroll = require('./models/hr/Payroll');

async function findAdilPayroll() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    // Find all Adil Aamir employees first
    const Employee = mongoose.model('Employee');
    const adilEmployees = await Employee.find({
      firstName: { $regex: 'Adil', $options: 'i' },
      lastName: { $regex: 'Aamir', $options: 'i' }
    }).select('firstName lastName employeeId _id allowances');
    
    console.log('\n=== ADIL AAMIR EMPLOYEES ===');
    adilEmployees.forEach(emp => {
      console.log(`- ${emp.firstName} ${emp.lastName} (ID: ${emp.employeeId}, MongoDB ID: ${emp._id})`);
    });
    
    // Check payrolls for September 2025
    console.log('\n=== PAYROLLS FOR SEPTEMBER 2025 ===');
    const payrolls = await Payroll.find({
      month: 9,
      year: 2025
    }).populate('employee', 'firstName lastName employeeId');
    
    console.log(`Found ${payrolls.length} payrolls for September 2025:`);
    
    payrolls.forEach(p => {
      console.log(`\n--- Payroll ID: ${p._id} ---`);
      console.log('Employee:', p.employee?.firstName, p.employee?.lastName, `(ID: ${p.employee?.employeeId})`);
      console.log('Created:', p.createdAt);
      
      // Check if this is Adil Aamir
      if (p.employee && 
          p.employee.firstName.toLowerCase().includes('adil') && 
          p.employee.lastName.toLowerCase().includes('aamir')) {
        
        console.log('🎯 THIS IS ADIL AAMIR!');
        console.log('Basic Salary:', p.basicSalary);
        console.log('Gross Salary:', p.grossSalary);
        console.log('Total Earnings:', p.totalEarnings);
        
        console.log('\n=== ALLOWANCES STRUCTURE ===');
        console.log(JSON.stringify(p.allowances, null, 2));
        
        if (p.allowances) {
          console.log('\n=== INDIVIDUAL ALLOWANCES ===');
          console.log('Conveyance:', p.allowances.conveyance?.isActive ? p.allowances.conveyance.amount : 'Inactive');
          console.log('Food:', p.allowances.food?.isActive ? p.allowances.food.amount : 'Inactive');
          console.log('Vehicle & Fuel:', p.allowances.vehicleFuel?.isActive ? p.allowances.vehicleFuel.amount : 'Inactive');
          console.log('Medical:', p.allowances.medical?.isActive ? p.allowances.medical.amount : 'Inactive');
          console.log('Special:', p.allowances.special?.isActive ? p.allowances.special.amount : 'Inactive');
          console.log('Other:', p.allowances.other?.isActive ? p.allowances.other.amount : 'Inactive');
        }
        
        console.log('\n=== LEGACY ALLOWANCE FIELDS ===');
        console.log('Conveyance Allowance:', p.conveyanceAllowance || 0);
        console.log('Medical Allowance:', p.medicalAllowance || 0);
        console.log('Special Allowance:', p.specialAllowance || 0);
        console.log('Other Allowance:', p.otherAllowance || 0);
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

findAdilPayroll();
