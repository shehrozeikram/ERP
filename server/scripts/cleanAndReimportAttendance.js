#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');
const zktecoService = require('../services/zktecoService');

async function cleanAndReimportAttendance() {
  try {
    console.log('🧹 CLEANING AND REIMPORTING ATTENDANCE DATA...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Step 1: Remove all existing attendance data
    console.log('\n🗑️  Step 1: Removing all existing attendance data...');
    const deleteResult = await Attendance.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} attendance records`);
    
    // Step 2: Initialize ZKTeco service
    console.log('\n🔗 Step 2: Initializing ZKTeco service...');
    await zktecoService.connect();
    console.log('✅ Connected to ZKTeco device');
    
    // Step 3: Get all attendance data from ZKTeco device
    console.log('\n📊 Step 3: Getting attendance data from ZKTeco device...');
    const attendanceData = await zktecoService.getAttendanceData();
    
    if (!attendanceData.success || !attendanceData.data) {
      throw new Error('No attendance data received from ZKTeco device');
    }
    
    console.log(`✅ Found ${attendanceData.data.length} attendance records from ZKTeco device`);
    
    // Step 4: Get all employees for mapping
    console.log('\n👥 Step 4: Getting all employees...');
    const allEmployees = await Employee.find({ isDeleted: { $ne: true } });
    const employeeMap = new Map();
    allEmployees.forEach(emp => {
      employeeMap.set(emp.employeeId.toString(), emp);
    });
    console.log(`✅ Found ${allEmployees.length} employees`);
    
    // Step 5: Process attendance data
    console.log('\n🔄 Step 5: Processing attendance data...');
    
    let totalRecordsImported = 0;
    let recordsByDate = {};
    
    // Group records by employee and date
    for (const record of attendanceData.data) {
      const userId = record.uid || record.userId || record.deviceUserId;
      const employee = employeeMap.get(userId.toString());
      
      if (!employee) {
        console.log(`⚠️  Employee with ID ${userId} not found in database`);
        continue;
      }
      
      // Parse the exact time from ZKTeco device - STORE AS IS
      const recordTime = new Date(record.timestamp || record.recordTime);
      
      // Get the date in Pakistan timezone for grouping
      const dateKey = recordTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      const employeeDateKey = `${employee._id}_${dateKey}`;
      
      if (!recordsByDate[employeeDateKey]) {
        recordsByDate[employeeDateKey] = {
          employee: employee,
          date: dateKey,
          times: []
        };
      }
      
      recordsByDate[employeeDateKey].times.push(recordTime);
    }
    
    // Step 6: Create attendance records
    console.log('\n📝 Step 6: Creating attendance records...');
    
    for (const [key, data] of Object.entries(recordsByDate)) {
      if (data.times.length === 0) continue;
      
      // Sort times for this date
      data.times.sort((a, b) => a - b);
      
      // First time is check-in, last time is check-out
      const checkInTime = data.times[0];
      const checkOutTime = data.times.length > 1 ? data.times[data.times.length - 1] : null;
      
      // Create the attendance record with EXACT ZKTeco times (as they are)
      // Parse the date string (YYYY-MM-DD) and create a proper date object
      const [year, month, day] = data.date.split('-').map(Number);
      const attendanceDate = new Date(year, month - 1, day); // month is 0-indexed
      
      const attendanceRecord = new Attendance({
        employee: data.employee._id,
        date: attendanceDate,
        checkIn: {
          time: checkInTime,
          location: 'ZKTeco Device',
          method: 'Biometric'
        }
      });
      
      if (checkOutTime && checkOutTime.getTime() !== checkInTime.getTime()) {
        attendanceRecord.checkOut = {
          time: checkOutTime,
          location: 'ZKTeco Device',
          method: 'Biometric'
        };
      }
      
      await attendanceRecord.save();
      totalRecordsImported++;
      
      if (totalRecordsImported % 100 === 0) {
        console.log(`  ✅ Processed ${totalRecordsImported} records...`);
      }
    }
    
    // Step 7: Disconnect from ZKTeco
    await zktecoService.disconnect();
    console.log('\n🔌 Disconnected from ZKTeco device');
    
    console.log(`\n🎉 SUCCESS SUMMARY:`);
    console.log(`  📊 Total attendance records imported: ${totalRecordsImported}`);
    console.log(`  ✅ All attendance data is now EXACT ZKTeco times!`);
    
    // Show sample verification
    console.log(`\n📋 Sample verification (first 3 employees):`);
    const sampleEmployees = await Employee.find({ isDeleted: { $ne: true } }).limit(3);
    
    for (const employee of sampleEmployees) {
      const recentAttendance = await Attendance.find({
        employee: employee._id
      }).sort({date: -1}).limit(2);
      
      if (recentAttendance.length > 0) {
        console.log(`\n👤 ${employee.firstName} ${employee.lastName} (${employee.employeeId}):`);
        recentAttendance.forEach(a => {
          const checkInTime = a.checkIn?.time ? new Date(a.checkIn.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
          const checkOutTime = a.checkOut?.time ? new Date(a.checkOut.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
          const dateStr = a.date.toLocaleDateString('en-US', {timeZone: 'Asia/Karachi'});
          console.log(`  ${dateStr} - Check-in: ${checkInTime} | Check-out: ${checkOutTime}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

cleanAndReimportAttendance(); 