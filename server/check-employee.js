const mongoose = require('mongoose');
const Employee = require('./models/hr/Employee');

async function checkEmployee() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    // Let's see some sample employees
    const sampleEmployees = await Employee.find().limit(10).select('_id employeeId firstName lastName');
    console.log('\n=== SAMPLE EMPLOYEES ===');
    sampleEmployees.forEach(emp => {
      console.log('MongoDB ID:', emp._id);
      console.log('Employee ID:', emp.employeeId);
      console.log('Name:', emp.firstName, emp.lastName);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

checkEmployee();
