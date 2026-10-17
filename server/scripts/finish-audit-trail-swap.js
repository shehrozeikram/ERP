require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const TMP = 'audittrails_keep_tmp';
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 20000
  });
  const db = mongoose.connection.db;
  const cutoff = new Date(Date.now() - RETENTION_MS);

  const names = (await db.listCollections().toArray()).map((c) => c.name);
  console.log('before', {
    hasLive: names.includes('audittrails'),
    hasTmp: names.includes(TMP),
    live: names.includes('audittrails')
      ? await db.collection('audittrails').estimatedDocumentCount()
      : 0,
    tmp: names.includes(TMP)
      ? await db.collection(TMP).estimatedDocumentCount()
      : 0
  });

  if (!names.includes(TMP)) {
    throw new Error('Temp keep collection missing — cannot finish swap');
  }

  if (names.includes('audittrails')) {
    const extra = await db.collection('audittrails').find({
      action: { $nin: ['read', 'view'] },
      timestamp: { $gte: cutoff }
    }).toArray();
    console.log('extra keep from live', extra.length);
    if (extra.length) {
      try {
        await db.collection(TMP).insertMany(extra, { ordered: false });
      } catch (e) {
        console.log('insert note', e.message);
      }
    }
    await db.collection('audittrails').drop();
  }

  await db.collection(TMP).rename('audittrails');
  const after = await db.collection('audittrails').estimatedDocumentCount();

  try {
    await db.collection('audittrails').createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 30 * 24 * 60 * 60, name: 'audit_trail_ttl_30d' }
    );
  } catch (e) {
    console.log('TTL index note', e.message);
  }
  try {
    await db.collection('audittrails').createIndex({ action: 1, timestamp: -1 });
    await db.collection('audittrails').createIndex({ userId: 1, timestamp: -1 });
  } catch (e) {
    console.log('index note', e.message);
  }

  console.log(JSON.stringify({
    success: true,
    after,
    finishedAt: new Date().toISOString()
  }, null, 2));

  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('FAIL', e.message);
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
  process.exit(1);
});
