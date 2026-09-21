#!/usr/bin/env node
/**
 * Delete specific journal entries by entryNumber using the full unwind path
 * (same as Finance UI developer delete).
 *
 * Default: DRY-RUN (lists only).
 *
 * Examples:
 *   NODE_ENV=production node server/scripts/delete-journal-entries-by-number.js JV-002523 JV-002524
 *   NODE_ENV=production node server/scripts/delete-journal-entries-by-number.js --apply --yes JV-002523 JV-002524 JV-002525
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const yes = args.includes('--yes');
  const entryNumbers = args.filter((a) => !a.startsWith('-'));

  if (!entryNumbers.length) {
    console.error('Usage: node server/scripts/delete-journal-entries-by-number.js [--apply --yes] JV-00xxxx ...');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  if (!uri) {
    console.error('No MongoDB URI');
    process.exit(1);
  }
  const isLocal = /localhost|127\.0\.0\.1/.test(uri);
  if (apply && !isLocal && !yes) {
    console.error('Refusing non-local apply without --yes');
    process.exit(1);
  }

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));
  // Ensure models are registered
  require('../models/finance/JournalEntry');
  require('../models/finance/GeneralLedger');
  require('../models/finance/Account');
  const JournalEntry = mongoose.model('JournalEntry');
  const { unwindJournalEntryOnDelete } = require('../utils/journalEntryDeleteUnwind');

  const entries = await JournalEntry.find({ entryNumber: { $in: entryNumbers } })
    .populate('lines.account', 'accountNumber name')
    .lean(false);

  console.log('═══════════════════════════════════════════════════');
  console.log(` Mode: ${apply ? 'APPLY (delete)' : 'DRY-RUN'}`);
  console.log(` DB:   ${mongoose.connection.name}`);
  console.log('───────────────────────────────────────────────────');

  if (!entries.length) {
    console.log('No journal entries found for:', entryNumbers.join(', '));
    await mongoose.disconnect();
    return;
  }

  for (const e of entries) {
    const lines = (e.lines || [])
      .map((l) => {
        const acc = l.account?.accountNumber || String(l.account);
        return `  ${acc}  Dr ${l.debit || 0}  Cr ${l.credit || 0}`;
      })
      .join('\n');
    console.log(
      `${e.entryNumber}  status=${e.status}  date=${e.date?.toISOString?.()?.slice(0, 10)}  ` +
        `Dr=${e.totalDebits} Cr=${e.totalCredits}  id=${e._id}`
    );
    if (lines) console.log(lines);
    console.log('');
  }

  const missing = entryNumbers.filter((n) => !entries.some((e) => e.entryNumber === n));
  if (missing.length) console.log('Not found:', missing.join(', '));

  if (!apply) {
    console.log('Dry-run only. Re-run with --apply --yes to delete via full unwind.');
    await mongoose.disconnect();
    return;
  }

  // Prefer deleting posted first is fine; unwind handles both
  for (const e of entries) {
    const fresh = await JournalEntry.findById(e._id);
    if (!fresh) {
      console.log(`Skip ${e.entryNumber}: already gone`);
      continue;
    }
    await unwindJournalEntryOnDelete(fresh);
    console.log(`Deleted ${e.entryNumber}`);
  }

  console.log('Done. Regenerate Trial Balance to verify.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
