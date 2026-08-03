const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Register all models to prevent MissingSchemaError
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandParty = require('../models/tajResidencia/LandParty');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandTransfer = require('../models/tajResidencia/LandTransfer');

async function run() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const uri = isProduction ? process.env.MONGODB_URI : (process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local');
    
    console.log(`Connecting to Database (${isProduction ? 'PRODUCTION' : 'LOCAL DEV'})...`);
    await mongoose.connect(uri);
    console.log('Connected.');

    const transfers = await LandTransfer.find({ isActive: true })
      .populate('moza', 'name')
      .populate({
        path: 'landPurchase',
        populate: { path: 'moza', select: 'name' }
      });

    console.log(`Checking ${transfers.length} transfers for moza mismatches...`);
    let fixedCount = 0;

    for (const t of transfers) {
      if (!t.moza) continue;

      const correctMozaId = t.moza._id?.toString() || t.moza.toString();
      const linkedPurchaseMozaId = t.landPurchase?.moza?._id?.toString() || t.landPurchase?.moza?.toString();

      // If the Moza linked to the transfer doesn't match the Moza of its linked landPurchase
      if (linkedPurchaseMozaId && correctMozaId !== linkedPurchaseMozaId) {
        console.log(`\nMismatch found for Transfer Ref: ${t.referenceNo} (Transfer No: ${t.transferNo}, Deal: ${t.dealNo})`);
        console.log(`  - Transfer Moza: ${t.moza.name || 'none'} (${correctMozaId})`);
        console.log(`  - Linked Purchase (${t.landPurchase?.purchaseNo || 'none'}) Moza: ${t.landPurchase?.moza?.name || 'none'} (${linkedPurchaseMozaId})`);

        // Find the correct LandPurchase record with the same dealNo and the correct moza
        const correctPurchase = await LandPurchase.findOne({
          dealNo: t.dealNo,
          moza: t.moza._id,
          isActive: true
        });

        if (correctPurchase) {
          console.log(`  - Found matching LandPurchase: ${correctPurchase.purchaseNo} (ID: ${correctPurchase._id})`);
          
          t.landPurchase = correctPurchase._id;
          t.purchaseNo = correctPurchase.purchaseNo;

          await t.save();
          console.log(`  ✅ Successfully updated Transfer ${t.referenceNo} to link to ${correctPurchase.purchaseNo}`);
          fixedCount++;
        } else {
          console.log(`  ⚠️ Warning: Could not find LandPurchase with Deal No: ${t.dealNo} in Moza: ${t.moza.name}. Skipping auto-fix.`);
        }
      }
    }

    console.log(`\n--- FIXED SUMMARY ---`);
    console.log(`Total mismatching transfers updated: ${fixedCount}`);

    await mongoose.disconnect();
    console.log('Database disconnected.');
    process.exit(0);
  } catch (err) {
    console.error('Migration script failed:', err);
    process.exit(1);
  }
}

run();
