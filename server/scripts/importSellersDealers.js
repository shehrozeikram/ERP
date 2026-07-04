#!/usr/bin/env node
/**
 * Import Sellers and Dealers from an Excel file into the LandParty collection.
 *
 * Usage:
 *   node server/scripts/importSellersDealers.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const xlsx = require('xlsx');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const LandParty = require('../models/tajResidencia/LandParty');

const run = async () => {
  const { uri: mongoUri, isLocal } = getMongoUri();
  await mongoose.connect(mongoUri, getMongooseClientOptions(mongoUri, isLocal));
  
  console.log('Connected to database. Starting import...');

  const filePath = path.join(__dirname, '..', '..', 'docs', 'Sellers and Dealers Information.xlsx');
  console.log(`Reading Excel file: ${filePath}`);
  
  const workbook = xlsx.readFile(filePath);

  const sheetsToProcess = [
    {
      sheetName: 'Dealers ',
      partyType: 'dealer',
      mapRow: (row) => ({
        partyType: 'dealer',
        name: row['Dealer Name'],
        cnic: row['CNIC'],
        phoneNumber: row['Phone #'],
        partyDate: row['Date'] ? new Date(row['Date']) : null
      })
    },
    {
      sheetName: 'Seller',
      partyType: 'seller',
      mapRow: (row) => ({
        partyType: 'seller',
        name: row['Name'],
        cnic: row['Cnic No.'],
        phoneNumber: row['Contact No.'],
        partyDate: row['Date'] ? new Date(row['Date']) : null
      })
    }
  ];

  for (const config of sheetsToProcess) {
    console.log(`\nProcessing sheet: ${config.sheetName} (Type: ${config.partyType})`);
    const sheet = workbook.Sheets[config.sheetName];
    if (!sheet) {
      console.log(`Sheet "${config.sheetName}" not found. Skipping.`);
      continue;
    }
    
    // Read with raw: false to get formatted dates like "11-Mar-26" instead of serial numbers
    const data = xlsx.utils.sheet_to_json(sheet, { raw: false });
    console.log(`Found ${data.length} rows.`);

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of data) {
      try {
        const mappedData = config.mapRow(row);
        
        if (!mappedData.name || !mappedData.cnic || !mappedData.phoneNumber) {
          console.log(`Skipping invalid row (missing name/cnic/phone):`, row);
          errors++;
          continue;
        }

        // Clean CNIC (optional, depending on how strict we are, but let's keep it as is from excel if it's formatted)
        // Clean phone number etc.
        const filter = { partyType: config.partyType, cnic: mappedData.cnic };
        
        // upsert: false because we don't want to update existing records, just insert new ones if they don't exist
        const exists = await LandParty.findOne(filter);
        if (exists) {
          skipped++;
        } else {
          await LandParty.create(mappedData);
          inserted++;
        }
      } catch (err) {
        console.error(`Error inserting row:`, row, err.message);
        errors++;
      }
    }

    console.log(`Finished ${config.sheetName}:`);
    console.log(`- Inserted: ${inserted}`);
    console.log(`- Skipped (Duplicates): ${skipped}`);
    console.log(`- Errors: ${errors}`);
  }

  console.log('\nImport complete. Disconnecting from database...');
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Fatal error during import:', err);
  process.exit(1);
});
