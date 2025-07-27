const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./server/models/User');
const Department = require('./server/models/hr/Department');

const setupDatabase = async () => {
  try {
    console.log('🚀 Starting SGC ERP System Setup...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await Department.deleteMany({});
    console.log('✅ Existing data cleared\n');

    // Create departments
    console.log('🏢 Creating departments...');
    const departments = [
      {
        name: 'Human Resources',
        code: 'HR',
        description: 'Human Resources Department',
        contactInfo: {
          phone: '+1-555-0101',
          email: 'hr@sgc.com'
        }
      },
      {
        name: 'Finance',
        code: 'FIN',
        description: 'Finance and Accounting Department',
        contactInfo: {
          phone: '+1-555-0102',
          email: 'finance@sgc.com'
        }
      },
      {
        name: 'Procurement',
        code: 'PROC',
        description: 'Procurement and Supply Chain Department',
        contactInfo: {
          phone: '+1-555-0103',
          email: 'procurement@sgc.com'
        }
      },
      {
        name: 'Sales',
        code: 'SALES',
        description: 'Sales and Marketing Department',
        contactInfo: {
          phone: '+1-555-0104',
          email: 'sales@sgc.com'
        }
      },
      {
        name: 'CRM',
        code: 'CRM',
        description: 'Customer Relationship Management Department',
        contactInfo: {
          phone: '+1-555-0105',
          email: 'crm@sgc.com'
        }
      },
      {
        name: 'Information Technology',
        code: 'IT',
        description: 'Information Technology Department',
        contactInfo: {
          phone: '+1-555-0106',
          email: 'it@sgc.com'
        }
      },
      {
        name: 'Operations',
        code: 'OPS',
        description: 'Operations Department',
        contactInfo: {
          phone: '+1-555-0107',
          email: 'operations@sgc.com'
        }
      }
    ];

    const createdDepartments = await Department.insertMany(departments);
    console.log(`✅ Created ${createdDepartments.length} departments\n`);

    // Create admin user
    console.log('👤 Creating admin user...');
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@sgc.com',
      password: 'admin123',
      role: 'admin',
      department: 'IT',
      position: 'System Administrator',
      employeeId: 'EMP001',
      phone: '+15550001',
      isActive: true,
      isEmailVerified: true,
      permissions: [
        {
          module: 'hr',
          actions: ['create', 'read', 'update', 'delete', 'approve']
        },
        {
          module: 'finance',
          actions: ['create', 'read', 'update', 'delete', 'approve']
        },
        {
          module: 'procurement',
          actions: ['create', 'read', 'update', 'delete', 'approve']
        },
        {
          module: 'sales',
          actions: ['create', 'read', 'update', 'delete', 'approve']
        },
        {
          module: 'crm',
          actions: ['create', 'read', 'update', 'delete', 'approve']
        }
      ]
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully\n');

    // Create sample users for each department
    console.log('👥 Creating sample users...');
    const sampleUsers = [
      {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@sgc.com',
        password: 'password123',
        role: 'hr_manager',
        department: 'HR',
        position: 'HR Manager',
        employeeId: 'EMP002',
        phone: '+15550002'
      },
      {
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@sgc.com',
        password: 'password123',
        role: 'finance_manager',
        department: 'Finance',
        position: 'Finance Manager',
        employeeId: 'EMP003',
        phone: '+15550003'
      },
      {
        firstName: 'Michael',
        lastName: 'Brown',
        email: 'michael.brown@sgc.com',
        password: 'password123',
        role: 'procurement_manager',
        department: 'Procurement',
        position: 'Procurement Manager',
        employeeId: 'EMP004',
        phone: '+15550004'
      },
      {
        firstName: 'Emily',
        lastName: 'Davis',
        email: 'emily.davis@sgc.com',
        password: 'password123',
        role: 'sales_manager',
        department: 'Sales',
        position: 'Sales Manager',
        employeeId: 'EMP005',
        phone: '+15550005'
      },
      {
        firstName: 'David',
        lastName: 'Wilson',
        email: 'david.wilson@sgc.com',
        password: 'password123',
        role: 'crm_manager',
        department: 'CRM',
        position: 'CRM Manager',
        employeeId: 'EMP006',
        phone: '+15550006'
      }
    ];

    for (const userData of sampleUsers) {
      const user = new User({
        ...userData,
        isActive: true,
        isEmailVerified: true,
        permissions: [
          {
            module: userData.role.split('_')[0],
            actions: ['create', 'read', 'update', 'delete', 'approve']
          }
        ]
      });
      await user.save();
    }
    console.log(`✅ Created ${sampleUsers.length} sample users\n`);

    console.log('🎉 Setup completed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('Admin: admin@sgc.com / admin123');
    console.log('HR Manager: john.smith@sgc.com / password123');
    console.log('Finance Manager: sarah.johnson@sgc.com / password123');
    console.log('Procurement Manager: michael.brown@sgc.com / password123');
    console.log('Sales Manager: emily.davis@sgc.com / password123');
    console.log('CRM Manager: david.wilson@sgc.com / password123');
    console.log('\n🚀 You can now start the application with: npm run dev');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
};

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase; 