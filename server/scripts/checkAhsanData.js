#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function checkAhsanData() {
  try {
    console.log('🔍 Checking Muhammad Ahsan (5742) attendance data...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find Muhammad Ahsan
    const ahsan = await Employee.findOne({employeeId: '5742'});
    if (!ahsan) {
      console.log('❌ Muhammad Ahsan (5742) not found in database');
      return;
    }
    
    console.log(`✅ Found: ${ahsan.firstName} ${ahsan.lastName} (${ahsan.employeeId})`);
    
    // Get attendance data for the last 7 days
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    const attendance = await Attendance.find({
      employee: ahsan._id,
      date: { $gte: sevenDaysAgo }
    }).sort({date: -1});
    
    console.log(`\n📊 Attendance Records for ${ahsan.firstName} ${ahsan.lastName}:`);
    console.log('='.repeat(80));
    
    attendance.forEach(a => {
      const checkInTime = a.checkIn?.time ? new Date(a.checkIn.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
      const checkOutTime = a.checkOut?.time ? new Date(a.checkOut.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
      const dateStr = a.date.toLocaleDateString('en-US', {timeZone: 'Asia/Karachi'});
      
      console.log(`${dateStr} - Check-in: ${checkInTime} | Check-out: ${checkOutTime}`);
    });
    
    // Now let's check what the ZKTeco device should have based on the image
    console.log('\n📋 Expected ZKTeco Data (from image):');
    console.log('='.repeat(80));
    console.log('Aug 1, 2025 - Check-in: 08:58 AM | Check-out: (empty)');
    console.log('Aug 2, 2025 - Check-in: (empty) | Check-out: (empty)');
    console.log('Aug 3, 2025 - Check-in: (empty) | Check-out: (empty)');
    console.log('Aug 4, 2025 - Check-in: 08:48 AM | Check-out: 18:03 PM');
    console.log('Aug 5, 2025 - Check-in: 08:53 AM | Check-out: 17:49 PM');
    console.log('Aug 6, 2025 - Check-in: 08:41 AM | Check-out: (empty)');
    console.log('Aug 7, 2025 - Check-in: 08:40 AM | Check-out: 17:57 PM');
    console.log('Aug 8, 2025 - Check-in: 08:52 AM | Check-out: (empty)');
    
    console.log('\n🔍 ANALYSIS:');
    console.log('='.repeat(80));
    
    // Compare with expected times
    const expectedTimes = {
      '2025-08-01': { checkIn: '08:58', checkOut: null },
      '2025-08-04': { checkIn: '08:48', checkOut: '18:03' },
      '2025-08-05': { checkIn: '08:53', checkOut: '17:49' },
      '2025-08-06': { checkIn: '08:41', checkOut: null },
      '2025-08-07': { checkIn: '08:40', checkOut: '17:57' },
      '2025-08-08': { checkIn: '08:52', checkOut: null }
    };
    
    attendance.forEach(a => {
      const dateKey = a.date.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      const expected = expectedTimes[dateKey];
      
      if (expected) {
        const actualCheckIn = a.checkIn?.time ? new Date(a.checkIn.time).toLocaleTimeString('en-US', {timeZone: 'Asia/Karachi', hour12: false}) : 'N/A';
        const actualCheckOut = a.checkOut?.time ? new Date(a.checkOut.time).toLocaleTimeString('en-US', {timeZone: 'Asia/Karachi', hour12: false}) : 'N/A';
        
        console.log(`${dateKey}:`);
        console.log(`  Expected: Check-in: ${expected.checkIn} | Check-out: ${expected.checkOut || 'N/A'}`);
        console.log(`  Actual:   Check-in: ${actualCheckIn} | Check-out: ${actualCheckOut}`);
        
        if (actualCheckIn !== expected.checkIn && actualCheckIn !== 'N/A') {
          console.log(`  ❌ Check-in time mismatch!`);
        }
        if (expected.checkOut && actualCheckOut !== expected.checkOut && actualCheckOut !== 'N/A') {
          console.log(`  ❌ Check-out time mismatch!`);
        }
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkAhsanData(); 