const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const XLSX = require('xlsx');

// Import models
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const Designation = require('../models/hr/Designation');
const Location = require('../models/hr/Location');
const Project = require('../models/hr/Project');

// Database connection
const { connectDB } = require('../config/database');

const importEmployeeAllowancesFromExcel = async () => {
  try {
    console.log('🚀 Starting Employee Allowances Import from Excel...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected successfully');

    // Read Excel file
    const excelFilePath = path.join(__dirname, 'Master_File_July-2025.xlsx');
    const workbook = XLSX.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`📊 Excel file loaded with ${data.length} rows`);

    // Find the header row (row with column names)
    let headerRow = null;
    let dataStartRow = null;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row && row.length > 0 && row[0] === 'Sr No') {
        headerRow = row;
        dataStartRow = i + 1;
        break;
      }
    }

    if (!headerRow) {
      throw new Error('Could not find header row in Excel file');
    }

    console.log('📋 Headers found:', headerRow);
    console.log(`📊 Data starts from row: ${dataStartRow}`);

    // Map column indices
    const columnMap = {
      srNo: headerRow.indexOf('Sr No'),
      id: headerRow.indexOf('ID'),
      name: headerRow.indexOf('Name'),
      guardianName: headerRow.indexOf('Guardian Name'),
      cnic: headerRow.indexOf('CNIC'),
      bank: headerRow.indexOf('Bank'),
      accountNo: headerRow.indexOf('Account No'),
      doj: headerRow.indexOf('DOJ'),
      project: headerRow.indexOf('Project'),
      department: headerRow.indexOf('Department'),
      section: headerRow.indexOf('Section'),
      designation: headerRow.indexOf('Designation'),
      location: headerRow.indexOf('Location'),
      dob: headerRow.indexOf('DOB'),
      contactNo: headerRow.indexOf('Contact No'),
      basic: headerRow.indexOf('Basic'),
      arrears: headerRow.indexOf('Arears'),
      conveyanceAllowance: headerRow.indexOf('Covance Allowance'),
      houseAllowance: headerRow.indexOf('House Allowance'),
      foodAllowance: headerRow.indexOf('Food Allowance'),
      vehicleFuelAllowance: headerRow.indexOf('Vehicle & Fuel Allowance'),
      medicalAllowance: headerRow.indexOf('Medical Allowance'),
      grossSalary: headerRow.indexOf('Gross Salary'),
      incomeTax: headerRow.indexOf('Income Tax'),
      companyLoan: headerRow.indexOf('Company Loan'),
      vehicleLoan: headerRow.indexOf('Vehicle Loan'),
      eobiDed: headerRow.indexOf('EOBI Ded'),
      netPayable: headerRow.indexOf('Net Payable')
    };

    console.log('🗺️ Column mapping:', columnMap);

    // Process data rows
    let processedCount = 0;
    let updatedCount = 0;
    let notFoundCount = 0;
    let errors = [];

    for (let i = dataStartRow; i < data.length; i++) {
      const row = data[i];
      
      // Skip empty rows or rows without ID
      if (!row || !row[columnMap.id] || row[columnMap.id] === 'Total') {
        continue;
      }

      try {
        const employeeId = row[columnMap.id]?.toString().trim();
        const employeeName = row[columnMap.name]?.toString().trim();
        
        if (!employeeId || !employeeName) {
          continue;
        }

        console.log(`\n👤 Processing Employee: ${employeeName} (ID: ${employeeId})`);

        // Find employee by ID or name
        let employee = await Employee.findOne({
          $or: [
            { employeeId: employeeId },
            { firstName: { $regex: new RegExp(employeeName.split(' ')[0], 'i') } },
            { lastName: { $regex: new RegExp(employeeName.split(' ').slice(-1)[0], 'i') } }
          ]
        });

        if (!employee) {
          console.log(`❌ Employee not found: ${employeeName} (ID: ${employeeId})`);
          notFoundCount++;
          continue;
        }

        console.log(`✅ Employee found: ${employee.firstName} ${employee.lastName}`);

        // Parse allowance amounts
        const conveyanceAmount = parseFloat(row[columnMap.conveyanceAllowance]) || 0;
        const foodAmount = parseFloat(row[columnMap.foodAllowance]) || 0;
        const vehicleFuelAmount = parseFloat(row[columnMap.vehicleFuelAllowance]) || 0;
        const medicalAmount = parseFloat(row[columnMap.medicalAllowance]) || 0;
        const basicSalary = parseFloat(row[columnMap.basic]) || 0;
        const companyLoanAmount = parseFloat(row[columnMap.companyLoan]) || 0;
        const vehicleLoanAmount = parseFloat(row[columnMap.vehicleLoan]) || 0;

        // Update employee allowances
        const updateData = {
          'salary.basic': basicSalary,
          'allowances.conveyance.isActive': conveyanceAmount > 0,
          'allowances.conveyance.amount': conveyanceAmount,
          'allowances.food.isActive': foodAmount > 0,
          'allowances.food.amount': foodAmount,
          'allowances.vehicleFuel.isActive': vehicleFuelAmount > 0,
          'allowances.vehicleFuel.amount': vehicleFuelAmount,
          'allowances.medical.isActive': medicalAmount > 0,
          'allowances.medical.amount': medicalAmount,
          'loans.companyLoan.isActive': companyLoanAmount > 0,
          'loans.companyLoan.amount': companyLoanAmount,
          'loans.companyLoan.monthlyInstallment': companyLoanAmount > 0 ? Math.round(companyLoanAmount / 12) : 0, // Estimate monthly installment
          'loans.companyLoan.outstandingBalance': companyLoanAmount,
          'loans.vehicleLoan.isActive': vehicleLoanAmount > 0,
          'loans.vehicleLoan.amount': vehicleLoanAmount,
          'loans.vehicleLoan.monthlyInstallment': vehicleLoanAmount > 0 ? Math.round(vehicleLoanAmount / 12) : 0, // Estimate monthly installment
          'loans.vehicleLoan.outstandingBalance': vehicleLoanAmount
        };

        // Update employee
        await Employee.findByIdAndUpdate(employee._id, updateData, { new: true });
        
        console.log(`✅ Updated allowances for ${employee.firstName} ${employee.lastName}:`);
        console.log(`   - Conveyance: ${conveyanceAmount > 0 ? 'Active' : 'Inactive'} (${conveyanceAmount})`);
        console.log(`   - Food: ${foodAmount > 0 ? 'Active' : 'Inactive'} (${foodAmount})`);
        console.log(`   - Vehicle & Fuel: ${vehicleFuelAmount > 0 ? 'Active' : 'Inactive'} (${vehicleFuelAmount})`);
        console.log(`   - Medical: ${medicalAmount > 0 ? 'Active' : 'Inactive'} (${medicalAmount})`);
        console.log(`   - Company Loan: ${companyLoanAmount > 0 ? 'Active' : 'Inactive'} (${companyLoanAmount})`);
        console.log(`   - Vehicle Loan: ${vehicleLoanAmount > 0 ? 'Active' : 'Inactive'} (${vehicleLoanAmount})`);

        updatedCount++;
        processedCount++;

      } catch (error) {
        console.error(`❌ Error processing row ${i}:`, error.message);
        errors.push({ row: i, error: error.message });
      }
    }

    // Summary
    console.log('\n📊 Import Summary:');
    console.log(`✅ Total rows processed: ${processedCount}`);
    console.log(`✅ Employees updated: ${updatedCount}`);
    console.log(`❌ Employees not found: ${notFoundCount}`);
    console.log(`❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(error => {
        console.log(`   Row ${error.row}: ${error.error}`);
      });
    }

    console.log('\n🎉 Employee allowances import completed successfully!');

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

// Run the import
if (require.main === module) {
  importEmployeeAllowancesFromExcel();
}

module.exports = importEmployeeAllowancesFromExcel; 