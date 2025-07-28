// Test script for EmployeeList object rendering fix
function safeRenderEmployeeField(value, fieldType) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (value && typeof value === 'object') {
    switch (fieldType) {
      case 'department':
        return value.name || 'Unknown Department';
      case 'position':
        return value.title || 'Unknown Position';
      case 'bankName':
        return value.name || 'Unknown Bank';
      default:
        return 'Unknown';
    }
  }
  return 'N/A';
}

console.log('🧪 Testing EmployeeList object rendering fix...\n');

// Test cases
const testCases = [
  {
    description: 'String department and position',
    employee: {
      department: 'Human Resources',
      position: 'HR Manager',
      bankName: 'HBL Bank'
    },
    expected: {
      department: 'Human Resources',
      position: 'HR Manager',
      bankName: 'HBL Bank'
    }
  },
  {
    description: 'Object department and position',
    employee: {
      department: { _id: '123', name: 'IT Department', code: 'IT' },
      position: { _id: '456', title: 'Software Engineer', level: 'Senior' },
      bankName: { _id: '789', name: 'UBL Bank', type: 'Commercial' }
    },
    expected: {
      department: 'IT Department',
      position: 'Software Engineer',
      bankName: 'UBL Bank'
    }
  },
  {
    description: 'Mixed string and object fields',
    employee: {
      department: 'Marketing',
      position: { _id: '456', title: 'Marketing Manager', level: 'Manager' },
      bankName: 'MCB Bank'
    },
    expected: {
      department: 'Marketing',
      position: 'Marketing Manager',
      bankName: 'MCB Bank'
    }
  },
  {
    description: 'Null and undefined fields',
    employee: {
      department: null,
      position: undefined,
      bankName: { _id: '789', name: 'HBL Bank', type: 'Commercial' }
    },
    expected: {
      department: 'N/A',
      position: 'N/A',
      bankName: 'HBL Bank'
    }
  },
  {
    description: 'Empty object fields',
    employee: {
      department: {},
      position: { _id: '456', title: 'Developer' },
      bankName: {}
    },
    expected: {
      department: 'Unknown Department',
      position: 'Developer',
      bankName: 'Unknown Bank'
    }
  }
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.description}`);
  
  const result = {
    department: safeRenderEmployeeField(testCase.employee.department, 'department'),
    position: safeRenderEmployeeField(testCase.employee.position, 'position'),
    bankName: safeRenderEmployeeField(testCase.employee.bankName, 'bankName')
  };
  
  const success = 
    result.department === testCase.expected.department &&
    result.position === testCase.expected.position &&
    result.bankName === testCase.expected.bankName;
  
  console.log(`  Input: ${JSON.stringify(testCase.employee)}`);
  console.log(`  Expected: ${JSON.stringify(testCase.expected)}`);
  console.log(`  Result: ${JSON.stringify(result)}`);
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
  console.log('🎉 All tests passed! The EmployeeList object rendering fix is working correctly.');
} else {
  console.log('⚠️  Some tests failed. Please review the EmployeeList object rendering fix.');
} 