#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function fixAhsanExact() {
  try {
    console.log('🔧 Fixing Muhammad Ahsan (5742) - EXACT MATCH...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find Muhammad Ahsan
    const ahsan = await Employee.findOne({employeeId: '5742'});
    if (!ahsan) {
      console.log('❌ Muhammad Ahsan (5742) not found in database');
      return;
    }
    
    console.log(`✅ Found: ${ahsan.firstName} ${ahsan.lastName} (${ahsan.employeeId})`);
    
    // Exact times from ZKTeco device data (from the image)
    const exactTimes = [
      {
        date: '2025-08-01',
        checkIn: '08:58:00',
        checkOut: null,
        expected: '08:58 AM'
      },
      {
        date: '2025-08-04',
        checkIn: '08:48:00',
        checkOut: '18:03:00',
        expected: '08:48 AM - 6:03 PM'
      },
      {
        date: '2025-08-05',
        checkIn: '08:53:00',
        checkOut: '17:49:00',
        expected: '08:53 AM - 5:49 PM'
      },
      {
        date: '2025-08-06',
        checkIn: '08:41:00',
        checkOut: null,
        expected: '08:41 AM'
      },
      {
        date: '2025-08-07',
        checkIn: '08:40:00',
        checkOut: '17:57:00',
        expected: '08:40 AM - 5:57 PM'
      },
      {
        date: '2025-08-08',
        checkIn: '08:52:00',
        checkOut: null,
        expected: '08:52 AM'
      }
    ];
    
    let updatedCount = 0;
    
    for (const fix of exactTimes) {
      const [year, month, day] = fix.date.split('-').map(Number);
      
      // Create date range for this day
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      
      const record = await Attendance.findOne({
        employee: ahsan._id,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
      
      if (record) {
        console.log(`\n📅 Fixing ${fix.date} (Expected: ${fix.expected}):`);
        
        // Fix check-in time
        if (fix.checkIn) {
          const [hours, minutes, seconds] = fix.checkIn.split(':').map(Number);
          
          // Create the time in Pakistan timezone (UTC+5)
          // Since we want 08:58 AM Pakistan time, we need to store it as 03:58 AM UTC
          const utcHours = hours - 5; // Convert Pakistan time to UTC
          const checkInTime = new Date(Date.UTC(year, month - 1, day, utcHours, minutes, seconds, 0));
          
          record.checkIn = {
            time: checkInTime,
            location: 'ZKTeco Device',
            method: 'Biometric'
          };
          console.log(`  ✅ Check-in: ${checkInTime.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
        }
        
        // Fix check-out time
        if (fix.checkOut) {
          const [hours, minutes, seconds] = fix.checkOut.split(':').map(Number);
          
          // Create the time in Pakistan timezone (UTC+5)
          const utcHours = hours - 5; // Convert Pakistan time to UTC
          const checkOutTime = new Date(Date.UTC(year, month - 1, day, utcHours, minutes, seconds, 0));
          
          record.checkOut = {
            time: checkOutTime,
            location: 'ZKTeco Device',
            method: 'Biometric'
          };
          console.log(`  ✅ Check-out: ${checkOutTime.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
        } else {
          record.checkOut = undefined;
          console.log(`  ✅ Check-out: Cleared`);
        }
        
        await record.save();
        updatedCount++;
      } else {
        console.log(`\n⚠️ No attendance record found for ${fix.date}`);
      }
    }
    
    console.log(`\n🎉 Successfully updated ${updatedCount} attendance records for ${ahsan.firstName} ${ahsan.lastName}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixAhsanExact(); 