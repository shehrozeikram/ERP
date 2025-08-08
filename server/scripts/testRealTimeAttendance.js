#!/usr/bin/env node

/**
 * Test Real-Time Attendance for Any Available Employee
 * 
 * This script simulates real-time attendance data by directly updating the database
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Import models
const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function testRealTimeAttendance() {
  try {
    console.log('🧪 Testing Real-Time Attendance for any available employee...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find any available employee
    const employee = await Employee.findOne({ 
      isDeleted: false,
      isActive: true
    });
    
    if (!employee) {
      console.log('❌ No active employees found');
      return;
    }
    
    console.log('✅ Found employee:', `${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
    
    // Test data for the found employee
    const testData = {
      employeeId: employee.employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      deviceUserId: employee.employeeId,
      timestamp: new Date(),
      isCheckIn: Math.random() > 0.5, // Randomly choose check-in or check-out
      deviceId: "ZKTeco Device",
      location: "Office",
      method: "Biometric"
    };
    
    console.log(`🎯 Testing ${testData.isCheckIn ? 'Check-in' : 'Check-out'} for ${testData.employeeName}`);
    
    // Create or update attendance record
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let attendance = await Attendance.findOne({
      employee: employee._id,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
      isActive: true
    });
    
    if (!attendance) {
      // Create new attendance record
      attendance = new Attendance({
        employee: employee._id,
        date: today,
        status: 'Present',
        checkIn: {
          time: testData.isCheckIn ? testData.timestamp : new Date(today.getTime() + 9 * 60 * 60 * 1000), // Default 9 AM check-in
          location: testData.location,
          method: testData.method,
          deviceId: testData.deviceId
        },
        checkOut: !testData.isCheckIn ? {
          time: testData.timestamp,
          location: testData.location,
          method: testData.method,
          deviceId: testData.deviceId
        } : null,
        isActive: true
      });
      
      await attendance.save();
      console.log(`✅ Created new attendance record for ${testData.isCheckIn ? 'check-in' : 'check-out'}`);
    } else {
      // Update existing attendance record
      if (!testData.isCheckIn) {
        // Check-out
        attendance.checkOut = {
          time: testData.timestamp,
          location: testData.location,
          method: testData.method,
          deviceId: testData.deviceId
        };
      } else {
        // Check-in
        attendance.checkIn = {
          time: testData.timestamp,
          location: testData.location,
          method: testData.method,
          deviceId: testData.deviceId
        };
      }
      
      await attendance.save();
      console.log(`✅ Updated attendance record for ${testData.isCheckIn ? 'check-in' : 'check-out'}`);
    }
    
    console.log('\n🎯 Real-time attendance test completed!');
    console.log('📊 Test Data:', {
      employee: testData.employeeName,
      employeeId: testData.employeeId,
      action: testData.isCheckIn ? 'Check-in' : 'Check-out',
      time: testData.timestamp.toLocaleString(),
      device: testData.deviceId,
      location: testData.location
    });
    
    console.log('\n🔍 Check the Attendance Management page to see the update!');
    console.log('💡 Look for the employee in the attendance records.');
    console.log('🔄 If real-time is enabled, you should see the update immediately!');
    
  } catch (error) {
    console.error('❌ Error testing real-time attendance:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testRealTimeAttendance();
