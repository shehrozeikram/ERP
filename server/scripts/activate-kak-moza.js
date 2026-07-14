const mongoose = require('mongoose');
require('dotenv').config();

const LandMoza = require('../models/tajResidencia/LandMoza');

async function activateKakMoza() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const kakMoza = await LandMoza.findOne({ name: /kak/i });
    if (!kakMoza) {
      console.log('Kak Moza not found in DB!');
      process.exit(1);
    }

    console.log(`Found Kak Moza: ${kakMoza.name} (isActive: ${kakMoza.isActive})`);

    if (!kakMoza.isActive) {
      console.log('Activating Kak Moza...');
      kakMoza.isActive = true;
      await kakMoza.save();
      console.log('Kak Moza is now ACTIVE.');
    } else {
      console.log('Kak Moza is already active.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error activating Kak Moza:', error);
    process.exit(1);
  }
}

activateKakMoza();
