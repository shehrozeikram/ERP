const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('../server/models/User'); // Required by Employee schema
const Employee = require('../server/models/hr/Employee');
const User = require('../server/models/User');

async function removeEmployee() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
     console.error('No MONGODB_URI found.');
     process.exit(1);
  }
  
  console.log(`🔌 Connecting to MongoDB (URI hidden)`);
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    const employeeIdToRemove = '6279';
    
    // Find the employee
    const employee = await Employee.findOne({ employeeId: employeeIdToRemove });
    
    if (employee) {
      console.log(`Found Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.employeeId})`);
      
      // Delete the employee
      await Employee.deleteOne({ _id: employee._id });
      console.log(`✅ Deleted Employee ${employeeIdToRemove}`);

      // Check if there is a User associated with this employee
      const user = await User.findOne({ employee: employee._id });
      if (user) {
         await User.deleteOne({ _id: user._id });
         console.log(`✅ Deleted associated User for Employee ${employeeIdToRemove}`);
      } else {
         console.log(`ℹ️ No associated User found for Employee ${employeeIdToRemove}`);
      }
    } else {
      console.log(`❌ Employee ${employeeIdToRemove} not found.`);
    }

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Connection closed');
  }
}

removeEmployee();
