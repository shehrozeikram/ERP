const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Import models and config
const Role = require('../models/Role');
const { connectDB } = require('../config/database');
const { ROLES, ROLE_MODULE_ACCESS, SUBMODULES } = require('../config/permissions');

// Connect to database
connectDB();

const migrateExistingRoles = async () => {
  try {
    console.log('🚀 Starting role migration...');
    
    // Get all existing roles from config
    const existingRoles = Object.values(ROLES);
    
    for (const roleName of existingRoles) {
      console.log(`\n📋 Processing role: ${roleName}`);
      
      // Check if role already exists in database
      const existingRole = await Role.findOne({ name: roleName });
      if (existingRole) {
        console.log(`   ✅ Role ${roleName} already exists, skipping...`);
        continue;
      }
      
      // Get role configuration
      const roleConfig = ROLE_MODULE_ACCESS[roleName];
      if (!roleConfig) {
        console.log(`   ⚠️  No configuration found for role ${roleName}, skipping...`);
        continue;
      }
      
      // Convert module access to permission structure
      const permissions = [];
      
      if (roleConfig.canAccessAll) {
        // Super admin gets all permissions
        for (const [moduleKey, submodules] of Object.entries(SUBMODULES)) {
          permissions.push({
            module: moduleKey,
            submodules: submodules,
            actions: ['create', 'read', 'update', 'delete', 'approve', 'export', 'import']
          });
        }
      } else {
        // Regular roles get specific module permissions
        for (const module of roleConfig.modules) {
          const submodules = SUBMODULES[module] || [];
          if (submodules.length > 0) {
            permissions.push({
              module: module,
              submodules: submodules,
              actions: ['create', 'read', 'update', 'delete', 'approve', 'export', 'import']
            });
          }
        }
      }
      
      // Create role display name
      const displayName = roleName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Create role document
      const role = new Role({
        name: roleName,
        displayName: displayName,
        description: roleConfig.description || `${displayName} role`,
        permissions: permissions,
        isActive: true,
        isSystemRole: true, // Mark as system role
        createdBy: null // System created
      });
      
      await role.save();
      console.log(`   ✅ Created role: ${displayName} with ${permissions.length} module permissions`);
    }
    
    console.log('\n🎉 Role migration completed successfully!');
    console.log('\n📊 Migration Summary:');
    
    // Display summary
    const totalRoles = await Role.countDocuments();
    const systemRoles = await Role.countDocuments({ isSystemRole: true });
    const customRoles = await Role.countDocuments({ isSystemRole: false });
    
    console.log(`   Total Roles: ${totalRoles}`);
    console.log(`   System Roles: ${systemRoles}`);
    console.log(`   Custom Roles: ${customRoles}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    mongoose.connection.close();
  }
};

// Run migration
migrateExistingRoles();
