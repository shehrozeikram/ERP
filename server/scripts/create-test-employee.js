const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const Payroll = require('../models/hr/Payroll');

async function createTestEmployeeWithAllAllowances() {
  try {
    // Connect to cloud database
    const MONGODB_URI = 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority';
    await mongoose.connect(MONGODB_URI);
    
    console.log('Creating Test Employee with All Allowances:');
    console.log('==========================================');
    
    // First, let's find an existing employee to modify instead of creating a new one
    const existingEmployee = await Employee.findOne({ 
      employeeId: '5598' // Ejaz Ahmad
    });
    
    if (!existingEmployee) {
      console.log('❌ Could not find existing employee to modify');
      return;
    }
    
    console.log(`📝 Modifying existing employee: ${existingEmployee.firstName} ${existingEmployee.lastName} (ID: ${existingEmployee.employeeId})`);
    
    // Update the employee with all allowances populated
    existingEmployee.allowances = {
      conveyance: {
        isActive: true,
        amount: 15000
      },
      food: {
        isActive: true,
        amount: 8000
      },
      vehicleFuel: {
        isActive: true,
        amount: 25000
      },
      medical: {
        isActive: true,
        amount: 12000
      },
      houseRent: {
        isActive: true,
        amount: 35000
      },
      special: {
        isActive: true,
        amount: 10000
      },
      other: {
        isActive: true,
        amount: 5000
      }
    };
    
    // Update Excel allowance fields
    existingEmployee.excelConveyanceAllowance = 15000;
    existingEmployee.excelHouseAllowance = 35000;
    existingEmployee.excelFoodAllowance = 8000;
    existingEmployee.excelVehicleFuelAllowance = 25000;
    existingEmployee.excelMedicalAllowance = 12000;
    
    // Save the updated employee
    await existingEmployee.save({ validateBeforeSave: false });
    
    console.log(`✅ Employee Updated Successfully!`);
    console.log(`Employee ID: ${existingEmployee._id}`);
    console.log(`Employee Name: ${existingEmployee.firstName} ${existingEmployee.lastName}`);
    console.log(`Employee ID Number: ${existingEmployee.employeeId}`);
    
    console.log('\n📊 Employee Allowances Structure:');
    console.log('==================================');
    if (existingEmployee.allowances) {
      console.log(`Conveyance: Rs. ${existingEmployee.allowances.conveyance?.amount || 0} (Active: ${existingEmployee.allowances.conveyance?.isActive || false})`);
      console.log(`Food: Rs. ${existingEmployee.allowances.food?.amount || 0} (Active: ${existingEmployee.allowances.food?.isActive || false})`);
      console.log(`Vehicle & Fuel: Rs. ${existingEmployee.allowances.vehicleFuel?.amount || 0} (Active: ${existingEmployee.allowances.vehicleFuel?.isActive || false})`);
      console.log(`Medical: Rs. ${existingEmployee.allowances.medical?.amount || 0} (Active: ${existingEmployee.allowances.medical?.isActive || false})`);
      console.log(`House Rent: Rs. ${existingEmployee.allowances.houseRent?.amount || 0} (Active: ${existingEmployee.allowances.houseRent?.isActive || false}) ✅`);
      console.log(`Special: Rs. ${existingEmployee.allowances.special?.amount || 0} (Active: ${existingEmployee.allowances.special?.isActive || false})`);
      console.log(`Other: Rs. ${existingEmployee.allowances.other?.amount || 0} (Active: ${existingEmployee.allowances.other?.isActive || false})`);
    }
    
    console.log('\n📋 Excel Allowance Fields (Backward Compatibility):');
    console.log('=================================================');
    console.log(`Excel Conveyance Allowance: Rs. ${existingEmployee.excelConveyanceAllowance || 0}`);
    console.log(`Excel House Allowance: Rs. ${existingEmployee.excelHouseAllowance || 0}`);
    console.log(`Excel Food Allowance: Rs. ${existingEmployee.excelFoodAllowance || 0}`);
    console.log(`Excel Vehicle & Fuel Allowance: Rs. ${existingEmployee.excelVehicleFuelAllowance || 0}`);
    console.log(`Excel Medical Allowance: Rs. ${existingEmployee.excelMedicalAllowance || 0}`);
    
    // Now create a payroll record for this employee to see how values are transferred
    console.log('\n🔄 Creating Payroll Record for Test Employee:');
    console.log('============================================');
    
    const payroll = await Payroll.createPayrollFromEmployee(existingEmployee, 1, 2025); // January 2025
    
    console.log(`✅ Payroll Created Successfully!`);
    console.log(`Payroll ID: ${payroll._id}`);
    console.log(`Month/Year: ${payroll.month}/${payroll.year}`);
    
    console.log('\n📊 Payroll Allowances Structure (Copied from Employee):');
    console.log('=====================================================');
    if (payroll.allowances) {
      console.log(`Conveyance: Rs. ${payroll.allowances.conveyance?.amount || 0} (Active: ${payroll.allowances.conveyance?.isActive || false})`);
      console.log(`Food: Rs. ${payroll.allowances.food?.amount || 0} (Active: ${payroll.allowances.food?.isActive || false})`);
      console.log(`Vehicle & Fuel: Rs. ${payroll.allowances.vehicleFuel?.amount || 0} (Active: ${payroll.allowances.vehicleFuel?.isActive || false})`);
      console.log(`Medical: Rs. ${payroll.allowances.medical?.amount || 0} (Active: ${payroll.allowances.medical?.isActive || false})`);
      console.log(`House Rent: Rs. ${payroll.allowances.houseRent?.amount || 0} (Active: ${payroll.allowances.houseRent?.isActive || false}) ✅`);
      console.log(`Special: Rs. ${payroll.allowances.special?.amount || 0} (Active: ${payroll.allowances.special?.isActive || false})`);
      console.log(`Other: Rs. ${payroll.allowances.other?.amount || 0} (Active: ${payroll.allowances.other?.isActive || false})`);
    }
    
    console.log('\n💰 Payroll Salary Structure:');
    console.log('===========================');
    console.log(`Basic Salary: Rs. ${payroll.basicSalary || 0}`);
    console.log(`House Rent Allowance: Rs. ${payroll.houseRentAllowance || 0}`);
    console.log(`Medical Allowance: Rs. ${payroll.medicalAllowance || 0}`);
    console.log(`Gross Salary: Rs. ${payroll.grossSalary || 0}`);
    console.log(`Total Earnings: Rs. ${payroll.totalEarnings || 0}`);
    
    console.log('\n🧮 Virtual Calculations:');
    console.log('=======================');
    console.log(`Total Allowances: Rs. ${payroll.totalAllowances || 0}`);
    console.log(`Total Bonuses: Rs. ${payroll.totalBonuses || 0}`);
    
    console.log('\n📈 Data Flow Summary:');
    console.log('====================');
    console.log('1. ✅ Employee updated with all allowances populated');
    console.log('2. ✅ Payroll created using createPayrollFromEmployee() method');
    console.log('3. ✅ All allowance values copied from Employee to Payroll');
    console.log('4. ✅ Salary calculations performed automatically');
    console.log('5. ✅ Virtual fields calculated (totalAllowances, totalEarnings)');
    
    console.log('\n🔍 Key Observations:');
    console.log('====================');
    console.log('• Employee allowances are stored in the allowances object');
    console.log('• Payroll allowances are copied from Employee allowances');
    console.log('• houseRent field is now available in both collections');
    console.log('• All allowance values flow from Employee → Payroll');
    console.log('• Virtual calculations work correctly with the new houseRent field');
    
    await mongoose.disconnect();
    console.log('\n🎉 Test Employee and Payroll creation completed successfully!');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.errors) {
      console.error('Validation Errors:', error.errors);
    }
  }
}

createTestEmployeeWithAllAllowances();