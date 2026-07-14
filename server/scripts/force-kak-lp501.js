const mongoose = require('mongoose');
require('dotenv').config();

const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandMoza = require('../models/tajResidencia/LandMoza');

async function forceKakLP501() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const kakMoza = await LandMoza.findOne({ name: /kak/i });
    if (!kakMoza) {
      console.log('Kak moza not found in DB. Cannot proceed.');
      process.exit(1);
    }

    // Find the current Kak Deal No 0.12
    const kakDeal = await LandPurchase.findOne({ dealNo: 0.12, moza: kakMoza._id });
    if (!kakDeal) {
      console.log('Kak Deal No 0.12 not found in production.');
      process.exit(1);
    }

    if (kakDeal.purchaseNo === 'LP-501') {
      console.log('Kak deal is already LP-501. Nothing to do!');
      process.exit(0);
    }

    // Find whatever is holding LP-501 right now
    const conflictingDeal = await LandPurchase.findOne({ purchaseNo: 'LP-501' });
    
    if (conflictingDeal && conflictingDeal._id.toString() !== kakDeal._id.toString()) {
      console.log(`Found a conflicting deal holding LP-501 (Deal No: ${conflictingDeal.dealNo}).`);
      console.log('Renaming conflicting deal to free up LP-501...');
      
      // Temporarily rename the conflicting deal so the unique index is freed
      conflictingDeal.purchaseNo = `LP-501-DUMMY-${Date.now()}`;
      await conflictingDeal.save();
      console.log('Conflicting deal renamed.');
    }

    console.log(`Updating Kak Deal No 0.12 to be LP-501...`);
    kakDeal.purchaseNo = 'LP-501';
    await kakDeal.save();

    console.log(`Successfully updated Kak Deal No 0.12 to have Purchase No LP-501!`);
    process.exit(0);
  } catch (error) {
    console.error('Error enforcing LP-501 for Kak deal:', error);
    process.exit(1);
  }
}

forceKakLP501();
