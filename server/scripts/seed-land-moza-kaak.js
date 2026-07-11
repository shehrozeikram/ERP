#!/usr/bin/env node
require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
const { parseLandMozaExcel } = require('../utils/landMozaExcelParser');

const XLSX_PATH = path.join(__dirname, '../../docs/MUZA KAAK.xlsx');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL || process.env.MONGO_URI;
  if (!uri) {
    console.error('No MongoDB URI configured');
    process.exit(1);
  }

  await mongoose.connect(uri);

  let parsed;
  try {
    parsed = parseLandMozaExcel(XLSX_PATH, { fallbackMozaName: 'Kak', colOffset: 1 });
  } catch (e) {
    console.error("Parse error:", e.message);
    process.exit(1);
  }
  
  let moza = await LandMoza.findOne({ slug: parsed.slug });

  if (!moza) {
    moza = await LandMoza.create({
      name: parsed.mozaName,
      slug: parsed.slug,
      sourceLabel: 'MUZA KAAK.xlsx'
    });
    console.log(`Created moza: ${moza.name}`);
  } else {
    console.log(`Updating moza: ${moza.name}`);
  }

  await LandMozaKhasraEntry.deleteMany({ moza: moza._id });
  await LandMozaKhasraEntry.insertMany(
    parsed.entries.map((e) => ({ ...e, moza: moza._id }))
  );

  moza.entryCount = parsed.entries.length;
  moza.sourceLabel = 'MUZA KAAK.xlsx';
  await moza.save();

  console.log(`Seeded ${parsed.entries.length} khasra entries for ${parsed.mozaName}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
