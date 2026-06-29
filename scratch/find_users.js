const mongoose = require('mongoose');
require('dotenv').config({ path: 'server/.env' });
const Employee = require('./server/models/hr/Employee');

async function findUsers() {
  await mongoose.connect(process.env.MONGODB_URI);
  const names = ["Waqar", "Sumiya Khurshid Awan", "sheri khan", "hamza khan", "Muhammad Saad Ahsen", "Manahil Ameen"];
  
  for (const name of names) {
    const users = await Employee.find({ $or: [
      { firstName: new RegExp(name, 'i') },
      { lastName: new RegExp(name, 'i') },
      { $expr: { $regexMatch: { input: { $concat: ["$firstName", " ", "$lastName"] }, regex: new RegExp(name, 'i') } } }
    ] });
    console.log(`Found ${users.length} for ${name}:`);
    users.forEach(u => console.log(` - [${u.employeeId}] ${u.firstName} ${u.lastName} (isActive: ${u.isActive}, status: ${u.employmentStatus})`));
  }
  process.exit(0);
}
findUsers();
