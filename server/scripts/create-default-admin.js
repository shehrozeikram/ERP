const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import User model
const User = require('../models/User');

async function createDefaultAdmin() {
  try {
    console.log('🚀 Creating default admin user...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to MongoDB\n');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@sgc.com' });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log(`   Employee ID: ${existingAdmin.employeeId}`);
      return;
    }

    // Create default admin user
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@sgc.com',
      password: 'password123',
      role: 'admin',
      department: 'IT',
      position: 'System Administrator',
      employeeId: 'ADMIN001',
      phone: '+923000000000',
      isActive: true,
      isEmailVerified: true
    });

    // Hash password before saving
    const salt = await bcrypt.genSalt(10);
    adminUser.password = await bcrypt.hash(adminUser.password, salt);

    await adminUser.save();

    console.log('✅ Default admin user created successfully!');
    console.log('📧 Email: admin@sgc.com');
    console.log('🔑 Password: password123');
    console.log('👤 Role: admin');
    console.log('🏢 Department: IT');
    console.log('💼 Position: System Administrator');
    console.log('🆔 Employee ID: ADMIN001');

    // Verify the user was created
    const createdUser = await User.findOne({ email: 'admin@sgc.com' });
    if (createdUser) {
      console.log('\n🔍 Verification: Admin user found in database');
      console.log(`   User ID: ${createdUser._id}`);
      console.log(`   Created: ${createdUser.createdAt}`);
      console.log(`   Active: ${createdUser.isActive}`);
    }

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  createDefaultAdmin()
    .then(() => {
      console.log('\n✅ Admin user creation completed successfully!');
      console.log('🎉 You can now login with admin@sgc.com / password123');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Admin user creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createDefaultAdmin };
