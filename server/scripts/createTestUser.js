#!/usr/bin/env node

/**
 * Create Test User - Shehroze Ikram (1234)
 * 
 * This script creates a test user for real-time attendance testing
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Import models
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');

async function createTestUser() {
  try {
    console.log('🧪 Creating test user for Shehroze Ikram...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Check if user already exists
    let existingEmployee = await Employee.findOne({ 
      employeeId: '1234',
      isDeleted: false 
    });
    
    if (existingEmployee) {
      console.log('⚠️ Test user already exists:', existingEmployee.firstName, existingEmployee.lastName);
      console.log('🔄 Updating existing user...');
      
      // Update existing user
      existingEmployee.firstName = 'Shehroze';
      existingEmployee.lastName = 'Ikram';
      existingEmployee.email = 'shehroze.ikram@test.com';
      existingEmployee.phone = '+92-300-1234567';
      existingEmployee.isActive = true;
      existingEmployee.isDeleted = false;
      
      await existingEmployee.save();
      console.log('✅ Updated existing test user');
    } else {
      // Get or create a default department
      let department = await Department.findOne({ name: 'IT' });
      if (!department) {
        department = await Department.findOne();
        if (!department) {
          console.log('❌ No departments found. Creating default department...');
          department = new Department({
            name: 'IT',
            description: 'Information Technology Department',
            isActive: true
          });
          await department.save();
        }
      }
      
      // Create new test user
      const testUser = new Employee({
        employeeId: '1234',
        firstName: 'Shehroze',
        lastName: 'Ikram',
        email: 'shehroze.ikram@test.com',
        phone: '+92-300-1234567',
        dateOfBirth: new Date('1990-01-01'),
        dateOfJoining: new Date('2023-01-01'),
        appointmentDate: new Date('2023-01-01'),
        department: department._id,
        designation: 'Software Engineer',
        salary: 50000,
        probationPeriodMonths: 3,
        gender: 'Male',
        nationality: 'Pakistani',
        idCard: '12345-1234567-1',
        qualification: 'Bachelor of Science in Computer Science',
        bankName: 'Test Bank',
        isActive: true,
        isDeleted: false,
        emergencyContact: {
          name: 'Test Contact',
          phone: '+92-300-1234568',
          relationship: 'Spouse'
        },
        address: {
          street: 'Test Street',
          city: 'Test City',
          state: 'Test State',
          country: 'Pakistan',
          postalCode: '44000'
        }
      });
      
      await testUser.save();
      console.log('✅ Created new test user: Shehroze Ikram (1234)');
    }
    
    // Verify the user
    const employee = await Employee.findOne({ 
      employeeId: '1234',
      isDeleted: false 
    });
    
    if (employee) {
      console.log('\n🎯 Test User Details:');
      console.log('📋 ID:', employee._id);
      console.log('👤 Name:', employee.firstName, employee.lastName);
      console.log('🆔 Employee ID:', employee.employeeId);
      console.log('📧 Email:', employee.email);
      console.log('📞 Phone:', employee.phone);
      console.log('🏢 Department:', employee.department);
      console.log('✅ Status: Active');
      
      console.log('\n🎉 Test user ready for real-time attendance testing!');
      console.log('💡 You can now test check-in/check-out for this user.');
    }
    
  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
createTestUser();
