const mongoose = require('mongoose');
require('dotenv').config();
const Department = require('../models/hr/Department');

async function fixDepts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const result = await Department.deleteMany({ name: { $regex: /^nursing$/i } });
    console.log(`Deleted ${result.deletedCount} departments matching "nursing".`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
fixDepts();
