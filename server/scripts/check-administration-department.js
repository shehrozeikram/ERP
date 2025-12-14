const mongoose = require('mongoose');
const Department = require('../models/hr/Department');
require('dotenv').config();

async function checkAdministrationDepartment() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to database');

    // Check for Administration department (case-insensitive)
    const adminDept = await Department.findOne({ 
      name: { $regex: /^administration$/i } 
    });

    if (adminDept) {
      console.log('✅ Administration department EXISTS:');
      console.log(`   ID: ${adminDept._id}`);
      console.log(`   Name: ${adminDept.name}`);
      console.log(`   Code: ${adminDept.code || 'N/A'}`);
      console.log(`   Active: ${adminDept.isActive}`);
    } else {
      console.log('❌ Administration department DOES NOT EXIST');
      
      // Check for similar names
      const similarDepts = await Department.find({
        name: { $regex: /admin/i }
      });
      
      if (similarDepts.length > 0) {
        console.log('\n⚠️  Found similar department names:');
        similarDepts.forEach(dept => {
          console.log(`   - ${dept.name} (ID: ${dept._id}, Active: ${dept.isActive})`);
        });
      }
    }

    // List all departments for reference
    const allDepts = await Department.find({}).sort({ name: 1 });
    console.log(`\n📋 Total departments in database: ${allDepts.length}`);
    if (allDepts.length > 0) {
      console.log('\nAll departments:');
      allDepts.forEach(dept => {
        console.log(`   - ${dept.name} (ID: ${dept._id}, Active: ${dept.isActive})`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking department:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

checkAdministrationDepartment();

