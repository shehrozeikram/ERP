/**
 * Test script to verify Academic Background, Professional Education, and Employment History
 * are being saved correctly for employee 06459
 */

const mongoose = require('mongoose');
require('dotenv').config();
const Employee = require('./server/models/hr/Employee');

async function testEmployee06459() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Find employee by employeeId
    console.log('🔍 Searching for employee with ID: 06459');
    const employee = await Employee.findOne({ employeeId: '06459' });

    if (!employee) {
      console.error('❌ Employee 06459 not found');
      console.log('\n💡 Available employees (sample):');
      const sample = await Employee.find({}).select('employeeId firstName lastName').limit(10);
      sample.forEach(emp => {
        console.log(`   - ${emp.employeeId}: ${emp.firstName} ${emp.lastName || ''}`);
      });
      process.exit(1);
    }

    console.log(`✅ Found employee: ${employee.firstName} ${employee.lastName || ''}`);
    console.log(`   MongoDB ID: ${employee._id}`);
    console.log(`   Employee ID: ${employee.employeeId}\n`);

    // Check current data
    console.log('📊 Current Data:');
    console.log(`   Academic Background: ${employee.academicBackground?.length || 0} records`);
    if (employee.academicBackground && employee.academicBackground.length > 0) {
      employee.academicBackground.forEach((bg, idx) => {
        console.log(`     [${idx + 1}] ${bg.degree || 'N/A'} - ${bg.institution || 'N/A'} (${bg.graduationYear || 'N/A'})`);
      });
    }

    console.log(`   Professional Education: ${employee.professionalEducation?.length || 0} records`);
    if (employee.professionalEducation && employee.professionalEducation.length > 0) {
      employee.professionalEducation.forEach((edu, idx) => {
        console.log(`     [${idx + 1}] ${edu.courseName || 'N/A'} - ${edu.institution || 'N/A'}`);
      });
    }

    console.log(`   Employment History: ${employee.employmentHistory?.length || 0} records`);
    if (employee.employmentHistory && employee.employmentHistory.length > 0) {
      employee.employmentHistory.forEach((emp, idx) => {
        console.log(`     [${idx + 1}] ${emp.companyName || 'N/A'} - ${emp.position || 'N/A'}`);
      });
    }

    console.log('\n✅ Test completed successfully');
    console.log('\n💡 To test saving:');
    console.log('   1. Open the employee form in the UI');
    console.log('   2. Add data to Academic Background, Professional Education, and Employment History sections');
    console.log('   3. Save the employee');
    console.log('   4. Run this script again to verify the data was saved');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the test
testEmployee06459();
