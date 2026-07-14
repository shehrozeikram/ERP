const mongoose = require('mongoose');
require('dotenv').config();

const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandTransfer = require('../models/tajResidencia/LandTransfer');

async function linkKakTransfers() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const kakMoza = await LandMoza.findOne({ name: /kak/i });
    if (!kakMoza) {
      console.log('Kak moza not found in DB. Cannot proceed.');
      process.exit(1);
    }

    // Find the Kak deal (which we just forced to LP-501)
    const kakDeal = await LandPurchase.findOne({ purchaseNo: 'LP-501', moza: kakMoza._id });
    if (!kakDeal) {
      console.log('Kak Deal LP-501 not found in production.');
      process.exit(1);
    }

    // Find all transfers that belong to Kak Moza and Deal No 0.12
    const kakTransfers = await LandTransfer.find({ moza: kakMoza._id, dealNo: 0.12 });
    
    if (kakTransfers.length === 0) {
      console.log('No Kak transfers found for Deal No 0.12. They might have been deleted or not imported.');
      process.exit(0);
    }

    console.log(`Found ${kakTransfers.length} Kak transfers for Deal No 0.12. Relinking to LP-501...`);
    
    let updatedCount = 0;
    for (const transfer of kakTransfers) {
      if (transfer.landPurchase.toString() !== kakDeal._id.toString()) {
        transfer.landPurchase = kakDeal._id;
        await transfer.save();
        updatedCount++;
      }
    }

    console.log(`Successfully relinked ${updatedCount} Kak transfers to LP-501!`);
    process.exit(0);
  } catch (error) {
    console.error('Error relinking Kak transfers:', error);
    process.exit(1);
  }
}

linkKakTransfers();
