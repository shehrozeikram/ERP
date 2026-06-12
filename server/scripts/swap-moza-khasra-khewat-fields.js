#!/usr/bin/env node
/**
 * One-time fix: swap khasraNo and khewatNo on all moza khasra entries
 * (columns were imported/displayed in the wrong order).
 *
 * Usage:
 *   node server/scripts/swap-moza-khasra-khewat-fields.js
 *   NODE_ENV=production node server/scripts/swap-moza-khasra-khewat-fields.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');

async function main() {
  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('No MongoDB URI configured');
    process.exit(1);
  }

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));
  const entries = await LandMozaKhasraEntry.find({});
  let updated = 0;

  for (const entry of entries) {
    const prevKhasra = entry.khasraNo;
    const prevKhewat = entry.khewatNo;
    entry.khasraNo = prevKhewat;
    entry.khewatNo = prevKhasra;
    await entry.save();
    updated += 1;
  }

  console.log(`Swapped khasraNo ↔ khewatNo on ${updated} moza khasra record(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
