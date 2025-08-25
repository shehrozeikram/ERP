const mongoose = require('mongoose');
const { connectDB } = require('./config/database');
require('dotenv').config();
const Employee = require('./models/hr/Employee');
const Payroll = require('./models/hr/Payroll');

// Connect to database
const createAugustPayrolls = async () => {
  try {
    await connectDB();
    console.log('🔌 Connected to database');

    // Get all active employees
    const employees = await Employee.find({}).select('employeeId firstName lastName department position salary allowances');
    console.log(`📋 Found ${employees.length} employees`);

    if (employees.length === 0) {
      console.log('❌ No employees found');
      return;
    }

    // Create payrolls for August 2025
    const month = 8; // August
    const year = 2025;
    
    console.log(`\n📅 Creating payrolls for ${month}/${year} with NEW salary logic`);
    console.log('==============================================================');

    const results = [];
    
    for (const employee of employees) {
      try {
        // Check if payroll already exists
        const existingPayroll = await Payroll.findOne({
          employee: employee._id,
          month,
          year
        });

        if (existingPayroll) {
          console.log(`⚠️  Payroll already exists for ${employee.employeeId} - ${employee.firstName} ${employee.lastName}`);
          results.push({
            employeeId: employee.employeeId,
            name: `${employee.firstName} ${employee.lastName}`,
            status: 'Already exists',
            payrollId: existingPayroll._id
          });
          continue;
        }

        // Get employee salary structure
        const grossSalary = employee.salary?.gross || 0;
        
        if (grossSalary === 0) {
          console.log(`⚠️  No gross salary for ${employee.employeeId} - ${employee.firstName} ${employee.lastName}`);
          results.push({
            employeeId: employee.employeeId,
            name: `${employee.firstName} ${employee.lastName}`,
            status: 'No gross salary',
            error: 'Gross salary is 0'
          });
          continue;
        }

        // Calculate salary breakdown using NEW logic (66.66% basic, 10% medical, 23.34% house rent)
        const basicSalary = Math.round(grossSalary * 0.6666);
        const medicalAllowance = Math.round(grossSalary * 0.10);
        const houseRentAllowance = Math.round(grossSalary * 0.2334);

        console.log(`\n💰 Salary Breakdown for ${employee.employeeId} - ${employee.firstName} ${employee.lastName}:`);
        console.log(`   Gross Salary: ${grossSalary.toLocaleString()}`);
        console.log(`   Basic Salary (66.66%): ${basicSalary.toLocaleString()}`);
        console.log(`   Medical Allowance (10%): ${medicalAllowance.toLocaleString()}`);
        console.log(`   House Rent Allowance (23.34%): ${houseRentAllowance.toLocaleString()}`);

        // Get additional allowances from employee
        const employeeAllowances = employee.allowances || {};
        const additionalAllowances = 
          (employeeAllowances.conveyance?.isActive ? employeeAllowances.conveyance.amount : 0) +
          (employeeAllowances.food?.isActive ? employeeAllowances.food.amount : 0) +
          (employeeAllowances.vehicleFuel?.isActive ? employeeAllowances.vehicleFuel.amount : 0) +
          (employeeAllowances.special?.isActive ? employeeAllowances.special.amount : 0) +
          (employeeAllowances.other?.isActive ? employeeAllowances.other.amount : 0);

        // Calculate total earnings
        const totalEarnings = grossSalary + additionalAllowances;

        console.log(`   Additional Allowances: ${additionalAllowances.toLocaleString()}`);
        console.log(`   Total Earnings: ${totalEarnings.toLocaleString()}`);

        // Auto-calculate Provident Fund (8.34% of basic salary)
        const providentFund = Math.round((basicSalary * 8.34) / 100);

        // Create payroll data
        const payrollData = {
          employee: employee._id,
          month,
          year,
          basicSalary,
          medicalAllowance,
          houseRentAllowance,
          grossSalary, // This will trigger the new salary breakdown logic
          totalEarnings,
          allowances: {
            conveyance: {
              isActive: employeeAllowances.conveyance?.isActive || false,
              amount: employeeAllowances.conveyance?.isActive ? employeeAllowances.conveyance.amount : 0
            },
            food: {
              isActive: employeeAllowances.food?.isActive || false,
              amount: employeeAllowances.food?.isActive ? employeeAllowances.food.amount : 0
            },
            vehicleFuel: {
              isActive: employeeAllowances.vehicleFuel?.isActive || false,
              amount: employeeAllowances.vehicleFuel?.isActive ? employeeAllowances.vehicleFuel.amount : 0
            },
            special: {
              isActive: employeeAllowances.special?.isActive || false,
              amount: employeeAllowances.special?.isActive ? employeeAllowances.special.amount : 0
            },
            other: {
              isActive: employeeAllowances.other?.isActive || false,
              amount: employeeAllowances.other?.isActive ? employeeAllowances.other.amount : 0
            }
          },
          overtimeHours: 0,
          overtimeRate: 0,
          overtimeAmount: 0,
          performanceBonus: 0,
          otherBonus: 0,
          arrears: 0,
          providentFund,
          healthInsurance: 0,
          vehicleLoanDeduction: 0,
          companyLoanDeduction: 0,
          otherDeductions: 0,
          eobi: 370, // Fixed EOBI amount for Pakistan
          totalWorkingDays: 26,
          presentDays: 26,
          absentDays: 0,
          leaveDays: 0,
          currency: 'PKR',
          status: 'Draft',
          paymentMethod: 'Bank Transfer',
          remarks: 'Bulk created payroll for August 2025 with NEW salary logic',
          createdBy: '68ab0aa2f733c442d3863a24' // Using a placeholder ID
        };

        // Create and save payroll
        const payroll = new Payroll(payrollData);
        await payroll.save();

        console.log(`✅ Created payroll for ${employee.employeeId} - ${employee.firstName} ${employee.lastName}`);
        console.log(`   Tax: ${payroll.incomeTax?.toLocaleString() || 0}`);

        results.push({
          employeeId: employee.employeeId,
          name: `${employee.firstName} ${employee.lastName}`,
          status: 'Created',
          payrollId: payroll._id,
          grossSalary,
          basicSalary,
          medicalAllowance,
          houseRentAllowance,
          totalEarnings,
          incomeTax: payroll.incomeTax
        });

      } catch (error) {
        console.error(`❌ Error creating payroll for ${employee.employeeId}:`, error.message);
        results.push({
          employeeId: employee.employeeId,
          name: `${employee.firstName} ${employee.lastName}`,
          status: 'Error',
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log('==========');
    const created = results.filter(r => r.status === 'Created').length;
    const existing = results.filter(r => r.status === 'Already exists').length;
    const noSalary = results.filter(r => r.status === 'No gross salary').length;
    const errors = results.filter(r => r.status === 'Error').length;
    
    console.log(`✅ Created: ${created}`);
    console.log(`⚠️  Already exists: ${existing}`);
    console.log(`⚠️  No gross salary: ${noSalary}`);
    console.log(`❌ Errors: ${errors}`);

    // Show sample results
    console.log('\n📋 Sample Results:');
    results.slice(0, 5).forEach(result => {
      if (result.status === 'Created') {
        console.log(`   ${result.employeeId}: ${result.name} - Tax: ${result.incomeTax?.toLocaleString() || 0}`);
      }
    });

    return results;

  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
};

// Run the script
createAugustPayrolls();
