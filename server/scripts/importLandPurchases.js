#!/usr/bin/env node
/**
 * Import Land Purchases from an Excel file.
 * Automatically creates Sellers, Dealers, and Mozas if they don't exist.
 *
 * Usage:
 *   node server/scripts/importLandPurchases.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const xlsx = require('xlsx');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');

const LandParty = require('../models/tajResidencia/LandParty');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandPurchase = require('../models/tajResidencia/LandPurchase');

const run = async () => {
  const { uri: mongoUri, isLocal } = getMongoUri();
  await mongoose.connect(mongoUri, getMongooseClientOptions(mongoUri, isLocal));
  console.log('Connected to database. Starting import...');

  // Try to drop the unique index on dealNo if it exists
  try {
    await LandPurchase.collection.dropIndex('dealNo_1');
    console.log('Dropped dealNo_1 index to allow duplicate deal numbers.');
  } catch (err) {
    if (err.codeName === 'IndexNotFound') {
      console.log('Index dealNo_1 does not exist, skipping drop.');
    } else {
      console.log('Warning dropping index:', err.message);
    }
  }

  const filePath = path.join(__dirname, '..', '..', 'docs', 'LAND DATA for IT.htm.xlsx');
  console.log(`Reading Excel file: ${filePath}`);
  
  const workbook = xlsx.readFile(filePath);
  const sheetName = 'Sheet1';
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    console.error(`Sheet "${sheetName}" not found. Exiting.`);
    process.exit(1);
  }

  const data = xlsx.utils.sheet_to_json(sheet, { raw: false });
  console.log(`Found ${data.length} rows.`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let partiesCreated = 0;
  let mozasCreated = 0;

  for (const row of data) {
    try {
      const purchaseNo = row['Land Purchase #'];
      if (!purchaseNo) {
        console.log('Skipping row without Land Purchase #:', row);
        errors++;
        continue;
      }

      // 1. Resolve Moza
      const mozaName = (row['Moza'] || '').trim();
      let mozaDoc = null;
      if (mozaName) {
        const slug = mozaName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        mozaDoc = await LandMoza.findOne({ slug });
        if (!mozaDoc) {
          mozaDoc = await LandMoza.create({ name: mozaName, slug });
          partiesCreated++; // Wait, mozasCreated
          mozasCreated++;
        }
      }

      // 2. Resolve Seller
      const sellerName = (row['Seller name'] || '').trim();
      const sellerCNIC = (row['Seller CNIC'] || '').trim();
      let sellerDoc = null;
      if (sellerCNIC && sellerName) {
        sellerDoc = await LandParty.findOne({ partyType: 'seller', cnic: sellerCNIC });
        if (!sellerDoc) {
          sellerDoc = await LandParty.create({ partyType: 'seller', name: sellerName, cnic: sellerCNIC, phoneNumber: '00000000000' });
          partiesCreated++;
        }
      }

      // 3. Resolve Dealer (Agent)
      const dealerName = (row['Agent '] || '').trim();
      const dealerCNIC = (row['Agent CNIC'] || '').trim();
      let dealerDoc = null;
      if (dealerCNIC && dealerName) {
        dealerDoc = await LandParty.findOne({ partyType: 'dealer', cnic: dealerCNIC });
        if (!dealerDoc) {
          dealerDoc = await LandParty.create({ partyType: 'dealer', name: dealerName, cnic: dealerCNIC, phoneNumber: '00000000000' });
          partiesCreated++;
        }
      }

      // Parse Amounts
      const rawAmount = row['Land Purchase'] || '0';
      const cleanAmount = Number(String(rawAmount).replace(/,/g, ''));

      // Construct LandPurchase
      const purchaseData = {
        purchaseNo,
        dealNo: Number(row['Deal No'] || 0),
        purchaseDate: row['Date'] ? new Date(row['Date']) : new Date(),
        project: row['Project'] || 'Taj Residencia',
        seller: sellerDoc ? sellerDoc._id : null,
        dealer: dealerDoc ? dealerDoc._id : null,
        moza: mozaDoc ? mozaDoc._id : null,
        lines: [
          {
            khasraNo: row['Khasra'] || '',
            khewatNo: ''
          }
        ],
        totalArea: {
          kanal: Number(row['Kanal']) || 0,
          marla: Number(row['Marla']) || 0,
          sarsai: Number(row['Sarsai']) || 0
        },
        agreedAmount: cleanAmount
      };

      // Ensure required fields
      if (!purchaseData.seller || !purchaseData.moza) {
        console.log(`Skipping ${purchaseNo} due to missing seller or moza.`);
        errors++;
        continue;
      }

      // Check existence
      const exists = await LandPurchase.findOne({ purchaseNo });
      if (exists) {
        skipped++;
      } else {
        await LandPurchase.create(purchaseData);
        inserted++;
      }

    } catch (err) {
      console.error(`Error inserting row:`, row, err.message);
      errors++;
    }
  }

  console.log(`\nFinished Import:`);
  console.log(`- Inserted Land Purchases: ${inserted}`);
  console.log(`- Skipped (Duplicates): ${skipped}`);
  console.log(`- Errors: ${errors}`);
  console.log(`- New Parties Created: ${partiesCreated}`);
  console.log(`- New Mozas Created: ${mozasCreated}`);

  console.log('\nImport complete. Disconnecting from database...');
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Fatal error during import:', err);
  process.exit(1);
});
