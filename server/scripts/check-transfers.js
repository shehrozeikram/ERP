const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const LandTransfer = require('../models/tajResidencia/LandTransfer');

async function run() {
  try {
    const uri = process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local';
    await mongoose.connect(uri);

    const transfers = await LandTransfer.find({ isActive: true })
      .populate('purchaser', 'name')
      .lean();

    console.log('--- ALL ACTIVE TRANSFERS ---');
    for (const t of transfers) {
      console.log(`Ref: ${t.referenceNo}, PurchaseNo: ${t.purchaseNo}, PurchaserID: ${t.purchaser?._id || 'null'}, PurchaserPopulatedName: ${t.purchaser?.name || 'null'}, PurchaserNameField: ${t.purchaserName || 'null'}`);
    }

    mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

run();
