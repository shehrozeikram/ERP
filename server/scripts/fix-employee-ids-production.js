#!/usr/bin/env node
/**
 * One-time fix: restore employee IDs that were accidentally changed in production.
 *
 * Usage (on production server, from repo root):
 *   NODE_ENV=production node server/scripts/fix-employee-ids-production.js --dry-run
 *   NODE_ENV=production node server/scripts/fix-employee-ids-production.js
 *
 * Local dev (uses MONGODB_URI_LOCAL when set):
 *   node server/scripts/fix-employee-ids-production.js --dry-run
 *
 * Safe to run multiple times — skips employees already on the correct ID.
 */
const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '..', '..');
const envPath = path.join(repoRoot, '.env');
const localPath = path.join(repoRoot, '.env.local');
if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
const prodLike = process.env.NODE_ENV === 'production';
if (!prodLike && fs.existsSync(localPath)) {
  require('dotenv').config({ path: localPath, override: true });
}
if (process.env.SGC_ENV_FILE) {
  const extra = path.isAbsolute(process.env.SGC_ENV_FILE)
    ? process.env.SGC_ENV_FILE
    : path.join(repoRoot, process.env.SGC_ENV_FILE);
  if (fs.existsSync(extra)) require('dotenv').config({ path: extra, override: true });
}

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');

const dryRun = process.argv.includes('--dry-run');

// firstName / lastName used to locate the employee when wrong IDs differ between environments
const CORRECTIONS = [
  {
    name: 'Abrar Ullah',
    firstName: 'Abrar',
    lastName: 'Ullah',
    correctId: '02995',
    wrongIds: ['6604', '06604', '2995', '02995']
  },
  {
    name: 'Najeeb Abbasi',
    firstName: 'Najeeb',
    lastName: 'Abbasi',
    correctId: '06187',
    wrongIds: ['6605', '06605', '6187', '06187']
  },
  {
    name: 'Muhammad Haris Ali',
    firstName: 'Muhammad Haris',
    lastName: 'Ali',
    correctId: '04921',
    wrongIds: ['6606', '06606', '4921', '04921']
  },
  {
    name: 'Wajahat Haleem',
    firstName: 'Wajahat',
    lastName: 'Haleem',
    correctId: '03015',
    wrongIds: ['6607', '06607', '3015', '03015']
  },
  {
    name: 'Zakir Hussain',
    firstName: 'Zakir',
    lastName: 'Hussain',
    correctId: '05874',
    wrongIds: ['6608', '06608', '5874', '05874']
  },
  {
    name: 'Muhammad Adnan Khan',
    firstName: 'Muhammad Adnan',
    lastName: 'Khan',
    correctId: '06453',
    wrongIds: ['6610', '06610', '6453', '06453']
  },
  {
    name: 'Malik Zahid Mehmood',
    firstName: 'Malik Zahid',
    lastName: 'Mehmood',
    correctId: '01630',
    wrongIds: ['6611', '06611', '1630', '01630']
  }
];

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function findEmployee(col, entry) {
  const { correctId, wrongIds, firstName, lastName } = entry;

  const already = await col.findOne({
    employeeId: correctId,
    firstName: new RegExp(`^${escapeRegex(firstName)}$`, 'i'),
    lastName: new RegExp(`^${escapeRegex(lastName)}$`, 'i'),
    isDeleted: { $ne: true }
  });
  if (already) return { employee: already, status: 'already_correct' };

  for (const wrongId of wrongIds) {
    if (wrongId === correctId) continue;
    const byWrongId = await col.findOne({
      employeeId: wrongId,
      isDeleted: { $ne: true }
    });
    if (byWrongId) {
      const dbName = [byWrongId.firstName, byWrongId.lastName].filter(Boolean).join(' ');
      if (
        new RegExp(escapeRegex(firstName), 'i').test(byWrongId.firstName || '') &&
        new RegExp(escapeRegex(lastName), 'i').test(byWrongId.lastName || '')
      ) {
        return { employee: byWrongId, status: 'found_by_wrong_id', matchedId: wrongId };
      }
      console.warn(
        `⚠️  ID ${wrongId} belongs to "${dbName}", not ${entry.name}. Skipping that ID.`
      );
    }
  }

  const byName = await col.findOne({
    firstName: new RegExp(`^${escapeRegex(firstName)}$`, 'i'),
    lastName: new RegExp(`^${escapeRegex(lastName)}$`, 'i'),
    isDeleted: { $ne: true }
  });
  if (byName) {
    return { employee: byName, status: 'found_by_name' };
  }

  return { employee: null, status: 'not_found' };
}

async function main() {
  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('❌  No MongoDB URI. Set MONGODB_URI (production) or MONGODB_URI_LOCAL (dev).');
    process.exit(1);
  }

  const host = (() => {
    try {
      return new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'https://')).hostname;
    } catch {
      return '(unknown host)';
    }
  })();

  console.log(`Database: ${isLocal ? 'LOCAL (MONGODB_URI_LOCAL)' : 'PRODUCTION (MONGODB_URI)'} — ${host}`);
  if (dryRun) console.log('Mode: DRY RUN (no writes)\n');
  else console.log('Mode: APPLY\n');

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));
  const col = mongoose.connection.collection('employees');

  let fixed = 0;
  let alreadyCorrect = 0;
  let notFound = 0;
  let conflicts = 0;

  for (const entry of CORRECTIONS) {
    const { employee, status, matchedId } = await findEmployee(col, entry);

    if (status === 'not_found' || !employee) {
      console.warn(`⚠️  ${entry.name} — NOT FOUND in this database`);
      notFound++;
      continue;
    }

    const dbName = [employee.firstName, employee.lastName].filter(Boolean).join(' ');
    const currentId = employee.employeeId;

    if (currentId === entry.correctId) {
      console.log(`⏭   ${entry.name} — already correct (${entry.correctId}) [${dbName}]`);
      alreadyCorrect++;
      continue;
    }

    const conflict = await col.findOne({
      employeeId: entry.correctId,
      isDeleted: { $ne: true },
      _id: { $ne: employee._id }
    });

    if (conflict) {
      const conflictName = [conflict.firstName, conflict.lastName].filter(Boolean).join(' ');
      console.error(
        `❌  ${entry.name} — cannot set ${entry.correctId}: already used by "${conflictName}"`
      );
      conflicts++;
      continue;
    }

    const via =
      status === 'found_by_wrong_id'
        ? `wrong id ${matchedId}`
        : status === 'found_by_name'
          ? 'name match'
          : 'lookup';

    if (dryRun) {
      console.log(`🔍  ${entry.name} (${dbName}) — would change ${currentId} → ${entry.correctId} [${via}]`);
      fixed++;
      continue;
    }

    const result = await col.updateOne(
      { _id: employee._id },
      { $set: { employeeId: entry.correctId } }
    );

    if (result.modifiedCount === 1) {
      console.log(`✅  ${entry.name} (${dbName}) — ${currentId} → ${entry.correctId} [${via}]`);
      fixed++;
    } else {
      console.warn(`⚠️  ${entry.name} — update reported 0 modifications (current: ${currentId})`);
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`  ${dryRun ? 'Would fix' : 'Fixed'}       : ${fixed}`);
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  Not found      : ${notFound}`);
  console.log(`  Conflicts      : ${conflicts}`);
  console.log('─────────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(conflicts > 0 || notFound > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
