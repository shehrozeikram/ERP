const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const LandMoza = require('../models/tajResidencia/LandMoza');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandTransfer = require('../models/tajResidencia/LandTransfer');

const MARLA_PER_KANAL = 20;
const SARSAIS_PER_KANAL = 180;

const areaToDecimalKanal = (area) => {
  const k = Number(area?.kanal) || 0;
  const m = Number(area?.marla) || 0;
  const s = Number(area?.sarsai) || 0;
  return k + (m / MARLA_PER_KANAL) + (s / SARSAIS_PER_KANAL);
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

async function run() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const uri = isProduction ? process.env.MONGODB_URI : (process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local');
    
    console.log(`Connecting to Database (${isProduction ? 'PRODUCTION' : 'LOCAL DEV'})...`);
    await mongoose.connect(uri);
    console.log('Connected.');

    const transfers = await LandTransfer.find({ isActive: { $ne: false } })
      .populate('moza')
      .populate({
        path: 'landPurchase',
        populate: { path: 'moza' }
      });

    console.log(`Checking ${transfers.length} transfers for moza and size mismatches...`);
    let mozaFixedCount = 0;
    let sizeFixedCount = 0;

    for (const t of transfers) {
      if (!t.landPurchase) {
        console.warn(`⚠️ Warning: Transfer ${t.referenceNo} has no linked LandPurchase. Skipping.`);
        continue;
      }

      let updated = false;

      // 1. Check Moza
      const correctMozaId = t.landPurchase.moza?._id || t.landPurchase.moza;
      if (correctMozaId) {
        const currentMozaIdStr = t.moza?._id?.toString() || t.moza?.toString();
        const correctMozaIdStr = correctMozaId.toString();

        if (currentMozaIdStr !== correctMozaIdStr) {
          const oldName = t.moza?.name || 'none';
          const newName = t.landPurchase.moza?.name || 'none';
          console.log(`Moza Mismatch found for Transfer Ref: ${t.referenceNo} (Deal: ${t.dealNo})`);
          console.log(`  - Old Moza: ${oldName} (${currentMozaIdStr})`);
          console.log(`  - Correct Moza (from Purchase): ${newName} (${correctMozaIdStr})`);

          t.moza = correctMozaId;
          updated = true;
          mozaFixedCount++;
        }
      }

      // 2. Check Purchase Land Area Size
      const purchaseTotalArea = t.landPurchase.totalArea || { kanal: 0, marla: 0, sarsai: 0 };
      const currentPurchaseArea = t.purchaseArea || { kanal: 0, marla: 0, sarsai: 0 };

      const diffKanal = Number(currentPurchaseArea.kanal) !== Number(purchaseTotalArea.kanal);
      const diffMarla = Number(currentPurchaseArea.marla) !== Number(purchaseTotalArea.marla);
      const diffSarsai = Math.abs((Number(currentPurchaseArea.sarsai) || 0) - (Number(purchaseTotalArea.sarsai) || 0)) > 0.001;

      if (diffKanal || diffMarla || diffSarsai) {
        console.log(`Size Mismatch found for Transfer Ref: ${t.referenceNo} (Deal: ${t.dealNo})`);
        console.log(`  - Old purchaseArea size: ${currentPurchaseArea.kanal}K ${currentPurchaseArea.marla}M ${currentPurchaseArea.sarsai}S`);
        console.log(`  - Correct purchaseArea size (from Purchase): ${purchaseTotalArea.kanal}K ${purchaseTotalArea.marla}M ${purchaseTotalArea.sarsai}S`);

        t.purchaseArea = purchaseTotalArea;
        t.purchaseSizeInKanal = roundMoney(areaToDecimalKanal(purchaseTotalArea));
        updated = true;
        sizeFixedCount++;
      }

      if (updated) {
        await t.save();
        console.log(`  ✅ Successfully updated Transfer ${t.referenceNo}`);
      }
    }

    console.log(`\n--- MIGRATION SUMMARY ---`);
    console.log(`Total mismatching transfer mozas updated: ${mozaFixedCount}`);
    console.log(`Total mismatching purchase sizes updated: ${sizeFixedCount}`);

    await mongoose.disconnect();
    console.log('Database disconnected.');
    process.exit(0);
  } catch (err) {
    console.error('Migration script failed:', err);
    process.exit(1);
  }
}

run();
