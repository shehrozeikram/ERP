const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const Payroll = require('../models/hr/Payroll');

async function findPayrollForEmployee06382() {
  try {
    // Connect to cloud database
    const MONGODB_URI = 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority';
    await mongoose.connect(MONGODB_URI);
    
    console.log('🔍 Finding Payroll for Employee ID 06382:');
    console.log('=========================================');
    
    // First, find the employee
    const employee = await Employee.findOne({ 
      employeeId: '06382'
    });
    
    if (!employee) {
      console.log('❌ Employee with ID 06382 not found');
      return;
    }
    
    console.log(`✅ Employee Found:`);
    console.log(`   Name: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Employee ID: ${employee.employeeId}`);
    console.log(`   MongoDB ID: ${employee._id}`);
    console.log(`   Employment Status: ${employee.employmentStatus}`);
    
    // Now find all payrolls for this employee
    const payrolls = await Payroll.find({ 
      employee: employee._id 
    }).sort({ year: -1, month: -1 });
    
    console.log(`\n📊 Found ${payrolls.length} payroll(s) for this employee:`);
    console.log('==================================================');
    
    if (payrolls.length === 0) {
      console.log('❌ No payrolls found for this employee');
      console.log('\n💡 To create a payroll for this employee, you can:');
      console.log('   1. Use the Payroll Management page in the UI');
      console.log('   2. Generate payroll for a specific month/year');
      console.log('   3. The system will automatically copy allowances from employee to payroll');
    } else {
      payrolls.forEach((payroll, index) => {
        console.log(`\n📋 Payroll ${index + 1}:`);
        console.log(`   Payroll ID: ${payroll._id}`);
        console.log(`   Month/Year: ${payroll.month}/${payroll.year}`);
        console.log(`   Status: ${payroll.status}`);
        console.log(`   Basic Salary: Rs. ${payroll.basicSalary || 0}`);
        console.log(`   Gross Salary: Rs. ${payroll.grossSalary || 0}`);
        
        // Show allowances structure
        if (payroll.allowances) {
          console.log(`   \n   📊 Allowances Structure:`);
          console.log(`      Medical: Rs. ${payroll.allowances.medical?.amount || 0} (Active: ${payroll.allowances.medical?.isActive || false})`);
          console.log(`      House Rent: Rs. ${payroll.allowances.houseRent?.amount || 0} (Active: ${payroll.allowances.houseRent?.isActive || false})`);
          console.log(`      Conveyance: Rs. ${payroll.allowances.conveyance?.amount || 0} (Active: ${payroll.allowances.conveyance?.isActive || false})`);
          console.log(`      Food: Rs. ${payroll.allowances.food?.amount || 0} (Active: ${payroll.allowances.food?.isActive || false})`);
          console.log(`      Vehicle & Fuel: Rs. ${payroll.allowances.vehicleFuel?.amount || 0} (Active: ${payroll.allowances.vehicleFuel?.isActive || false})`);
          console.log(`      Special: Rs. ${payroll.allowances.special?.amount || 0} (Active: ${payroll.allowances.special?.isActive || false})`);
          console.log(`      Other: Rs. ${payroll.allowances.other?.amount || 0} (Active: ${payroll.allowances.other?.isActive || false})`);
        }
        
        // Show direct allowance fields
        console.log(`   \n   💰 Direct Allowance Fields:`);
        console.log(`      Medical Allowance: Rs. ${payroll.medicalAllowance || 0}`);
        console.log(`      House Rent Allowance: Rs. ${payroll.houseRentAllowance || 0}`);
      });
    }
    
    // Also show the employee's current allowances structure
    console.log(`\n👤 Employee's Current Allowances Structure:`);
    console.log('==========================================');
    if (employee.allowances) {
      console.log(`Medical: Rs. ${employee.allowances.medical?.amount || 0} (Active: ${employee.allowances.medical?.isActive || false})`);
      console.log(`House Rent: Rs. ${employee.allowances.houseRent?.amount || 0} (Active: ${employee.allowances.houseRent?.isActive || false})`);
      console.log(`Conveyance: Rs. ${employee.allowances.conveyance?.amount || 0} (Active: ${employee.allowances.conveyance?.isActive || false})`);
      console.log(`Food: Rs. ${employee.allowances.food?.amount || 0} (Active: ${employee.allowances.food?.isActive || false})`);
      console.log(`Vehicle & Fuel: Rs. ${employee.allowances.vehicleFuel?.amount || 0} (Active: ${employee.allowances.vehicleFuel?.isActive || false})`);
      console.log(`Special: Rs. ${employee.allowances.special?.amount || 0} (Active: ${employee.allowances.special?.isActive || false})`);
      console.log(`Other: Rs. ${employee.allowances.other?.amount || 0} (Active: ${employee.allowances.other?.isActive || false})`);
    }
    
    console.log(`\n📋 How to Find Payrolls in Database:`);
    console.log('====================================');
    console.log('1. In MongoDB Compass or any MongoDB client:');
    console.log('   - Database: sgc_erp');
    console.log('   - Collection: payrolls');
    console.log('   - Query: { "employee": ObjectId("' + employee._id + '") }');
    console.log('');
    console.log('2. Or search by employee ID:');
    console.log('   - First find employee: { "employeeId": "06382" }');
    console.log('   - Then find payrolls: { "employee": <employee._id> }');
    
    await mongoose.disconnect();
    console.log('\n✅ Search completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findPayrollForEmployee06382();
