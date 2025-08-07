const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Import models
const Employee = require('../models/hr/Employee');

// Database connection
const { connectDB } = require('../config/database');

const updateExistingEmployeesWithIsDeleted = async () => {
  try {
    console.log('🚀 Starting Employee isDeleted Field Update...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected successfully');

    // Find all employees that don't have the isDeleted field
    const employeesWithoutIsDeleted = await Employee.find({
      isDeleted: { $exists: false }
    });

    console.log(`📊 Found ${employeesWithoutIsDeleted.length} employees without isDeleted field`);

    if (employeesWithoutIsDeleted.length === 0) {
      console.log('✅ All employees already have isDeleted field');
      return;
    }

    // Update all employees to have isDeleted: false
    const result = await Employee.updateMany(
      { isDeleted: { $exists: false } },
      { $set: { isDeleted: false } }
    );

    console.log(`✅ Updated ${result.modifiedCount} employees with isDeleted: false`);

    // Verify the update
    const totalEmployees = await Employee.countDocuments();
    const employeesWithIsDeleted = await Employee.countDocuments({ isDeleted: { $exists: true } });
    const activeEmployees = await Employee.countDocuments({ 
      $or: [
        { isDeleted: false },
        { isDeleted: { $exists: false } }
      ]
    });

    console.log('\n📊 Update Summary:');
    console.log(`✅ Total employees: ${totalEmployees}`);
    console.log(`✅ Employees with isDeleted field: ${employeesWithIsDeleted}`);
    console.log(`✅ Active employees (non-deleted): ${activeEmployees}`);

    console.log('\n🎉 Employee isDeleted field update completed successfully!');

  } catch (error) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

// Run the update
if (require.main === module) {
  updateExistingEmployeesWithIsDeleted();
}

module.exports = updateExistingEmployeesWithIsDeleted; 