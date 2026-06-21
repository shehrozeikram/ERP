const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Employee = require('../server/models/hr/Employee');
const User = require('../server/models/User');

async function searchSameer() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local';
  console.log(`🔌 Connecting to: ${uri.replace(/:([^:@]+)@/, ':****@')}`);
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    // Find employee by name matching 'Sameer'
    const employees = await Employee.find({
      $or: [
        { firstName: /Sameer/i },
        { lastName: /Sameer/i }
      ]
    }).lean();

    console.log(`🔍 Found ${employees.length} employees matching 'Sameer':`);
    for (const emp of employees) {
      console.log(`\n👤 Employee: ${emp.firstName} ${emp.lastName}`);
      console.log(`   MongoDB _id: ${emp._id}`);
      console.log(`   Employee ID: ${emp.employeeId}`);
      console.log(`   Active: ${emp.isActive}, Deleted: ${emp.isDeleted}`);
      console.log(`   Email: ${emp.email}`);
      console.log(`   User Link (on Employee): ${emp.user}`);

      if (emp.user) {
        const user = await User.findById(emp.user).lean();
        if (user) {
          console.log(`   Linked User:`);
          console.log(`     _id: ${user._id}`);
          console.log(`     username: ${user.username}`);
          console.log(`     email: ${user.email}`);
          console.log(`     employeeId: ${user.employeeId}`);
          console.log(`     linkedEmployee: ${user.linkedEmployee}`);
        } else {
          console.log(`   Linked User with _id ${emp.user} NOT found in users collection!`);
        }
      }

      // Also search users by email/employeeId
      const usersByEmpId = await User.find({
        $or: [
          { employeeId: emp.employeeId },
          { linkedEmployee: emp._id }
        ]
      }).lean();
      if (usersByEmpId.length > 0) {
        console.log(`   Users linked to this Employee by ID/Link:`);
        usersByEmpId.forEach(u => {
          console.log(`     - User _id: ${u._id}, email: ${u.email}, employeeId: ${u.employeeId}, linkedEmployee: ${u.linkedEmployee}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Connection closed');
  }
}

searchSameer();
