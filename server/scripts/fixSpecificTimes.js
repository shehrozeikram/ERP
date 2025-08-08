#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function fixSpecificTimes() {
  try {
    console.log('🔧 Fixing specific times for Muhammad Ahsan...');
    
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
    const attendance = await Attendance.find({
      employee: ahsan._id
    }).sort({date: -1});
    
    console.log(`✅ Found ${attendance.length} attendance records`);
    
    // Fix specific dates based on ZKTeco device data
    const fixes = [
      {
        date: '2025-08-04',
        checkIn: '08:48:00',
        checkOut: '18:03:00'
      },
      {
        date: '2025-08-05', 
        checkIn: '08:53:00',
        checkOut: '17:49:00'
      },
      {
        date: '2025-08-06',
        checkIn: '08:41:00',
        checkOut: null
      },
      {
        date: '2025-08-07',
        checkIn: '08:40:00', 
        checkOut: '17:57:00'
      },
      {
        date: '2025-08-08',
        checkIn: '08:52:00',
        checkOut: null
      }
    ];
    
    let updatedCount = 0;
    
    for (const fix of fixes) {
      const [year, month, day] = fix.date.split('-').map(Number);
      
      // Find attendance record for this date
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
        console.log(`\n📅 Fixing ${fix.date}:`);
        
        // Fix check-in time
        if (fix.checkIn) {
          const [hours, minutes, seconds] = fix.checkIn.split(':').map(Number);
          const checkInTime = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, 0));
          
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
          const checkOutTime = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, 0));
          
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

fixSpecificTimes(); 