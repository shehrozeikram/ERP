#!/usr/bin/env node
/**
 * Seed Sheikhpur moza from server/data/land-acquisition/sheikhpur-1907.xlsx
 * Usage: node server/scripts/seed-land-moza-sheikhpur.js
 */
require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
const { parseLandMozaExcel } = require('../utils/landMozaExcelParser');

const XLSX_PATH = path.join(__dirname, '../data/land-acquisition/sheikhpur-1907.xlsx');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL || process.env.MONGO_URI;
  if (!uri) {
    console.error('No MongoDB URI configured');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const parsed = parseLandMozaExcel(XLSX_PATH);
  let moza = await LandMoza.findOne({ slug: parsed.slug });

  if (!moza) {
    moza = await LandMoza.create({
      name: parsed.mozaName,
      slug: parsed.slug,
      sourceLabel: 'sheikhpur-1907.xlsx'
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
  moza.sourceLabel = 'sheikhpur-1907.xlsx';
  await moza.save();

  console.log(`Seeded ${parsed.entries.length} khasra entries for ${parsed.mozaName}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
