const mongoose = require('mongoose');
require('dotenv').config();
const Department = require('../models/hr/Department');

async function checkDepts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const depts = await Department.find({});
    console.log(`Found ${depts.length} departments.`);
    
    depts.forEach(d => console.log(`${d.name} - active: ${d.isActive}`));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkDepts();
