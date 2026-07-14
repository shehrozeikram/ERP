const mongoose = require('mongoose');
require('dotenv').config();
const Department = require('../models/hr/Department');

async function fixDepts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    // Find ANY department containing "nurs" (case-insensitive)
    const depts = await Department.find({ name: { $regex: /nurs/i } });
    
    if (depts.length === 0) {
      console.log('No departments found containing "nurs".');
    } else {
      for (const d of depts) {
        console.log(`Found and deleting: "${d.name}" (isActive: ${d.isActive})`);
        await Department.findByIdAndDelete(d._id);
      }
      console.log('Successfully deleted them.');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
fixDepts();
