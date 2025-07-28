// Test script for safeFormValue function logic
function safeFormValue(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (value && typeof value === 'object' && value._id !== undefined && value._id !== null) {
    console.log('Converting object to ID:', value);
    return value._id.toString();
  }
  return '';
}

console.log('🧪 Testing safeFormValue function...\n');

// Test cases
const testCases = [
  { input: 'Hello World', expected: 'Hello World', description: 'String input' },
  { input: 123, expected: '123', description: 'Number input' },
  { input: { _id: '507f1f77bcf86cd799439011', name: 'Test Department' }, expected: '507f1f77bcf86cd799439011', description: 'Object with _id property' },
  { input: { name: 'Test Department' }, expected: '', description: 'Object without _id property' },
  { input: null, expected: '', description: 'Null input' },
  { input: undefined, expected: '', description: 'Undefined input' },
  { input: {}, expected: '', description: 'Empty object' },
  { input: { _id: null }, expected: '', description: 'Object with null _id' },
  { input: { _id: undefined }, expected: '', description: 'Object with undefined _id' },
  { input: { _id: 0 }, expected: '0', description: 'Object with _id as 0' }
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = safeFormValue(testCase.input);
  const success = result === testCase.expected;
  
  console.log(`Test ${index + 1}: ${testCase.description}`);
  console.log(`  Input: ${JSON.stringify(testCase.input)}`);
  console.log(`  Expected: "${testCase.expected}"`);
  console.log(`  Result: "${result}"`);
  console.log(`  Status: ${success ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  
  if (success) {
    passed++;
  } else {
    failed++;
  }
});

console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
console.log(`🎯 Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('🎉 All tests passed! The safeFormValue function is working correctly.');
} else {
  console.log('⚠️  Some tests failed. Please review the safeFormValue function.');
} 