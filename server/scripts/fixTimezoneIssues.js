#!/usr/bin/env node

/**
 * Fix Timezone Issues in Historical Attendance
 * 
 * This script fixes timezone issues in historical attendance data.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function fixTimezoneIssues() {
  try {
    console.log('🔧 Fixing timezone issues in historical attendance...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get date range for last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    const pakistanOffset = 5 * 60 * 60 * 1000; // UTC+5 for Pakistan
    
    const startDate = new Date(thirtyDaysAgo.getTime() - pakistanOffset);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(today.getTime() - pakistanOffset);
    endDate.setHours(23, 59, 59, 999);

    console.log(`📅 Processing data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get all attendance records for the last 30 days
    const historicalAttendance = await Attendance.find({
      date: {
        $gte: startDate,
        $lte: endDate
      },
      isActive: true
    }).populate('employee', 'firstName lastName employeeId');

    console.log(`📊 Found ${historicalAttendance.length} historical attendance records`);

    // Fix each attendance record
    let updated = 0;
    let errors = 0;

    for (const attendance of historicalAttendance) {
      try {
        const employeeId = attendance.employee?.employeeId;
        if (!employeeId) continue;

        let needsUpdate = false;

        // Fix check-in time if it exists and seems to be in wrong timezone
        if (attendance.checkIn && attendance.checkIn.time) {
          const currentCheckIn = new Date(attendance.checkIn.time);
          const currentHour = currentCheckIn.getHours();
          
          // If check-in time is between 1 PM and 6 PM, it's likely wrong (should be morning)
          if (currentHour >= 13 && currentHour <= 18) {
            // Subtract 5 hours to convert to Pakistan time
            const correctedCheckIn = new Date(currentCheckIn.getTime() - (5 * 60 * 60 * 1000));
            
            attendance.checkIn = {
              time: correctedCheckIn,
              location: attendance.checkIn.location || 'Biometric Device',
              method: attendance.checkIn.method || 'Biometric'
            };
            needsUpdate = true;
            console.log(`  🔄 Fixed check-in for ${attendance.employee.firstName} ${attendance.employee.lastName} - ${currentCheckIn.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})} → ${correctedCheckIn.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
          }
        }

        // Fix check-out time if it exists and seems to be in wrong timezone
        if (attendance.checkOut && attendance.checkOut.time) {
          const currentCheckOut = new Date(attendance.checkOut.time);
          const currentHour = currentCheckOut.getHours();
          
          // If check-out time is between 1 PM and 6 PM, it's likely wrong (should be evening)
          if (currentHour >= 13 && currentHour <= 18) {
            // Subtract 5 hours to convert to Pakistan time
            const correctedCheckOut = new Date(currentCheckOut.getTime() - (5 * 60 * 60 * 1000));
            
            attendance.checkOut = {
              time: correctedCheckOut,
              location: attendance.checkOut.location || 'Biometric Device',
              method: attendance.checkOut.method || 'Biometric'
            };
            needsUpdate = true;
            console.log(`  🔄 Fixed check-out for ${attendance.employee.firstName} ${attendance.employee.lastName} - ${currentCheckOut.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})} → ${correctedCheckOut.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
          }
        }

        if (needsUpdate) {
          await attendance.save();
          updated++;
        }

      } catch (error) {
        console.error(`❌ Error updating ${attendance.employee?.firstName} ${attendance.employee?.lastName}:`, error.message);
        errors++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  Updated: ${updated} records`);
    console.log(`  Errors: ${errors} records`);
    console.log(`  Total processed: ${historicalAttendance.length} records`);

  } catch (error) {
    console.error('❌ Error fixing timezone issues:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
  }
}

// Run the fix
fixTimezoneIssues(); 