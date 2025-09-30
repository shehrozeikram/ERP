const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
require('dotenv').config();

const checkCloudDatabase = async () => {
  try {
    console.log('🔍 Checking Cloud Atlas Database...');
    console.log('Database URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
    
    // Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB Atlas');
    console.log('Database Name:', mongoose.connection.name);

    // Check all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📊 Available Collections:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });

    // Check Employee collection specifically
    console.log('\n👥 Employee Collection Analysis:');
    
    const totalEmployees = await Employee.countDocuments();
    const activeEmployees = await Employee.countDocuments({ isActive: true });
    const deletedEmployees = await Employee.countDocuments({ isDeleted: true });
    
    console.log(`  Total employees: ${totalEmployees}`);
    console.log(`  Active employees: ${activeEmployees}`);
    console.log(`  Deleted employees: ${deletedEmployees}`);

    if (totalEmployees > 0) {
      console.log('\n📋 Sample Employees:');
      const sampleEmployees = await Employee.find({}).limit(5).select('firstName lastName employeeId email isActive isDeleted leaveBalance');
      
      sampleEmployees.forEach(emp => {
        console.log(`  - ${emp.firstName} ${emp.lastName} (${emp.employeeId})`);
        console.log(`    Email: ${emp.email}`);
        console.log(`    Active: ${emp.isActive}, Deleted: ${emp.isDeleted}`);
        console.log(`    Leave Balance Type: ${typeof emp.leaveBalance}`);
        
        if (emp.leaveBalance) {
          console.log(`    Leave Balance Structure:`);
          Object.keys(emp.leaveBalance).forEach(key => {
            const value = emp.leaveBalance[key];
            console.log(`      ${key}: ${typeof value} - ${JSON.stringify(value)}`);
          });
        }
        console.log('');
      });

      // Check for employees with problematic leave balance structure
      console.log('🔍 Checking for problematic leave balance structures...');
      
      const problematicEmployees = await Employee.find({
        $or: [
          { 'leaveBalance.maternity': { $type: 'number' } },
          { 'leaveBalance.paternity': { $type: 'number' } },
          { 'leaveBalance.annual': { $type: 'number' } },
          { 'leaveBalance.casual': { $type: 'number' } },
          { 'leaveBalance.medical': { $type: 'number' } }
        ]
      }).select('firstName lastName employeeId leaveBalance');

      if (problematicEmployees.length > 0) {
        console.log(`⚠️  Found ${problematicEmployees.length} employees with problematic leave balance structure:`);
        problematicEmployees.forEach(emp => {
          console.log(`  - ${emp.firstName} ${emp.lastName} (${emp.employeeId})`);
          console.log(`    Leave Balance: ${JSON.stringify(emp.leaveBalance)}`);
        });
      } else {
        console.log('✅ No employees with problematic leave balance structure found');
      }
    }

  } catch (error) {
    console.error('❌ Error checking cloud database:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
};

checkCloudDatabase();
