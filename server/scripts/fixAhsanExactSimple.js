#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function fixAhsanExactSimple() {
  try {
    console.log('🔧 Fixing Muhammad Ahsan (5742) - EXACT SIMPLE...');
    
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
    
    // Exact times from ZKTeco device data (from the image) - NO CONVERSION
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
        
        // Fix check-in time - Store exact ZKTeco time without conversion
        if (expected.checkIn) {
          const [hours, minutes, seconds] = expected.checkIn.split(':').map(Number);
          
          // Create the time in Pakistan timezone (exact as from ZKTeco device)
          // Create a new date using the exact time string
          const checkInDate = new Date(`${dateKey}T${expected.checkIn}:00.000Z`);
          
          // Adjust for Pakistan timezone (UTC+5)
          // Since we want to store 8:52 AM Pakistan time, we need to store it as 3:52 AM UTC
          checkInDate.setUTCHours(hours - 5, minutes, seconds, 0);
          
          // Store the exact time as is (no UTC conversion)
          attendance.checkIn = {
            time: checkInDate,
            location: 'ZKTeco Device',
            method: 'Biometric'
          };
          console.log(`  ✅ Check-in: ${checkInDate.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})} (exact ZKTeco time)`);
        }
        
        // Fix check-out time - Store exact ZKTeco time without conversion
        if (expected.checkOut) {
          const [hours, minutes, seconds] = expected.checkOut.split(':').map(Number);
          
          // Create the time in Pakistan timezone (exact as from ZKTeco device)
          const checkOutDate = new Date(`${dateKey}T${expected.checkOut}:00.000Z`);
          
          // Adjust for Pakistan timezone (UTC+5)
          checkOutDate.setUTCHours(hours - 5, minutes, seconds, 0);
          
          // Store the exact time as is (no UTC conversion)
          attendance.checkOut = {
            time: checkOutDate,
            location: 'ZKTeco Device',
            method: 'Biometric'
          };
          console.log(`  ✅ Check-out: ${checkOutDate.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})} (exact ZKTeco time)`);
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
    console.log('\n📊 Final attendance data (exact ZKTeco times):');
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

fixAhsanExactSimple(); 