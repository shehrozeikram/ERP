/**
 * Shows which MongoDB URI the app would use (same rules as server/config/database.js).
 *
 * Env loading:
 *   - NODE_ENV=production: same as server/index.js → repo root `.env` only (+ optional SGC_ENV_FILE).
 *   - Otherwise: like ensure-developer-user → `.env`, then `.env.local` override, then SGC_ENV_FILE.
 *
 * Usage (repo root):
 *   node scripts/show-mongodb-target.js
 *   NODE_ENV=production node scripts/show-mongodb-target.js
 *   NODE_ENV=production node scripts/show-mongodb-target.js --connect
 *
 * On production droplet (100% sure with --connect):
 *   cd /var/www/sgc-erp && NODE_ENV=production node scripts/show-mongodb-target.js --connect
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
  // After .env so NODE_ENV from file is visible (dotenv does not override pre-set shell vars).
  const prodLike = process.env.NODE_ENV === 'production';
  if (!prodLike && fs.existsSync(localPath)) {
    require('dotenv').config({ path: localPath, override: true });
  } else if (prodLike && fs.existsSync(localPath)) {
    console.warn(
      'Note: .env.local exists but was skipped (NODE_ENV=production matches server/index.js: .env only).\n'
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
}

loadEnvFiles();

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../server/config/database');

function describeUri(uri) {
  if (!uri) return '(none)';
  try {
    if (/^mongodb\+srv:/i.test(uri)) {
      const u = new URL(uri.replace(/^mongodb\+srv:/i, 'mongodb:'));
      const db = (u.pathname || '').replace(/^\//, '') || '(default)';
      return `${u.hostname}:(SRV)/${db}`;
    }
    const noQuery = uri.split('?')[0];
    const dbMatch = noQuery.match(/\/([^/]+)$/);
    const db = dbMatch ? dbMatch[1] : '(unknown)';
    const afterProto = uri.replace(/^mongodb:\/\//i, '');
    const hostPart = afterProto.includes('@') ? afterProto.split('@').slice(1).join('@') : afterProto;
    const slash = hostPart.indexOf('/');
    const hosts = slash === -1 ? hostPart : hostPart.slice(0, slash);
    return `${hosts}/${db}`;
  } catch {
    return '(unparsed URI)';
  }
}

function redactUri(uri) {
  if (!uri) return '';
  // user:password@host → user:***@host (covers Atlas and droplet URIs)
  const withPass = uri.replace(
    /^(mongodb(?:\+srv)?:\/\/)([^/@\s]+):([^@\s]+)@/i,
    '$1$2:***@'
  );
  return withPass;
}

async function main() {
  const doConnect = process.argv.includes('--connect');
  const { uri, isLocal } = getMongoUri();

  console.log('');
  console.log('=== MongoDB target (same logic as the API) ===');
  console.log(`NODE_ENV:           ${process.env.NODE_ENV || '(unset)'}`);
  console.log(`Env source wins:    ${isLocal ? 'MONGODB_URI_LOCAL (dev only)' : 'MONGODB_URI'}`);
  console.log(`Resolved host/db:   ${describeUri(uri)}`);
  console.log(`URI (redacted):     ${redactUri(uri) || '(missing)'}`);
  console.log('');

  if (!uri) {
    console.error('No URI resolved. Set MONGODB_URI (and for local dev optionally MONGODB_URI_LOCAL).');
    process.exit(1);
  }

  if (!doConnect) {
    console.log('Tip: pass --connect to open a short-lived connection and print the live database name from the server.');
    process.exit(0);
  }

  const opts = getMongooseClientOptions(uri, isLocal);
  try {
    await mongoose.connect(uri, opts);
    const c = mongoose.connection;
    console.log('=== Live connection (authoritative) ===');
    console.log(`mongoose db name:   ${c.db.databaseName}`);
    console.log(`connection host:    ${c.host}`);
    console.log('');
    await mongoose.disconnect();
    console.log('Disconnected OK.');
  } catch (e) {
    console.error('Connection failed:', e.message);
    process.exit(1);
  }
}

main();
