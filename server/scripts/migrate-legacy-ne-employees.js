/**
 * Backfill employees[] on legacy New-Hiring records that stored flat fields.
 *
 * Usage:
 *   NODE_ENV=production node server/scripts/migrate-legacy-ne-employees.js
 *   NODE_ENV=production node server/scripts/migrate-legacy-ne-employees.js --apply
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const NonEmployeeRecord = require('../models/hr/NonEmployeeRecord');

const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('nonemployeerecords');
  const docs = await col.find({
    $or: [
      { employees: { $exists: false } },
      { employees: { $size: 0 } },
      { employees: null }
    ]
  }).toArray();

  console.log(`Found ${docs.length} legacy record(s) without employees[]. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  let updated = 0;
  for (const d of docs) {
    const line = NonEmployeeRecord.normalizeEmployeeLine(d);
    if (!line.name && !line.cnic) {
      console.log(`Skip ${d.recordNumber}: no usable legacy fields`);
      continue;
    }
    console.log(`${APPLY ? 'Update' : 'Would update'} ${d.recordNumber}:`, line);
    if (APPLY) {
      await col.updateOne(
        { _id: d._id },
        { $set: { employees: [line], updatedAt: new Date() } }
      );
      updated += 1;
    }
  }

  console.log(`Done. ${APPLY ? `Updated ${updated}` : `Dry-run ${docs.length} candidate(s)`}.`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
