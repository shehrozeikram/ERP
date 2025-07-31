const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function setUserPassword() {
  try {
    console.log('🔍 Finding admin user...');
    
    const user = await User.findOne({ role: 'admin' });
    
    if (!user) {
      console.log('❌ No admin user found.');
      return;
    }
    
    console.log(`✅ Found admin user: ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.email}`);
    
    // Set password
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 12);
    
    user.password = hashedPassword;
    await user.save();
    
    console.log(`✅ Password set successfully for ${user.email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Hashed: ${hashedPassword.substring(0, 20)}...`);
    
    console.log('\n📝 You can now use these credentials to test the API:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${password}`);
    
  } catch (error) {
    console.error('❌ Error setting password:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
setUserPassword(); 