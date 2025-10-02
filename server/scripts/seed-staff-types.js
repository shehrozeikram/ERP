const mongoose = require('mongoose');
const { connectDB } = require('../config/database');

// Import models
require('../models/hr/StaffType');
const StaffType = mongoose.model('StaffType');

const defaultStaffTypes = [
  {
    code: 'DRIVER',
    name: 'Driver',
    description: 'Professional drivers assigned to vehicles and routes',
    icon: 'directions_car',
    color: '#1976d2',
    assignmentTargets: [
      {
        type: 'vehicle',
        label: 'Vehicle',
        model: 'Vehicle',
        required: true,
        priority: 1
      },
      {
        type: 'location',
        label: 'Route/Base Location',
        model: 'Location',
        required: true,
        priority: 2
      }
    ],
    defaultShift: {
      startTime: '08:00',
      endTime: '18:00',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      hoursPerDay: 10
    },
    requiredSkills: ['Valid Driver License', 'Safe Driving', 'Route Knowledge'],
    isSystemGenerated: true
  },
  {
    code: 'GUARD',
    name: 'Security Guard',
    description: 'Security personnel assigned to protect locations and premises',
    icon: 'security',
    color: '#d32f2f',
    assignmentTargets: [
      {
        type: 'location',
        label: 'Location/Post',
        model: 'Location',
        required: true,
        priority: 1
      }
    ],
    defaultShift: {
      startTime: '00:00',
      endTime: '23:59',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      hoursPerDay: 12
    },
    requiredSkills: ['Security Training', 'Physical Fitness', 'Alertness'],
    isSystemGenerated: true
  },
  {
    code: 'OFFICE_BOY',
    name: 'Office Boy',
    description: 'Support staff for office operations and maintenance',
    icon: 'person',
    color: '#f57c00',
    assignmentTargets: [
      {
        type: 'department',
        label: 'Department',
        model: 'Department',
        required: true,
        priority: 1
      },
      {
        type: 'location',
        label: 'Office Location',
        model: 'Location',
        required: true,
        priority: 2
      }
    ],
    defaultShift: {
      startTime: '09:00',
      endTime: '17:00',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      hoursPerDay: 8
    },
    requiredSkills: ['Communication', 'Basic Computer Skills', 'Office Equipment Handling'],
    isSystemGenerated: true
  },
  {
    code: 'MAINTENANCE',
    name: 'Maintenance Worker',
    description: 'Technical staff for facility and equipment maintenance',
    icon: 'build',
    color: '#388e3c',
    assignmentTargets: [
      {
        type: 'location',
        label: 'Facility/Location',
        model: 'Location',
        required: true,
        priority: 1
      },
      {
        type: 'project',
        label: 'Maintenance Project',
        model: 'Project',
        required: false,
        priority: 2
      }
    ],
    defaultShift: {
      startTime: '08:00',
      endTime: '16:00',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      hoursPerDay: 8
    },
    requiredSkills: ['Basic Technical Knowledge', 'Equipment Handling', 'Safety Procedures'],
    isSystemGenerated: true
  },
  {
    code: 'RECEPTIONIST',
    name: 'Receptionist',
    description: 'Front desk staff for customer service and office support',
    icon: 'recent_actors',
    color: '#7b1fa2',
    assignmentTargets: [
      {
        type: 'department',
        label: 'Department',
        model: 'Department',
        required: true,
        priority: 1
      },
      {
        type: 'location',
        label: 'Front Desk Location',
        model: 'Location',
        required: true,
        priority: 2
      }
    ],
    defaultShift: {
      startTime: '09:00',
      endTime: '17:00',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      hoursPerDay: 8
    },
    requiredSkills: ['Communication', 'Customer Service', 'Phone Etiquette', 'Basic Computer Skills'],
    isSystemGenerated: true
  },
  {
    code: 'TECHNICIAN',
    name: 'Technician',
    description: 'Technical specialists for project-based assignments',
    icon: 'settings',
    color: '#5d4037',
    assignmentTargets: [
      {
        type: 'project',
        label: 'Project',
        model: 'Project',
        required: true,
        priority: 1
      },
      {
        type: 'location',
        label: 'Work Site',
        model: 'Location',
        required: true,
        priority: 2
      }
    ],
    defaultShift: {
      startTime: '09:00',
      endTime: '18:00',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      hoursPerDay: 9
    },
    requiredSkills: ['Technical Expertise', 'Problem Solving', 'Equipment Knowledge'],
    isSystemGenerated: true
  },
  {
    code: 'ADMIN_STAFF',
    name: 'Administrative Staff',
    description: 'Administrative personnel for office management and clerical work',
    icon: 'admin_panel_settings',
    color: '#455a64',
    assignmentTargets: [
      {
        type: 'department',
        label: 'Department',
        model: 'Department',
        required: true,
        priority: 1
      }
    ],
    defaultShift: {
      startTime: '09:00',
      endTime: '17:00',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      hoursPerDay: 8
    },
    requiredSkills: ['Office Software', 'Communication', 'Organization', 'Documentation'],
    isSystemGenerated: true
  }
];

async function seedStaffTypes() {
  try {
    console.log('🌱 Starting staff types seeding...');

    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB');

    // Clear existing system-generated staff types
    await StaffType.deleteMany({ isSystemGenerated: true });
    console.log('🗑️  Cleared existing system-generated staff types');

    // Create admin user reference (you might want to use an actual admin user ID)
    const adminUserId = new mongoose.Types.ObjectId(); // Replace with actual admin user ID

    // Create staff types
    const createdStaffTypes = [];
    for (const staffTypeData of defaultStaffTypes) {
      const staffType = new StaffType({
        ...staffTypeData,
        createdBy: adminUserId,
        status: 'Active'
      });

      await staffType.save();
      createdStaffTypes.push(staffType);
      console.log(`✅ Created staff type: ${staffType.name} (${staffType.code})`);
    }

    console.log(`🎉 Successfully seeded ${createdStaffTypes.length} staff types`);
    
    // Display summary
    console.log('\n📊 Staff Types Summary:');
    createdStaffTypes.forEach(st => {
      console.log(`  • ${st.name} (${st.code}): ${st.assignmentTargets.length} assignment targets`);
    });

    return createdStaffTypes;
  } catch (error) {
    console.error('❌ Error seeding staff types:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the seeding if this script is executed directly
if (require.main === module) {
  seedStaffTypes()
    .then(() => {
      console.log('✨ Staff types seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed to seed staff types:', error);
      process.exit(1);
    });
}

module.exports = { seedStaffTypes, defaultStaffTypes };
