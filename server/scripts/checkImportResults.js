const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
require('dotenv').config();

async function checkResults() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    
    const count = await Employee.countDocuments();
    console.log('✅ Total employees in database:', count);
    
    // Get sample employees from the import
    const sampleEmployees = await Employee.find({employeeId: {$in: ['3', '7', '26', '33', '44']}})
      .select('employeeId firstName lastName department salary')
      .populate('department', 'name');
    
    console.log('\n📋 Sample newly imported employees:');
    sampleEmployees.forEach(emp => {
      console.log(`- ID: ${emp.employeeId} | Name: ${emp.firstName} ${emp.lastName} | Department: ${emp.department?.name || 'N/A'} | Salary: ${emp.salary?.gross || 'N/A'}`);
    });
    
    // Get some statistics
    const departments = await Employee.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: '$dept' },
      { $project: { name: '$dept.name', count: 1 } }
    ]);
    
    console.log('\n📊 Department distribution:');
    departments.forEach(dept => {
      console.log(`- ${dept.name}: ${dept.count} employees`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkResults(); 