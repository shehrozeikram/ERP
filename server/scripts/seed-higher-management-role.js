const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Role = require('../models/Role');
const { MODULES, SUBMODULES } = require('../config/permissions');

async function seedHigherManagementRole() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Check if role already exists
    const existingRole = await Role.findOne({ name: 'higher_management' });
    
    if (existingRole) {
      console.log('ℹ️  Higher Management role already exists');
      console.log(`   Role ID: ${existingRole._id}`);
      console.log(`   Display Name: ${existingRole.displayName}`);
      console.log(`   Status: ${existingRole.isActive ? 'Active' : 'Inactive'}`);
      return;
    }

    // Build permissions for all modules and submodules
    const permissions = [];
    
    // Iterate through all modules
    Object.values(MODULES).forEach(moduleKey => {
      const submodules = SUBMODULES[moduleKey] || [];
      
      if (submodules.length > 0) {
        permissions.push({
          module: moduleKey,
          submodules: submodules,
          actions: ['create', 'read', 'update', 'delete', 'approve', 'export', 'import']
        });
      }
    });

    // Create the Higher Management role
    const higherManagementRole = new Role({
      name: 'higher_management',
      displayName: 'Higher Management',
      description: 'Access to all departments and modules with full permissions',
      permissions: permissions,
      isActive: true,
      isSystemRole: true, // Mark as system role so it can't be deleted
      createdBy: null // System created
    });

    await higherManagementRole.save();
    
    console.log('✅ Higher Management role created successfully!');
    console.log(`   Role ID: ${higherManagementRole._id}`);
    console.log(`   Display Name: ${higherManagementRole.displayName}`);
    console.log(`   Modules: ${permissions.length}`);
    console.log(`   Total Permissions: ${permissions.reduce((sum, p) => sum + p.submodules.length, 0)} submodules`);
    
  } catch (error) {
    console.error('❌ Error seeding Higher Management role:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the seed function
if (require.main === module) {
  seedHigherManagementRole()
    .then(() => {
      console.log('\n🎉 Seed completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seed failed:', error);
      process.exit(1);
    });
}

module.exports = seedHigherManagementRole;

