const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const ApprovalLevelConfiguration = require('../models/hr/ApprovalLevelConfiguration');
const User = require('../models/User');
const Employee = require('../models/hr/Employee');

async function seedApprovalLevelConfig() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Find users by name (case-insensitive, handles trailing spaces)
    const findUserByName = async (firstName, lastName = null) => {
      // First try exact match
      let query = {
        firstName: { $regex: new RegExp(`^${firstName.trim()}$`, 'i') }
      };
      
      if (lastName) {
        const cleanLastName = lastName.trim();
        query.lastName = { $regex: new RegExp(`^${cleanLastName.replace(/\s+/g, '\\s*')}$`, 'i') };
      }
      
      let user = await User.findOne(query);
      
      // If not found, try partial match on firstName only
      if (!user && lastName) {
        user = await User.findOne({
          firstName: { $regex: new RegExp(`^${firstName.trim()}$`, 'i') },
          lastName: { $regex: new RegExp( lastName.trim().split(' ')[0], 'i') }
        });
      }
      
      // If still not found, try by email pattern
      if (!user && lastName) {
        const emailPattern = `${firstName.toLowerCase()}${lastName.toLowerCase().split(' ')[0]}`;
        user = await User.findOne({
          email: { $regex: new RegExp(emailPattern, 'i') }
        });
      }
      
      if (!user) {
        console.warn(`⚠️  User not found: ${firstName} ${lastName || ''}`);
      }
      return user;
    };

    // Find employees by user
    const findEmployeeByUser = async (userId) => {
      return await Employee.findOne({ user: userId });
    };

    // Approval level configurations for Evaluation & Appraisal
    const approvalLevels = [
      {
        module: 'evaluation_appraisal',
        level: 1,
        title: 'Assistant Vice President / CHRO SGC',
        firstName: 'Fahad Farid',
        lastName: '',
        role: 'higher_management',
        email: 'fahadfarid@tovus.net'
      },
      {
        module: 'evaluation_appraisal',
        level: 2,
        title: 'Chairman Steering Committee',
        firstName: 'Ahmad Tasnim',
        lastName: '',
        role: 'higher_management',
        email: 'ahmadtasnim@tovus.net'
      },
      {
        module: 'evaluation_appraisal',
        level: 3,
        title: 'CEO SGC',
        firstName: 'Sardar Umer Tanveer',
        lastName: '',
        role: 'super_admin',
        email: 'ceo@sgc.com' // Use email as fallback
      },
      {
        module: 'evaluation_appraisal',
        level: 4,
        title: 'President SGC',
        firstName: 'Sardar Tanveer Ilyas Khan',
        lastName: '',
        role: 'super_admin',
        email: 'sardartanveerilyaskhan@tovus.net'
      }
    ];

    console.log('\n📋 Setting up Approval Level Configuration for Evaluation & Appraisal...\n');

    for (const levelConfig of approvalLevels) {
      // Check if configuration already exists
      const existing = await ApprovalLevelConfiguration.findOne({
        module: levelConfig.module,
        level: levelConfig.level
      });

      if (existing) {
        console.log(`ℹ️  Level ${levelConfig.level} already configured: ${existing.title}`);
        console.log(`   Assigned User: ${existing.assignedUser}`);
        continue;
      }

      // Find user - try by email first if provided, then by name
      let user = null;
      if (levelConfig.email) {
        user = await User.findOne({ email: levelConfig.email });
      }
      
      if (!user) {
        user = await findUserByName(levelConfig.firstName, levelConfig.lastName);
      }
      
      if (!user) {
        console.error(`❌ Cannot create level ${levelConfig.level}: User "${levelConfig.firstName} ${levelConfig.lastName}" not found`);
        console.log(`   Please create the user first or update the script with correct name`);
        continue;
      }

      // Verify user role matches expected role
      if (user.role !== levelConfig.role) {
        console.warn(`⚠️  Warning: User "${user.firstName} ${user.lastName}" has role "${user.role}" but expected "${levelConfig.role}"`);
      }

      // Find employee record if exists
      const employee = await findEmployeeByUser(user._id);

      // Create configuration
      const config = new ApprovalLevelConfiguration({
        module: levelConfig.module,
        level: levelConfig.level,
        title: levelConfig.title,
        assignedUser: user._id,
        assignedEmployee: employee ? employee._id : null,
        isActive: true
      });

      await config.save();
      
      console.log(`✅ Level ${levelConfig.level} configured:`);
      console.log(`   Title: ${levelConfig.title}`);
      console.log(`   Assigned User: ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`   User Role: ${user.role}`);
      if (employee) {
        console.log(`   Employee ID: ${employee.employeeId}`);
      }
      console.log('');
    }

    // Display summary
    const allConfigs = await ApprovalLevelConfiguration.find({ module: 'evaluation_appraisal' })
      .populate('assignedUser', 'firstName lastName email role')
      .sort({ level: 1 });

    console.log('\n📊 Approval Level Configuration Summary:');
    console.log('==========================================');
    allConfigs.forEach(config => {
      const user = config.assignedUser;
      console.log(`Level ${config.level}: ${config.title}`);
      console.log(`  → ${user.firstName} ${user.lastName} (${user.email}) - ${user.role}`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding approval level configuration:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the seed function
if (require.main === module) {
  seedApprovalLevelConfig()
    .then(() => {
      console.log('\n🎉 Seed completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seed failed:', error);
      process.exit(1);
    });
}

module.exports = seedApprovalLevelConfig;

