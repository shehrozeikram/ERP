#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

async function quickCheck() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const today = new Date();
    const pakistanOffset = 5 * 60 * 60 * 1000;
    const todayStart = new Date(today.getTime() - pakistanOffset);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const attendance = await Attendance.find({
      date: { $gte: todayStart, $lt: todayEnd },
      isActive: true
    }).populate('employee', 'firstName lastName employeeId');
    
    console.log('✅ Employees with check-out times:');
    const withCheckout = attendance.filter(a => a.checkOut && a.checkOut.time);
    
    withCheckout.forEach(a => {
      const checkIn = new Date(a.checkIn.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'});
      const checkOut = new Date(a.checkOut.time).toLocaleString('en-US', {timeZone: 'Asia/Karachi'});
      console.log(`  ${a.employee.firstName} ${a.employee.lastName} - Check-in: ${checkIn} | Check-out: ${checkOut}`);
    });
    
    console.log(`\n📊 Summary: ${withCheckout.length}/${attendance.length} employees have check-out times`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

quickCheck(); 