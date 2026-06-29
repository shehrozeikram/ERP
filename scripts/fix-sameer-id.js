require('dotenv').config({ path: '../server/.env' });
const mongoose = require('mongoose');
const Employee = require('../server/models/hr/Employee');

async function fixSameerId() {
  try {
    // Ensure you load production env if running on production
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected.');

    console.log('Searching for Muhammad Sameer (ID 06613)...');
    const emp = await Employee.findOne({ employeeId: '06613' });
    
    if (!emp) {
      console.log('Employee with ID 06613 not found! Looking for him by name...');
      const fallbackEmp = await Employee.findOne({ firstName: /Muhammad/i, lastName: /Sameer/i });
      if (fallbackEmp) {
        console.log(`Found Muhammad Sameer but his ID is already ${fallbackEmp.employeeId}`);
      } else {
        console.log('Could not find Muhammad Sameer at all.');
      }
      process.exit(0);
    }

    const oldId = emp.employeeId;
    const newId = '05726';

    console.log(`Found employee. Updating ID from ${oldId} to ${newId}...`);
    await Employee.updateOne({ _id: emp._id }, { $set: { employeeId: newId } });
    
    console.log('Successfully updated Employee ID in production!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixSameerId();
