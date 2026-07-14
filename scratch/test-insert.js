const mongoose = require('mongoose');
require('dotenv').config();
const Department = require('../models/hr/Department');

async function testInsert() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Attempting to create Nursing department...');
    const dept = new Department({ name: 'Nursing Test' });
    await dept.save();
    console.log('Successfully created! ID:', dept._id);
    
    // Now delete it
    await Department.findByIdAndDelete(dept._id);
    console.log('Cleaned up test department.');
    process.exit(0);
  } catch (err) {
    console.error('ERROR OCCURRED:');
    console.error(err);
    process.exit(1);
  }
}
testInsert();
