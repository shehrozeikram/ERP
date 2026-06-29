const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Try loading environment variables from different possible locations
const possibleEnvPaths = [
  path.join(__dirname, '../.env.production'), // Production root
  path.join(__dirname, '../server/.env'),     // Dev server folder
  path.join(__dirname, '../.env')             // Root
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment from ${envPath}`);
    dotenv.config({ path: envPath });
    break;
  }
}

const Employee = require('../server/models/hr/Employee');

async function fixSameerId() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB.');

    // 1. Fix Muhammad Sameer ID
    console.log('\n--- Task 1: Fixing Muhammad Sameer ID ---');
    const emp = await Employee.findOne({ employeeId: '06613' }) || await Employee.findOne({ firstName: /Muhammad/i, lastName: /Sameer/i });
    
    if (emp) {
      if (emp.employeeId === '05726') {
        console.log(`Muhammad Sameer already has correct ID: 05726`);
      } else {
        const oldId = emp.employeeId;
        const newId = '05726';
        console.log(`Updating Muhammad Sameer ID from ${oldId} to ${newId}...`);
        await Employee.updateOne({ _id: emp._id }, { $set: { employeeId: newId } });
        console.log('Successfully updated Sameer ID!');
      }
    } else {
      console.log('Could not find Muhammad Sameer (ID 06613).');
    }

    // 2. Remove specified employees
    console.log('\n--- Task 2: Removing Invalid Left Employees ---');
    const namesToRemove = ["Waqar", "Sumiya Khurshid Awan", "sheri khan", "hamza khan", "Muhammad Saad Ahsen", "Manahil Ameen"];
    
    for (const name of namesToRemove) {
      const users = await Employee.find({ $or: [
        { firstName: new RegExp(name, 'i') },
        { lastName: new RegExp(name, 'i') },
        { $expr: { $regexMatch: { input: { $concat: ["$firstName", " ", "$lastName"] }, regex: new RegExp(name, 'i') } } }
      ]});
      
      if (users.length > 0) {
        console.log(`Found ${users.length} match(es) for "${name}". Deleting...`);
        for (const user of users) {
          // Hard delete
          await Employee.deleteOne({ _id: user._id });
          console.log(` -> Deleted [${user.employeeId}] ${user.firstName} ${user.lastName}`);
        }
      } else {
        console.log(`No match found for "${name}".`);
      }
    }

    console.log('\nAll tasks completed successfully in production!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixSameerId();
