const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function createAdminDirectly() {
  try {
    console.log('🚀 Creating admin user directly in database...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to MongoDB\n');

    // Delete existing admin user if it exists
    await User.deleteOne({ email: 'admin@sgc.com' });
    console.log('🗑️  Deleted existing admin user');

    // Hash password manually
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('password123', salt);
    console.log('🔐 Password hashed successfully');

    // Insert directly into database to bypass pre-save middleware
    const result = await User.collection.insertOne({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@sgc.com',
      password: hashedPassword,
      role: 'admin',
      department: 'IT',
      position: 'System Administrator',
      employeeId: 'ADMIN001',
      phone: '+923000000000',
      isActive: true,
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Admin user created directly in database!');
    console.log('📧 Email: admin@sgc.com');
    console.log('🔑 Password: password123');
    console.log('👤 Role: admin');

    // Test password comparison
    const savedUser = await User.findOne({ email: 'admin@sgc.com' }).select('+password');
    const isMatch = await bcrypt.compare('password123', savedUser.password);
    console.log('🔍 Password test:', isMatch ? 'PASS' : 'FAIL');

    if (isMatch) {
      console.log('\n🎉 SUCCESS: Admin user is ready for login!');
    } else {
      console.log('\n❌ FAILED: Password comparison still failing');
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
  createAdminDirectly()
    .then(() => {
      console.log('\n✅ Admin user creation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Admin user creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createAdminDirectly };
