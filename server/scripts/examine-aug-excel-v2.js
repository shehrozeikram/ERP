const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Examine Excel file structure with proper parsing
const examineExcelStructure = () => {
  try {
    const filePath = path.join(__dirname, 'Master_File_Aug_2025.xlsx');
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Excel file not found at: ${filePath}`);
      return;
    }
    
    console.log('📊 Examining Excel file structure...');
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log(`📋 Sheet name: ${sheetName}`);
    
    // Convert to JSON starting from row 2 (skip header rows)
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      range: 2, // Start from row 2 (0-indexed)
      header: 1 // Use first row as headers
    });
    
    console.log(`\n📊 Total data rows: ${data.length}`);
    
    if (data.length > 0) {
      // The headers are in the second row
      const headers = data[0];
      console.log('\n📋 Actual Column Headers:');
      headers.forEach((header, index) => {
        if (header && header.trim()) {
          console.log(`   ${index + 1}. ${header}`);
        }
      });
      
      // Show sample data (skip header row)
      console.log('\n📋 Sample Data (First 3 employee rows):');
      data.slice(1, 4).forEach((row, index) => {
        console.log(`\n   Employee ${index + 1}:`);
        headers.forEach((header, colIndex) => {
          if (header && header.trim() && row[colIndex] !== undefined) {
            console.log(`     ${header}: ${row[colIndex]}`);
          }
        });
      });
    }
    
    // Map the columns to our Employee model fields
    console.log('\n🔍 Column Mapping Analysis:');
    const columnMapping = {
      'ID': 'employeeId',
      'Name': 'fullName',
      'Guardian Name': 'guardianName',
      'CNIC': 'idCard',
      'Bank': 'bankName',
      'Branch Code': 'branchCode',
      'Account No': 'accountNumber',
      'DOJ': 'hireDate',
      'Project': 'project',
      'Department': 'department',
      'Section': 'section',
      'Designation': 'designation',
      'Location': 'location',
      'DOB': 'dateOfBirth',
      'Address': 'address',
      'Qualification': 'qualification',
      'Contact No': 'phone',
      'Probation Period': 'probationPeriod',
      'Date Of joining': 'joiningDate',
      'Date of Appiontment': 'appointmentDate',
      'Conformation Date': 'confirmationDate',
      'Gross Salary': 'grossSalary',
      'Arears': 'arrears',
      'Covance Allowance': 'conveyanceAllowance',
      'House Allowance': 'houseAllowance',
      'Food Allowance': 'foodAllowance',
      'Vehicle & Fuel Allowance': 'vehicleFuelAllowance',
      'Medical Allowance': 'medicalAllowance',
      'Total Earnings': 'totalEarnings',
      'Income Tax': 'incomeTax',
      'Company Loan': 'companyLoan',
      'Vehicle Loan': 'vehicleLoan',
      'EOBI Ded': 'eobiDeduction',
      'Net Payable': 'netPayable'
    };
    
    console.log('\n📋 Mapped Fields:');
    Object.entries(columnMapping).forEach(([excelField, modelField]) => {
      console.log(`   ${excelField} → ${modelField}`);
    });
    
  } catch (error) {
    console.error('❌ Error examining Excel file:', error);
  }
};

// Run the examination
examineExcelStructure();
