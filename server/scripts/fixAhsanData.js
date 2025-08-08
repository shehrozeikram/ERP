#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function fixAhsanData() {
  try {
    console.log('🔧 Fixing Muhammad Ahsan (5742) attendance data...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find Muhammad Ahsan
    const ahsan = await Employee.findOne({employeeId: '5742'});
    if (!ahsan) {
      console.log('❌ Muhammad Ahsan (5742) not found in database');
      return;
    }
    
    console.log(`✅ Found: ${ahsan.firstName} ${ahsan.lastName} (${ahsan.employeeId})`);
    
    // Expected times from ZKTeco device (based on the image)
    const expectedTimes = {
      '2025-08-01': { checkIn: '08:58:00', checkOut: null },
      '2025-08-04': { checkIn: '08:48:00', checkOut: '18:03:00' },
      '2025-08-05': { checkIn: '08:53:00', checkOut: '17:49:00' },
      '2025-08-06': { checkIn: '08:41:00', checkOut: null },
      '2025-08-07': { checkIn: '08:40:00', checkOut: '17:57:00' },
      '2025-08-08': { checkIn: '08:52:00', checkOut: null }
    };
    
    let updatedCount = 0;
    
    for (const [dateKey, expected] of Object.entries(expectedTimes)) {
      // Create date in Pakistan timezone
      const [year, month, day] = dateKey.split('-');
      const pakistanDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
      const pakistanOffset = 5 * 60 * 60 * 1000; // UTC+5
      const localDate = new Date(pakistanDate.getTime() + pakistanOffset);
      
      // Find existing attendance record
      let attendance = await Attendance.findOne({
        employee: ahsan._id,
        date: {
          $gte: new Date(localDate.getTime() - pakistanOffset),
          $lt: new Date(localDate.getTime() - pakistanOffset + 24 * 60 * 60 * 1000)
        }
      });
      
      if (attendance) {
        console.log(`\n📅 Fixing ${dateKey}:`);
        
        // Update check-in time
        if (expected.checkIn) {
          const [hours, minutes, seconds] = expected.checkIn.split(':');
          const checkInTime = new Date(localDate);
          checkInTime.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds), 0);
          
          attendance.checkIn = {
            time: checkInTime,
            location: attendance.checkIn?.location || 'ZKTeco Device',
            method: attendance.checkIn?.method || 'biometric'
          };
          console.log(`  ✅ Check-in: ${checkInTime.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
        }
        
        // Update check-out time
        if (expected.checkOut) {
          const [hours, minutes, seconds] = expected.checkOut.split(':');
          const checkOutTime = new Date(localDate);
          checkOutTime.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds), 0);
          
          attendance.checkOut = {
            time: checkOutTime,
            location: attendance.checkOut?.location || 'ZKTeco Device',
            method: attendance.checkOut?.method || 'biometric'
          };
          console.log(`  ✅ Check-out: ${checkOutTime.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
        } else {
          // Clear check-out by setting it to undefined instead of null
          attendance.checkOut = undefined;
          console.log(`  ✅ Check-out: Cleared`);
        }
        
        await attendance.save();
        updatedCount++;
      } else {
        console.log(`\n⚠️ No attendance record found for ${dateKey}`);
      }
    }
    
    console.log(`\n🎉 Successfully updated ${updatedCount} attendance records for ${ahsan.firstName} ${ahsan.lastName}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixAhsanData(); 