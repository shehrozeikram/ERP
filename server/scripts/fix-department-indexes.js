const mongoose = require('mongoose');
require('dotenv').config();
const Department = require('../models/hr/Department');

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');
    
    // Sync indexes with the current schema (this drops old indexes not in the schema!)
    console.log('Syncing indexes for Department collection...');
    await Department.syncIndexes();
    
    console.log('Successfully removed old unique constraints (like "code") that are no longer in the schema.');
    console.log('You can now create the "Nursing" department!');
    
    process.exit(0);
  } catch (err) {
    console.error('ERROR OCCURRED:');
    console.error(err);
    process.exit(1);
  }
}
fixIndexes();
