const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Import models
const Employee = require('../models/hr/Employee');
const Payroll = require('../models/hr/Payroll');

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Read Excel file
const readExcelFile = () => {
  try {
    const filePath = path.join(__dirname, 'Master_File_July-2025.xlsx');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found at: ${filePath}`);
    }
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // First sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log(`📊 Excel file read successfully. Found ${data.length} rows`);
    
    return data;
  } catch (error) {
    console.error('❌ Error reading Excel file:', error);
    throw error;
  }
};

// Parse employee data from Excel row
const parseEmployeeData = (row) => {
  try {
    // Map Excel columns to our existing database structure
    // Based on the actual Excel file structure we examined
    const employeeData = {
      employeeId: row['__EMPTY'] || row['ID'], // Excel column: __EMPTY (contains ID like 3, 4, etc.)
      basicSalary: parseFloat(row['__EMPTY_14'] || 0), // Excel column: __EMPTY_14 (contains "Basic")
      conveyanceAllowance: parseFloat(row['__EMPTY_16'] || 0), // Excel column: __EMPTY_16 (contains "Covance Allowance")
      houseRentAllowance: parseFloat(row['__EMPTY_17'] || 0), // Excel column: __EMPTY_17 (contains "House Allowance")
      foodAllowance: parseFloat(row['__EMPTY_18'] || 0), // Excel column: __EMPTY_18 (contains "Food Allowance")
      vehicleFuelAllowance: parseFloat(row['__EMPTY_19'] || 0), // Excel column: __EMPTY_19 (contains "Vehicle & Fuel Allowance")
      medicalAllowance: parseFloat(row['__EMPTY_20'] || 0), // Excel column: __EMPTY_20 (contains "Medical Allowance")
      grossSalary: parseFloat(row['__EMPTY_21'] || 0), // Excel column: __EMPTY_21 (contains "Gross Salary")
      incomeTax: parseFloat(row['__EMPTY_22'] || 0), // Excel column: __EMPTY_22 (contains "Income Tax")
      companyLoan: parseFloat(row['__EMPTY_23'] || 0), // Excel column: __EMPTY_23 (contains "Company Loan")
      vehicleLoan: parseFloat(row['__EMPTY_24'] || 0), // Excel column: __EMPTY_24 (contains "Vehicle Loan")
      eobi: parseFloat(row['__EMPTY_25'] || 370), // Excel column: __EMPTY_25 (contains "EOBI Ded")
      netPayable: parseFloat(row['__EMPTY_26'] || 0), // Excel column: __EMPTY_26 (contains "Net Payable")
    };
    
    // Validate required fields
    if (!employeeData.employeeId || isNaN(employeeData.employeeId) || employeeData.employeeId <= 0) {
      console.warn('⚠️ Row missing or invalid Employee ID:', row);
      return null;
    }
    
    if (!employeeData.grossSalary || employeeData.grossSalary <= 0) {
      console.warn('⚠️ Row missing or invalid Gross Salary:', row);
      return null;
    }
    
    return employeeData;
  } catch (error) {
    console.error('❌ Error parsing row:', error, row);
    return null;
  }
};

// Update employee record
const updateEmployee = async (employeeData) => {
  try {
    const employee = await Employee.findOne({ employeeId: employeeData.employeeId.toString() });
    
    if (!employee) {
      console.warn(`⚠️ Employee not found with ID: ${employeeData.employeeId}`);
      return null;
    }
    
    // Update salary structure - keep existing structure, just update values
    const updatedSalary = {
      gross: employeeData.grossSalary,
      basic: employeeData.basicSalary, // Use Basic from Excel (not calculated)
    };
    
    // Update allowances structure - keep existing structure, just update values
    const updatedAllowances = {
      food: {
        isActive: employeeData.foodAllowance > 0,
        amount: employeeData.foodAllowance
      },
      vehicleFuel: {
        isActive: employeeData.vehicleFuelAllowance > 0,
        amount: employeeData.vehicleFuelAllowance
      },
      conveyance: {
        isActive: employeeData.conveyanceAllowance > 0,
        amount: employeeData.conveyanceAllowance
      },
      medical: {
        isActive: employeeData.medicalAllowance > 0,
        amount: employeeData.medicalAllowance
      },
      special: {
        isActive: employee.allowances?.special?.isActive || false, // Keep existing
        amount: employee.allowances?.special?.amount || 0 // Keep existing
      },
      other: {
        isActive: employee.allowances?.other?.isActive || false, // Keep existing
        amount: employee.allowances?.other?.amount || 0 // Keep existing
      }
    };
    
    // Update EOBI settings - keep existing structure, just update values
    const updatedEOBI = {
      isActive: true,
      amount: employeeData.eobi
    };
    
    // Update employee - keep existing structure, just update values
    const updatedEmployee = await Employee.findByIdAndUpdate(
      employee._id,
      {
        'salary.gross': updatedSalary.gross,
        'salary.basic': updatedSalary.basic,
        allowances: updatedAllowances,
        eobi: updatedEOBI
      },
      { new: true, runValidators: true }
    );
    
    console.log(`✅ Employee updated: ${updatedEmployee.firstName} ${updatedEmployee.lastName} (ID: ${updatedEmployee.employeeId})`);
    console.log(`   Basic Salary: ${updatedSalary.basic}`);
    console.log(`   Gross Salary: ${updatedSalary.gross}`);
    console.log(`   Food Allowance: ${employeeData.foodAllowance}`);
    console.log(`   Vehicle Allowance: ${employeeData.vehicleFuelAllowance}`);
    
    return updatedEmployee;
    
  } catch (error) {
    console.error(`❌ Error updating employee ${employeeData.employeeId}:`, error);
    return null;
  }
};

// Update payroll records
const updatePayrolls = async (employeeData, employee) => {
  try {
    // Find all payrolls for this employee
    const payrolls = await Payroll.find({ employee: employee._id });
    
    if (payrolls.length === 0) {
      console.log(`ℹ️ No payrolls found for employee ${employeeData.employeeId}`);
      return 0;
    }
    
    let updatedCount = 0;
    
    for (const payroll of payrolls) {
      // Update allowances - keep existing structure, just update values
      const updatedAllowances = {
        food: {
          isActive: employeeData.foodAllowance > 0,
          amount: employeeData.foodAllowance
        },
        vehicleFuel: {
          isActive: employeeData.vehicleFuelAllowance > 0,
          amount: employeeData.vehicleFuelAllowance
        },
        conveyance: {
          isActive: employeeData.conveyanceAllowance > 0,
          amount: employeeData.conveyanceAllowance
        },
        medical: {
          isActive: employeeData.medicalAllowance > 0,
          amount: employeeData.medicalAllowance
        },
        special: {
          isActive: payroll.allowances?.special?.isActive || false, // Keep existing
          amount: payroll.allowances?.special?.amount || 0 // Keep existing
        },
        other: {
          isActive: payroll.allowances?.other?.isActive || false, // Keep existing
          amount: payroll.allowances?.other?.amount || 0 // Keep existing
        }
      };
      
      // Update payroll - keep existing structure, just update values
      const updatedPayroll = await Payroll.findByIdAndUpdate(
        payroll._id,
        {
          basicSalary: employeeData.basicSalary, // Use Basic from Excel
          grossSalary: employeeData.grossSalary, // Use Gross from Excel
          allowances: updatedAllowances,
          eobi: employeeData.eobi, // Use EOBI from Excel
          netSalary: employeeData.netPayable, // Use Net Payable from Excel
          // Update other fields from Excel
          incomeTax: employeeData.incomeTax,
          companyLoanDeduction: employeeData.companyLoan,
          vehicleLoanDeduction: employeeData.vehicleLoan,
          // Recalculate total deductions excluding Provident Fund
          totalDeductions: employeeData.incomeTax + 
                          (payroll.healthInsurance || 0) + 
                          employeeData.vehicleLoan + 
                          employeeData.companyLoan + 
                          employeeData.eobi + 
                          (payroll.otherDeductions || 0)
        },
        { new: true, runValidators: true }
      );
      
      updatedCount++;
      console.log(`✅ Payroll updated: ${payroll.month}/${payroll.year} for ${employee.firstName} ${employee.lastName}`);
      console.log(`   Basic: ${employeeData.basicSalary}, Gross: ${employeeData.grossSalary}, Net: ${employeeData.netPayable}`);
    }
    
    return updatedCount;
    
  } catch (error) {
    console.error(`❌ Error updating payrolls for employee ${employeeData.employeeId}:`, error);
    return 0;
  }
};

// Main execution function
const main = async () => {
  try {
    console.log('🚀 Starting payroll update from Excel file...');
    
    // Connect to database
    await connectDB();
    
    // Read Excel file
    const excelData = readExcelFile();
    
    if (!excelData || excelData.length === 0) {
      console.log('❌ No data found in Excel file');
      return;
    }
    
    console.log(`📋 Processing ${excelData.length} employee records...`);
    
    let totalEmployeesUpdated = 0;
    let totalPayrollsUpdated = 0;
    let errors = 0;
    
    // Process each row
    for (const row of excelData) {
      try {
        // Skip header rows (rows 1 and 2 contain company info and column headers)
        if (row['Sardar Group of Companies'] && 
            typeof row['Sardar Group of Companies'] === 'string' &&
            (row['Sardar Group of Companies'].includes('Master File') || 
             row['Sardar Group of Companies'].includes('Sr No'))) {
          console.log(`⏭️ Skipping header row: ${row['Sardar Group of Companies']}`);
          continue;
        }
        
        // Skip total rows
        if (row['Sardar Group of Companies'] && 
            typeof row['Sardar Group of Companies'] === 'string' &&
            row['Sardar Group of Companies'].includes('Total')) {
          console.log(`⏭️ Skipping total row: ${row['Sardar Group of Companies']}`);
          continue;
        }
        
        // Parse employee data
        const employeeData = parseEmployeeData(row);
        
        if (!employeeData) {
          errors++;
          continue;
        }
        
        console.log(`\n📝 Processing Employee ID: ${employeeData.employeeId}`);
        console.log(`   Basic Salary: ${employeeData.basicSalary}`);
        console.log(`   Gross Salary: ${employeeData.grossSalary}`);
        console.log(`   Food Allowance: ${employeeData.foodAllowance}`);
        console.log(`   Vehicle Allowance: ${employeeData.vehicleFuelAllowance}`);
        console.log(`   EOBI: ${employeeData.eobi}`);
        console.log(`   Net Payable: ${employeeData.netPayable}`);
        
        // Update employee record
        const updatedEmployee = await updateEmployee(employeeData);
        
        if (updatedEmployee) {
          totalEmployeesUpdated++;
          
          // Update payrolls for this employee
          const payrollsUpdated = await updatePayrolls(employeeData, updatedEmployee);
          totalPayrollsUpdated += payrollsUpdated;
        } else {
          errors++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing row:`, error);
        errors++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 UPDATE SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Employees Updated: ${totalEmployeesUpdated}`);
    console.log(`✅ Payrolls Updated: ${totalPayrollsUpdated}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📋 Total Records Processed: ${excelData.length}`);
    console.log('='.repeat(50));
    
    if (errors === 0) {
      console.log('🎉 All updates completed successfully!');
    } else {
      console.log('⚠️ Some updates failed. Check the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, updateEmployee, updatePayrolls };
