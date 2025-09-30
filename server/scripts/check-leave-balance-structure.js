const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const checkLeaveBalanceStructure = async () => {
  try {
    console.log('🔍 Checking leave balance structure for all employees...');

    const employees = await Employee.find({ isActive: true }).limit(10);

    console.log(`Found ${employees.length} active employees`);

    for (const employee of employees) {
      console.log(`\nEmployee: ${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
      console.log('Leave Balance Structure:');
      
      if (!employee.leaveBalance) {
        console.log('  ❌ No leaveBalance field');
        continue;
      }

      const leaveTypes = ['annual', 'casual', 'medical', 'maternity', 'paternity'];
      
      for (const leaveType of leaveTypes) {
        const leaveData = employee.leaveBalance[leaveType];
        console.log(`  ${leaveType}:`, typeof leaveData, leaveData);
        
        if (typeof leaveData === 'number') {
          console.log(`    ⚠️  ${leaveType} is a number instead of object`);
        } else if (typeof leaveData === 'object' && leaveData !== null) {
          console.log(`    ✅ ${leaveType} has proper object structure`);
        } else {
          console.log(`    ❌ ${leaveType} is missing or invalid`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error checking leave balance structure:', error);
  } finally {
    mongoose.connection.close();
  }
};

checkLeaveBalanceStructure();
