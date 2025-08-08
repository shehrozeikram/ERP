#!/usr/bin/env node

/**
 * Fix Historical Attendance Times
 * 
 * This script fixes historical attendance data by correcting timezone issues.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');
const { processZKTecoTimestamp, formatLocalDateTime } = require('../utils/timezoneHelper');

async function fixHistoricalTimes() {
  try {
    console.log('🔧 Fixing historical attendance times...');
    
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

        // Fix check-in time if it exists
        if (attendance.checkIn && attendance.checkIn.time) {
          const currentCheckIn = new Date(attendance.checkIn.time);
          const correctedCheckIn = processZKTecoTimestamp(currentCheckIn);
          
          // Check if the time needs correction (if it's more than 1 hour off)
          if (correctedCheckIn && Math.abs(currentCheckIn - correctedCheckIn) > 60 * 60 * 1000) {
            attendance.checkIn = {
              time: correctedCheckIn,
              location: attendance.checkIn.location || 'Biometric Device',
              method: attendance.checkIn.method || 'Biometric'
            };
            needsUpdate = true;
            console.log(`  🔄 Fixed check-in for ${attendance.employee.firstName} ${attendance.employee.lastName} - ${formatLocalDateTime(currentCheckIn)} → ${formatLocalDateTime(correctedCheckIn)}`);
          }
        }

        // Fix check-out time if it exists
        if (attendance.checkOut && attendance.checkOut.time) {
          const currentCheckOut = new Date(attendance.checkOut.time);
          const correctedCheckOut = processZKTecoTimestamp(currentCheckOut);
          
          // Check if the time needs correction (if it's more than 1 hour off)
          if (correctedCheckOut && Math.abs(currentCheckOut - correctedCheckOut) > 60 * 60 * 1000) {
            attendance.checkOut = {
              time: correctedCheckOut,
              location: attendance.checkOut.location || 'Biometric Device',
              method: attendance.checkOut.method || 'Biometric'
            };
            needsUpdate = true;
            console.log(`  🔄 Fixed check-out for ${attendance.employee.firstName} ${attendance.employee.lastName} - ${formatLocalDateTime(currentCheckOut)} → ${formatLocalDateTime(correctedCheckOut)}`);
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
    console.error('❌ Error fixing historical times:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
  }
}

// Run the fix
fixHistoricalTimes(); 