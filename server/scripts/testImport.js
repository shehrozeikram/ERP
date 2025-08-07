const EmployeeImporter = require('./importEmployeesFromExcel');
const path = require('path');

async function testImport() {
  console.log('🧪 Testing Employee Import Functionality...\n');
  
  const importer = new EmployeeImporter();
  
  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await importer.connectToDatabase();
    console.log('✅ Database connection successful\n');
    
    // Test with a sample file (if exists)
    const testFile = path.join(__dirname, 'test_employees.xlsx');
    const fs = require('fs');
    
    if (fs.existsSync(testFile)) {
      console.log('📖 Found test file, running import test...');
      await importer.importEmployees(testFile);
    } else {
      console.log('📝 No test file found. To test the import:');
      console.log('1. Create a test_employees.xlsx file in server/scripts/');
      console.log('2. Add sample employee data with headers');
      console.log('3. Run this test again');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await importer.disconnectFromDatabase();
  }
}

// Run test
testImport(); 