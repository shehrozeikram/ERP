#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function checkHistoricalData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Find Sardar Shehroze Ikram
    const employee = await Employee.findOne({employeeId: '6035'});
    if (!employee) {
      console.log('Employee not found');
      return;
    }
    
    console.log(`\n📊 ${employee.firstName} ${employee.lastName} (${employee.employeeId}) - Attendance History:`);
    
    const attendance = await Attendance.find({
      employee: employee._id
    }).sort({date: -1}).limit(7);
    
    attendance.forEach(a => {
      const checkInTime = a.checkIn?.time ? new Date(a.checkIn.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
      const checkOutTime = a.checkOut?.time ? new Date(a.checkOut.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
      console.log(`  ${a.date.toLocaleDateString('en-US', {timeZone: 'Asia/Karachi'})} - Check-in: ${checkInTime} | Check-out: ${checkOutTime}`);
    });
    
    // Also check Haris Naseer Satti
    const haris = await Employee.findOne({employeeId: '6036'});
    if (haris) {
      console.log(`\n📊 ${haris.firstName} ${haris.lastName} (${haris.employeeId}) - Attendance History:`);
      
      const harisAttendance = await Attendance.find({
        employee: haris._id
      }).sort({date: -1}).limit(3);
      
      harisAttendance.forEach(a => {
        const checkInTime = a.checkIn?.time ? new Date(a.checkIn.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
        const checkOutTime = a.checkOut?.time ? new Date(a.checkOut.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'}) : 'N/A';
        console.log(`  ${a.date.toLocaleDateString('en-US', {timeZone: 'Asia/Karachi'})} - Check-in: ${checkInTime} | Check-out: ${checkOutTime}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkHistoricalData(); 