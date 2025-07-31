const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function checkUserCredentials() {
  try {
    console.log('🔍 Finding users...');
    
    const users = await User.find({ role: { $in: ['admin', 'hr_manager'] } });
    
    if (users.length === 0) {
      console.log('❌ No admin or hr_manager users found.');
      return;
    }
    
    console.log(`✅ Found ${users.length} users:`);
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. User Details:`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Password: ${user.password ? 'Set' : 'Not set'}`);
      console.log(`   Created: ${user.createdAt}`);
    });
    
    console.log('\n📝 Note: Passwords are hashed. You may need to reset a password or create a new user for testing.');
    
  } catch (error) {
    console.error('❌ Error checking user credentials:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the check
checkUserCredentials(); 