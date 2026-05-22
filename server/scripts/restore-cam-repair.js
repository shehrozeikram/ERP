/**
 * Restore CAM invoices from a backup created by backup-cam-repair.js
 *
 *   NODE_ENV=production node server/scripts/restore-cam-repair.js server/backups/cam-repair-backup-production-....json
 *   NODE_ENV=production node server/scripts/restore-cam-repair.js server/backups/cam-repair-backup-production-....json --dryRun
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');

const fileArg = process.argv[2];
const dryRun = process.argv.includes('--dryRun');

if (!fileArg) {
  console.error('Usage: node server/scripts/restore-cam-repair.js <backup-file.json> [--dryRun]');
  process.exit(1);
}

const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
if (!fs.existsSync(filePath)) {
  console.error(`Backup file not found: ${filePath}`);
  process.exit(1);
}

(async () => {
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
  await connectDB();

  const backup = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const invoices = backup.invoices || [];

  console.log(`Backup from: ${backup.createdAt}`);
  console.log(`Environment: ${backup.environment}`);
  console.log(`Invoices to restore: ${invoices.length}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}\n`);

  if (!dryRun && backup.environment === 'production' && process.env.NODE_ENV !== 'production') {
    console.error('Refusing to restore production backup while NODE_ENV is not production.');
    process.exit(1);
  }

  let restored = 0;
  for (const doc of invoices) {
    const id = doc._id;
    if (!id) continue;
    if (dryRun) {
      console.log(`Would restore: ${doc.invoiceNumber}`);
      restored++;
      continue;
    }
    await PropertyInvoice.replaceOne({ _id: id }, doc, { upsert: false });
    restored++;
    console.log(`Restored: ${doc.invoiceNumber}`);
  }

  console.log(`\n✅ ${dryRun ? 'Would restore' : 'Restored'} ${restored} CAM invoice(s).`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
