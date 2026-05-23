#!/usr/bin/env node
/**
 * One-time: drop legacy `code` unique index on departments and remove code field from documents.
 * Run after deploying Department model without `code` (fixes "code already exists" on create).
 *
 *   node server/scripts/drop-department-code-index.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
if (!uri) {
  console.error('Set MONGODB_URI or MONGODB_URI_LOCAL');
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('departments');
  const indexes = await col.indexes();
  for (const idx of indexes) {
    if (idx.key && Object.prototype.hasOwnProperty.call(idx.key, 'code')) {
      const name = idx.name;
      console.log(`Dropping index: ${name}`);
      await col.dropIndex(name);
    }
  }
  const unset = await col.updateMany({ code: { $exists: true } }, { $unset: { code: '' } });
  console.log(`Unset code on ${unset.modifiedCount} department(s).`);
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
