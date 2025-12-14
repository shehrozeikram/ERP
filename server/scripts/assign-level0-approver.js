const mongoose = require('mongoose');
require('dotenv').config();

const Employee = require('../models/hr/Employee');
const User = require('../models/User');
const ApprovalLevelConfiguration = require('../models/hr/ApprovalLevelConfiguration');

const EMPLOYEE_ID = '05834'; // Matthys Izak Cronje

async function assignLevel0Approver() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Find employee by employeeId
    console.log(`\n🔍 Searching for employee with ID: ${EMPLOYEE_ID}`);
    const employee = await Employee.findOne({ employeeId: EMPLOYEE_ID })
      .populate('user', 'firstName lastName email employeeId');

    if (!employee) {
      console.error(`❌ Employee with ID ${EMPLOYEE_ID} not found`);
      console.log('\n💡 Trying alternative search...');
      
      // Try without leading zero
      const altEmployeeId = EMPLOYEE_ID.replace(/^0+/, '');
      const altEmployee = await Employee.findOne({ employeeId: altEmployeeId })
        .populate('user', 'firstName lastName email employeeId');
      
      if (!altEmployee) {
        console.error(`❌ Employee with ID ${altEmployeeId} also not found`);
        process.exit(1);
      }
      
      console.log(`✅ Found employee with ID: ${altEmployeeId}`);
      return await processEmployee(altEmployee);
    }

    console.log(`✅ Found employee: ${employee.firstName} ${employee.lastName}`);
    await processEmployee(employee);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

async function processEmployee(employee) {
  try {
    console.log(`\n📋 Employee Details:`);
    console.log(`   Name: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Employee ID: ${employee.employeeId}`);
    console.log(`   Email: ${employee.email || 'N/A'}`);
    
    // Find or get user
    let user = employee.user;
    
    if (!user && employee.email) {
      console.log(`\n🔍 Searching for user by email: ${employee.email}`);
      user = await User.findOne({ email: employee.email.toLowerCase() });
    }
    
    if (!user && employee.employeeId) {
      console.log(`\n🔍 Searching for user by employeeId: ${employee.employeeId}`);
      user = await User.findOne({ employeeId: employee.employeeId });
    }
    
    if (!user) {
      console.error(`\n❌ No user account found for employee ${employee.firstName} ${employee.lastName}`);
      console.log(`\n💡 Please create a user account for this employee first.`);
      console.log(`   Employee ID: ${employee.employeeId}`);
      console.log(`   Email: ${employee.email || 'N/A'}`);
      process.exit(1);
    }
    
    console.log(`\n✅ Found user account:`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   User ID: ${user._id}`);
    
    // Check if Level 0 configuration already exists
    const existingConfig = await ApprovalLevelConfiguration.findOne({
      module: 'evaluation_appraisal',
      level: 0,
      isActive: true
    }).populate('assignedUser', 'firstName lastName email');
    
    if (existingConfig) {
      console.log(`\n⚠️  Level 0 configuration already exists:`);
      if (existingConfig.assignedUser) {
        console.log(`   Current Approver: ${existingConfig.assignedUser.firstName} ${existingConfig.assignedUser.lastName}`);
      } else {
        console.log(`   Current Approver: None (null)`);
      }
      console.log(`   Title: ${existingConfig.title}`);
      
      // Update existing configuration
      existingConfig.assignedUser = user._id;
      existingConfig.assignedEmployee = employee._id;
      existingConfig.title = 'Department/Project Approver';
      existingConfig.isActive = true;
      existingConfig.updatedBy = user._id;
      
      await existingConfig.save();
      
      console.log(`\n✅ Updated Level 0 configuration:`);
      console.log(`   New Approver: ${employee.firstName} ${employee.lastName}`);
      console.log(`   Title: ${existingConfig.title}`);
    } else {
      // Create new Level 0 configuration
      const newConfig = new ApprovalLevelConfiguration({
        module: 'evaluation_appraisal',
        level: 0,
        title: 'Department/Project Approver',
        assignedUser: user._id,
        assignedEmployee: employee._id,
        isActive: true,
        createdBy: user._id,
        updatedBy: user._id
      });
      
      await newConfig.save();
      
      console.log(`\n✅ Created Level 0 configuration:`);
      console.log(`   Approver: ${employee.firstName} ${employee.lastName}`);
      console.log(`   Title: ${newConfig.title}`);
      console.log(`   Level: ${newConfig.level}`);
      console.log(`   Module: ${newConfig.module}`);
    }
    
    console.log(`\n🎉 Level 0 approver assignment completed successfully!`);
    console.log(`\n📝 Summary:`);
    console.log(`   Employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
    console.log(`   User: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`   Level: 0`);
    console.log(`   Module: evaluation_appraisal`);
    console.log(`   Title: Department/Project Approver`);
    
  } catch (error) {
    console.error('❌ Error processing employee:', error);
    throw error;
  }
}

// Run the script
assignLevel0Approver();


