#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');
const zktecoService = require('../services/zktecoService');

async function processAttendanceProfessionally() {
  try {
    console.log('🎯 PROCESSING ATTENDANCE PROFESSIONALLY...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Step 1: Initialize ZKTeco service
    console.log('\n🔗 Step 1: Initializing ZKTeco service...');
    await zktecoService.connect();
    console.log('✅ Connected to ZKTeco device');
    
    // Step 2: Get all attendance data from ZKTeco device
    console.log('\n📊 Step 2: Getting attendance data from ZKTeco device...');
    const attendanceData = await zktecoService.getAttendanceData();
    
    if (!attendanceData.success || !attendanceData.data) {
      throw new Error('No attendance data received from ZKTeco device');
    }
    
    console.log(`✅ Found ${attendanceData.data.length} attendance records from ZKTeco device`);
    
    // Step 3: Clear old attendance records for today
    console.log('\n🧹 Step 3: Clearing old attendance records for today...');
    const today = new Date();
    // Use today's date directly without timezone conversion
    const todayStartUTC = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // Delete all attendance records for today
    const deleteResult = await Attendance.deleteMany({
      date: {
        $gte: todayStartUTC,
        $lt: new Date(todayStartUTC.getTime() + (24 * 60 * 60 * 1000))
      }
    });
    
    console.log(`✅ Cleared ${deleteResult.deletedCount} old attendance records for today`);
    
    // Step 4: Process attendance data by employee and date
    console.log('\n🔄 Step 4: Processing attendance data...');
    
    let totalRecordsProcessed = 0;
    let lateCheckIns = 0;
    let missingCheckOuts = 0;
    let presentEmployees = 0;
    
    // Group ZKTeco records by employee and date
    const zktecoRecordsByEmployee = {};
    
    for (const record of attendanceData.data) {
      const userId = record.uid || record.userId || record.deviceUserId;
      const recordTime = new Date(record.timestamp || record.recordTime);
      const dateKey = recordTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      
      if (!zktecoRecordsByEmployee[userId]) {
        zktecoRecordsByEmployee[userId] = {};
      }
      
      if (!zktecoRecordsByEmployee[userId][dateKey]) {
        zktecoRecordsByEmployee[userId][dateKey] = [];
      }
      
      zktecoRecordsByEmployee[userId][dateKey].push(recordTime);
    }
    
    // Step 5: Process each employee who has attendance
    for (const [employeeId, employeeRecords] of Object.entries(zktecoRecordsByEmployee)) {
      const todayRecords = employeeRecords[todayPakistan] || [];
      
      if (todayRecords.length === 0) {
        // Skip employees with no attendance for today
        continue;
      }
      
      // Get employee details
      const employee = await Employee.findOne({ employeeId: employeeId, isDeleted: { $ne: true } });
      if (!employee) {
        console.log(`⚠️  Employee with ID ${employeeId} not found in database`);
        continue;
      }
      
      console.log(`\n👤 Processing ${employee.firstName} ${employee.lastName} (${employee.employeeId})...`);
      console.log(`  📊 Found ${todayRecords.length} attendance records`);
      
      // Determine check-in and check-out times
      let checkInTime = todayRecords[0];
      let checkOutTime = null;
      
      // If there are multiple records, analyze them to find check-out
      if (todayRecords.length > 1) {
        // Sort records by time to ensure proper order
        todayRecords.sort((a, b) => a - b);
        
        // The first record is always check-in
        checkInTime = todayRecords[0];
        
        // Look for the last record that's significantly different from check-in
        for (let i = todayRecords.length - 1; i > 0; i--) {
          const potentialCheckOut = todayRecords[i];
          const timeDiff = Math.abs(potentialCheckOut.getTime() - checkInTime.getTime());
          
          // If the time difference is more than 5 minutes, consider it a check-out
          if (timeDiff > 300000) { // 5 minutes = 300,000 milliseconds
            checkOutTime = potentialCheckOut;
            break;
          }
        }
        
        // If no significant time difference found, but there are multiple records,
        // use the last record as check-out (with a minimum 1-minute difference)
        if (!checkOutTime && todayRecords.length > 1) {
          const lastRecord = todayRecords[todayRecords.length - 1];
          const timeDiff = Math.abs(lastRecord.getTime() - checkInTime.getTime());
          if (timeDiff > 60000) { // 1 minute = 60,000 milliseconds
            checkOutTime = lastRecord;
          }
        }
      }
      
      // Determine status based on check-in time
      let status = 'Present';
      let notes = '';
      let lateMinutes = 0;
      
      // Check if check-in is late (after 9:00 AM Pakistan time)
      const checkInPakistanTime = new Date(checkInTime);
      const checkInHour = checkInPakistanTime.getUTCHours() + 5; // Convert to Pakistan time
      const checkInMinute = checkInPakistanTime.getUTCMinutes();
      const checkInTotalMinutes = checkInHour * 60 + checkInMinute;
      
      if (checkInTotalMinutes > 540) { // 9:00 AM = 540 minutes
        status = 'Late';
        lateMinutes = checkInTotalMinutes - 540;
        notes = `Late check-in by ${lateMinutes} minutes`;
        lateCheckIns++;
      }
      
      // Check if missing check-out
      if (!checkOutTime) {
        notes += notes ? ' | Missing check-out' : 'Missing check-out';
        missingCheckOuts++;
      }
      
      // Calculate work hours if both check-in and check-out exist
      let workHours = 0;
      if (checkInTime && checkOutTime && checkOutTime.getTime() !== checkInTime.getTime()) {
        const diffMs = checkOutTime.getTime() - checkInTime.getTime();
        workHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }
      
      // Create new attendance record
      const attendanceRecord = new Attendance({
        employee: employee._id,
        date: todayStartUTC,
        checkIn: {
          time: checkInTime,
          location: 'ZKTeco Device',
          method: 'Biometric',
          late: status === 'Late',
          lateMinutes: lateMinutes
        },
        status: status,
        workHours: workHours,
        notes: notes
      });
      
      if (checkOutTime && checkOutTime.getTime() !== checkInTime.getTime()) {
        attendanceRecord.checkOut = {
          time: checkOutTime,
          location: 'ZKTeco Device',
          method: 'Biometric'
        };
      }
      
      await attendanceRecord.save();
      console.log(`  ✅ Created new record - Status: ${status} | Check-in: ${checkInTime.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})} | Check-out: ${checkOutTime ? checkOutTime.toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A'}`);
      
      presentEmployees++;
      totalRecordsProcessed++;
    }
    
    // Step 6: Disconnect from ZKTeco
    await zktecoService.disconnect();
    console.log('\n🔌 Disconnected from ZKTeco device');
    
    // Step 7: Summary
    console.log(`\n🎉 PROFESSIONAL ATTENDANCE PROCESSING COMPLETE!`);
    console.log(`  📊 Total records processed: ${totalRecordsProcessed}`);
    console.log(`  ✅ Present employees: ${presentEmployees}`);
    console.log(`  ⏰ Late check-ins: ${lateCheckIns}`);
    console.log(`  🚪 Missing check-outs: ${missingCheckOuts}`);
    
    // Step 8: Show sample verification
    console.log(`\n📋 Sample verification (first 5 employees with attendance):`);
    const todayAttendance = await Attendance.find({
      date: todayStartUTC
    }).populate('employee', 'firstName lastName employeeId').limit(5);
    
    for (const attendance of todayAttendance) {
      let checkInTime = 'N/A';
      let checkOutTime = 'N/A';
      
      if (attendance.checkIn?.time) {
        const checkInDate = new Date(attendance.checkIn.time);
        checkInTime = checkInDate.toLocaleString('en-US', {timeZone: 'Asia/Karachi'});
      }
      
      if (attendance.checkOut?.time) {
        const checkOutDate = new Date(attendance.checkOut.time);
        checkOutTime = checkOutDate.toLocaleString('en-US', {timeZone: 'Asia/Karachi'});
      }
      
      const status = attendance.status;
      const workHours = attendance.workHours;
      const employee = attendance.employee;
      
      console.log(`\n👤 ${employee.firstName} ${employee.lastName} (${employee.employeeId}):`);
      console.log(`  Status: ${status} | Check-in: ${checkInTime} | Check-out: ${checkOutTime} | Hours: ${workHours}h`);
      
      if (attendance.notes) {
        console.log(`  Notes: ${attendance.notes}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

processAttendanceProfessionally(); 