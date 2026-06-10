/**
 * Backfill BOQ item titles from the first line of description.
 *
 * Run once on production:
 *   node server/scripts/backfill-boq-titles-from-description.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const BOQItem = require('../models/projectManagement/BOQItem');

const titleFromDescription = (description) =>
  String(description || '').split(/\r?\n/)[0]?.trim() || '';

async function run() {
  const uri = process.env.NODE_ENV === 'production'
    ? process.env.MONGODB_URI
    : (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI);

  if (!uri) {
    console.error('No MongoDB URI found');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const items = await BOQItem.find({
    $or: [{ title: { $exists: false } }, { title: null }, { title: '' }]
  }).select('_id description title').lean();

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const title = titleFromDescription(item.description);
    if (!title) {
      skipped += 1;
      continue;
    }
    await BOQItem.updateOne({ _id: item._id }, { $set: { title } });
    updated += 1;
  }

  console.log(`BOQ title backfill complete: ${updated} updated, ${skipped} skipped, ${items.length} scanned`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
