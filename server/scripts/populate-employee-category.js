require('dotenv').config();
const mongoose = require('mongoose');

const Employee = require('../models/hr/Employee');
const Designation = require('../models/hr/Designation');
const { classifyDesignationCategory } = require('../utils/employeeCategoryHelper');

/**
 * Script to populate employeeCategory field for existing employees
 * based on their placementDesignation
 */

async function populateEmployeeCategory() {
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp';
  console.log('🚀 Connecting to database...');
  await mongoose.connect(dbUri);
  console.log('✅ Connected to database');

  try {
    // Find all employees with a designation
    const employees = await Employee.find({
      isDeleted: false,
      placementDesignation: { $ne: null }
    }).populate('placementDesignation', 'title level');

    console.log(`📋 Found ${employees.length} employees with designations`);

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const employee of employees) {
      try {
        if (!employee.placementDesignation) {
          skipped++;
          continue;
        }

        const designation = employee.placementDesignation;
        const category = classifyDesignationCategory(
          designation.title || '',
          designation.level || ''
        );

        // Only update if category is different or not set
        if (employee.employeeCategory !== category) {
          // Use direct update to avoid validation errors for other required fields
          await Employee.updateOne(
            { _id: employee._id },
            { $set: { employeeCategory: category } }
          );
          updated++;
          console.log(`✓ Updated ${employee.employeeId} (${employee.firstName} ${employee.lastName}): ${category}`);
        } else {
          skipped++;
        }
      } catch (error) {
        errors.push({
          employeeId: employee.employeeId,
          error: error.message
        });
        console.error(`✗ Error updating ${employee.employeeId}:`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(err => {
        console.log(`  - ${err.employeeId}: ${err.error}`);
      });
    }

    console.log('\n✅ Migration completed!');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the script
populateEmployeeCategory()
  .then(() => {
    console.log('✨ Script finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });

