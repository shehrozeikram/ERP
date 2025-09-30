const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
require('dotenv').config();

const debugEmployeeLeaveBalance = async () => {
  try {
    console.log('🔍 Debugging Employee Leave Balance Structure...');

    // Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Get a specific employee with problematic structure
    const employee = await Employee.findOne({
      $or: [
        { 'leaveBalance.annual': { $type: 'number' } },
        { 'leaveBalance.maternity': { $type: 'number' } },
        { 'leaveBalance.paternity': { $type: 'number' } }
      ]
    }).select('firstName lastName employeeId leaveBalance');

    if (!employee) {
      console.log('❌ No employee found with problematic structure');
      return;
    }

    console.log(`\n👤 Found employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
    console.log('Current leave balance structure:');
    console.log(JSON.stringify(employee.leaveBalance, null, 2));

    console.log('\n🔍 Field types:');
    Object.keys(employee.leaveBalance).forEach(key => {
      const value = employee.leaveBalance[key];
      console.log(`  ${key}: ${typeof value} - ${JSON.stringify(value)}`);
    });

    // Test the update
    console.log('\n🧪 Testing update...');
    
    const updates = {};
    let needsUpdate = false;

    // Fix annual leave balance
    if (typeof employee.leaveBalance.annual === 'number') {
      const annualValue = employee.leaveBalance.annual;
      updates['leaveBalance.annual'] = {
        allocated: annualValue,
        used: 0,
        remaining: annualValue,
        carriedForward: 0
      };
      needsUpdate = true;
      console.log(`  - Will convert annual from ${annualValue} to object`);
    }

    // Fix maternity leave balance
    if (typeof employee.leaveBalance.maternity === 'number') {
      const maternityValue = employee.leaveBalance.maternity;
      updates['leaveBalance.maternity'] = {
        allocated: maternityValue,
        used: 0,
        remaining: maternityValue
      };
      needsUpdate = true;
      console.log(`  - Will convert maternity from ${maternityValue} to object`);
    }

    // Fix paternity leave balance
    if (typeof employee.leaveBalance.paternity === 'number') {
      const paternityValue = employee.leaveBalance.paternity;
      updates['leaveBalance.paternity'] = {
        allocated: paternityValue,
        used: 0,
        remaining: paternityValue
      };
      needsUpdate = true;
      console.log(`  - Will convert paternity from ${paternityValue} to object`);
    }

    if (needsUpdate) {
      console.log('\n📝 Update object:');
      console.log(JSON.stringify(updates, null, 2));

      // Perform the update
      const result = await Employee.updateOne(
        { _id: employee._id },
        { $set: updates }
      );

      console.log(`\n✅ Update result: ${result.modifiedCount} document modified`);

      // Verify the update
      const updatedEmployee = await Employee.findById(employee._id).select('leaveBalance');
      console.log('\n🔄 Updated leave balance structure:');
      console.log(JSON.stringify(updatedEmployee.leaveBalance, null, 2));
    } else {
      console.log('❌ No update needed');
    }

  } catch (error) {
    console.error('❌ Error debugging leave balance:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
};

debugEmployeeLeaveBalance();
