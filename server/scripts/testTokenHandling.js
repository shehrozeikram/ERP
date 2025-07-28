// Test script to check token handling
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Connect to database
mongoose.connect('mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const testTokenHandling = async () => {
  console.log('🔐 Testing Token Handling...\n');

  try {
    // Find a user to create a token for
    console.log('📋 Finding user for token creation...');
    const user = await User.findOne({ role: 'hr_manager' });
    
    if (!user) {
      console.log('❌ No HR manager user found');
      return;
    }
    
    console.log(`✅ Found user: ${user.email} (${user.role})`);
    
    // Create a token
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log(`✅ Token created: ${token.substring(0, 20)}...`);
    console.log('');

    // Test token verification
    console.log('🔍 Testing token verification...');
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('   ✅ Token is valid');
      console.log(`   User ID: ${decoded.userId}`);
      console.log(`   Email: ${decoded.email}`);
      console.log(`   Role: ${decoded.role}`);
      console.log(`   Expires: ${new Date(decoded.exp * 1000)}`);
    } catch (verifyError) {
      console.log('   ❌ Token verification failed');
      console.log(`   Error: ${verifyError.message}`);
    }

    // Test token expiration
    console.log('\n⏰ Testing token expiration...');
    const expiredToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1s' }
    );
    
    console.log('   Created token that expires in 1 second...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    try {
      const decodedExpired = jwt.verify(expiredToken, JWT_SECRET);
      console.log('   ❌ Expired token still valid (unexpected)');
    } catch (expiredError) {
      console.log('   ✅ Expired token properly rejected');
      console.log(`   Error: ${expiredError.message}`);
    }

    // Check if there are any token-related issues in the auth middleware
    console.log('\n🔧 Checking auth middleware...');
    console.log('   The issue might be in the authorize middleware');
    console.log('   Let\'s check if tokens are being properly validated');

  } catch (error) {
    console.log('❌ Error during test:');
    console.log(`   Error: ${error.message}`);
  }

  console.log('\n🎯 Test Summary:');
  console.log('✅ Token handling test completed');
  console.log('📝 The issue might be:');
  console.log('   1. Token expiration after first edit');
  console.log('   2. Token being cleared from localStorage');
  console.log('   3. Auth middleware rejecting valid tokens');
  console.log('   4. Server restart invalidating tokens');
  
  mongoose.connection.close();
};

testTokenHandling().catch(console.error); 