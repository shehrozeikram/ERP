const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Import models
const Employee = require('../models/hr/Employee');

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Update employee gross salary with Basic values from Excel
const updateEmployeeGrossSalary = async () => {
  try {
    const filePath = path.join(__dirname, 'Master_File_July-2025.xlsx');
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Excel file not found at: ${filePath}`);
      return;
    }
    
    console.log('📊 Reading Excel file...');
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📋 Total rows in Excel: ${data.length}`);
    
    // Filter out header rows and get employee data
    const employeeData = data.filter(row => {
      // Check if this row has employee data (has ID and Basic values)
      return row['__EMPTY'] && row['__EMPTY_14'] && 
             typeof row['__EMPTY'] === 'number' && 
             typeof row['__EMPTY_14'] === 'number';
    });
    
    console.log(`👥 Valid employee rows found: ${employeeData.length}`);
    
    if (employeeData.length === 0) {
      console.log('❌ No valid employee data found in Excel file');
      return;
    }
    
    // Show sample data
    console.log('\n📋 Sample employee data:');
    employeeData.slice(0, 3).forEach((row, index) => {
      console.log(`   Employee ${index + 1}: ID=${row['__EMPTY']}, Basic=${row['__EMPTY_14']}`);
    });
    
    // Update employees in database
    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    
    for (const row of employeeData) {
      const employeeId = row['__EMPTY'];
      const basicSalary = row['__EMPTY_14'];
      
      try {
        // Find employee by employeeId
        const employee = await Employee.findOne({ employeeId: employeeId.toString() });
        
        if (employee) {
          // Update the gross salary with Basic value
          employee.salary.gross = basicSalary;
          
          // Also update basic salary if it's 0 or undefined
          if (!employee.salary.basic || employee.salary.basic === 0) {
            employee.salary.basic = basicSalary;
          }
          
          await employee.save();
          updatedCount++;
          console.log(`✅ Updated Employee ID ${employeeId}: Gross Salary = ${basicSalary}`);
        } else {
          notFoundCount++;
          console.log(`❌ Employee ID ${employeeId} not found in database`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error updating Employee ID ${employeeId}:`, error.message);
      }
    }
    
    console.log('\n📊 Update Summary:');
    console.log(`   ✅ Successfully updated: ${updatedCount} employees`);
    console.log(`   ❌ Not found in database: ${notFoundCount} employees`);
    console.log(`   ❌ Errors during update: ${errorCount} employees`);
    
    if (updatedCount > 0) {
      console.log('\n🎉 Employee gross salaries have been updated successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error updating employee gross salaries:', error);
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await updateEmployeeGrossSalary();
  } catch (error) {
    console.error('❌ Main execution error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
main();
