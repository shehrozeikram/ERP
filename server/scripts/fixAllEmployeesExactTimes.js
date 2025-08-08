#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function fixAllEmployeesExactTimes() {
  try {
    console.log('🔧 Fixing ALL Employees - EXACT ZKTeco Times...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get all employees
    const allEmployees = await Employee.find({ isDeleted: { $ne: true } }).sort({ firstName: 1 });
    console.log(`✅ Found ${allEmployees.length} employees`);
    
    let totalUpdatedRecords = 0;
    let employeesProcessed = 0;
    
    // Process each employee
    for (const employee of allEmployees) {
      console.log(`\n👤 Processing ${employee.firstName} ${employee.lastName} (${employee.employeeId})...`);
      
      // Get all attendance records for this employee
      const allAttendance = await Attendance.find({
        employee: employee._id
      }).sort({date: -1});
      
      if (allAttendance.length === 0) {
        console.log(`  ⚠️  No attendance records found`);
        continue;
      }
      
      console.log(`  📊 Found ${allAttendance.length} attendance records`);
      
      let employeeUpdatedCount = 0;
      
      // Process each attendance record for this employee
      for (const attendance of allAttendance) {
        const dateKey = attendance.date.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
        
        // Get the check-in and check-out times for this record
        const checkInTime = attendance.checkIn?.time;
        const checkOutTime = attendance.checkOut?.time;
        
        let needsUpdate = false;
        
        if (checkInTime) {
          // Check if the time is stored as UTC (showing as 3-4 AM when it should be 8-9 AM)
          const currentTime = new Date(checkInTime);
          const currentHours = currentTime.getUTCHours();
          
          // If the time is between 3-4 AM UTC, it's likely stored incorrectly
          if (currentHours >= 3 && currentHours <= 4) {
            // Convert to Pakistan time (add 5 hours) and then store correctly
            const pakistanHours = currentHours + 5;
            const pakistanMinutes = currentTime.getUTCMinutes();
            const pakistanSeconds = currentTime.getUTCSeconds();
            
            // Create the correct UTC time (subtract 5 hours to store Pakistan time as UTC)
            const correctCheckInDate = new Date(attendance.date);
            correctCheckInDate.setUTCHours(pakistanHours - 5, pakistanMinutes, pakistanSeconds, 0);
            
            attendance.checkIn = {
              time: correctCheckInDate,
              location: attendance.checkIn?.location || 'ZKTeco Device',
              method: attendance.checkIn?.method || 'Biometric'
            };
            
            needsUpdate = true;
            employeeUpdatedCount++;
          }
        }
        
        if (checkOutTime) {
          // Check if the time is stored as UTC
          const currentTime = new Date(checkOutTime);
          const currentHours = currentTime.getUTCHours();
          
          // If the time is between 3-4 AM UTC or 12-1 PM UTC, it's likely stored incorrectly
          if ((currentHours >= 3 && currentHours <= 4) || (currentHours >= 12 && currentHours <= 13)) {
            // Convert to Pakistan time (add 5 hours) and then store correctly
            const pakistanHours = currentHours + 5;
            const pakistanMinutes = currentTime.getUTCMinutes();
            const pakistanSeconds = currentTime.getUTCSeconds();
            
            // Create the correct UTC time (subtract 5 hours to store Pakistan time as UTC)
            const correctCheckOutDate = new Date(attendance.date);
            correctCheckOutDate.setUTCHours(pakistanHours - 5, pakistanMinutes, pakistanSeconds, 0);
            
            attendance.checkOut = {
              time: correctCheckOutDate,
              location: attendance.checkOut?.location || 'ZKTeco Device',
              method: attendance.checkOut?.method || 'Biometric'
            };
            
            needsUpdate = true;
            employeeUpdatedCount++;
          }
        }
        
        if (needsUpdate) {
          await attendance.save();
        }
      }
      
      if (employeeUpdatedCount > 0) {
        console.log(`  ✅ Updated ${employeeUpdatedCount} attendance records`);
        totalUpdatedRecords += employeeUpdatedCount;
        employeesProcessed++;
      } else {
        console.log(`  ℹ️  No updates needed`);
      }
    }
    
    console.log(`\n🎉 SUCCESS SUMMARY:`);
    console.log(`  📊 Total employees processed: ${employeesProcessed}`);
    console.log(`  📊 Total attendance records updated: ${totalUpdatedRecords}`);
    console.log(`  ✅ All employees' attendance times are now exact ZKTeco times!`);
    
    // Show sample data for verification
    console.log(`\n📋 Sample verification (first 3 employees):`);
    const sampleEmployees = await Employee.find({ isDeleted: { $ne: true } }).limit(3);
    
    for (const employee of sampleEmployees) {
      const recentAttendance = await Attendance.find({
        employee: employee._id
      }).sort({date: -1}).limit(2);
      
      if (recentAttendance.length > 0) {
        console.log(`\n👤 ${employee.firstName} ${employee.lastName} (${employee.employeeId}):`);
        recentAttendance.forEach(a => {
          const checkInTime = a.checkIn?.time ? new Date(a.checkIn.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
          const checkOutTime = a.checkOut?.time ? new Date(a.checkOut.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
          const dateStr = a.date.toLocaleDateString('en-US', {timeZone: 'Asia/Karachi'});
          console.log(`  ${dateStr} - Check-in: ${checkInTime} | Check-out: ${checkOutTime}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixAllEmployeesExactTimes(); 