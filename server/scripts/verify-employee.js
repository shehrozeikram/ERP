const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
require('dotenv').config();

async function verifyEmployee() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    
    const employee = await Employee.findOne({ employeeId: '1' })
      .populate('department', 'name')
      .populate('position', 'title')
      .populate('bankName', 'name')
      .populate('address.city', 'name')
      .populate('address.state', 'name')
      .populate('address.country', 'name');
    
    if (employee) {
      console.log('✅ Employee Verification:');
      console.log('   Name:', employee.firstName, employee.lastName);
      console.log('   Employee ID:', employee.employeeId);
      console.log('   Email:', employee.email);
      console.log('   Phone:', employee.phone);
      console.log('   CNIC:', employee.idCard);
      console.log('   Department:', employee.department?.name);
      console.log('   Designation:', employee.position?.title);
      console.log('   Bank:', employee.bankName?.name);
      console.log('   Account:', employee.accountNumber);
      console.log('   Gross Salary:', employee.salary.gross);
      console.log('   Basic Salary:', employee.salary.basic);
      console.log('   Hire Date:', employee.hireDate);
      console.log('   Address:', employee.address.street);
      console.log('   City:', employee.address.city?.name);
      console.log('   Province:', employee.address.state?.name);
      console.log('   Country:', employee.address.country?.name);
      console.log('   Emergency Contact:', employee.emergencyContact.name);
      console.log('   Emergency Phone:', employee.emergencyContact.phone);
      console.log('   Allowances:');
      console.log('     Conveyance:', employee.allowances.conveyance);
      console.log('     House:', employee.allowances.house);
      console.log('     Food:', employee.allowances.food);
      console.log('     Vehicle:', employee.allowances.vehicle);
      console.log('     Medical:', employee.allowances.medical);
    } else {
      console.log('❌ Employee not found');
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

verifyEmployee();
