/**
 * Backup CAM invoices that will be changed by repair-cam-production.sh
 * (from bad March 2026 batch anchor onward). CAM-only.
 *
 * Production:
 *   NODE_ENV=production node server/scripts/backup-cam-repair.js
 * Or:
 *   ./server/scripts/backup-cam-production.sh
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const TajProperty = require('../models/tajResidencia/TajProperty');
const {
  findBadBatchCamInvoices,
  getCamInvoicesForRepairScope,
  BAD_BATCH_INVOICE_DATE,
  BAD_BATCH_PERIOD_FROM,
  BAD_BATCH_PERIOD_TO
} = require('../utils/camRepairBatch');

const BACKUP_DIR = path.join(__dirname, '../backups');

(async () => {
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
  await connectDB();

  const isProd = process.env.NODE_ENV === 'production';
  console.log(`Database: ${isProd ? 'PRODUCTION' : 'LOCAL'}`);

  const targets = await findBadBatchCamInvoices();
  if (!targets.length) {
    console.log('No bad-batch March CAM invoices found. Nothing to back up.');
    await mongoose.disconnect();
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `cam-repair-backup-${isProd ? 'production' : 'local'}-${stamp}.json`;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const filePath = path.join(BACKUP_DIR, fileName);

  const backup = {
    createdAt: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    description: 'CAM PropertyInvoice snapshots before repair-cam-production (from Mar 2026 bad batch anchor onward)',
    badBatchCriteria: {
      invoiceDateGte: BAD_BATCH_INVOICE_DATE.toISOString(),
      periodFrom: BAD_BATCH_PERIOD_FROM.toISOString(),
      periodTo: BAD_BATCH_PERIOD_TO.toISOString()
    },
    propertyCount: targets.length,
    invoiceCount: 0,
    properties: [],
    invoices: []
  };

  for (const { propertyId, anchorInvoice } of targets) {
    const property = await TajProperty.findById(propertyId).select('srNo ownerName').lean();
    const docs = await getCamInvoicesForRepairScope(propertyId, anchorInvoice.invoiceNumber);

    backup.properties.push({
      propertyId: String(propertyId),
      srNo: property?.srNo,
      ownerName: property?.ownerName,
      anchorInvoiceNumber: anchorInvoice.invoiceNumber,
      invoiceCount: docs.length
    });
    backup.invoices.push(...docs);
  }

  backup.invoiceCount = backup.invoices.length;
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf8');

  console.log('\n✅ Backup saved');
  console.log(`   File: ${filePath}`);
  console.log(`   Properties: ${backup.propertyCount}`);
  console.log(`   Invoices: ${backup.invoiceCount}`);
  console.log('\nKeep this path safe. To restore:');
  console.log(`   NODE_ENV=production node server/scripts/restore-cam-repair.js "${filePath}"`);

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
