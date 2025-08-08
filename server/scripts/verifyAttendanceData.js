#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function verifyAttendanceData() {
  try {
    console.log('🔍 VERIFYING ATTENDANCE DATA...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get total attendance records
    const totalRecords = await Attendance.countDocuments();
    console.log(`📊 Total attendance records: ${totalRecords}`);
    
    // Get sample employees
    const sampleEmployees = await Employee.find({ isDeleted: { $ne: true } }).limit(5);
    
    console.log('\n📋 VERIFICATION RESULTS:');
    console.log('='.repeat(80));
    
    for (const employee of sampleEmployees) {
      const recentAttendance = await Attendance.find({
        employee: employee._id
      }).sort({date: -1}).limit(3);
      
      if (recentAttendance.length > 0) {
        console.log(`\n👤 ${employee.firstName} ${employee.lastName} (${employee.employeeId}):`);
        recentAttendance.forEach(a => {
          const checkInTime = a.checkIn?.time ? new Date(a.checkIn.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
          const checkOutTime = a.checkOut?.time ? new Date(a.checkOut.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
          const dateStr = a.date.toLocaleDateString('en-US', {timeZone: 'Asia/Karachi'});
          console.log(`  ${dateStr} - Check-in: ${checkInTime} | Check-out: ${checkOutTime}`);
        });
      } else {
        console.log(`\n👤 ${employee.firstName} ${employee.lastName} (${employee.employeeId}): No attendance records`);
      }
    }
    
    // Check for any records with incorrect times (3-4 AM check-ins)
    console.log('\n🔍 Checking for incorrect times...');
    const incorrectRecords = await Attendance.find({
      'checkIn.time': {
        $gte: new Date('2025-08-01T03:00:00.000Z'),
        $lte: new Date('2025-08-08T04:00:00.000Z')
      }
    }).populate('employee', 'firstName lastName employeeId');
    
    if (incorrectRecords.length > 0) {
      console.log(`⚠️  Found ${incorrectRecords.length} records with potentially incorrect times (3-4 AM):`);
      incorrectRecords.slice(0, 5).forEach(record => {
        const checkInTime = new Date(record.checkIn.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'});
        console.log(`  ${record.employee.firstName} ${record.employee.lastName} (${record.employee.employeeId}): ${checkInTime}`);
      });
    } else {
      console.log('✅ No incorrect times found!');
    }
    
    console.log('\n🎉 VERIFICATION COMPLETE!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

verifyAttendanceData(); 