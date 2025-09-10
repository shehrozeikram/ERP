const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function recreateAdmin() {
  try {
    console.log('🚀 Recreating admin user...\n');

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

    // Create admin user with pre-hashed password
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@sgc.com',
      password: hashedPassword, // Use pre-hashed password
      role: 'admin',
      department: 'IT',
      position: 'System Administrator',
      employeeId: 'ADMIN001',
      phone: '+923000000000',
      isActive: true,
      isEmailVerified: true
    });

    // Save without triggering pre-save middleware for password
    await adminUser.save();
    console.log('✅ Admin user created successfully!');

    // Test password comparison
    const savedUser = await User.findOne({ email: 'admin@sgc.com' }).select('+password');
    const isMatch = await bcrypt.compare('password123', savedUser.password);
    console.log('🔍 Password test:', isMatch ? 'PASS' : 'FAIL');

    console.log('\n📧 Email: admin@sgc.com');
    console.log('🔑 Password: password123');
    console.log('👤 Role: admin');

  } catch (error) {
    console.error('❌ Error recreating admin user:', error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  recreateAdmin()
    .then(() => {
      console.log('\n✅ Admin user recreation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Admin user recreation failed:', error);
      process.exit(1);
    });
}

module.exports = { recreateAdmin };
