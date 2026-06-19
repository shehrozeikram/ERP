#!/usr/bin/env node
/**
 * One-time: drop legacy `code` unique index on placement companies and remove code from documents.
 * Fixes "code already exists" when creating companies after code was removed from the schema.
 *
 *   node server/scripts/drop-company-code-index.js
 *   NODE_ENV=production node server/scripts/drop-company-code-index.js
 */
const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '..', '..');
for (const f of ['.env', '.env.local']) {
  const p = path.join(repoRoot, f);
  if (fs.existsSync(p)) require('dotenv').config({ path: p, override: f === '.env.local' });
}

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');

async function main() {
  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('Set MONGODB_URI (production) or MONGODB_URI_LOCAL (local dev).');
    process.exit(1);
  }

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));
  console.log(`Connected${isLocal ? ' [local]' : ' [production]'}`);

  const col = mongoose.connection.collection('placementcompanies');
  const indexes = await col.indexes();

  for (const idx of indexes) {
    if (idx.key && Object.prototype.hasOwnProperty.call(idx.key, 'code')) {
      console.log(`Dropping index: ${idx.name}`);
      await col.dropIndex(idx.name);
    }
  }

  const unset = await col.updateMany({ code: { $exists: true } }, { $unset: { code: '' } });
  console.log(`Removed legacy code field from ${unset.modifiedCount} company document(s).`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
