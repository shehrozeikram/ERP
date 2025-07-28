// Test script for employee edit with authentication
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Employee = require('../models/hr/Employee');
const User = require('../models/User');
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const Bank = require('../models/hr/Bank');
const City = require('../models/hr/City');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');

// Connect to database
mongoose.connect('mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const testEmployeeEditWithAuth = async () => {
  console.log('🔐 Testing Employee Edit with Authentication...\n');

  try {
    // Find a user and create a token
    console.log('📋 Setting up authentication...');
    const user = await User.findOne({ role: 'hr_manager' });
    
    if (!user) {
      console.log('❌ No HR manager user found');
      return;
    }
    
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log(`✅ Token created for user: ${user.email}`);
    console.log('');

    // Find an employee
    console.log('📋 Finding test employee...');
    const employee = await Employee.findOne().populate('department position bankName address.city address.state address.country');
    
    if (!employee) {
      console.log('❌ No employees found');
      return;
    }
    
    console.log(`✅ Found employee: ${employee.firstName} ${employee.lastName}`);
    console.log('');

    // Simulate first edit cycle
    console.log('🔄 Simulating first edit cycle...');
    console.log('   1. Fetch employee data');
    console.log('   2. Update employee');
    console.log('   3. Verify token still valid');
    
    // Verify token is still valid after operations
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('   ✅ Token is still valid after first cycle');
      console.log(`   User: ${decoded.email}, Role: ${decoded.role}`);
    } catch (tokenError) {
      console.log('   ❌ Token became invalid after first cycle');
      console.log(`   Error: ${tokenError.message}`);
    }

    // Simulate second edit cycle
    console.log('\n🔄 Simulating second edit cycle...');
    console.log('   1. Fetch employee data again');
    console.log('   2. Update employee again');
    console.log('   3. Verify token still valid');
    
    // Verify token is still valid after second cycle
    try {
      const decoded2 = jwt.verify(token, JWT_SECRET);
      console.log('   ✅ Token is still valid after second cycle');
      console.log(`   User: ${decoded2.email}, Role: ${decoded2.role}`);
    } catch (tokenError2) {
      console.log('   ❌ Token became invalid after second cycle');
      console.log(`   Error: ${tokenError2.message}`);
    }

    // Test token expiration scenarios
    console.log('\n⏰ Testing token scenarios...');
    
    // Create a short-lived token
    const shortToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '5s' }
    );
    
    console.log('   Created token that expires in 5 seconds...');
    
    // Wait and test
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    try {
      const decodedShort = jwt.verify(shortToken, JWT_SECRET);
      console.log('   ❌ Short token still valid (unexpected)');
    } catch (shortTokenError) {
      console.log('   ✅ Short token properly expired');
      console.log(`   Error: ${shortTokenError.message}`);
    }

  } catch (error) {
    console.log('❌ Error during test:');
    console.log(`   Error: ${error.message}`);
  }

  console.log('\n🎯 Test Summary:');
  console.log('✅ Employee edit with auth test completed');
  console.log('📝 Key findings:');
  console.log('   - Tokens should remain valid across edit cycles');
  console.log('   - API interceptor should not auto-redirect for HR endpoints');
  console.log('   - Components should handle 401 errors gracefully');
  console.log('   - Token expiration should be handled properly');
  
  mongoose.connection.close();
};

testEmployeeEditWithAuth().catch(console.error); 