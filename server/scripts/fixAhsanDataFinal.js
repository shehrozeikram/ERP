#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function fixAhsanDataFinal() {
  try {
    console.log('🔧 Fixing Muhammad Ahsan (5742) attendance data (final)...');
    
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
      // Parse the date properly
      const [year, month, day] = dateKey.split('-').map(Number);
      
      // Create start and end of day in Pakistan timezone
      const startOfDay = new Date(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T00:00:00.000Z`);
      const endOfDay = new Date(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T23:59:59.999Z`);
      
      // Find existing attendance record for this date
      let attendance = await Attendance.findOne({
        employee: ahsan._id,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
      
      if (attendance) {
        console.log(`\n📅 Fixing ${dateKey}:`);
        
        // Update check-in time
        if (expected.checkIn) {
          const [hours, minutes, seconds] = expected.checkIn.split(':').map(Number);
          
          // Create the time in Pakistan timezone
          const checkInTime = new Date(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.000Z`);
          
          // Adjust for Pakistan timezone (UTC+5)
          const pakistanOffset = 5 * 60 * 60 * 1000;
          const adjustedCheckInTime = new Date(checkInTime.getTime() - pakistanOffset);
          
          attendance.checkIn = {
            time: adjustedCheckInTime,
            location: attendance.checkIn?.location || 'ZKTeco Device',
            method: 'Biometric'
          };
          console.log(`  ✅ Check-in: ${adjustedCheckInTime.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
        }
        
        // Update check-out time
        if (expected.checkOut) {
          const [hours, minutes, seconds] = expected.checkOut.split(':').map(Number);
          
          // Create the time in Pakistan timezone
          const checkOutTime = new Date(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.000Z`);
          
          // Adjust for Pakistan timezone (UTC+5)
          const pakistanOffset = 5 * 60 * 60 * 1000;
          const adjustedCheckOutTime = new Date(checkOutTime.getTime() - pakistanOffset);
          
          attendance.checkOut = {
            time: adjustedCheckOutTime,
            location: attendance.checkOut?.location || 'ZKTeco Device',
            method: 'Biometric'
          };
          console.log(`  ✅ Check-out: ${adjustedCheckOutTime.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
        } else {
          // Clear check-out by setting it to undefined
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

fixAhsanDataFinal(); 