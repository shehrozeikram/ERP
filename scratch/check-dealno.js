const mongoose = require('mongoose');
require('dotenv').config();

const LandPurchase = require('../models/tajResidencia/LandPurchase');

async function fixDealNo() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);

    const anomalousPurchases = await LandPurchase.find({ dealNo: { $gt: 1000 } });
    console.log(`Found ${anomalousPurchases.length} anomalous purchases with dealNo > 1000.`);

    for (const p of anomalousPurchases) {
      console.log(`- Purchase ID: ${p._id}, Deal No: ${p.dealNo}, Purchase No: ${p.purchaseNo}`);
      
      // We will set them to 0 or null, or recalculate them properly.
      // Since they mess up the calculation, setting to a low value or just the next available
      // The user wants it to continue from 823.
      // So if we just set this anomalous one to 824, or if it's junk, delete it.
      // Wait, let's just reset the anomalous dealNo to 0 so the calculation ignores it
      // or we can just print it first to be safe.
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixDealNo();
