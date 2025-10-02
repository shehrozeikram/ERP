const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const StaffManagementService = require('../services/staffManagementService');

// Import models
require('../models/User');
require('../models/hr/StaffType');
require('../models/hr/GenericStaffAssignment');
require('../models/hr/Employee');
require('../models/hr/Location');
require('../models/hr/Department');
require('../models/hr/Vehicle');

const StaffType = mongoose.model('StaffType');
const GenericStaffAssignment = mongoose.model('GenericStaffAssignment');
const Employee = mongoose.model('Employee');

async function demonstrateStaffManagement() {
  try {
    console.log('🎪 Starting Staff Management System Demonstration...\n');

    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // 1. Get all staff types
    console.log('📋 1. FETCHING STAFF TYPES');
    console.log('================================');
    const staffTypes = await StaffManagementService.getStaffTypes({ populateTargets: true });
    
    console.log(`Found ${staffTypes.length} staff types:\n`);
    staffTypes.forEach(st => {
      console.log(`  🔷 ${st.name} (${st.code})`);
      console.log(`     📅 Default Shift: ${st.defaultShift.startTime}-${st.defaultShift.endTime}`);
      console.log(`     🎯 Assignment Targets: ${st.assignmentTargets.length}`);
      st.assignmentTargets.forEach(target => {
        console.log(`       • ${target.label}: ${target.type} (${target.required ? 'Required' : 'Optional'})`);
      });
      console.log('');
    });

    // 2. Demonstrate assignment target fetching
    console.log('🎯 2. FETCHING ASSIGNMENT TARGETS');
    console.log('================================');
    const driverType = staffTypes.find(st => st.code === 'DRIVER');
    
    if (driverType) {
      const targets = await StaffManagementService.getAssignmentTargets(driverType._id);
      console.log(`Assignment targets for ${driverType.name}:\n`);
      Object.entries(targets).forEach(([type, targetList]) => {
        console.log(`  📍 ${type.toUpperCase()}:`);
        targetList.slice(0, 3).forEach(target => {
          if (type === 'vehicle') {
            console.log(`     • ${target.make} ${target.model} (${target.licensePlate})`);
          } else if (type === 'location') {
            console.log(`     • ${target.name} (${target.type})`);
          } else {
            console.log(`     • ${target.name || 'Unnamed'}`);
          }
        });
        if (targetList.length > 3) {
          console.log(`     ... and ${targetList.length - 3} more`);
        }
        console.log('');
      });
    }

    // 3. Get dashboard data
    console.log('📊 3. FETCHING DASHBOARD DATA');
    console.log('===============================');
    const dashboardData = await StaffManagementService.getDashboardData();
    
    console.log('Dashboard Overview:');
    console.log(`  📊 Total Assignments: ${dashboardData.overview.totalAssignments}`);
    console.log(`  ✅ Active Assignments: ${dashboardData.overview.activeAssignments}`);
    console.log(`  👥 Staff Types Available: ${dashboardData.overview.staffTypesCount}`);
    console.log(`  📈 Completion Rate: ${dashboardData.overview.completionRate}%\n`);
    
    console.log('Assignments by Type:');
    dashboardData.assignmentsByType.forEach(item => {
      console.log(`  🏷️  ${item.staffType}: ${item.count} assignments`);
    });
    console.log('');

    // 4. Demonstrate assignment creation (without actually creating)
    console.log('🛠️  4. ASSIGNMENT VALIDATION DEMO');
    console.log('==================================');
    
    const sampleAssignment = {
      title: 'Sample Driver Assignment',
      description: 'Demonstration assignment for driver',
      startDate: new Date(),
      targets: [
        {
          type: 'vehicle',
          targetId: '507f1f77bcf86cd799439011', // Sample ObjectId
          label: 'Sample Vehicle'
        },
        {
          type: 'location',
          targetId: '507f1f77bcf86cd799439012', // Sample ObjectId
          label: 'Sample Location'
        }
      ],
      schedule: {
        shiftTimings: {
          startTime: '08:00',
          endTime: '18:00',
          hoursPerDay: 10
        },
        workArrangement: 'Full-time',
        locationRequirement: 'On-site'
      },
      responsibilities: [
        { title: 'Safe Vehicle Operation', description: 'Drive safely and follow traffic rules', priority: 'High' },
        { title: 'Route Management', description: 'Follow assigned routes efficiently', priority: 'Medium' }
      ]
    };

    console.log('Sample Assignment Structure:');
    console.log(`  📝 Title: ${sampleAssignment.title}`);
    console.log(`  📋 Description: ${sampleAssignment.description}`);
    console.log(`  🎯 Targets: ${sampleAssignment.targets.length}`);
    sampleAssignment.targets.forEach(target => {
      console.log(`     • ${target.label} (${target.type})`);
    });
    console.log(`  🕒 Schedule: ${sampleAssignment.schedule.shiftTimings.startTime}-${sampleAssignment.schedule.shiftTimings.endTime}`);
    console.log(`  📋 Responsibilities: ${sampleAssignment.responsibilities.length}`);
    console.log('');

    // 5. Demonstrate search functionality
    console.log('🔍 5. SEARCH FUNCTIONALITY DEMO');
    console.log('===============================');
    
    const searchResults = await StaffManagementService.searchAssignments('driver', {});
    console.log(`Found ${searchResults.length} assignments matching 'driver'`);
    
    if (searchResults.length > 0) {
      searchResults.slice(0, 2).forEach(assignment => {
        console.log(`  📄 ${assignment.title}`);
        console.log(`     👤 Employee: ${assignment.employee?.firstName} ${assignment.employee?.lastName}`);
        console.log(`     🏷️  Staff Type: ${assignment.staffType?.name}`);
        console.log(`     📅 Status: ${assignment.status}`);
        console.log('');
      });
    } else {
      console.log('  No assignments found matching search criteria');
    }

    console.log('✨ STAFF MANAGEMENT SYSTEM DEMONSTRATION COMPLETED! ✨');
    console.log('\n🎯 Key Features Demonstrated:');
    console.log('  ✅ Flexible Staff Type Management');
    console.log('  ✅ Dynamic Assignment Target Configuration');
    console.log('  ✅ Comprehensive Dashboard Analytics');
    console.log('  ✅ Assignment Validation System');
    console.log('  ✅ Advanced Search Capabilities');
    console.log('  ✅ Optimized Database Queries');
    console.log('  ✅ Reusable Service Architecture');

  } catch (error) {
    console.error('❌ Error in demonstration:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the demonstration if this script is executed directly
if (require.main === module) {
  demonstrateStaffManagement()
    .then(() => {
      console.log('✨ Demonstration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Demonstration failed:', error);
      process.exit(1);
    });
}

module.exports = { demonstrateStaffManagement };
