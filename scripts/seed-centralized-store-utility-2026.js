/**
 * Import IESCO, SNGPL, PTCL-Nayatel, and CDA Water items from bundled 2026 utility bills data.
 *
 * Usage:
 *   node scripts/seed-centralized-store-utility-2026.js --dry-run
 *   node scripts/seed-centralized-store-utility-2026.js --yes
 *   node scripts/seed-centralized-store-utility-2026.js --yes --replace
 *
 * Re-export JSON from Apple Numbers (optional):
 *   python3 scripts/export-utility-bills-from-numbers.py
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const path = require('path');
const { getMongoUri, getMongooseClientOptions } = require('../server/config/database');
const { importUtilityBills2026, loadSeedData } = require('../server/utils/importUtilityBills2026');

const yes = process.argv.includes('--yes');
const dryRun = process.argv.includes('--dry-run');
const replace = process.argv.includes('--replace');

async function main() {
  if (!yes && !dryRun) {
    console.error('Pass --yes to import or --dry-run to preview.');
    process.exit(1);
  }

  const seed = loadSeedData();
  const summary = Object.entries(seed).map(([k, v]) => `${k}: ${v.length}`).join(', ');
  console.log(`Seed file rows — ${summary}`);

  if (dryRun) {
    console.log('Dry run only. No database changes.');
    process.exit(0);
  }

  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('No MongoDB URI configured.');
    process.exit(1);
  }

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));

  try {
    const result = await importUtilityBills2026({ replace });
    console.log('Import complete:');
    console.log(`  Categories created: ${result.categoriesCreated}`);
    console.log(`  Items created:      ${result.itemsCreated}`);
    console.log(`  Items updated:      ${result.itemsUpdated}`);
    console.log(`  Items skipped:      ${result.itemsSkipped}`);
    console.log(`  Site options:       ${result.siteOptions.join(', ')}`);
  } finally {
    await mongoose.connection.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
