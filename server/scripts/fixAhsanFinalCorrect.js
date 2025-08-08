#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function fixAhsanFinalCorrect() {
  try {
    console.log('🔧 Fixing Muhammad Ahsan (5742) - FINAL CORRECT...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find Muhammad Ahsan
    const ahsan = await Employee.findOne({employeeId: '5742'});
    if (!ahsan) {
      console.log('❌ Muhammad Ahsan (5742) not found in database');
      return;
    }
    
    console.log(`✅ Found: ${ahsan.firstName} ${ahsan.lastName} (${ahsan.employeeId})`);
    
    // Get all attendance records for Ahsan
    const allAttendance = await Attendance.find({
      employee: ahsan._id
    }).sort({date: -1});
    
    console.log(`✅ Found ${allAttendance.length} attendance records`);
    
    // Exact times from ZKTeco device data (from the image)
    const exactTimes = {
      '2025-08-01': { checkIn: '08:58:00', checkOut: null },
      '2025-08-04': { checkIn: '08:48:00', checkOut: '18:03:00' },
      '2025-08-05': { checkIn: '08:53:00', checkOut: '17:49:00' },
      '2025-08-06': { checkIn: '08:41:00', checkOut: null },
      '2025-08-07': { checkIn: '08:40:00', checkOut: '17:57:00' },
      '2025-08-08': { checkIn: '08:52:00', checkOut: null }
    };
    
    let updatedCount = 0;
    
    // Process each attendance record
    for (const attendance of allAttendance) {
      const dateKey = attendance.date.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      const expected = exactTimes[dateKey];
      
      if (expected) {
        console.log(`\n📅 Fixing ${dateKey}:`);
        
        // Fix check-in time
        if (expected.checkIn) {
          const [hours, minutes, seconds] = expected.checkIn.split(':').map(Number);
          
          // Create the time in Pakistan timezone
          const checkInDate = new Date(attendance.date);
          checkInDate.setHours(hours, minutes, seconds, 0);
          
          // Convert to UTC by subtracting 5 hours (Pakistan is UTC+5)
          const utcTime = new Date(checkInDate.getTime() - (5 * 60 * 60 * 1000));
          
          attendance.checkIn = {
            time: utcTime,
            location: 'ZKTeco Device',
            method: 'Biometric'
          };
          console.log(`  ✅ Check-in: ${utcTime.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
        }
        
        // Fix check-out time
        if (expected.checkOut) {
          const [hours, minutes, seconds] = expected.checkOut.split(':').map(Number);
          
          // Create the time in Pakistan timezone
          const checkOutDate = new Date(attendance.date);
          checkOutDate.setHours(hours, minutes, seconds, 0);
          
          // Convert to UTC by subtracting 5 hours (Pakistan is UTC+5)
          const utcTime = new Date(checkOutDate.getTime() - (5 * 60 * 60 * 1000));
          
          attendance.checkOut = {
            time: utcTime,
            location: 'ZKTeco Device',
            method: 'Biometric'
          };
          console.log(`  ✅ Check-out: ${utcTime.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
        } else {
          attendance.checkOut = undefined;
          console.log(`  ✅ Check-out: Cleared`);
        }
        
        await attendance.save();
        updatedCount++;
      }
    }
    
    console.log(`\n🎉 Successfully updated ${updatedCount} attendance records for ${ahsan.firstName} ${ahsan.lastName}`);
    
    // Show final data
    console.log('\n📊 Final attendance data:');
    const finalAttendance = await Attendance.find({
      employee: ahsan._id
    }).sort({date: -1}).limit(7);
    
    finalAttendance.forEach(a => {
      const checkInTime = a.checkIn?.time ? new Date(a.checkIn.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
      const checkOutTime = a.checkOut?.time ? new Date(a.checkOut.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
      const dateStr = a.date.toLocaleDateString('en-US', {timeZone: 'Asia/Karachi'});
      console.log(`  ${dateStr} - Check-in: ${checkInTime} | Check-out: ${checkOutTime}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixAhsanFinalCorrect(); 