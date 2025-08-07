const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

// Import models
const Employee = require('../models/hr/Employee');

// Database connection
const { connectDB } = require('../config/database');

const updateProbationDates = async () => {
  try {
    console.log('🚀 Starting Probation Dates Update...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected successfully');

    // Find all employees with appointment date and probation period
    const employees = await Employee.find({
      appointmentDate: { $exists: true, $ne: null },
      probationPeriodMonths: { $exists: true, $ne: null }
    });

    console.log(`📊 Found ${employees.length} employees with appointment date and probation period`);

    let updatedCount = 0;
    let errors = [];

    for (const employee of employees) {
      try {
        console.log(`\n👤 Processing Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.employeeId})`);
        console.log(`   Appointment Date: ${employee.appointmentDate}`);
        console.log(`   Probation Period: ${employee.probationPeriodMonths} months`);

        // Calculate end of probation date
        const endOfProbationDate = new Date(employee.appointmentDate);
        endOfProbationDate.setMonth(endOfProbationDate.getMonth() + employee.probationPeriodMonths);
        
        // Confirmation date is the same as end of probation date
        const confirmationDate = new Date(endOfProbationDate);

        console.log(`   Calculated End of Probation: ${endOfProbationDate.toDateString()}`);
        console.log(`   Calculated Confirmation Date: ${confirmationDate.toDateString()}`);

        // Update employee
        await Employee.findByIdAndUpdate(employee._id, {
          endOfProbationDate: endOfProbationDate,
          confirmationDate: confirmationDate
        });

        console.log(`✅ Updated probation dates for ${employee.firstName} ${employee.lastName}`);
        updatedCount++;

      } catch (error) {
        console.error(`❌ Error processing employee ${employee.firstName} ${employee.lastName}:`, error.message);
        errors.push({ 
          employeeId: employee.employeeId, 
          name: `${employee.firstName} ${employee.lastName}`, 
          error: error.message 
        });
      }
    }

    // Summary
    console.log('\n📊 Update Summary:');
    console.log(`✅ Total employees processed: ${employees.length}`);
    console.log(`✅ Employees updated: ${updatedCount}`);
    console.log(`❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(error => {
        console.log(`   ${error.name} (${error.employeeId}): ${error.error}`);
      });
    }

    console.log('\n🎉 Probation dates update completed successfully!');

  } catch (error) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

// Run the update
if (require.main === module) {
  updateProbationDates();
}

module.exports = updateProbationDates; 