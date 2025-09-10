const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
require('dotenv').config();

const checkEmployee = async () => {
  try {
    console.log('🔍 Checking employees in database...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all employees
    const employees = await Employee.find({}, { employeeId: 1, firstName: 1, lastName: 1, email: 1 });
    
    console.log(`📊 Found ${employees.length} employees:`);
    employees.forEach(emp => {
      console.log(`   ID: ${emp.employeeId}, Name: ${emp.firstName} ${emp.lastName}, Email: ${emp.email}`);
    });
    
    // Check specifically for ID 06035
    const employee06035 = await Employee.findOne({ employeeId: '06035' });
    if (employee06035) {
      console.log(`✅ Employee with ID 06035 found: ${employee06035.firstName} ${employee06035.lastName}`);
    } else {
      console.log(`❌ Employee with ID 06035 not found`);
    }
    
  } catch (error) {
    console.error('❌ Error checking employees:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
};

checkEmployee();
