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
  
  // Find all mozas matching kaak in case there are multiple (e.g. inactive ones or duplicates)
  const mozas = await LandMoza.find({ name: { $regex: /kaak/i } });
  if (!mozas || mozas.length === 0) {
    console.error('Moza Kaak not found');
    await mongoose.disconnect();
    process.exit(1);
  }

  let totalUpdated = 0;

  for (const moza of mozas) {
    const entries = await LandMozaKhasraEntry.find({ moza: moza._id });
    let updated = 0;

    for (const entry of entries) {
      const prevKhasra = entry.khasraNo;
      const prevKhewat = entry.khewatNo;
      entry.khasraNo = prevKhewat;
      entry.khewatNo = prevKhasra;
      await entry.save();
      updated += 1;
      totalUpdated += 1;
    }

    console.log(`Swapped khasraNo ↔ khewatNo on ${updated} moza khasra record(s) for Moza: ${moza.name} (ID: ${moza._id}).`);
  }

  console.log(`Total records updated: ${totalUpdated}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
