const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
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

// Restructure employee salary system
const restructureEmployeeSalary = async () => {
  try {
    console.log('🔄 Starting salary system restructuring...');
    
    // Get all employees
    const employees = await Employee.find({});
    console.log(`👥 Found ${employees.length} employees to restructure`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const employee of employees) {
      try {
        if (!employee.salary?.gross || employee.salary.gross <= 0) {
          console.log(`⚠️  Employee ${employee.employeeId} has no gross salary, skipping...`);
          continue;
        }
        
        const currentGrossSalary = employee.salary.gross;
        
        // Calculate new salary structure
        const basicSalary = Math.round(currentGrossSalary * 0.6666); // 66.66%
        const medicalAllowance = Math.round(currentGrossSalary * 0.10); // 10%
        const houseRentAllowance = Math.round(currentGrossSalary * 0.2334); // 23.34%
        
        // Update employee salary structure
        employee.salary.basic = basicSalary;
        
        // Update allowances structure
        employee.allowances = employee.allowances || {};
        employee.allowances.medical = {
          isActive: true,
          amount: medicalAllowance
        };
        employee.allowances.houseRent = {
          isActive: true,
          amount: houseRentAllowance
        };
        
        // Keep existing allowances but ensure they're properly structured
        if (!employee.allowances.conveyance) {
          employee.allowances.conveyance = { isActive: false, amount: 0 };
        }
        if (!employee.allowances.food) {
          employee.allowances.food = { isActive: false, amount: 0 };
        }
        if (!employee.allowances.vehicleFuel) {
          employee.allowances.vehicleFuel = { isActive: false, amount: 0 };
        }
        if (!employee.allowances.special) {
          employee.allowances.special = { isActive: false, amount: 0 };
        }
        if (!employee.allowances.other) {
          employee.allowances.other = { isActive: false, amount: 0 };
        }
        
        await employee.save();
        
        console.log(`✅ Employee ${employee.employeeId}: Basic=${basicSalary}, Medical=${medicalAllowance}, HouseRent=${houseRentAllowance}`);
        updatedCount++;
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error updating Employee ${employee.employeeId}:`, error.message);
      }
    }
    
    console.log(`\n📊 Employee Salary Restructuring Summary:`);
    console.log(`   ✅ Successfully updated: ${updatedCount} employees`);
    console.log(`   ❌ Errors: ${errorCount} employees`);
    
  } catch (error) {
    console.error('❌ Error restructuring employee salaries:', error);
  }
};

// Restructure payroll system
const restructurePayrollSystem = async () => {
  try {
    console.log('\n🔄 Starting payroll system restructuring...');
    
    // Get all payrolls
    const payrolls = await Payroll.find({});
    console.log(`📊 Found ${payrolls.length} payrolls to restructure`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const payroll of payrolls) {
      try {
        if (!payroll.grossSalary || payroll.grossSalary <= 0) {
          console.log(`⚠️  Payroll ${payroll._id} has no gross salary, skipping...`);
          continue;
        }
        
        const currentGrossSalary = payroll.grossSalary;
        
        // Calculate new salary structure
        const basicSalary = Math.round(currentGrossSalary * 0.6666); // 66.66%
        const medicalAllowance = Math.round(currentGrossSalary * 0.10); // 10%
        const houseRentAllowance = Math.round(currentGrossSalary * 0.2334); // 23.34%
        
        // Calculate total allowances (including existing ones)
        const existingAllowances = payroll.allowances || {};
        const totalAdditionalAllowances = 
          (existingAllowances.conveyance?.isActive ? existingAllowances.conveyance.amount : 0) +
          (existingAllowances.food?.isActive ? existingAllowances.food.amount : 0) +
          (existingAllowances.vehicleFuel?.isActive ? existingAllowances.vehicleFuel.amount : 0) +
          (existingAllowances.special?.isActive ? existingAllowances.special.amount : 0) +
          (existingAllowances.other?.isActive ? existingAllowances.other.amount : 0);
        
        // Total Earnings = Gross Salary + Additional Allowances
        const totalEarnings = currentGrossSalary + totalAdditionalAllowances;
        
        // Taxable Income = Total Earnings - Medical Allowance (10% tax-free)
        const taxableIncome = totalEarnings - medicalAllowance;
        
        // Calculate tax based on taxable income
        const calculatedTax = calculateTax(taxableIncome);
        
        // Update payroll structure
        payroll.basicSalary = basicSalary;
        
        // Update allowances structure
        payroll.allowances = {
          medical: {
            isActive: true,
            amount: medicalAllowance
          },
          houseRent: {
            isActive: true,
            amount: houseRentAllowance
          },
          conveyance: existingAllowances.conveyance || { isActive: false, amount: 0 },
          food: existingAllowances.food || { isActive: false, amount: 0 },
          vehicleFuel: existingAllowances.vehicleFuel || { isActive: false, amount: 0 },
          special: existingAllowances.special || { isActive: false, amount: 0 },
          other: existingAllowances.other || { isActive: false, amount: 0 }
        };
        
        // Update calculated fields
        payroll.grossSalary = currentGrossSalary; // Keep original gross
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
        
        console.log(`✅ Payroll ${payroll._id}: Basic=${basicSalary}, Medical=${medicalAllowance}, HouseRent=${houseRentAllowance}, Tax=${calculatedTax}, Net=${payroll.netSalary}`);
        updatedCount++;
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error updating Payroll ${payroll._id}:`, error.message);
      }
    }
    
    console.log(`\n📊 Payroll Restructuring Summary:`);
    console.log(`   ✅ Successfully updated: ${updatedCount} payrolls`);
    console.log(`   ❌ Errors: ${errorCount} payrolls`);
    
  } catch (error) {
    console.error('❌ Error restructuring payrolls:', error);
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    
    console.log('🚀 Starting complete salary system restructuring...\n');
    
    // Step 1: Restructure employee salaries
    await restructureEmployeeSalary();
    
    // Step 2: Restructure payrolls
    await restructurePayrollSystem();
    
    console.log('\n🎉 Salary system restructuring completed successfully!');
    console.log('\n📋 New Salary Structure:');
    console.log('   • Basic Salary: 66.66% of Gross Salary');
    console.log('   • Medical Allowance: 10% of Gross Salary (Tax-free)');
    console.log('   • House Rent Allowance: 23.34% of Gross Salary');
    console.log('   • Total Earnings: Gross Salary + Additional Allowances');
    console.log('   • Taxable Income: Total Earnings - Medical Allowance');
    console.log('   • Tax: Calculated from Pakistan tax slabs');
    
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
