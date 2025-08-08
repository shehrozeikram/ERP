#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function showRawData() {
  try {
    console.log('🔍 Showing RAW data for Muhammad Ahsan (5742)...');
    
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
    const zktecoData = {
      '2025-08-01': { checkIn: '08:58:00', checkOut: null },
      '2025-08-04': { checkIn: '08:48:00', checkOut: '18:03:00' },
      '2025-08-05': { checkIn: '08:53:00', checkOut: '17:49:00' },
      '2025-08-06': { checkIn: '08:41:00', checkOut: null },
      '2025-08-07': { checkIn: '08:40:00', checkOut: '17:57:00' },
      '2025-08-08': { checkIn: '08:52:00', checkOut: null }
    };
    
    console.log('\n📊 COMPARISON: ZKTeco Device vs Database');
    console.log('='.repeat(80));
    
    // Process each attendance record
    for (const attendance of allAttendance) {
      const dateKey = attendance.date.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      const zkteco = zktecoData[dateKey];
      
      if (zkteco) {
        console.log(`\n📅 ${dateKey}:`);
        console.log(`  ZKTeco Device:`);
        console.log(`    Check-in:  ${zkteco.checkIn || 'N/A'}`);
        console.log(`    Check-out: ${zkteco.checkOut || 'N/A'}`);
        
        console.log(`  Database (RAW):`);
        console.log(`    Check-in:  ${attendance.checkIn?.time ? attendance.checkIn.time.toISOString() : 'N/A'}`);
        console.log(`    Check-out: ${attendance.checkOut?.time ? attendance.checkOut.time.toISOString() : 'N/A'}`);
        
        console.log(`  Database (Display):`);
        console.log(`    Check-in:  ${attendance.checkIn?.time ? new Date(attendance.checkIn.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A'}`);
        console.log(`    Check-out: ${attendance.checkOut?.time ? new Date(attendance.checkOut.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A'}`);
      }
    }
    
    console.log('\n🔍 RAW DATABASE DATA:');
    console.log('='.repeat(80));
    
    allAttendance.forEach(a => {
      const dateKey = a.date.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      console.log(`\n${dateKey}:`);
      console.log(`  Date: ${a.date.toISOString()}`);
      console.log(`  Check-in: ${a.checkIn?.time ? a.checkIn.time.toISOString() : 'N/A'}`);
      console.log(`  Check-out: ${a.checkOut?.time ? a.checkOut.time.toISOString() : 'N/A'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

showRawData(); 