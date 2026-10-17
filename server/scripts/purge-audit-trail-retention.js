/**
 * Fast Audit Trail purge for large collections:
 * keep only non-read/view rows from the last 30 days, then replace the collection.
 *
 * Usage (on droplet):
 *   nohup env NODE_ENV=production node server/scripts/purge-audit-trail-retention.js > /tmp/audit-purge.log 2>&1 &
 */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const repoRoot = path.join(__dirname, '..', '..');
const envFile = fs.existsSync(path.join(repoRoot, '.env'))
  ? path.join(repoRoot, '.env')
  : path.join(repoRoot, '.env.production');
require('dotenv').config({ path: envFile });

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const TMP = 'audittrails_keep_tmp';

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  if (!uri) {
    console.error('No MONGODB_URI found');
    process.exit(1);
  }

  console.log('Connecting...', new Date().toISOString());
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000
  });
  console.log('Connected.');

  const db = mongoose.connection.db;
  const col = db.collection('audittrails');
  const before = await col.estimatedDocumentCount();
  const cutoff = new Date(Date.now() - RETENTION_MS);
  console.log({ before, cutoff: cutoff.toISOString() });

  // Drop temp if a previous run left it
  const existing = await db.listCollections({ name: TMP }).toArray();
  if (existing.length) {
    console.log('Dropping leftover temp collection...');
    await db.collection(TMP).drop();
  }

  const keepFilter = {
    action: { $nin: ['read', 'view'] },
    timestamp: { $gte: cutoff }
  };

  const keepCount = await col.countDocuments(keepFilter);
  console.log('Rows to keep:', keepCount);

  console.log('Writing kept rows to temp collection via $out...');
  await col.aggregate([
    { $match: keepFilter },
    { $out: TMP }
  ]).toArray();

  const tmpCount = await db.collection(TMP).estimatedDocumentCount();
  console.log('Temp collection count:', tmpCount);

  console.log('Dropping old audittrails collection...');
  await col.drop();

  console.log('Renaming temp -> audittrails...');
  await db.collection(TMP).rename('audittrails');

  const afterCol = db.collection('audittrails');
  const after = await afterCol.estimatedDocumentCount();

  // Helpful indexes for future queries / TTL
  console.log('Ensuring indexes...');
  try {
    await afterCol.createIndex({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60, name: 'audit_trail_ttl_30d' });
  } catch (e) {
    console.log('TTL index note:', e.message);
  }
  try {
    await afterCol.createIndex({ action: 1, timestamp: -1 });
    await afterCol.createIndex({ userId: 1, timestamp: -1 });
    await afterCol.createIndex({ module: 1, action: 1, timestamp: -1 });
  } catch (e) {
    console.log('Index note:', e.message);
  }

  const summary = {
    success: true,
    before,
    kept: keepCount,
    after,
    deletedApprox: Math.max(0, before - after),
    cutoff: cutoff.toISOString(),
    finishedAt: new Date().toISOString()
  };
  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Purge failed:', err.message);
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
  process.exit(1);
});
