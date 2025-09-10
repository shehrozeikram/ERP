const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Examine Excel file structure
const examineExcelStructure = () => {
  try {
    const filePath = path.join(__dirname, 'Master_File_Aug_2025.xlsx');
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Excel file not found at: ${filePath}`);
      return;
    }
    
    console.log('📊 Examining Excel file structure...');
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // First sheet
    const worksheet = workbook.Sheets[sheetName];
    
    console.log(`📋 Sheet name: ${sheetName}`);
    
    // Get column headers
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const headers = [];
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      const cellValue = worksheet[cellAddress]?.v;
      if (cellValue) {
        headers.push(cellValue);
      }
    }
    
    console.log('\n📋 Column Headers:');
    headers.forEach((header, index) => {
      console.log(`   ${index + 1}. ${header}`);
    });
    
    // Convert to JSON and show first few rows
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`\n📊 Total rows: ${data.length}`);
    
    if (data.length > 0) {
      console.log('\n📋 Sample Data (First 3 rows):');
      data.slice(0, 3).forEach((row, index) => {
        console.log(`\n   Row ${index + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          console.log(`     ${key}: ${value}`);
        });
      });
    }
    
    // Look for specific columns we need
    console.log('\n🔍 Looking for key columns:');
    const keyColumns = [
      'Employee ID', 'EmployeeID', 'ID', 'ID Number',
      'Name', 'First Name', 'Last Name', 'Full Name',
      'Email', 'Phone', 'Department', 'Designation', 'Position',
      'Salary', 'Gross Salary', 'Basic Salary',
      'Date of Birth', 'DOB', 'Birth Date',
      'Hire Date', 'Joining Date', 'Start Date',
      'Address', 'City', 'Province', 'Country',
      'Bank', 'Account Number', 'CNIC', 'ID Card'
    ];
    
    keyColumns.forEach(key => {
      const found = headers.find(header => 
        header && header.toLowerCase().includes(key.toLowerCase())
      );
      if (found) {
        console.log(`   ✅ Found: ${found}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error examining Excel file:', error);
  }
};

// Run the examination
examineExcelStructure();
