/**
 * One-time fix for an existing posted GRN journal entry.
 *
 * Rewrites the JE lines from wrong heads to correct heads and syncs:
 * - JournalEntry lines
 * - Account balances
 * - General Ledger rows for that JE
 *
 * Default target (as requested):
 *   JE-000002: DR 1200 (Inventory), CR 2140 (GRNI)
 *
 * Usage:
 *   node server/scripts/fix-existing-grn-je-heads.js --entry JE-000002 --yes
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const JournalEntry = require(path.join(root, 'server/models/finance/JournalEntry'));
const GeneralLedger = require(path.join(root, 'server/models/finance/GeneralLedger'));
const Account = require(path.join(root, 'server/models/finance/Account'));
const FinanceHelper = require(path.join(root, 'server/utils/financeHelper'));

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

async function main() {
  const entryNumber = getArg('--entry', 'JE-000002');
  const confirm = process.argv.includes('--yes');
  if (!confirm) {
    console.error('Refusing to run without --yes.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI_LOCAL;
  if (!uri) {
    console.error('Set MONGODB_URI_LOCAL in .env (local DB only).');
    process.exit(1);
  }
  if (!(uri.includes('localhost') || uri.includes('127.0.0.1') || uri.includes('::1'))) {
    console.error('Refusing to run: MONGODB_URI_LOCAL is not localhost.');
    process.exit(1);
  }

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const je = await JournalEntry.findOne({ entryNumber });
  if (!je) throw new Error(`Journal entry not found: ${entryNumber}`);
  if (je.status !== 'posted') throw new Error(`Journal entry ${entryNumber} is not posted.`);

  const inventoryAcc = await Account.findOne({ accountNumber: '1200', type: 'Asset' });
  const grniAcc = await Account.findOne({ accountNumber: '2140', type: 'Liability' });
  if (!inventoryAcc) throw new Error('Inventory account 1200 (Asset) not found.');
  if (!grniAcc) throw new Error('GRNI account 2140 (Liability) not found.');

  // Snapshot old effects so we can reverse posted impact.
  const oldLines = (je.lines || []).map((l) => ({
    account: String(l.account),
    debit: Number(l.debit || 0),
    credit: Number(l.credit || 0),
    description: l.description || ''
  }));

  const debitLine = oldLines.find((l) => l.debit > 0);
  const creditLine = oldLines.find((l) => l.credit > 0);
  if (!debitLine || !creditLine) {
    throw new Error(`Entry ${entryNumber} does not have expected debit/credit lines.`);
  }

  const amount = round2(debitLine.debit);
  if (amount <= 0 || Math.abs(round2(creditLine.credit) - amount) > 0.01) {
    throw new Error(`Entry ${entryNumber} is not a single balanced amount.`);
  }

  // 1) Undo old posted balance impact.
  for (const l of oldLines) {
    const delta = round2(l.debit - l.credit);
    if (delta !== 0) {
      await Account.findByIdAndUpdate(l.account, { $inc: { balance: -delta } });
    }
  }

  // 2) Rewrite JE lines to correct heads.
  je.lines = [
    {
      account: inventoryAcc._id,
      description: debitLine.description || 'Inventory in (corrected account head)',
      debit: amount,
      credit: 0,
      department: 'procurement'
    },
    {
      account: grniAcc._id,
      description: creditLine.description || 'GRNI (corrected account head)',
      debit: 0,
      credit: amount,
      department: 'procurement'
    }
  ];
  je.description = `${je.description} [HEADS-CORRECTED]`;
  await je.save(); // recalculates totals via pre-save

  // 3) Apply new posted balance impact.
  for (const l of je.lines) {
    const delta = round2(Number(l.debit || 0) - Number(l.credit || 0));
    if (delta !== 0) {
      await Account.findByIdAndUpdate(l.account, { $inc: { balance: delta } });
    }
  }

  // 4) Rebuild GL rows for this JE.
  await GeneralLedger.deleteMany({ journalEntry: je._id });
  await FinanceHelper.postToGeneralLedger(je._id);

  console.log(`Fixed ${entryNumber}: DR 1200 ${amount}, CR 2140 ${amount}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('FAILED:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
