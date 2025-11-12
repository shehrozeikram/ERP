const mongoose = require('mongoose');
const Department = require('./server/models/hr/Department');
require('dotenv').config();

async function createDefaultDepartments() {
  try {
    // Connect to your cloud database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to cloud database');

    const defaultDepartments = [
      { name: 'Administration', code: 'ADMIN', description: 'Administrative Department' },
      { name: 'Human Resources', code: 'HR', description: 'Human Resources Department' },
      { name: 'Finance', code: 'FIN', description: 'Finance Department' },
      { name: 'Information Technology', code: 'IT', description: 'IT Department' },
      { name: 'Sales', code: 'SALES', description: 'Sales Department' },
      { name: 'Marketing', code: 'MKT', description: 'Marketing Department' },
      { name: 'Operations', code: 'OPS', description: 'Operations Department' },
      { name: 'Customer Service', code: 'CS', description: 'Customer Service Department' },
      { name: 'Procurement', code: 'PROC', description: 'Procurement Department' },
      { name: 'CRM', code: 'CRM', description: 'Customer Relationship Management' }
    ];

    // Check if departments already exist
    const existingDepartments = await Department.find({});
    if (existingDepartments.length > 0) {
      console.log('📋 Departments already exist:');
      existingDepartments.forEach(dept => {
        console.log(`  - ${dept.name} (${dept.code})`);
      });
      return;
    }

    // Create departments
    await Department.insertMany(defaultDepartments);
    console.log('✅ Default departments created successfully!');
    
    // Show created departments
    const createdDepartments = await Department.find({isActive: true});
    console.log('📋 Available departments:');
    createdDepartments.forEach(dept => {
      console.log(`  - ${dept.name} (${dept.code})`);
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
