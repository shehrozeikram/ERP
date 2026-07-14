const mongoose = require('mongoose');
require('dotenv').config();

const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandMoza = require('../models/tajResidencia/LandMoza');

async function fixKakDeal() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const kakMoza = await LandMoza.findOne({ name: /kak/i });
    if (!kakMoza) {
      console.log('Kak moza not found in DB. Cannot proceed.');
      process.exit(1);
    }

    const sheikhpurMoza = await LandMoza.findOne({ name: /Sheikhpur/i });
    if (!sheikhpurMoza) {
      console.log('Sheikhpur moza not found in DB.');
      process.exit(1);
    }

    // Check if Deal 0.12 already exists for Kak
    const existingKakDeal = await LandPurchase.findOne({ dealNo: 0.12, moza: kakMoza._id });
    if (existingKakDeal) {
      console.log('Kak Deal No 0.12 ALREADY exists in production.');
      if (!existingKakDeal.isActive) {
        console.log('It is inactive. Reactivating...');
        existingKakDeal.isActive = true;
        await existingKakDeal.save();
        console.log('Reactivated successfully.');
      }
      process.exit(0);
    }

    // Find the Sheikhpur deal No 0.12 to clone
    const sheikhpurDeal = await LandPurchase.findOne({ dealNo: 0.12, moza: sheikhpurMoza._id }).lean();
    if (!sheikhpurDeal) {
      console.log('Could not find Sheikhpur Deal No 0.12 to use as a template!');
      process.exit(1);
    }

    console.log('Found Sheikhpur Deal No 0.12. Cloning it for Kak...');

    // Generate a new unique purchaseNo
    const lastPurchase = await LandPurchase.findOne().sort({ purchaseNo: -1 });
    let maxPurchaseNo = 'LP-001';
    if (lastPurchase && lastPurchase.purchaseNo) {
      const parts = lastPurchase.purchaseNo.split('-');
      if (parts.length > 1) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) {
          maxPurchaseNo = `LP-${String(num + 1).padStart(3, '0')}`;
        }
      }
    }

    // Create the new cloned deal
    const newKakDeal = { ...sheikhpurDeal };
    delete newKakDeal._id;
    delete newKakDeal.__v;
    delete newKakDeal.createdAt;
    delete newKakDeal.updatedAt;

    newKakDeal.moza = kakMoza._id;
    newKakDeal.purchaseNo = maxPurchaseNo;

    await LandPurchase.create(newKakDeal);
    console.log(`Successfully created Kak Deal No 0.12 with Purchase No: ${maxPurchaseNo}`);

    process.exit(0);
  } catch (error) {
    console.error('Error fixing Kak deal:', error);
    process.exit(1);
  }
}

fixKakDeal();
