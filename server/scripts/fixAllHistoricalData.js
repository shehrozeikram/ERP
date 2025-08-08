#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function fixAllHistoricalData() {
  try {
    console.log('🔧 Fixing all historical attendance data...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get all employees
    const employees = await Employee.find({});
    console.log(`✅ Found ${employees.length} employees`);
    
    // Get all attendance records from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const allAttendance = await Attendance.find({
      date: { $gte: thirtyDaysAgo },
      isActive: true
    }).populate('employee', 'firstName lastName employeeId');
    
    console.log(`✅ Found ${allAttendance.length} attendance records`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Group attendance by employee and date
    const attendanceByEmployee = {};
    allAttendance.forEach(attendance => {
      const employeeId = attendance.employee.employeeId;
      const dateKey = attendance.date.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      
      if (!attendanceByEmployee[employeeId]) {
        attendanceByEmployee[employeeId] = {};
      }
      if (!attendanceByEmployee[employeeId][dateKey]) {
        attendanceByEmployee[employeeId][dateKey] = [];
      }
      attendanceByEmployee[employeeId][dateKey].push(attendance);
    });
    
    // Process each employee
    for (const employee of employees) {
      const employeeAttendance = attendanceByEmployee[employee.employeeId] || {};
      
      for (const [dateKey, records] of Object.entries(employeeAttendance)) {
        if (records.length === 0) continue;
        
        // Get the main attendance record (first one)
        const mainRecord = records[0];
        
        // Get all ZKTeco records for this employee on this date
        const zktecoRecords = records.filter(r => r.checkIn?.method === 'Biometric' || r.checkIn?.location === 'ZKTeco Device');
        
        if (zktecoRecords.length > 0) {
          // Sort by time to get earliest (check-in) and latest (check-out)
          const sortedRecords = zktecoRecords.sort((a, b) => {
            const timeA = a.checkIn?.time || new Date(0);
            const timeB = b.checkIn?.time || new Date(0);
            return timeA - timeB;
          });
          
          const earliestRecord = sortedRecords[0];
          const latestRecord = sortedRecords[sortedRecords.length - 1];
          
          let needsUpdate = false;
          
          // Check if check-in time needs updating
          if (earliestRecord.checkIn?.time) {
            const currentCheckIn = mainRecord.checkIn?.time;
            const earliestCheckIn = earliestRecord.checkIn.time;
            
            if (!currentCheckIn || Math.abs(currentCheckIn - earliestCheckIn) > 60000) { // 1 minute difference
              mainRecord.checkIn = {
                time: earliestCheckIn,
                location: 'ZKTeco Device',
                method: 'Biometric'
              };
              needsUpdate = true;
            }
          }
          
          // Check if check-out time needs updating
          if (latestRecord.checkOut?.time && latestRecord.checkOut.time !== earliestRecord.checkIn?.time) {
            const currentCheckOut = mainRecord.checkOut?.time;
            const latestCheckOut = latestRecord.checkOut.time;
            
            if (!currentCheckOut || Math.abs(currentCheckOut - latestCheckOut) > 60000) { // 1 minute difference
              mainRecord.checkOut = {
                time: latestCheckOut,
                location: 'ZKTeco Device',
                method: 'Biometric'
              };
              needsUpdate = true;
            }
          } else if (latestRecord.checkIn?.time && latestRecord.checkIn.time !== earliestRecord.checkIn?.time) {
            // If no check-out but multiple check-ins, use the latest as check-out
            const currentCheckOut = mainRecord.checkOut?.time;
            const latestCheckIn = latestRecord.checkIn.time;
            
            if (!currentCheckOut || Math.abs(currentCheckOut - latestCheckIn) > 60000) {
              mainRecord.checkOut = {
                time: latestCheckIn,
                location: 'ZKTeco Device',
                method: 'Biometric'
              };
              needsUpdate = true;
            }
          }
          
          if (needsUpdate) {
            try {
              await mainRecord.save();
              updatedCount++;
              console.log(`✅ Updated ${employee.firstName} ${employee.lastName} (${employee.employeeId}) - ${dateKey}`);
            } catch (error) {
              console.error(`❌ Error updating ${employee.firstName} ${employee.lastName} (${employee.employeeId}) - ${dateKey}:`, error.message);
              errorCount++;
            }
          }
        }
      }
    }
    
    console.log(`\n🎉 Successfully updated ${updatedCount} attendance records`);
    if (errorCount > 0) {
      console.log(`⚠️ ${errorCount} records had errors`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixAllHistoricalData(); 