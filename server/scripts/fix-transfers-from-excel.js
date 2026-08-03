const mongoose = require('mongoose');
const XLSX = require('xlsx');
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

    const excelFile = path.join(__dirname, '../../docs/Land Transfer detail.xlsx');
    console.log(`Reading Excel file: ${excelFile}`);
    const workbook = XLSX.readFile(excelFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
    console.log(`Read ${data.length} rows from Excel.`);

    // Load active mozas for resolution mapping
    const mozas = await LandMoza.find();
    const getMozaId = (name) => {
      let n = (name || 'Unknown Moza').toLowerCase().trim();
      if (n === 'ropa') n = 'rupa';
      const found = mozas.find(m => m.name.toLowerCase().trim() === n);
      return found ? found._id : null;
    };

    let fixedCount = 0;
    let notFoundTransfers = 0;
    let notFoundPurchases = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      let dealNo = row['Deal No.'];
      if (dealNo === null || dealNo === undefined) continue;

      const baseRef = row['Reference No.'] ? String(row['Reference No.']).trim() : 'T';
      const referenceNo = `${baseRef}_R${i+2}`;

      const correctMozaId = getMozaId(row['Moza']);
      if (!correctMozaId) {
        console.warn(`Row ${i+2}: Could not resolve Moza ID for "${row['Moza']}"`);
        continue;
      }

      // Find transfer in DB by referenceNo
      const transfer = await LandTransfer.findOne({ referenceNo, isActive: true });
      if (!transfer) {
        notFoundTransfers++;
        continue;
      }

      // Find the correct LandPurchase by dealNo and Moza
      const correctPurchase = await LandPurchase.findOne({
        dealNo: Number(dealNo),
        moza: correctMozaId,
        isActive: true
      });

      if (!correctPurchase) {
        notFoundPurchases++;
        if (notFoundPurchases <= 10) {
          console.warn(`Row ${i+2}: Could not find LandPurchase for Deal ${dealNo} in Moza ${row['Moza']}`);
        }
        continue;
      }

      const currentMozaId = transfer.moza?._id?.toString() || transfer.moza?.toString();
      const currentPurchaseId = transfer.landPurchase?._id?.toString() || transfer.landPurchase?.toString();

      const needsMozaFix = currentMozaId !== correctMozaId.toString();
      const needsPurchaseFix = currentPurchaseId !== correctPurchase._id.toString();

      if (needsMozaFix || needsPurchaseFix) {
        console.log(`\nRow ${i+2} Mismatch: Ref ${referenceNo} (Deal ${dealNo})`);
        if (needsMozaFix) console.log(`  - Moza: current (${currentMozaId}) -> correct (${correctMozaId} - ${row['Moza']})`);
        if (needsPurchaseFix) console.log(`  - Purchase: current (${currentPurchaseId}) -> correct (${correctPurchase._id} - ${correctPurchase.purchaseNo})`);

        transfer.moza = correctMozaId;
        transfer.landPurchase = correctPurchase._id;
        transfer.purchaseNo = correctPurchase.purchaseNo;

        await transfer.save();
        console.log(`  ✅ Successfully updated.`);
        fixedCount++;
      }
    }

    console.log(`\n--- EXCEL-BASED FIX SUMMARY ---`);
    console.log(`Total mismatching transfers corrected: ${fixedCount}`);
    console.log(`Transfers not found in DB: ${notFoundTransfers}`);
    console.log(`Purchases not found in DB: ${notFoundPurchases}`);

    await mongoose.disconnect();
    console.log('Database disconnected.');
    process.exit(0);
  } catch (err) {
    console.error('Excel-based fix script failed:', err);
    process.exit(1);
  }
}

run();
