const mongoose = require('mongoose');
require('dotenv').config();

async function simpleCheck() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    
    const db = mongoose.connection.db;
    const count = await db.collection('employees').countDocuments();
    console.log('✅ Total employees in database:', count);
    
    // Get sample employees
    const sampleEmployees = await db.collection('employees')
      .find({employeeId: {$in: ['3', '7', '26', '33', '44']}})
      .limit(5)
      .toArray();
    
    console.log('\n📋 Sample newly imported employees:');
    sampleEmployees.forEach(emp => {
      console.log(`- ID: ${emp.employeeId} | Name: ${emp.firstName} ${emp.lastName} | Salary: ${emp.salary?.gross || 'N/A'}`);
    });
    
    // Get department count
    const deptCount = await db.collection('departments').countDocuments();
    console.log(`\n📊 Total departments created: ${deptCount}`);
    
    // Get position count
    const posCount = await db.collection('positions').countDocuments();
    console.log(`📊 Total positions created: ${posCount}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

simpleCheck(); 