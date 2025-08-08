#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function fixAllHistoricalDataFinal() {
  try {
    console.log('🔧 Fixing all historical attendance data - FINAL...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get all attendance records from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const allAttendance = await Attendance.find({
      date: { $gte: thirtyDaysAgo },
      isActive: true
    }).populate('employee', 'firstName lastName employeeId');
    
    console.log(`✅ Found ${allAttendance.length} attendance records`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Process each attendance record
    for (const attendance of allAttendance) {
      try {
        const employee = attendance.employee;
        const dateKey = attendance.date.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
        
        // Check if this is a ZKTeco record
        if (attendance.checkIn?.location === 'ZKTeco Device' || attendance.checkIn?.method === 'Biometric') {
          // Get the check-in time in Pakistan timezone
          const checkInTime = attendance.checkIn?.time;
          if (checkInTime) {
            const pakistanTime = new Date(checkInTime.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
            
            // Check if the time is in the correct range (should be between 5 AM and 12 PM for check-in)
            const hours = pakistanTime.getHours();
            if (hours < 5 || hours > 12) {
              // Time is likely incorrect, need to fix
              console.log(`⚠️ ${employee.firstName} ${employee.lastName} (${employee.employeeId}) - ${dateKey} has incorrect check-in time: ${pakistanTime.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
              
              // Try to find the correct time from ZKTeco device data
              // For now, let's just log the issue
              errorCount++;
            }
          }
        }
        
        // Check check-out time
        const checkOutTime = attendance.checkOut?.time;
        if (checkOutTime) {
          const pakistanTime = new Date(checkOutTime.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
          const hours = pakistanTime.getHours();
          
          // Check-out should be between 5 PM and 10 PM
          if (hours < 17 || hours > 22) {
            console.log(`⚠️ ${employee.firstName} ${employee.lastName} (${employee.employeeId}) - ${dateKey} has incorrect check-out time: ${pakistanTime.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
            errorCount++;
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing attendance record:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total records processed: ${allAttendance.length}`);
    console.log(`  Records with issues: ${errorCount}`);
    console.log(`  Records updated: ${updatedCount}`);
    
    if (errorCount > 0) {
      console.log(`\n🔧 To fix the remaining issues, you may need to:`);
      console.log(`  1. Check the ZKTeco device data directly`);
      console.log(`  2. Verify the timezone settings`);
      console.log(`  3. Re-sync the data from the device`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixAllHistoricalDataFinal(); 