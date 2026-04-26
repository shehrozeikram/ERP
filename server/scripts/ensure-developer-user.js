/**
 * Upserts the Tovus developer account (legacy role `developer` — full access in app code).
 *
 * Uses the SAME MongoDB selection rules as the API (server/config/database.js):
 * - If NODE_ENV is not "production" and MONGODB_URI_LOCAL is set → that URI is used.
 * - Otherwise → MONGODB_URI is used.
 *
 * Env files (repo root), in order:
 *   1) .env
 *   2) .env.local (overrides; typical on a Mac for local Mongo)
 *   3) Optional extra file: SGC_ENV_FILE=.env.production (absolute or relative to cwd)
 *
 * Examples:
 *   npm run ensure:developer-user
 *   SGC_ENV_FILE=.env.production node server/scripts/ensure-developer-user.js
 *   NODE_ENV=production node server/scripts/ensure-developer-user.js   # on droplet with .env
 *
 * Optional: DEVELOPER_PASSWORD=... overrides default password.
 */

const path = require('path');
const fsSync = require('fs');

const repoRoot = path.join(__dirname, '..', '..');

function loadEnvFiles() {
  const envPath = path.join(repoRoot, '.env');
  const localPath = path.join(repoRoot, '.env.local');
  if (fsSync.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
  if (fsSync.existsSync(localPath)) {
    require('dotenv').config({ path: localPath, override: true });
  }
  const extra = process.env.SGC_ENV_FILE;
  if (extra) {
    const resolved = path.isAbsolute(extra) ? extra : path.join(process.cwd(), extra);
    if (fsSync.existsSync(resolved)) {
      require('dotenv').config({ path: resolved, override: true });
    } else {
      console.warn(`SGC_ENV_FILE set but file not found: ${resolved}`);
    }
  }
}

loadEnvFiles();

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const User = require('../models/User');

const CONFIG = {
  email: 'developer@tovus.net',
  employeeId: '6035',
  firstName: 'Sardar Shehroze',
  lastName: 'Ikram',
  role: 'developer',
  department: 'Technology',
  position: 'Software Developer',
  phone: '',
  defaultPassword: process.env.DEVELOPER_PASSWORD || 'shehroze@tovus'
};

function describeUri(uri) {
  if (!uri) return '(none)';
  try {
    const u = new URL(uri.replace(/^mongodb\+srv:/, 'mongodb:'));
    const db = u.pathname?.replace(/^\//, '') || '';
    return `${u.hostname}:${u.port || '27017'}/${db}`;
  } catch {
    return '(unparsed URI)';
  }
}

async function main() {
  const { uri, isLocal } = getMongoUri();

  if (!uri) {
    console.error('\n❌ No MongoDB URI resolved.');
    console.error('This script uses the same rules as the API:');
    console.error('  • Non-production: if MONGODB_URI_LOCAL is set, it is used; else MONGODB_URI.');
    console.error('  • NODE_ENV=production: MONGODB_URI only.');
    console.error('\nFix: set MONGODB_URI_LOCAL and/or MONGODB_URI in .env or .env.local (repo root).');
    console.error('On the droplet: run from /var/www/sgc-erp with .env containing MONGODB_URI=...\n');
    process.exit(1);
  }

  console.log('\n📦 ensure-developer-user');
  console.log(`   NODE_ENV:     ${process.env.NODE_ENV || '(unset)'} `);
  console.log(`   Using:        ${isLocal ? 'MONGODB_URI_LOCAL' : 'MONGODB_URI'}`);
  console.log(`   Target:       ${describeUri(uri)}`);
  console.log('   Connecting...\n');

  try {
    await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));
  } catch (e) {
    console.error('❌ MongoDB connection failed:', e.message);
    if (String(e.message || '').includes('ENOTFOUND') || String(e.message || '').includes('Server selection')) {
      console.error('\nHint: your .env may still point at an old host. For droplet DB, use 127.0.0.1 from the server,');
      console.error('or tunnel Mongo and pass MONGODB_URI to this script.\n');
    }
    process.exit(1);
  }

  console.log('✅ Connected.\n');

  const emailLower = CONFIG.email.toLowerCase().trim();

  const emailTaken = await User.findOne({ email: emailLower }).select('employeeId email').lean();
  if (emailTaken && String(emailTaken.employeeId) !== String(CONFIG.employeeId)) {
    throw new Error(
      `Email ${emailLower} is already assigned to employeeId ${emailTaken.employeeId}. Change CONFIG or that user.`
    );
  }

  let user =
    (await User.findOne({ employeeId: String(CONFIG.employeeId) }).select('+password')) ||
    (await User.findOne({ email: emailLower }).select('+password'));

  const payload = {
    firstName: CONFIG.firstName,
    lastName: CONFIG.lastName,
    email: emailLower,
    employeeId: String(CONFIG.employeeId),
    role: CONFIG.role,
    department: CONFIG.department,
    position: CONFIG.position,
    phone: CONFIG.phone || undefined,
    isActive: true,
    isEmailVerified: true,
    roleRef: null,
    roles: [],
    subRoles: []
  };

  if (!user) {
    user = new User({ ...payload, password: CONFIG.defaultPassword });
    console.log('Creating new developer user...');
  } else {
    console.log(`Updating existing user (${user.email} / employeeId ${user.employeeId})...`);
    Object.assign(user, payload);
    user.password = CONFIG.defaultPassword;
  }

  await user.save();

  console.log('\n✅ Done. Sign in with:');
  console.log(`   Email:    ${emailLower}`);
  console.log(`   Password: (value of DEVELOPER_PASSWORD, or default if unset)`);
  console.log(`   Role:     ${CONFIG.role}`);
  console.log('\nDeploy the app code that includes the "developer" role, then restart PM2 if needed.\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
