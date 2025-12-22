const mongoose = require('mongoose');
require('dotenv').config();

require('../models/User');
require('../models/hr/ApprovalLevelConfiguration');
require('../models/hr/Employee');
const User = mongoose.model('User');
const ApprovalLevelConfiguration = mongoose.model('ApprovalLevelConfiguration');
const Employee = mongoose.model('Employee');

async function addMubashirLevel1ReadOnly() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Find Mubashir Aziz
    const user = await User.findOne({ email: 'mubasher@tovus.net' })
      .select('_id firstName lastName email');

    if (!user) {
      console.log('❌ User not found: mubasher@tovus.net');
      await mongoose.connection.close();
      return;
    }

    console.log('👤 User Found:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.email}\n`);

    // Find employee record if exists
    const employee = await Employee.findOne({ user: user._id })
      .select('_id firstName lastName employeeId');

    // Check if Level 1 configuration already exists for this user
    const existingConfig = await ApprovalLevelConfiguration.findOne({
      module: 'evaluation_appraisal',
      level: 1,
      assignedUser: user._id
    });

    if (existingConfig) {
      console.log('⚠️  Level 1 configuration already exists for this user');
      console.log(`   Current readOnly: ${existingConfig.readOnly}`);
      
      if (existingConfig.readOnly) {
        console.log('✅ User already has read-only access at Level 1\n');
      } else {
        // Update to read-only
        existingConfig.readOnly = true;
        existingConfig.updatedBy = user._id;
        await existingConfig.save();
        console.log('✅ Updated existing configuration to read-only\n');
      }
    } else {
      // Create new read-only Level 1 configuration
      const newConfig = new ApprovalLevelConfiguration({
        module: 'evaluation_appraisal',
        level: 1,
        title: 'Level 1 Approval',
        assignedUser: user._id,
        assignedEmployee: employee ? employee._id : null,
        isActive: true,
        readOnly: true,
        createdBy: user._id
      });

      await newConfig.save();
      console.log('✅ Created new Level 1 read-only configuration for Mubashir Aziz\n');
    }

    // Verify the configuration
    const verifyConfig = await ApprovalLevelConfiguration.findOne({
      module: 'evaluation_appraisal',
      level: 1,
      assignedUser: user._id
    })
      .populate('assignedUser', 'firstName lastName email')
      .populate('assignedEmployee', 'firstName lastName employeeId');

    console.log('📋 Configuration Details:');
    console.log(`   Module: ${verifyConfig.module}`);
    console.log(`   Level: ${verifyConfig.level}`);
    console.log(`   Title: ${verifyConfig.title}`);
    console.log(`   User: ${verifyConfig.assignedUser.firstName} ${verifyConfig.assignedUser.lastName}`);
    console.log(`   Email: ${verifyConfig.assignedUser.email}`);
    if (verifyConfig.assignedEmployee) {
      console.log(`   Employee: ${verifyConfig.assignedEmployee.firstName} ${verifyConfig.assignedEmployee.lastName} (ID: ${verifyConfig.assignedEmployee.employeeId})`);
    }
    console.log(`   Read-Only: ${verifyConfig.readOnly ? '✅ YES' : '❌ NO'}`);
    console.log(`   Active: ${verifyConfig.isActive ? '✅ YES' : '❌ NO'}\n`);

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addMubashirLevel1ReadOnly();

