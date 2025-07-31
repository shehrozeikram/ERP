const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function testPassword() {
  try {
    console.log('🔍 Finding admin user...');
    
    const user = await User.findOne({ role: 'admin' }).select('+password');
    
    if (!user) {
      console.log('❌ No admin user found.');
      return;
    }
    
    console.log(`✅ Found admin user: ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Password field: ${user.password ? 'Set' : 'Not set'}`);
    
    if (user.password) {
      console.log(`   Password hash: ${user.password.substring(0, 20)}...`);
      
      // Test password comparison
      const testPassword = 'password123';
      const isMatch = await bcrypt.compare(testPassword, user.password);
      
      console.log(`\n🔐 Testing password comparison:`);
      console.log(`   Test password: ${testPassword}`);
      console.log(`   Is match: ${isMatch}`);
      
      // Test using the model method
      const isMatchMethod = await user.comparePassword(testPassword);
      console.log(`   Using model method: ${isMatchMethod}`);
      
      if (isMatch) {
        console.log('✅ Password comparison works correctly!');
      } else {
        console.log('❌ Password comparison failed!');
        
        // Let's try to set the password again
        console.log('\n🔄 Setting password again...');
        const hashedPassword = await bcrypt.hash(testPassword, 12);
        user.password = hashedPassword;
        await user.save();
        
        console.log('✅ Password updated successfully!');
        
        // Test again
        const newUser = await User.findOne({ role: 'admin' }).select('+password');
        const isMatchAfterUpdate = await newUser.comparePassword(testPassword);
        console.log(`   Test after update: ${isMatchAfterUpdate}`);
      }
    } else {
      console.log('❌ Password is not set. Setting it now...');
      
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 12);
      
      user.password = hashedPassword;
      await user.save();
      
      console.log('✅ Password set successfully!');
      console.log(`   Password: ${password}`);
      console.log(`   Hash: ${hashedPassword.substring(0, 20)}...`);
    }
    
  } catch (error) {
    console.error('❌ Error testing password:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testPassword(); 