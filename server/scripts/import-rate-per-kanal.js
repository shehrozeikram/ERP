#!/usr/bin/env node
const isProd = process.argv.includes('--prod');
// On the server, deploy-simple.sh renames .env.production to .env
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const LandPurchase = require('../models/tajResidencia/LandPurchase');

const uri = isProd ? process.env.MONGODB_URI : (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp_local');

(async () => {
  try {
    if (!uri) {
      throw new Error('MONGODB_URI is not defined. Please check your .env file.');
    }
    await mongoose.connect(uri);
    console.log(`Connected to MongoDB (${isProd ? 'PRODUCTION' : 'LOCAL'}).`);

    const filePath = path.join(__dirname, '../../docs/LAND PURCHASED DATA for IMPORT.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log(`Found ${data.length} rows in the Excel file.`);

    let updatedCount = 0;
    let notFoundCount = 0;
    let skippedCount = 0;

    for (const row of data) {
      const purchaseNo = row['Land Purchase #'];
      const rawRate = row[' Rate / Kanal '];

      if (!purchaseNo) {
        skippedCount++;
        continue;
      }

      const ratePerKanal = Number(rawRate);
      if (isNaN(ratePerKanal) || ratePerKanal <= 0) {
        console.log(`Skipping ${purchaseNo} due to invalid rate: ${rawRate}`);
        skippedCount++;
        continue;
      }

      // Find the record
      const purchase = await LandPurchase.findOne({ purchaseNo: String(purchaseNo).trim() });
      if (!purchase) {
        console.log(`Purchase not found in DB: ${purchaseNo}`);
        notFoundCount++;
        continue;
      }

      // Update ratePerKanal
      await purchase.updateOne({ ratePerKanal: ratePerKanal });
      updatedCount++;
    }

    console.log('--- Import Summary ---');
    console.log(`Total Rows Processed: ${data.length}`);
    console.log(`Successfully Updated: ${updatedCount}`);
    console.log(`Not Found in DB:      ${notFoundCount}`);
    console.log(`Skipped (No Data):    ${skippedCount}`);

  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
})();
