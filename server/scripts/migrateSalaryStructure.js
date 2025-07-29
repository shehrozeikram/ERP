const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
require('dotenv').config();

const migrateSalaryStructure = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all employees
    const employees = await Employee.find({});
    console.log(`📊 Found ${employees.length} employees to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const employee of employees) {
      try {
        // Check if employee already has the new structure
        if (employee.salary?.gross) {
          console.log(`⏭️  Employee ${employee.employeeId} (${employee.firstName} ${employee.lastName}) already has new structure`);
          skippedCount++;
          continue;
        }

        // Calculate gross salary from old structure
        const oldBasic = employee.salary?.basic || 0;
        const oldHouseRent = employee.salary?.houseRent || 0;
        const oldMedical = employee.salary?.medical || 0;
        const oldConveyance = employee.salary?.conveyance || 0;
        const oldSpecial = employee.salary?.special || 0;
        const oldOther = employee.salary?.other || 0;

        const grossSalary = oldBasic + oldHouseRent + oldMedical + oldConveyance + oldSpecial + oldOther;

        if (grossSalary === 0) {
          console.log(`⚠️  Employee ${employee.employeeId} (${employee.firstName} ${employee.lastName}) has no salary data`);
          skippedCount++;
          continue;
        }

        // Update to new structure
        await Employee.findByIdAndUpdate(employee._id, {
          salary: {
            gross: grossSalary,
            basic: Math.round(grossSalary * 0.6),
            houseRent: Math.round(grossSalary * 0.3),
            medical: Math.round(grossSalary * 0.1)
          }
        });

        console.log(`✅ Migrated employee ${employee.employeeId} (${employee.firstName} ${employee.lastName}): ${grossSalary} PKR`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Error migrating employee ${employee.employeeId}:`, error.message);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`✅ Migrated: ${migratedCount} employees`);
    console.log(`⏭️  Skipped: ${skippedCount} employees`);
    console.log(`📊 Total: ${employees.length} employees`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run migration if called directly
if (require.main === module) {
  migrateSalaryStructure();
}

module.exports = migrateSalaryStructure; 