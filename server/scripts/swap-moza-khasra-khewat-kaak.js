#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');

async function main() {
  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('No MongoDB URI configured');
    process.exit(1);
  }

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));
  
  const moza = await LandMoza.findOne({ name: { $regex: /kaak/i } });
  if (!moza) {
    console.error('Moza Kaak not found');
    await mongoose.disconnect();
    process.exit(1);
  }

  const entries = await LandMozaKhasraEntry.find({ moza: moza._id });
  let updated = 0;

  for (const entry of entries) {
    const prevKhasra = entry.khasraNo;
    const prevKhewat = entry.khewatNo;
    entry.khasraNo = prevKhewat;
    entry.khewatNo = prevKhasra;
    await entry.save();
    updated += 1;
  }

  console.log(`Swapped khasraNo ↔ khewatNo on ${updated} moza khasra record(s) for Moza: ${moza.name}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
