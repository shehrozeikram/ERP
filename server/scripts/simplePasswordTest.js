const bcrypt = require('bcryptjs');

async function simplePasswordTest() {
  try {
    console.log('🔐 Testing bcrypt password hashing and comparison...');
    
    const password = 'password123';
    console.log(`   Original password: ${password}`);
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log(`   Hashed password: ${hashedPassword.substring(0, 20)}...`);
    
    // Compare with correct password
    const isMatchCorrect = await bcrypt.compare(password, hashedPassword);
    console.log(`   Compare with correct password: ${isMatchCorrect}`);
    
    // Compare with wrong password
    const isMatchWrong = await bcrypt.compare('wrongpassword', hashedPassword);
    console.log(`   Compare with wrong password: ${isMatchWrong}`);
    
    if (isMatchCorrect && !isMatchWrong) {
      console.log('✅ bcrypt is working correctly!');
    } else {
      console.log('❌ bcrypt is not working correctly!');
    }
    
  } catch (error) {
    console.error('❌ Error in simple password test:', error);
  }
}

// Run the test
simplePasswordTest(); 