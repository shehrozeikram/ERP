/**
 * One-time corrective script:
 * For a given PO, detects GRN journal entries where the "GRNI" credit leg
 * was posted to a non-liability account (e.g. Accounts Receivable),
 * then posts a correcting JE:
 *   DR wrong account
 *   CR GRNI liability
 *
 * This preserves audit trail (no history mutation).
 *
 * Usage:
 *   node server/scripts/fix-po-grn-ar-to-grni.js --po PO-202605-0001 --yes
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const PurchaseOrder = require(path.join(root, 'server/models/procurement/PurchaseOrder'));
const GoodsReceive = require(path.join(root, 'server/models/procurement/GoodsReceive'));
const JournalEntry = require(path.join(root, 'server/models/finance/JournalEntry'));
const Account = require(path.join(root, 'server/models/finance/Account'));
const FinanceHelper = require(path.join(root, 'server/utils/financeHelper'));

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

async function resolveGrniAccount() {
  let acc = await Account.findOne({ accountNumber: FinanceHelper.ACCOUNTS.GRNI }).lean();
  if (!acc) {
    acc = await Account.findOne({
      type: 'Liability',
      name: { $regex: 'goods\\s*received\\s*not\\s*invoiced|\\bgrni\\b', $options: 'i' }
    }).lean();
  }
  return acc || null;
}

async function main() {
  const poNumber = getArg('--po');
  const confirm = process.argv.includes('--yes');

  if (!poNumber) {
    console.error('Missing --po. Example: --po PO-202605-0001');
    process.exit(1);
  }
  if (!confirm) {
    console.error('Refusing to run without --yes.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI_LOCAL;
  if (!uri) {
    console.error('Set MONGODB_URI_LOCAL in .env (local database only).');
    process.exit(1);
  }
  if (!(uri.includes('localhost') || uri.includes('127.0.0.1') || uri.includes('::1'))) {
    console.error('Refusing to run: MONGODB_URI_LOCAL is not a localhost URI.');
    process.exit(1);
  }

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const po = await PurchaseOrder.findOne({ orderNumber: poNumber }).lean();
  if (!po) {
    throw new Error(`PO not found: ${poNumber}`);
  }

  const grns = await GoodsReceive.find({ purchaseOrder: po._id })
    .select('_id receiveNumber receiveDate')
    .lean();
  if (!grns.length) {
    console.log(`No GRNs linked to PO ${poNumber}. Nothing to fix.`);
    await mongoose.disconnect();
    return;
  }

  const grnIds = grns.map((g) => g._id);
  const grnById = new Map(grns.map((g) => [String(g._id), g]));
  const grniAccount = await resolveGrniAccount();
  if (!grniAccount) {
    throw new Error('Could not resolve a GRNI liability account.');
  }

  const entries = await JournalEntry.find({
    referenceType: 'grn',
    referenceId: { $in: grnIds },
    status: 'posted'
  }).populate('lines.account', 'accountNumber name type').lean();

  let totalFixAmount = 0;
  const badLines = [];
  for (const je of entries) {
    for (const line of (je.lines || [])) {
      const credit = Number(line.credit || 0);
      if (credit <= 0) continue;
      const account = line.account || {};
      const type = String(account.type || '').toLowerCase();
      const name = String(account.name || '');
      const accNo = String(account.accountNumber || '');
      const saysGrniLeg = /grni|goods\s*received\s*not\s*invoiced/i.test(String(line.description || ''));
      const looksWrong = type !== 'liability' || /\baccounts?\s*receivable\b|\bar\b/i.test(name) || accNo === '1100';
      if (saysGrniLeg && looksWrong) {
        totalFixAmount = round2(totalFixAmount + credit);
        badLines.push({
          jeId: je._id,
          entryNumber: je.entryNumber,
          referenceId: je.referenceId,
          badAccountId: account._id,
          badAccountNumber: accNo,
          badAccountName: name,
          amount: credit
        });
      }
    }
  }

  if (!badLines.length) {
    console.log(`No incorrect GRN credit lines found for PO ${poNumber}.`);
    await mongoose.disconnect();
    return;
  }

  // Group by wrong account to preserve exact account-level correction.
  const byBadAccount = new Map();
  for (const row of badLines) {
    const key = String(row.badAccountId);
    const existing = byBadAccount.get(key) || { ...row, amount: 0 };
    existing.amount = round2(existing.amount + row.amount);
    byBadAccount.set(key, existing);
  }

  const firstGrn = grns[0];
  const correctionLines = [];
  for (const [, row] of byBadAccount) {
    correctionLines.push({
      account: row.badAccountId,
      description: `Correction DR (${row.badAccountNumber} ${row.badAccountName}) for PO ${poNumber} GRN misposting`,
      debit: row.amount,
      credit: 0,
      department: 'finance'
    });
  }
  correctionLines.push({
    account: grniAccount._id,
    description: `Correction CR GRNI for PO ${poNumber}`,
    debit: 0,
    credit: totalFixAmount,
    department: 'finance'
  });

  const createdBy = po.createdBy || po.approvedBy || po.updatedBy;
  if (!createdBy) {
    throw new Error('PO has no createdBy/approvedBy/updatedBy. Cannot set createdBy on correction JE.');
  }

  const correction = await FinanceHelper.createAndPostJournalEntry({
    date: firstGrn.receiveDate || new Date(),
    reference: `FIX-GRNI-${poNumber}`,
    description: `Correction: move GRN credit from wrong account(s) to GRNI for ${poNumber}`,
    department: 'finance',
    module: 'procurement',
    referenceId: firstGrn._id,
    referenceType: 'adjustment',
    lines: correctionLines,
    notes: `Auto-fix for PO ${poNumber}. Total corrected amount: ${totalFixAmount}`,
    createdBy
  });

  console.log(`PO: ${poNumber}`);
  console.log(`Linked GRNs: ${grns.length}`);
  console.log(`Incorrect lines found: ${badLines.length}`);
  console.log(`Corrected amount: ${totalFixAmount}`);
  console.log(`Correction JE: ${correction.entryNumber} (${correction.reference})`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('FAILED:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
