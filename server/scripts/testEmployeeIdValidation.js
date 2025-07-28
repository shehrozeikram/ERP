// Test script for employee ID validation
const mongoose = require('mongoose');

// Connect to database
mongoose.connect('mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const testEmployeeIdValidation = async () => {
  console.log('🔍 Testing Employee ID Validation...\n');

  // Test various ID formats
  const testIds = [
    '68850b7f0482b9a9267b3c6b', // Valid ObjectId
    '123456789012345678901234', // Valid ObjectId format
    'invalid-id', // Invalid format
    '123', // Too short
    '12345678901234567890123', // Too short
    '1234567890123456789012345', // Too long
    '', // Empty string
    null, // Null
    undefined, // Undefined
    '68850b7f0482b9a9267b3c6', // Invalid ObjectId (missing character)
    '68850b7f0482b9a9267b3c6c', // Valid ObjectId
  ];

  console.log('📋 Testing ObjectId validation:');
  testIds.forEach((id, index) => {
    const isValid = mongoose.Types.ObjectId.isValid(id);
    console.log(`  ${index + 1}. "${id}" (type: ${typeof id}): ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  });

  // Test the exact validation logic used in routes
  console.log('\n🔍 Testing route validation logic:');
  testIds.forEach((id, index) => {
    // This is the exact logic used in the HR routes
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log(`  ${index + 1}. "${id}": ❌ Would return "Invalid employee ID format"`);
    } else {
      console.log(`  ${index + 1}. "${id}": ✅ Would pass validation`);
    }
  });

  // Test common edge cases
  console.log('\n🔍 Testing edge cases:');
  
  // Test with spaces
  const idWithSpaces = ' 68850b7f0482b9a9267b3c6b ';
  console.log(`  ID with spaces: "${idWithSpaces}" -> ${mongoose.Types.ObjectId.isValid(idWithSpaces) ? '✅ Valid' : '❌ Invalid'}`);
  
  // Test with special characters
  const idWithSpecialChars = '68850b7f0482b9a9267b3c6b!';
  console.log(`  ID with special chars: "${idWithSpecialChars}" -> ${mongoose.Types.ObjectId.isValid(idWithSpecialChars) ? '✅ Valid' : '❌ Invalid'}`);
  
  // Test with numbers
  const numericId = 123456789012345678901234;
  console.log(`  Numeric ID: ${numericId} -> ${mongoose.Types.ObjectId.isValid(numericId) ? '✅ Valid' : '❌ Invalid'}`);

  console.log('\n🎯 Validation Test Summary:');
  console.log('✅ ObjectId validation test completed');
  console.log('📝 Check the results above to identify invalid ID formats');
  
  mongoose.connection.close();
};

testEmployeeIdValidation().catch(console.error); 