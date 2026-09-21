#!/usr/bin/env node
/**
 * Diagnose orphan GL / lingering JEs for specific entry numbers.
 * Usage (on prod):
 *   NODE_ENV=production node server/scripts/diagnose-orphan-jvs.js
 *   NODE_ENV=production node server/scripts/diagnose-orphan-jvs.js JV-002523 JV-002524
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');

const defaultNums = [
  'JV-002523',
  'JV-002524',
  'JV-002525',
  'JV-002526',
  'JV-002527',
  'JV-002528',
  'JV-002529',
  'JV-002530'
];

async function main() {
  const nums = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const entryNumbers = nums.length ? nums : defaultNums;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri, getMongooseClientOptions(uri, false));
  const je = mongoose.connection.db.collection('journalentries');
  const gl = mongoose.connection.db.collection('generalledgers');

  console.log('Checking entry numbers:', entryNumbers.join(', '));
  console.log('DB:', mongoose.connection.name);

  const jes = await je
    .find({ entryNumber: { $in: entryNumbers } })
    .project({ entryNumber: 1, status: 1, date: 1, totalDebits: 1, totalCredits: 1 })
    .toArray();

  const gls = await gl
    .find({ entryNumber: { $in: entryNumbers } })
    .project({ entryNumber: 1, journalEntry: 1, account: 1, debit: 1, credit: 1, date: 1, status: 1 })
    .toArray();

  const glJeIds = [...new Set(gls.map((g) => String(g.journalEntry)).filter(Boolean))];
  const existingJeIds = glJeIds.length
    ? await je
        .find({ _id: { $in: glJeIds.map((id) => new mongoose.Types.ObjectId(id)) } })
        .project({ _id: 1, entryNumber: 1 })
        .toArray()
    : [];
  const existingSet = new Set(existingJeIds.map((j) => String(j._id)));
  const orphanGl = gls.filter((g) => !existingSet.has(String(g.journalEntry)));

  console.log('\n=== JournalEntry documents ===');
  console.log(jes.length ? JSON.stringify(jes, null, 2) : '(none — JEs are deleted)');

  console.log('\n=== GeneralLedger rows ===');
  console.log('count:', gls.length);
  console.log(
    'by entryNumber:',
    JSON.stringify(
      gls.reduce((a, g) => {
        a[g.entryNumber] = (a[g.entryNumber] || 0) + 1;
        return a;
      }, {})
    )
  );
  console.log('orphan GL (JE missing):', orphanGl.length);
  console.log(
    'orphan entryNumbers:',
    JSON.stringify([...new Set(orphanGl.map((g) => g.entryNumber))])
  );

  // Broader scan: any GL whose journalEntry no longer exists (sample by entryNumber)
  const sampleOrphans = await gl
    .aggregate([
      { $match: { journalEntry: { $exists: true, $ne: null } } },
      {
        $lookup: {
          from: 'journalentries',
          localField: 'journalEntry',
          foreignField: '_id',
          as: 'je'
        }
      },
      { $match: { je: { $size: 0 } } },
      {
        $group: {
          _id: '$entryNumber',
          rows: { $sum: 1 },
          debit: { $sum: '$debit' },
          credit: { $sum: '$credit' }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 50 }
    ])
    .toArray();

  const orphanTotal = await gl
    .aggregate([
      { $match: { journalEntry: { $exists: true, $ne: null } } },
      {
        $lookup: {
          from: 'journalentries',
          localField: 'journalEntry',
          foreignField: '_id',
          as: 'je'
        }
      },
      { $match: { je: { $size: 0 } } },
      { $count: 'n' }
    ])
    .toArray();

  console.log('\n=== Global orphan GL summary (first 50 entryNumbers) ===');
  console.log('total orphan GL rows:', orphanTotal[0]?.n || 0);
  console.log(JSON.stringify(sampleOrphans, null, 2));

  // For requested nums: do they still contribute to TB via JE?
  if (jes.length) {
    console.log('\nWARNING: These JEs still exist — Trial Balance WILL include them.');
  } else if (orphanGl.length) {
    console.log(
      '\nNOTE: JEs gone but orphan GL remains — ledger under Trial Balance still shows them;'
    );
    console.log('Trial Balance account totals (from JE) should NOT include their amounts.');
  } else {
    console.log('\nNeither JE nor GL found for these numbers — they should not appear anywhere.');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
