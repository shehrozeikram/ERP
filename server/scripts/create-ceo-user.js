const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import User model
const User = require('../models/User');

async function createOrUpdateCEOUser() {
  try {
    console.log('🚀 Creating/Updating CEO user account...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to MongoDB\n');

    const ceoEmail = 'ceo@sgc.com';
    const ceoFirstName = 'Sardar';
    const ceoLastName = 'Umer Tanveer';
    
    // Check if CEO user already exists
    const existingCEO = await User.findOne({ email: ceoEmail });
    
    if (existingCEO) {
      console.log('⚠️  CEO user already exists! Updating profile image...');
      console.log(`   Email: ${existingCEO.email}`);
      console.log(`   Name: ${existingCEO.firstName} ${existingCEO.lastName}`);
      console.log(`   Role: ${existingCEO.role}`);
      
      // Update profile image
      existingCEO.profileImage = '/images/president-image.jpg';
      await existingCEO.save();
      
      console.log('✅ CEO profile image updated successfully!');
      console.log('🖼️ Profile Image: /images/president-image.jpg');
      return;
    }

    // Create CEO user
    const ceoUser = new User({
      firstName: ceoFirstName,
      lastName: ceoLastName,
      email: ceoEmail,
      password: 'ceo123456', // Default password - should be changed
      role: 'admin', // CEO should have admin role
      department: 'Operations',
      position: 'Chief Executive Officer',
      employeeId: 'CEO001',
      phone: '+923000000001',
      isActive: true,
      isEmailVerified: true,
      profileImage: '/images/president-image.jpg'
    });

    // Hash password before saving
    const salt = await bcrypt.genSalt(10);
    ceoUser.password = await bcrypt.hash(ceoUser.password, salt);

    await ceoUser.save();

    console.log('✅ CEO user created successfully!');
    console.log('📧 Email: ceo@sgc.com');
    console.log('🔑 Password: ceo123456 (Please change this)');
    console.log('👤 Role: admin');
    console.log('🏢 Department: Operations');
    console.log('💼 Position: Chief Executive Officer');
    console.log('🆔 Employee ID: CEO001');
    console.log('🖼️ Profile Image: /images/president-image.jpg');

    // Verify the user was created
    const createdUser = await User.findOne({ email: ceoEmail });
    if (createdUser) {
      console.log('\n🔍 Verification: CEO user found in database');
      console.log(`   User ID: ${createdUser._id}`);
      console.log(`   Created: ${createdUser.createdAt}`);
      console.log(`   Active: ${createdUser.isActive}`);
      console.log(`   Profile Image: ${createdUser.profileImage}`);
    }

  } catch (error) {
    console.error('❌ Error creating/updating CEO user:', error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  createOrUpdateCEOUser()
    .then(() => {
      console.log('\n✅ CEO user creation/update completed successfully!');
      console.log('🎉 CEO account is ready with profile image!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ CEO user creation/update failed:', error);
      process.exit(1);
    });
}

module.exports = { createOrUpdateCEOUser };
