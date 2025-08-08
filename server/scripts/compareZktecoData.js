#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');
const ZKTecoService = require('../services/zktecoService');

async function compareZktecoData() {
  try {
    console.log('🔍 Comparing ZKTeco device data with database...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Connect to ZKTeco device
    const zktecoService = new ZKTecoService();
    await zktecoService.connect();
    console.log('✅ Connected to ZKTeco device');
    
    // Get ZKTeco data for the last 7 days
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    console.log(`📅 Fetching ZKTeco data from ${sevenDaysAgo.toLocaleDateString()} to ${today.toLocaleDateString()}`);
    
    const zktecoData = await zktecoService.getAttendanceData(sevenDaysAgo, today);
    console.log(`✅ Found ${zktecoData.length} records in ZKTeco device`);
    
    // Group by employee and date
    const zktecoByEmployee = {};
    zktecoData.forEach(record => {
      const employeeId = record.deviceUserId || record.userId;
      const date = new Date(record.recordTime);
      const dateKey = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      
      if (!zktecoByEmployee[employeeId]) {
        zktecoByEmployee[employeeId] = {};
      }
      if (!zktecoByEmployee[employeeId][dateKey]) {
        zktecoByEmployee[employeeId][dateKey] = [];
      }
      zktecoByEmployee[employeeId][dateKey].push(record);
    });
    
    // Get database data for comparison
    const dbAttendance = await Attendance.find({
      date: { $gte: sevenDaysAgo },
      isActive: true
    }).populate('employee', 'firstName lastName employeeId');
    
    console.log(`✅ Found ${dbAttendance.length} records in database`);
    
    // Compare data
    console.log('\n📊 COMPARISON RESULTS:');
    
    dbAttendance.slice(0, 10).forEach(attendance => {
      const employee = attendance.employee;
      const dateKey = attendance.date.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      const zktecoRecords = zktecoByEmployee[employee.employeeId]?.[dateKey] || [];
      
      const checkInTime = attendance.checkIn?.time ? new Date(attendance.checkIn.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
      const checkOutTime = attendance.checkOut?.time ? new Date(attendance.checkOut.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
      
      console.log(`\n👤 ${employee.firstName} ${employee.lastName} (${employee.employeeId}) - ${dateKey}:`);
      console.log(`  Database: Check-in: ${checkInTime} | Check-out: ${checkOutTime}`);
      
      if (zktecoRecords.length > 0) {
        const zktecoTimes = zktecoRecords.map(r => new Date(r.recordTime).toLocaleString('en-US', {timeZone: 'Asia/Karachi'})).join(', ');
        console.log(`  ZKTeco:   Times: ${zktecoTimes}`);
      } else {
        console.log(`  ZKTeco:   No data found`);
      }
    });
    
    await zktecoService.disconnect();
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

compareZktecoData(); 