const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function fixUserPassword() {
  try {
    console.log('🔍 Finding admin user...');
    
    const user = await User.findOne({ role: 'admin' });
    
    if (!user) {
      console.log('❌ No admin user found.');
      return;
    }
    
    console.log(`✅ Found admin user: ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.email}`);
    
    // Hash the password manually (bypassing pre-save middleware)
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 12);
    
    console.log(`\n🔐 Setting password manually:`);
    console.log(`   Password: ${password}`);
    console.log(`   Hash: ${hashedPassword.substring(0, 20)}...`);
    
    // Update the password directly in the database to bypass pre-save middleware
    await User.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword } }
    );
    
    console.log('✅ Password updated directly in database!');
    
    // Test the password
    console.log('\n🔍 Testing the updated password...');
    const updatedUser = await User.findOne({ role: 'admin' }).select('+password');
    
    const isMatch = await updatedUser.comparePassword(password);
    console.log(`   Password comparison result: ${isMatch}`);
    
    if (isMatch) {
      console.log('✅ Password is working correctly now!');
      console.log('\n📝 You can now use these credentials:');
      console.log(`   Email: ${updatedUser.email}`);
      console.log(`   Password: ${password}`);
    } else {
      console.log('❌ Password is still not working!');
    }
    
  } catch (error) {
    console.error('❌ Error fixing password:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the fix
fixUserPassword(); 