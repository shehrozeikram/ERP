const mongoose = require('mongoose');
require('dotenv').config();

const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandRegistry = require('../models/tajResidencia/LandRegistry');
const LandPossession = require('../models/tajResidencia/LandPossession');

async function fixDealNo() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);

    // Find any purchases with a crazy high dealNo
    const anomalousPurchases = await LandPurchase.find({ dealNo: { $gt: 10000 } });
    console.log(`Found ${anomalousPurchases.length} anomalous purchases with dealNo > 10000.`);

    for (const p of anomalousPurchases) {
      console.log(`Fixing Purchase ID: ${p._id}, Old Deal No: ${p.dealNo}, Purchase No: ${p.purchaseNo}`);
      
      // We will assign it the correct next deal no that is < 10000
      const allNormalPurchases = await LandPurchase.find({ dealNo: { $lt: 10000 } }).lean();
      let maxNormalDeal = 0;
      for (const normal of allNormalPurchases) {
        const deal = Number(normal.dealNo);
        if (!Number.isNaN(deal) && deal > maxNormalDeal) {
          maxNormalDeal = deal;
        }
      }
      
      const nextDealNo = maxNormalDeal + 1;
      const oldDealNo = p.dealNo;

      // Update the Purchase
      p.dealNo = nextDealNo;
      await p.save();
      console.log(`  -> Updated Purchase dealNo to ${nextDealNo}`);

      // Now we must also update any Transfers, Registries, and Possessions that have the old deal no!
      const transfers = await LandTransfer.updateMany({ dealNo: oldDealNo }, { $set: { dealNo: nextDealNo } });
      const registries = await LandRegistry.updateMany({ dealNo: oldDealNo }, { $set: { dealNo: nextDealNo } });
      const possessions = await LandPossession.updateMany({ dealNo: oldDealNo }, { $set: { dealNo: nextDealNo } });

      console.log(`  -> Updated ${transfers.modifiedCount} Transfers, ${registries.modifiedCount} Registries, ${possessions.modifiedCount} Possessions`);
    }

    console.log('\nAll anomalous deal numbers fixed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error fixing deal numbers:', err);
    process.exit(1);
  }
}

fixDealNo();
