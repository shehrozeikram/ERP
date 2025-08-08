#!/usr/bin/env node

/**
 * Check Today's Attendance Records
 * 
 * This script checks what attendance records exist in the database for today.
 * 
 * Usage: node server/scripts/checkTodayAttendance.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function checkTodayAttendance() {
  try {
    console.log('🔍 Checking today\'s attendance records...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get today's date in Pakistan timezone
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    console.log(`📅 Checking attendance for: ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);

    // Find all attendance records for today
    const todayAttendance = await Attendance.find({
      date: {
        $gte: todayStart,
        $lt: todayEnd
      },
      isActive: true
    }).populate('employee', 'firstName lastName employeeId');

    console.log(`📊 Found ${todayAttendance.length} attendance records for today`);

    if (todayAttendance.length === 0) {
      console.log('❌ No attendance records found for today');
    } else {
      console.log('\n📋 Today\'s Attendance Records:');
      console.log('────────────────────────────────────────────────────────────────────────────────');
      
      todayAttendance.forEach((record, index) => {
        const employee = record.employee;
        const checkIn = record.checkIn ? new Date(record.checkIn.time).toLocaleString('en-US', { timeZone: 'Asia/Karachi' }) : 'N/A';
        const checkOut = record.checkOut ? new Date(record.checkOut.time).toLocaleString('en-US', { timeZone: 'Asia/Karachi' }) : 'N/A';
        
        console.log(`${index + 1}. ${employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'} (ID: ${employee ? employee.employeeId : 'N/A'})`);
        console.log(`   Check-in:  ${checkIn}`);
        console.log(`   Check-out: ${checkOut}`);
        console.log(`   Status:    ${record.status || 'N/A'}`);
        console.log(`   Method:    ${record.checkIn ? record.checkIn.method : 'N/A'}`);
        console.log('');
      });
    }

    // Check for recent attendance records (last 7 days)
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentAttendance = await Attendance.find({
      date: {
        $gte: weekAgo,
        $lt: todayEnd
      },
      isActive: true
    }).populate('employee', 'firstName lastName employeeId');

    console.log(`📊 Recent attendance records (last 7 days): ${recentAttendance.length}`);

    // Check for attendance records by date
    const attendanceByDate = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: weekAgo },
          isActive: true
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ]);

    console.log('\n📅 Attendance Records by Date (last 7 days):');
    attendanceByDate.forEach(item => {
      console.log(`   ${item._id}: ${item.count} records`);
    });

  } catch (error) {
    console.error('❌ Error checking today\'s attendance:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Run the check
checkTodayAttendance(); 