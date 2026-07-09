const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const envPaths = [
  path.resolve(__dirname, '../../.env'), // Prod
  path.resolve(__dirname, '../.env'),    // Local
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Found .env file at ${envPath}`);
    require('dotenv').config({ path: envPath });
    break;
  }
}

async function run() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    let uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sgc_erp';
    if (!isProduction && process.env.MONGODB_URI_LOCAL) {
      uri = process.env.MONGODB_URI_LOCAL;
    }
    
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(uri);
    
    const LandMoza = require('../models/tajResidencia/LandMoza');
    
    // Find Sheikhpur
    const moza = await LandMoza.findOne({ name: /Sheikhpur/i });
    if (!moza) {
      console.log('Sheikhpur Moza not found!');
      process.exit(1);
    }
    
    moza.isActive = true;
    await moza.save();
    
    console.log(`Successfully activated Moza: ${moza.name}`);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
