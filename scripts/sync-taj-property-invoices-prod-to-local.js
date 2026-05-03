/**
 * Copy Taj Utilities "PropertyInvoice" documents from a production MongoDB into local.
 * Collection: propertyinvoices (Mongoose model PropertyInvoice).
 *
 * Env loading matches scripts/show-mongodb-target.js (repo .env, then .env.local when not production).
 *
 * Required:
 *   MONGODB_URI_PROD_SYNC — production source (e.g. mongodb://127.0.0.1:27018/sgc_erp via SSH tunnel)
 *   Optional file (gitignored): scripts/.mongodb-prod-sync.env — same vars, loaded after .env / .env.local
 *
 * Destination (first match wins):
 *   MONGODB_URI_LOCAL_SYNC — recommended explicit target
 *   MONGODB_URI_LOCAL — usual local dev DB
 *
 * Optional CLI overrides (take precedence over env):
 *   --source <uri>
 *   --dest <uri>
 *
 * Modes:
 *   (default) merge — upsert by _id (updates existing, inserts new)
 *   --replace-dest — delete ALL propertyinvoices on destination, then insert from source (full mirror)
 *
 * Usage (repo root):
 *   node scripts/sync-taj-property-invoices-prod-to-local.js
 *   node scripts/sync-taj-property-invoices-prod-to-local.js --replace-dest
 *   node scripts/sync-taj-property-invoices-prod-to-local.js --source 'mongodb://...' --dest 'mongodb://...'
 *
 * Notes:
 *   - Preserves _id and embedded data from production.
 *   - Does not run Mongoose save hooks (raw collection read/write).
 *   - Property/User/CAM refs point at prod ObjectIds; populate may be empty locally unless those
 *     collections are also synced. Invoice rows and numbers still appear in the Invoices list.
 */

const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '..');

function loadEnvFiles() {
  const envPath = path.join(repoRoot, '.env');
  const localPath = path.join(repoRoot, '.env.local');

  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
  const prodLike = process.env.NODE_ENV === 'production';
  if (!prodLike && fs.existsSync(localPath)) {
    require('dotenv').config({ path: localPath, override: true });
  } else if (prodLike && fs.existsSync(localPath)) {
    console.warn(
      'Note: .env.local was skipped (NODE_ENV=production). Unset NODE_ENV=production when syncing to local.\n'
    );
  }
  const extra = process.env.SGC_ENV_FILE;
  if (extra) {
    const resolved = path.isAbsolute(extra) ? extra : path.join(process.cwd(), extra);
    if (fs.existsSync(resolved)) {
      require('dotenv').config({ path: resolved, override: true });
    } else {
      console.warn(`SGC_ENV_FILE set but file not found: ${resolved}`);
    }
  }
  const syncSecrets = path.join(repoRoot, 'scripts', '.mongodb-prod-sync.env');
  if (fs.existsSync(syncSecrets)) {
    require('dotenv').config({ path: syncSecrets, override: true });
  }
}

function parseArgUri(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return null;
  return process.argv[i + 1];
}

function inferIsLocal(uri) {
  if (!uri) return true;
  return /127\.0\.0\.1|localhost/i.test(uri);
}

function redactUri(uri) {
  if (!uri) return '';
  return uri.replace(/^(mongodb(?:\+srv)?:\/\/)([^/@\s]+):([^@\s]+)@/i, '$1$2:***@');
}

loadEnvFiles();

const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../server/config/database');

const COLLECTION = 'propertyinvoices';
const BATCH = 250;

async function main() {
  const replaceDest = process.argv.includes('--replace-dest');
  const sourceUri =
    parseArgUri('--source') || process.env.MONGODB_URI_PROD_SYNC || process.env.MONGODB_URI_PROD;
  const destUri =
    parseArgUri('--dest') ||
    process.env.MONGODB_URI_LOCAL_SYNC ||
    process.env.MONGODB_URI_LOCAL;

  if (!sourceUri) {
    console.error(
      'Missing source URI. Set MONGODB_URI_PROD_SYNC in .env.local (or pass --source <uri>).'
    );
    process.exit(1);
  }
  if (!destUri) {
    console.error(
      'Missing destination URI. Set MONGODB_URI_LOCAL_SYNC or MONGODB_URI_LOCAL (or pass --dest <uri>).'
    );
    process.exit(1);
  }

  if (sourceUri === destUri) {
    console.error('Source and destination URIs must differ.');
    process.exit(1);
  }

  console.log('');
  console.log('=== Taj PropertyInvoice sync ===');
  console.log(`Source (redacted):  ${redactUri(sourceUri)}`);
  console.log(`Dest (redacted):    ${redactUri(destUri)}`);
  console.log(`Mode:               ${replaceDest ? 'replace-dest (wipe then insert)' : 'merge (upsert by _id)'}`);
  console.log('');

  const sourceConn = mongoose.createConnection(sourceUri, getMongooseClientOptions(sourceUri, inferIsLocal(sourceUri)));
  const destConn = mongoose.createConnection(destUri, getMongooseClientOptions(destUri, inferIsLocal(destUri)));

  try {
    await sourceConn.asPromise();
    await destConn.asPromise();

    const srcCol = sourceConn.db.collection(COLLECTION);
    const dstCol = destConn.db.collection(COLLECTION);

    const total = await srcCol.countDocuments({});
    console.log(`Source document count: ${total}`);

    if (replaceDest) {
      const del = await dstCol.deleteMany({});
      console.log(`Destination cleared: ${del.deletedCount} removed from ${COLLECTION}`);
    }

    const cursor = srcCol.find({});
    let batch = [];
    let processed = 0;
    let upserted = 0;
    let modified = 0;

    const flushMerge = async () => {
      if (batch.length === 0) return;
      const ops = batch.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true
        }
      }));
      const r = await dstCol.bulkWrite(ops, { ordered: false });
      upserted += r.upsertedCount || 0;
      modified += r.modifiedCount || 0;
      processed += batch.length;
      batch = [];
      process.stdout.write(`\rWritten: ${processed} / ${total}`);
    };

    const flushInsert = async () => {
      if (batch.length === 0) return;
      await dstCol.insertMany(batch, { ordered: false });
      processed += batch.length;
      batch = [];
      process.stdout.write(`\rInserted: ${processed} / ${total}`);
    };

    for await (const doc of cursor) {
      batch.push(doc);
      if (batch.length >= BATCH) {
        if (replaceDest) await flushInsert();
        else await flushMerge();
      }
    }
    if (replaceDest) await flushInsert();
    else await flushMerge();

    console.log('\n');
    if (!replaceDest) {
      console.log(`Upserted: ${upserted}, matched/modified: ${modified}, total processed: ${processed}`);
    } else {
      console.log(`Inserted total: ${processed}`);
    }

    const destCount = await dstCol.countDocuments({});
    console.log(`Destination ${COLLECTION} count now: ${destCount}`);
    console.log('Done.');
  } finally {
    await sourceConn.close();
    await destConn.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
