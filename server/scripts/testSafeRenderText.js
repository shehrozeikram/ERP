// Test script for safeRenderText function logic
function safeRenderText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (value && typeof value === 'object' && value.name) return value.name;
  if (value && typeof value === 'object' && value.title) return value.title;
  return 'Unknown';
}

console.log('🧪 Testing safeRenderText function...\n');

// Test cases
const testCases = [
  { input: 'Hello World', expected: 'Hello World', description: 'String input' },
  { input: 123, expected: '123', description: 'Number input' },
  { input: { name: 'Test Department' }, expected: 'Test Department', description: 'Object with name property' },
  { input: { title: 'Test Position' }, expected: 'Test Position', description: 'Object with title property' },
  { input: null, expected: 'Unknown', description: 'Null input' },
  { input: undefined, expected: 'Unknown', description: 'Undefined input' },
  { input: {}, expected: 'Unknown', description: 'Empty object' },
  { input: { code: 'TEST' }, expected: 'Unknown', description: 'Object without name or title' },
  { input: { name: null }, expected: 'Unknown', description: 'Object with null name' },
  { input: { title: undefined }, expected: 'Unknown', description: 'Object with undefined title' }
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = safeRenderText(testCase.input);
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
  console.log('🎉 All tests passed! The safeRenderText function is working correctly.');
} else {
  console.log('⚠️  Some tests failed. Please review the safeRenderText function.');
} 