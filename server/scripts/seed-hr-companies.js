/**
 * Seed HR placement companies (Finance → HR Companies list).
 *
 * Usage:
 *   node server/scripts/seed-hr-companies.js --dry-run
 *   node server/scripts/seed-hr-companies.js --yes
 */

const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '..', '..');
for (const f of ['.env', '.env.local']) {
  const p = path.join(repoRoot, f);
  if (fs.existsSync(p)) require('dotenv').config({ path: p, override: f === '.env.local' });
}
if (process.env.SGC_ENV_FILE) {
  const extra = path.isAbsolute(process.env.SGC_ENV_FILE)
    ? process.env.SGC_ENV_FILE
    : path.join(repoRoot, process.env.SGC_ENV_FILE);
  if (fs.existsSync(extra)) require('dotenv').config({ path: extra, override: true });
}

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const Company = require('../models/hr/Company');

const COMPANIES = [
  { name: 'SARDAR GROUP OF COMPANIES', type: 'Other' },
  { name: 'TAJ RESIDENCIA', type: 'Private Limited' },
  { name: 'USMAN SOLAR (PVT)LTD', type: 'Private Limited' },
  { name: 'HAMZA PAPER BRAIN (PVT)LTD', type: 'Private Limited' },
  { name: 'ROYAL CRETE SOLUTIONS', type: 'Private Limited' },
  { name: 'CICON', type: 'Private Limited' },
  { name: 'TIGES', type: 'Private Limited' },
  { name: 'TENACIOUS', type: 'Private Limited' },
  { name: 'RADIANT MENTOR', type: 'Private Limited' },
  { name: 'TAJ PROJECTS', type: 'Private Limited' },
  { name: 'SARDAR PRIME BUILDERS', type: 'Private Limited' }
];

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findExisting = async (name) => Company.findOne({
  name: { $regex: new RegExp(`^${escapeRegex(name.trim())}$`, 'i') }
});

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');
  const confirmed = process.argv.includes('--yes');

  if (!dryRun && !confirmed) {
    console.error('Pass --dry-run to preview or --yes to apply.');
    process.exit(1);
  }

  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    throw new Error('MongoDB URI is not configured (MONGODB_URI_LOCAL or MONGODB_URI)');
  }

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));
  console.log(`Connected to MongoDB (${dryRun ? 'dry-run' : 'apply'})${isLocal ? ' [local]' : ''}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < COMPANIES.length; i += 1) {
    const row = COMPANIES[i];
    const existing = await findExisting(row.name);

    if (existing) {
      const needsUpdate = existing.isActive === false || existing.type !== row.type;

      if (!needsUpdate) {
        console.log(`${i + 1}. SKIP (exists): ${row.name}`);
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`${i + 1}. UPDATE: ${row.name} → active`);
        updated += 1;
        continue;
      }

      existing.name = row.name;
      existing.type = row.type;
      existing.isActive = true;
      await existing.save();
      console.log(`${i + 1}. UPDATED: ${row.name}`);
      updated += 1;
      continue;
    }

    if (dryRun) {
      console.log(`${i + 1}. CREATE: ${row.name}`);
      created += 1;
      continue;
    }

    await Company.create({
      name: row.name,
      type: row.type,
      isActive: true
    });
    console.log(`${i + 1}. CREATED: ${row.name}`);
    created += 1;
  }

  const total = await Company.countDocuments({ isActive: true });
  console.log(`\nDone. created=${created}, updated=${updated}, skipped=${skipped}, active total=${total}`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_e) {
    /* ignore */
  }
  process.exit(1);
});
