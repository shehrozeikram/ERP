const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Employee = require('../server/models/hr/Employee');

async function searchId() {
  const uri = process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local';
  console.log(`🔌 Connecting to: ${uri}`);
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    const ids = ['06459', '6459', 6459, '05726', '5726', 5726];
    const employees = await Employee.find({
      employeeId: { $in: ids }
    }).lean();

    console.log(`🔍 Found ${employees.length} employees:`);
    employees.forEach(emp => {
      console.log(`👤 Employee: ${emp.firstName} ${emp.lastName}`);
      console.log(`   MongoDB _id: ${emp._id}`);
      console.log(`   Employee ID: ${emp.employeeId}`);
      console.log(`   Active: ${emp.isActive}, Deleted: ${emp.isDeleted}`);
      console.log(`   Email: ${emp.email}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Connection closed');
  }
}

searchId();
