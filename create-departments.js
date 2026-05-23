const mongoose = require('mongoose');
const Department = require('./server/models/hr/Department');
require('dotenv').config();

async function createDefaultDepartments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to cloud database');

    const defaultDepartments = [
      { name: 'Administration', description: 'Administrative Department' },
      { name: 'Human Resources', description: 'Human Resources Department' },
      { name: 'Finance', description: 'Finance Department' },
      { name: 'Information Technology', description: 'IT Department' },
      { name: 'Sales', description: 'Sales Department' },
      { name: 'Marketing', description: 'Marketing Department' },
      { name: 'Operations', description: 'Operations Department' },
      { name: 'Customer Service', description: 'Customer Service Department' },
      { name: 'Procurement', description: 'Procurement Department' },
      { name: 'CRM', description: 'Customer Relationship Management' }
    ];

    const existingDepartments = await Department.find({});
    if (existingDepartments.length > 0) {
      console.log('📋 Departments already exist:');
      existingDepartments.forEach((dept) => {
        console.log(`  - ${dept.name}`);
      });
      return;
    }

    await Department.insertMany(defaultDepartments);
    console.log('✅ Default departments created successfully!');

    const createdDepartments = await Department.find({ isActive: true });
    console.log('📋 Available departments:');
    createdDepartments.forEach((dept) => {
      console.log(`  - ${dept.name}`);
    });
  } catch (error) {
    console.error('❌ Error creating departments:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

createDefaultDepartments();
