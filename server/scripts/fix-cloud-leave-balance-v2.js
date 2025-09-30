const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
require('dotenv').config();

const fixCloudLeaveBalanceV2 = async () => {
  try {
    console.log('🔧 Fixing Cloud Atlas Leave Balance Schema (Version 2)...');

    // Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Find all employees - we'll check each one individually
    const employees = await Employee.find({}).select('firstName lastName employeeId leaveBalance');

    console.log(`Found ${employees.length} total employees`);

    let fixedCount = 0;
    let batchSize = 50;
    let batchCount = 0;

    for (let i = 0; i < employees.length; i += batchSize) {
      const batch = employees.slice(i, i + batchSize);
      batchCount++;
      
      console.log(`\n📦 Processing batch ${batchCount} (${batch.length} employees)...`);

      const bulkOps = [];

      for (const employee of batch) {
        const updates = {};
        let needsUpdate = false;

        // Check if annual is a number (not an object with allocated/used/remaining)
        if (employee.leaveBalance.annual && 
            typeof employee.leaveBalance.annual === 'number') {
          const annualValue = employee.leaveBalance.annual;
          updates['leaveBalance.annual'] = {
            allocated: annualValue,
            used: 0,
            remaining: annualValue,
            carriedForward: 0
          };
          needsUpdate = true;
          console.log(`  - ${employee.firstName} ${employee.lastName}: Converting annual from ${annualValue} to object`);
        }

        // Check if maternity is a number
        if (employee.leaveBalance.maternity && 
            typeof employee.leaveBalance.maternity === 'number') {
          const maternityValue = employee.leaveBalance.maternity;
          updates['leaveBalance.maternity'] = {
            allocated: maternityValue,
            used: 0,
            remaining: maternityValue
          };
          needsUpdate = true;
          console.log(`  - ${employee.firstName} ${employee.lastName}: Converting maternity from ${maternityValue} to object`);
        }

        // Check if paternity is a number
        if (employee.leaveBalance.paternity && 
            typeof employee.leaveBalance.paternity === 'number') {
          const paternityValue = employee.leaveBalance.paternity;
          updates['leaveBalance.paternity'] = {
            allocated: paternityValue,
            used: 0,
            remaining: paternityValue
          };
          needsUpdate = true;
          console.log(`  - ${employee.firstName} ${employee.lastName}: Converting paternity from ${paternityValue} to object`);
        }

        // Remove extra fields (sick, personal)
        if (employee.leaveBalance.sick !== undefined) {
          updates['leaveBalance.sick'] = undefined; // Will be removed by $unset
          needsUpdate = true;
          console.log(`  - ${employee.firstName} ${employee.lastName}: Removing 'sick' field`);
        }

        if (employee.leaveBalance.personal !== undefined) {
          updates['leaveBalance.personal'] = undefined; // Will be removed by $unset
          needsUpdate = true;
          console.log(`  - ${employee.firstName} ${employee.lastName}: Removing 'personal' field`);
        }

        if (needsUpdate) {
          // Prepare $unset fields
          const unsetFields = {};
          if (employee.leaveBalance.sick !== undefined) {
            unsetFields['leaveBalance.sick'] = '';
          }
          if (employee.leaveBalance.personal !== undefined) {
            unsetFields['leaveBalance.personal'] = '';
          }

          bulkOps.push({
            updateOne: {
              filter: { _id: employee._id },
              update: { 
                $set: updates,
                ...(Object.keys(unsetFields).length > 0 && { $unset: unsetFields })
              }
            }
          });
        }
      }

      if (bulkOps.length > 0) {
        const result = await Employee.bulkWrite(bulkOps);
        fixedCount += result.modifiedCount;
        console.log(`✅ Fixed ${result.modifiedCount} employees in batch ${batchCount}`);
      }
    }

    console.log(`\n🎉 Leave balance schema fix completed!`);
    console.log(`Total employees fixed: ${fixedCount}`);

    // Verify the fix by checking a few employees
    console.log('\n🔍 Verification - checking sample employees:');
    const sampleEmployees = await Employee.find({}).limit(5).select('firstName lastName employeeId leaveBalance');
    
    sampleEmployees.forEach(emp => {
      console.log(`\n${emp.firstName} ${emp.lastName} (${emp.employeeId}):`);
      Object.keys(emp.leaveBalance).forEach(key => {
        const value = emp.leaveBalance[key];
        if (typeof value === 'object' && value !== null && value.allocated !== undefined) {
          console.log(`  ✅ ${key}: Proper object structure`);
        } else if (typeof value === 'number') {
          console.log(`  ❌ ${key}: Still a number (${value})`);
        } else {
          console.log(`  ⚠️  ${key}: ${typeof value} - ${JSON.stringify(value)}`);
        }
      });
    });

  } catch (error) {
    console.error('❌ Error fixing leave balance schema:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
};

fixCloudLeaveBalanceV2();
