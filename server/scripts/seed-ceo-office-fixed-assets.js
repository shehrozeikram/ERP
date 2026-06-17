/**
 * Seed CEO office fixed assets from handwritten FAR logs (June 2024).
 * Run: node server/scripts/seed-ceo-office-fixed-assets.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { importCeoOfficeFixedAssets } = require('../services/ceoOfficeFixedAssetImport');

async function run() {
  const uri = process.env.NODE_ENV === 'production'
    ? process.env.MONGODB_URI
    : (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI);

  if (!uri) {
    console.error('No MongoDB URI found in environment variables');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const result = await importCeoOfficeFixedAssets();

  if (result.legacyRemoved) {
    console.log(`Removed legacy combined entry ${result.legacyRemoved.assetNumber} — ${result.legacyRemoved.name}`);
  }
  result.createdRows.forEach((row) => {
    console.log(`Created ${row.importKey} -> ${row.assetNumber} — ${row.name}`);
  });
  result.skippedRows.forEach((row) => {
    console.log(`Skip ${row.importKey} — already exists as ${row.assetNumber} (${row.name})`);
  });

  console.log(`Done. Created: ${result.created}, Skipped: ${result.skipped}, Total in import set: ${result.totalInSet}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
