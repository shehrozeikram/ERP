require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Employee = require('../models/hr/Employee');
  const User = require('../models/User');

  const emp = await Employee.findOne({ phone: { $exists: true, $ne: '' } }).select('email phone firstName lastName employeeId').lean();
  console.log('SAMPLE EMP:', JSON.stringify(emp, null, 2));

  const user = await User.findOne().lean();
  console.log('USER KEYS:', Object.keys(user));

  const usersWithEmpId = await User.countDocuments({ employeeId: { $exists: true, $ne: null, $ne: '' } });
  console.log('Users with employeeId:', usersWithEmpId);

  // Check how many users have email matching any employee
  const empEmails = (await Employee.find({ email: { $exists: true, $ne: '' } }).select('email').lean()).map(e => e.email?.toLowerCase());
  const matchedUsers = await User.countDocuments({ email: { $in: empEmails } });
  console.log('Users whose email matches an employee email:', matchedUsers, '/ total employees with email:', empEmails.length);

  await mongoose.disconnect();
});
