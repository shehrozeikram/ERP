const mongoose = require('mongoose');
require('dotenv').config();

const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandPurchase = require('../models/tajResidencia/LandPurchase');

async function checkTransfers() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const transfers = await LandTransfer.find({ dealNo: 0.12 })
      .populate('moza', 'name')
      .populate('landPurchase', 'purchaseNo')
      .sort({ transferNo: -1 })
      .lean();

    console.log(`Found ${transfers.length} transfers for Deal No 0.12:`);
    for (const t of transfers) {
      console.log(`- ${t.transferNo} | Ref: ${t.referenceNo} | Moza: ${t.moza?.name} | Purchase: ${t.landPurchase?.purchaseNo} | Intiqal: ${t.intiqalNo}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTransfers();
