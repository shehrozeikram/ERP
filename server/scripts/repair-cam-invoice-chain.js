/**
 * Repair CAM invoice arrears chain (CAM-only). Does not touch water, electricity, rent, etc.
 *
 * Single property:
 *   node server/scripts/repair-cam-invoice-chain.js --srNo 1076 --from INV-CMC-2026-04-1076
 *   node server/scripts/repair-cam-invoice-chain.js --srNo 1076 --from INV-CMC-2026-04-1076 --dryRun
 *
 * Production — all properties with bad March CAM batch (invoice date Apr 7, 2026, period Mar 1–30):
 *   NODE_ENV=production node server/scripts/repair-cam-invoice-chain.js --allBadBatch --dryRun
 *   NODE_ENV=production node server/scripts/repair-cam-invoice-chain.js --allBadBatch
 *
 * Or use the wrapper on the server:
 *   ./server/scripts/repair-cam-production.sh --dryRun
 *   ./server/scripts/repair-cam-production.sh
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const TajProperty = require('../models/tajResidencia/TajProperty');
const { repairCamInvoiceChain } = require('../utils/camInvoiceArrears');
const { findBadBatchCamInvoices } = require('../utils/camRepairBatch');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = { dryRun: false, allBadBatch: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--srNo') out.srNo = Number(args[++i]);
    else if (args[i] === '--propertyId') out.propertyId = args[++i];
    else if (args[i] === '--from') out.fromInvoiceNumber = args[++i];
    else if (args[i] === '--dryRun') out.dryRun = true;
    else if (args[i] === '--allBadBatch') out.allBadBatch = true;
  }
  return out;
};

const repairOneProperty = async (propertyId, fromInvoiceNumber, dryRun) => {
  const property = await TajProperty.findById(propertyId).select('srNo ownerName').lean();
  const result = await repairCamInvoiceChain(propertyId, { fromInvoiceNumber, dryRun });
  return {
    srNo: property?.srNo,
    ownerName: property?.ownerName,
    fromInvoiceNumber,
    ...result
  };
};

(async () => {
  const { srNo, propertyId, fromInvoiceNumber, dryRun, allBadBatch } = parseArgs();

  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
  await connectDB();

  const isProd = process.env.NODE_ENV === 'production';
  console.log(`Database: ${isProd ? 'PRODUCTION (MONGODB_URI)' : 'LOCAL (MONGODB_URI_LOCAL)'}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no saves)' : 'APPLY (will update CAM invoices)'}\n`);

  if (allBadBatch) {
    const targets = await findBadBatchCamInvoices();
    if (!targets.length) {
      console.log('No March 2026 CAM invoices found with invoice date >= Apr 7, 2026. Nothing to repair.');
      await mongoose.disconnect();
      return;
    }

    console.log(`Found ${targets.length} propert(ies) with bad March CAM batch (Apr 7+ invoice date).\n`);

    const summary = { repaired: 0, skipped: 0, failed: 0, results: [] };
    for (const { propertyId, anchorInvoice } of targets) {
      try {
        const result = await repairOneProperty(propertyId, anchorInvoice.invoiceNumber, dryRun);
        const updatedCount = (result.updated || []).length;
        if (updatedCount > 0) summary.repaired += 1;
        else summary.skipped += 1;
        summary.results.push(result);
        console.log(
          `srNo ${result.srNo ?? '?'} | ${result.ownerName ?? ''} | anchor ${anchorInvoice.invoiceNumber} | updated ${updatedCount} invoice(s)`
        );
      } catch (err) {
        summary.failed += 1;
        console.error(`FAILED property ${propertyId}:`, err.message);
      }
    }

    console.log('\n--- Summary ---');
    console.log(JSON.stringify({
      dryRun,
      totalProperties: targets.length,
      propertiesWithChanges: summary.repaired,
      propertiesUnchanged: summary.skipped,
      failed: summary.failed,
      results: summary.results
    }, null, 2));
  } else {
    if (!srNo && !propertyId) {
      console.error('Provide --srNo, --propertyId, or --allBadBatch');
      process.exit(1);
    }

    let pid = propertyId;
    let fromInv = fromInvoiceNumber;
    if (srNo) {
      const property = await TajProperty.findOne({ srNo }).select('_id srNo ownerName').lean();
      if (!property) {
        console.error(`Property srNo ${srNo} not found`);
        process.exit(1);
      }
      pid = property._id;
      if (!fromInv) {
        fromInv = `INV-CMC-2026-04-${String(srNo).padStart(4, '0')}`;
      }
      console.log(`Property: ${property.ownerName} (srNo ${property.srNo})`);
      console.log(`From invoice: ${fromInv}\n`);
    }

    const result = await repairOneProperty(pid, fromInv, dryRun);
    console.log(JSON.stringify(result, null, 2));
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
