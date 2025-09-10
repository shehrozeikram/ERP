const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const Designation = require('../models/hr/Designation');
const Bank = require('../models/hr/Bank');
const City = require('../models/hr/City');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');
require('dotenv').config();

// Find or create reference data
const findOrCreateReference = async (Model, data, fieldName) => {
  if (!data || !data.trim()) return null;
  
  try {
    let item;
    
    // Special handling for different models
    if (Model.modelName === 'Designation') {
      item = await Model.findOne({ title: { $regex: new RegExp(data.trim(), 'i') } });
      if (!item) {
        const departmentId = await findOrCreateReference(Department, 'General', 'Department');
        // Generate a shorter code (max 10 characters)
        const shortCode = data.trim().toUpperCase().replace(/\s+/g, '_').substring(0, 10);
        item = new Model({ 
          title: data.trim(),
          department: departmentId,
          code: shortCode,
          level: 'Mid'
        });
        await item.save();
        console.log(`   ✅ Created new ${fieldName}: ${data.trim()}`);
      }
    } else if (Model.modelName === 'Department') {
      item = await Model.findOne({ name: { $regex: new RegExp(data.trim(), 'i') } });
      if (!item) {
        item = new Model({ 
          name: data.trim(),
          code: data.trim().toUpperCase().replace(/\s+/g, '_')
        });
        await item.save();
        console.log(`   ✅ Created new ${fieldName}: ${data.trim()}`);
      }
    } else {
      item = await Model.findOne({ name: { $regex: new RegExp(data.trim(), 'i') } });
      if (!item) {
        item = new Model({ name: data.trim() });
        await item.save();
        console.log(`   ✅ Created new ${fieldName}: ${data.trim()}`);
      }
    }
    
    return item._id;
  } catch (error) {
    console.log(`   ⚠️  Error with ${fieldName}: ${error.message}`);
    return null;
  }
};

const createTestEmployeeDirect = async () => {
  try {
    console.log('🚀 Creating test employee with ID 06035 (direct insertion)...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create test employee data
    const employeeData = {
      // Use the Excel ID as the Employee ID
      employeeId: '06035',
      firstName: 'Test',
      lastName: 'Employee',
      email: 'test.employee06035@sgc.com',
      phone: '+923000000000',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      idCard: '12345-1234567-1',
      nationality: 'Pakistani',
      religion: 'Islam',
      maritalStatus: 'Single',
      
      // Address Information
      address: {
        street: 'Test Street',
        city: await findOrCreateReference(City, 'Rawalpindi', 'City'),
        state: await findOrCreateReference(Province, 'Punjab', 'Province'),
        country: await findOrCreateReference(Country, 'Pakistan', 'Country')
      },
      
      // Emergency Contact
      emergencyContact: {
        name: 'Test Guardian',
        relationship: 'Guardian',
        phone: '+923000000000',
        email: null
      },
      
      // Employment Information
      appointmentDate: new Date(),
      department: await findOrCreateReference(Department, 'IT', 'Department'),
      position: await findOrCreateReference(Designation, 'Software Developer', 'Designation'),
      hireDate: new Date(),
      employmentType: 'Full-time',
      probationPeriodMonths: 3,
      employmentStatus: 'Active',
      
      // Salary Information
      salary: {
        gross: 50000,
        basic: 30000
      },
      currency: 'PKR',
      
      // Allowances
      allowances: {
        conveyance: {
          isActive: true,
          amount: 5000
        },
        food: {
          isActive: true,
          amount: 3000
        },
        vehicleFuel: {
          isActive: false,
          amount: 0
        },
        medical: {
          isActive: true,
          amount: 2000
        },
        special: {
          isActive: false,
          amount: 0
        },
        other: {
          isActive: false,
          amount: 0
        }
      },
      
      // Bank Information
      bankName: await findOrCreateReference(Bank, 'Allied Bank', 'Bank'),
      
      // Additional Information
      qualification: 'Bachelor of Computer Science',
      
      // Status
      isActive: true,
      isDeleted: false,
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert directly into the collection to bypass pre-save middleware
    const result = await Employee.collection.insertOne(employeeData);
    
    console.log(`✅ Test employee created successfully!`);
    console.log(`   MongoDB ID: ${result.insertedId}`);
    console.log(`   Employee ID: ${employeeData.employeeId}`);
    console.log(`   Name: ${employeeData.firstName} ${employeeData.lastName}`);
    console.log(`   Email: ${employeeData.email}`);
    
    // Verify the employee was created correctly
    const savedEmployee = await Employee.findOne({ employeeId: '06035' });
    if (savedEmployee) {
      console.log(`✅ Verification successful: Employee ${savedEmployee.employeeId} found in database`);
      console.log(`   Full name: ${savedEmployee.firstName} ${savedEmployee.lastName}`);
    } else {
      console.log(`❌ Verification failed: Employee not found`);
    }
    
  } catch (error) {
    console.error('❌ Error creating test employee:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
};

createTestEmployeeDirect();
