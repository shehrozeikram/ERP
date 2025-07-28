const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Employee = require('../models/hr/Employee');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function updateExistingEmployeeIds() {
  try {
    console.log('\n🔄 Updating Existing Employee IDs...\n');

    // Find all employees with EMP prefix
    const employeesWithEmpPrefix = await Employee.find({
      employeeId: { $regex: /^EMP/ }
    });

    console.log(`📊 Found ${employeesWithEmpPrefix.length} employees with EMP prefix`);

    if (employeesWithEmpPrefix.length === 0) {
      console.log('✅ No employees with EMP prefix found. Database is already updated.');
      return;
    }

    console.log('\n📋 Current Employee IDs with EMP prefix:');
    employeesWithEmpPrefix.forEach(emp => {
      console.log(`   - ${emp.employeeId} (${emp.firstName} ${emp.lastName})`);
    });

    // Update each employee
    let updatedCount = 0;
    for (const employee of employeesWithEmpPrefix) {
      const oldId = employee.employeeId;
      const newId = oldId.replace('EMP', '');
      
      // Skip if the ID is already numeric
      if (oldId === newId) {
        console.log(`   ⏭️  Skipping ${oldId} - already numeric`);
        continue;
      }

      try {
        await Employee.findByIdAndUpdate(employee._id, {
          employeeId: newId
        });
        
        console.log(`   ✅ Updated: ${oldId} → ${newId}`);
        updatedCount++;
      } catch (error) {
        console.error(`   ❌ Error updating ${oldId}:`, error.message);
      }
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} employee IDs`);

    // Verify the updates
    console.log('\n🔍 Verifying updates...');
    const allEmployees = await Employee.find({}, { employeeId: 1, firstName: 1, lastName: 1 })
      .sort({ employeeId: 1 });

    console.log('\n📋 All Employee IDs after update:');
    allEmployees.forEach(emp => {
      console.log(`   - ${emp.employeeId} (${emp.firstName} ${emp.lastName})`);
    });

    // Check for any remaining EMP prefixes
    const remainingEmpPrefix = await Employee.find({
      employeeId: { $regex: /^EMP/ }
    });

    if (remainingEmpPrefix.length > 0) {
      console.log(`\n⚠️  Warning: ${remainingEmpPrefix.length} employees still have EMP prefix`);
      remainingEmpPrefix.forEach(emp => {
        console.log(`   - ${emp.employeeId} (${emp.firstName} ${emp.lastName})`);
      });
    } else {
      console.log('\n✅ All Employee IDs successfully updated - no EMP prefixes remaining');
    }

  } catch (error) {
    console.error('❌ Error during Employee ID update:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

updateExistingEmployeeIds(); 