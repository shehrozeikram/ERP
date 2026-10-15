/**
 * Production data fix for PO-202609-0011 / PO-202609-0012 comparative:
 * Same indent has lot A (leave alone — used by another PO) and lot B with
 * multiple Finalized quotations. Both target POs are Rejected, so reset all
 * Finalized/Shortlisted on lot B back to Received (one-winner-per-lot).
 *
 * Usage:
 *   NODE_ENV=production node server/scripts/fix-po-comparative-finalized-lot.js --dry-run
 *   NODE_ENV=production node server/scripts/fix-po-comparative-finalized-lot.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');
const PO_NUMBERS = ['PO-202609-0011', 'PO-202609-0012'];

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('No MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const PO = mongoose.connection.collection('purchaseorders');
  const Q = mongoose.connection.collection('quotations');

  const pos = await PO.find({ orderNumber: { $in: PO_NUMBERS } }).toArray();
  console.log(`Found ${pos.length} PO(s). dryRun=${DRY_RUN}`);
  if (!pos.length) {
    await mongoose.disconnect();
    process.exit(1);
  }

  const indentId = pos[0].indent;
  for (const po of pos) {
    console.log(po.orderNumber, 'status=', po.status, 'quotation=', String(po.quotation));
    if (String(po.indent) !== String(indentId)) {
      console.error('POs do not share the same indent — aborting');
      process.exit(1);
    }
  }

  const quotes = await Q.find({ indent: indentId }).toArray();
  console.log('\nBefore:');
  for (const q of quotes) {
    console.log(`  ${q.quotationNumber} lot=${q.lotNumber || 'A'} status=${q.status}`);
  }

  // Lot B is the multi-finalized problem for these rejected POs.
  const lotBFinalized = quotes.filter(
    (q) => (q.lotNumber || 'A') === 'B' && ['Finalized', 'Shortlisted'].includes(q.status)
  );

  console.log(`\nLot B to reset (${lotBFinalized.length}):`, lotBFinalized.map((q) => q.quotationNumber));

  if (!DRY_RUN) {
    for (const q of lotBFinalized) {
      await Q.updateOne({ _id: q._id }, { $set: { status: 'Received' } });
      console.log(`  ${q.quotationNumber}: ${q.status} -> Received`);
    }
  } else {
    for (const q of lotBFinalized) {
      console.log(`  [dry-run] ${q.quotationNumber}: ${q.status} -> Received`);
    }
  }

  const after = await Q.find({ indent: indentId }).toArray();
  console.log('\nAfter:');
  for (const q of after) {
    console.log(`  ${q.quotationNumber} lot=${q.lotNumber || 'A'} status=${q.status}`);
  }

  const lotAFin = after.filter((q) => (q.lotNumber || 'A') === 'A' && q.status === 'Finalized');
  const lotBFin = after.filter((q) => (q.lotNumber || 'A') === 'B' && q.status === 'Finalized');
  console.log(`\nVerify: lot A Finalized=${lotAFin.length} (${lotAFin.map((q) => q.quotationNumber)}); lot B Finalized=${lotBFin.length}`);

  await mongoose.disconnect();
  console.log('\nDone.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
