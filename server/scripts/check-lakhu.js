const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const LandMoza = require('../models/tajResidencia/LandMoza');
    const LandPurchase = require('../models/tajResidencia/LandPurchase');
    const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');

    const lakhu = await LandMoza.findOne({ name: /Lakhu/i });
    if (!lakhu) {
      console.log('Lakhu Moza not found in DB!');
      process.exit(0);
    }
    
    console.log('Found Lakhu Moza ID:', lakhu._id);
    
    const entryCount = await LandMozaKhasraEntry.countDocuments({ moza: lakhu._id });
    console.log('Total Khasra Entries inside Lakhu:', entryCount);

    const count = await LandPurchase.countDocuments({ moza: lakhu._id, isActive: true });
    console.log('Total ACTIVE Land Purchase Deals for Lakhu:', count);

    const inactiveCount = await LandPurchase.countDocuments({ moza: lakhu._id, isActive: false });
    console.log('Total INACTIVE Land Purchase Deals for Lakhu:', inactiveCount);

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

run();
