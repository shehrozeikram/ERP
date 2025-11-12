const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
require('dotenv').config();

const fixCloudLeaveBalance = async () => {
  try {
    console.log('🔧 Fixing Cloud Atlas Leave Balance Schema...');

    // Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Find all employees with problematic leave balance structure
    const employees = await Employee.find({
      $or: [
        { 'leaveBalance.annual': { $type: 'number' } },
        { 'leaveBalance.maternity': { $type: 'number' } },
        { 'leaveBalance.paternity': { $type: 'number' } },
        { 'leaveBalance.sick': { $exists: true } },
        { 'leaveBalance.personal': { $exists: true } }
      ]
    });

    console.log(`Found ${employees.length} employees with problematic leave balance structure`);

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
          console.log(`  - ${employee.firstName} ${employee.lastName}: Converting annual from ${annualValue} to object`);
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
          console.log(`  - ${employee.firstName} ${employee.lastName}: Converting maternity from ${maternityValue} to object`);
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
          console.log(`  - ${employee.firstName} ${employee.lastName}: Converting paternity from ${paternityValue} to object`);
        }

        // Remove extra fields (sick, personal)
        if (employee.leaveBalance.sick !== undefined) {
          updates['leaveBalance.sick'] = undefined; // Remove field
          needsUpdate = true;
          console.log(`  - ${employee.firstName} ${employee.lastName}: Removing 'sick' field`);
        }

        if (employee.leaveBalance.personal !== undefined) {
          updates['leaveBalance.personal'] = undefined; // Remove field
          needsUpdate = true;
          console.log(`  - ${employee.firstName} ${employee.lastName}: Removing 'personal' field`);
        }

        if (needsUpdate) {
          bulkOps.push({
            updateOne: {
              filter: { _id: employee._id },
              update: { $set: updates, $unset: { 'leaveBalance.sick': '', 'leaveBalance.personal': '' } }
            }
          });
        }
      }

      if (bulkOps.length > 0) {
        await Employee.bulkWrite(bulkOps);
        fixedCount += bulkOps.length;
        console.log(`✅ Fixed ${bulkOps.length} employees in batch ${batchCount}`);
      }
    }

    console.log(`\n🎉 Leave balance schema fix completed!`);
    console.log(`Total employees fixed: ${fixedCount}`);

    // Verify the fix
    const remainingIssues = await Employee.countDocuments({
      $or: [
        { 'leaveBalance.annual': { $type: 'number' } },
        { 'leaveBalance.maternity': { $type: 'number' } },
        { 'leaveBalance.paternity': { $type: 'number' } },
        { 'leaveBalance.sick': { $exists: true } },
        { 'leaveBalance.personal': { $exists: true } }
      ]
    });

    console.log(`Remaining employees with schema issues: ${remainingIssues}`);

    if (remainingIssues === 0) {
      console.log('✅ All leave balance schema issues have been resolved!');
    }

  } catch (error) {
    console.error('❌ Error fixing leave balance schema:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
};

fixCloudLeaveBalance();
