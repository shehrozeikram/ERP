/**
 * LOCAL ONLY: Clears payments on Taj property invoices so Partially Paid / Paid show as Unpaid.
 * Uses MONGODB_URI_LOCAL (same safety rule as the app in dev) — refuses production and refuses
 * when only MONGODB_URI is configured (so you do not accidentally hit a shared/prod DB).
 *
 * Usage (repo root):
 *   node scripts/revert-local-property-invoices-to-unpaid.js --yes
 */

const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '..');

function loadEnvFiles() {
  const envPath = path.join(repoRoot, '.env');
  const localPath = path.join(repoRoot, '.env.local');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
  const prodLike = process.env.NODE_ENV === 'production';
  if (!prodLike && fs.existsSync(localPath)) {
    require('dotenv').config({ path: localPath, override: true });
  }
}

loadEnvFiles();

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../server/config/database');
const PropertyInvoice = require('../server/models/tajResidencia/PropertyInvoice');

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('Refusing to run without --yes (this clears invoice payment rows).');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run with NODE_ENV=production.');
    process.exit(1);
  }

  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('No MongoDB URI. Set MONGODB_URI_LOCAL for local dev.');
    process.exit(1);
  }
  if (!isLocal) {
    console.error(
      'This script only runs when MONGODB_URI_LOCAL is set (dev), so MONGODB_URI alone is never used.\n' +
        'Add MONGODB_URI_LOCAL in .env.local pointing at your local MongoDB, then retry.'
    );
    process.exit(1);
  }

  const opts = getMongooseClientOptions(uri, true);
  await mongoose.connect(uri, opts);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`Connected (LOCAL): ${mongoose.connection.host} / ${dbName}`);

  const filter = {
    status: { $nin: ['Draft', 'Cancelled'] },
    $or: [{ paymentStatus: { $in: ['partial_paid', 'paid'] } }, { totalPaid: { $gt: 0 } }]
  };

  const cursor = PropertyInvoice.find(filter).cursor();
  let updated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    if (!doc.payments?.length && (doc.paymentStatus === 'unpaid' || !doc.paymentStatus)) {
      skipped += 1;
      continue;
    }
    doc.payments = [];
    doc.markModified('payments');
    if (doc.status !== 'Cancelled') {
      doc.status = 'Issued';
    }
    await doc.save();
    updated += 1;
    if (updated % 50 === 0) {
      console.log(`  … ${updated} reverted`);
    }
  }

  await mongoose.disconnect();
  console.log(`Done. Reverted to unpaid (hooks recalculated totals): ${updated}. Skipped: ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
