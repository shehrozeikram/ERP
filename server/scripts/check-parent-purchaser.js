const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandPurchase = require('../models/tajResidencia/LandPurchase');

async function run() {
  try {
    const uri = process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local';
    await mongoose.connect(uri);

    const transfers = await LandTransfer.find({ isActive: true })
      .populate('purchaser', 'name')
      .populate({
        path: 'landPurchase',
        populate: { path: 'purchaser', select: 'name' }
      })
      .lean();

    console.log('Total active transfers:', transfers.length);

    const unassigned = transfers.filter(t => !t.purchaser && !t.purchaserName);
    console.log('Unassigned transfers (In Progress):', unassigned.length);

    let canInheritCount = 0;
    for (const t of transfers) {
      const currentPurchaserName = t.purchaser?.name || t.purchaserName || 'In Progress';
      const parentPurchaserName = t.landPurchase?.purchaser?.name || 'No Parent Purchaser';

      if (currentPurchaserName === 'In Progress') {
        console.log(`Transfer ${t.transferNo} (${t.referenceNo}):`);
        console.log(`  - Parent Purchase: ${t.purchaseNo} (Deal No: ${t.dealNo})`);
        console.log(`  - Parent Purchaser: ${parentPurchaserName}`);
        if (t.landPurchase?.purchaser) {
          canInheritCount++;
        }
      }
    }

    console.log(`\nOf the unassigned transfers, ${canInheritCount} can inherit the purchaser from their parent Land Purchase.`);
    mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

run();
