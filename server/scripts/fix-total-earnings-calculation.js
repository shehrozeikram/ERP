const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Import models
const Employee = require('../models/hr/Employee');
const Payroll = require('../models/hr/Payroll');

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

// Calculate tax based on taxable income (Pakistan tax slabs)
const calculateTax = (taxableIncome) => {
  let tax = 0;
  
  if (taxableIncome <= 600000) {
    tax = 0;
  } else if (taxableIncome <= 1200000) {
    tax = (taxableIncome - 600000) * 0.025;
  } else if (taxableIncome <= 2400000) {
    tax = 15000 + (taxableIncome - 1200000) * 0.125;
  } else if (taxableIncome <= 3600000) {
    tax = 165000 + (taxableIncome - 2400000) * 0.25;
  } else if (taxableIncome <= 6000000) {
    tax = 465000 + (taxableIncome - 3600000) * 0.325;
  } else if (taxableIncome <= 12000000) {
    tax = 1245000 + (taxableIncome - 6000000) * 0.35;
  } else {
    tax = 3345000 + (taxableIncome - 12000000) * 0.375;
  }
  
  return Math.round(tax);
};

// Fix Total Earnings calculation in payrolls
const fixTotalEarningsCalculation = async () => {
  try {
    console.log('🔄 Starting Total Earnings calculation fix...');
    
    // Get all payrolls
    const payrolls = await Payroll.find({});
    console.log(`📊 Found ${payrolls.length} payrolls to fix`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const payroll of payrolls) {
      try {
        if (!payroll.grossSalary || payroll.grossSalary <= 0) {
          console.log(`⚠️  Payroll ${payroll._id} has no gross salary, skipping...`);
          continue;
        }
        
        const grossSalary = payroll.grossSalary;
        
        // Calculate additional allowances (excluding medical and house rent which are part of gross)
        const additionalAllowances = 
          (payroll.allowances?.conveyance?.isActive ? payroll.allowances.conveyance.amount : 0) +
          (payroll.allowances?.food?.isActive ? payroll.allowances.food.amount : 0) +
          (payroll.allowances?.vehicleFuel?.isActive ? payroll.allowances.vehicleFuel.amount : 0) +
          (payroll.allowances?.special?.isActive ? payroll.allowances.special.amount : 0) +
          (payroll.allowances?.other?.isActive ? payroll.allowances.other.amount : 0);
        
        // Total Earnings = Gross Salary + Additional Allowances
        const totalEarnings = grossSalary + additionalAllowances;
        
        // Medical allowance is 10% of gross salary (tax-free)
        const medicalAllowance = Math.round(grossSalary * 0.10);
        
        // Taxable Income = Total Earnings - Medical Allowance
        const taxableIncome = totalEarnings - medicalAllowance;
        
        // Calculate tax based on taxable income
        const calculatedTax = calculateTax(taxableIncome);
        
        // Update payroll with correct calculations
        payroll.incomeTax = calculatedTax;
        
        // Recalculate net salary
        const totalDeductions = 
          calculatedTax +
          (payroll.providentFund || 0) +
          (payroll.vehicleLoanDeduction || 0) +
          (payroll.companyLoanDeduction || 0) +
          (payroll.healthInsurance || 0) +
          (payroll.otherDeductions || 0);
        
        payroll.totalDeductions = totalDeductions;
        payroll.netSalary = totalEarnings - totalDeductions;
        
        await payroll.save();
        
        console.log(`✅ Payroll ${payroll._id}: Gross=${grossSalary}, Additional=${additionalAllowances}, TotalEarnings=${totalEarnings}, Taxable=${taxableIncome}, Tax=${calculatedTax}, Net=${payroll.netSalary}`);
        updatedCount++;
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error updating Payroll ${payroll._id}:`, error.message);
      }
    }
    
    console.log(`\n📊 Total Earnings Fix Summary:`);
    console.log(`   ✅ Successfully updated: ${updatedCount} payrolls`);
    console.log(`   ❌ Errors: ${errorCount} payrolls`);
    
  } catch (error) {
    console.error('❌ Error fixing Total Earnings calculation:', error);
  }
};

// Update Employee model to include a virtual for Total Earnings
const updateEmployeeModel = async () => {
  try {
    console.log('\n🔄 Updating Employee model with Total Earnings calculation...');
    
    // Get all employees
    const employees = await Employee.find({});
    console.log(`👥 Found ${employees.length} employees to update`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const employee of employees) {
      try {
        if (!employee.salary?.gross || employee.salary.gross <= 0) {
          continue;
        }
        
        const grossSalary = employee.salary.gross;
        
        // Calculate additional allowances
        const additionalAllowances = 
          (employee.allowances?.conveyance?.isActive ? employee.allowances.conveyance.amount : 0) +
          (employee.allowances?.food?.isActive ? employee.allowances.food.amount : 0) +
          (employee.allowances?.vehicleFuel?.isActive ? employee.allowances.vehicleFuel.amount : 0) +
          (employee.allowances?.special?.isActive ? employee.allowances.special.amount : 0) +
          (employee.allowances?.other?.isActive ? employee.allowances.other.amount : 0);
        
        // Calculate Total Earnings
        const totalEarnings = grossSalary + additionalAllowances;
        
        // Store Total Earnings in employee record for easy access
        employee.totalEarnings = totalEarnings;
        
        await employee.save();
        
        console.log(`✅ Employee ${employee.employeeId}: Gross=${grossSalary}, Additional=${additionalAllowances}, TotalEarnings=${totalEarnings}`);
        updatedCount++;
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error updating Employee ${employee.employeeId}:`, error.message);
      }
    }
    
    console.log(`\n📊 Employee Total Earnings Update Summary:`);
    console.log(`   ✅ Successfully updated: ${updatedCount} employees`);
    console.log(`   ❌ Errors: ${errorCount} employees`);
    
  } catch (error) {
    console.error('❌ Error updating Employee model:', error);
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    
    console.log('🚀 Starting Total Earnings calculation fix...\n');
    
    // Step 1: Fix payroll Total Earnings calculation
    await fixTotalEarningsCalculation();
    
    // Step 2: Update Employee model with Total Earnings
    await updateEmployeeModel();
    
    console.log('\n🎉 Total Earnings calculation fix completed successfully!');
    console.log('\n📋 Corrected Calculation Flow:');
    console.log('   1. Gross Salary: Base amount');
    console.log('   2. Additional Allowances: Conveyance, Food, Vehicle, etc.');
    console.log('   3. Total Earnings: Gross Salary + Additional Allowances');
    console.log('   4. Taxable Income: Total Earnings - Medical Allowance (10%)');
    console.log('   5. Tax: Calculated from Pakistan tax slabs on Taxable Income');
    console.log('   6. Net Salary: Total Earnings - Total Deductions');
    
    console.log('\n💡 Example:');
    console.log('   • Gross Salary: Rs 380,000');
    console.log('   • Vehicle Allowance: Rs 35,000');
    console.log('   • Total Earnings: Rs 415,000 (380,000 + 35,000)');
    console.log('   • Medical Allowance: Rs 38,000 (10% of 380,000)');
    console.log('   • Taxable Income: Rs 377,000 (415,000 - 38,000)');
    console.log('   • Tax: Calculated on Rs 377,000');
    
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
