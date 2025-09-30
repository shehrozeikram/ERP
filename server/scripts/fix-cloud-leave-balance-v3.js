const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
require('dotenv').config();

const fixCloudLeaveBalanceV3 = async () => {
  try {
    console.log('🔧 Fixing Cloud Atlas Leave Balance Schema (Version 3)...');

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

        // Helper function to check if a value is a number (even if stored as object)
        const isNumberValue = (value) => {
          return (typeof value === 'number') || 
                 (typeof value === 'object' && value !== null && value.constructor === Number);
        };

        // Helper function to check if object has proper structure
        const hasProperStructure = (value) => {
          return typeof value === 'object' && 
                 value !== null && 
                 value.allocated !== undefined && 
                 value.used !== undefined && 
                 value.remaining !== undefined;
        };

        // Check if annual needs fixing
        if (employee.leaveBalance.annual && 
            !hasProperStructure(employee.leaveBalance.annual)) {
          const annualValue = typeof employee.leaveBalance.annual === 'number' ? 
                             employee.leaveBalance.annual : 
                             employee.leaveBalance.annual.valueOf();
          
          updates['leaveBalance.annual'] = {
            allocated: annualValue,
            used: 0,
            remaining: annualValue,
            carriedForward: 0
          };
          needsUpdate = true;
          console.log(`  - ${employee.firstName} ${employee.lastName}: Converting annual from ${annualValue} to object`);
        }

        // Check if maternity needs fixing
        if (employee.leaveBalance.maternity && 
            !hasProperStructure(employee.leaveBalance.maternity)) {
          const maternityValue = typeof employee.leaveBalance.maternity === 'number' ? 
                                employee.leaveBalance.maternity : 
                                employee.leaveBalance.maternity.valueOf();
          
          updates['leaveBalance.maternity'] = {
            allocated: maternityValue,
            used: 0,
            remaining: maternityValue
          };
          needsUpdate = true;
          console.log(`  - ${employee.firstName} ${employee.lastName}: Converting maternity from ${maternityValue} to object`);
        }

        // Check if paternity needs fixing
        if (employee.leaveBalance.paternity && 
            !hasProperStructure(employee.leaveBalance.paternity)) {
          const paternityValue = typeof employee.leaveBalance.paternity === 'number' ? 
                                employee.leaveBalance.paternity : 
                                employee.leaveBalance.paternity.valueOf();
          
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
          needsUpdate = true;
          console.log(`  - ${employee.firstName} ${employee.lastName}: Removing 'sick' field`);
        }

        if (employee.leaveBalance.personal !== undefined) {
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
        } else {
          console.log(`  ❌ ${key}: ${typeof value} - ${JSON.stringify(value)}`);
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

fixCloudLeaveBalanceV3();
