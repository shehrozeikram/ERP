const mongoose = require('mongoose');
const Department = require('../models/hr/Department');
require('dotenv').config();

async function activateAdministrationDepartment() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to database');

    // Find Administration department
    const adminDept = await Department.findOne({ 
      name: { $regex: /^administration$/i } 
    });

    if (!adminDept) {
      console.log('❌ Administration department not found');
      await mongoose.connection.close();
      process.exit(1);
    }

    // Activate the department
    adminDept.isActive = true;
    await adminDept.save();

    console.log('✅ Administration department activated successfully!');
    console.log(`   ID: ${adminDept._id}`);
    console.log(`   Name: ${adminDept.name}`);
    console.log(`   Code: ${adminDept.code || 'N/A'}`);
    console.log(`   Active: ${adminDept.isActive}`);

  } catch (error) {
    console.error('❌ Error activating department:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

activateAdministrationDepartment();

