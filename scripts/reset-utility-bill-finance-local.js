/**
 * Remove Finance posting for one utility bill (local dev) so you can re-test post-to-finance.
 *
 * Usage:
 *   node scripts/reset-utility-bill-finance-local.js UB830408 --yes
 *   node scripts/reset-utility-bill-finance-local.js UB830408 --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const path = require('path');

const billIdArg = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const confirmed = process.argv.includes('--yes');

if (!billIdArg) {
  console.error('Usage: node scripts/reset-utility-bill-finance-local.js <billId> --yes');
  process.exit(1);
}

const uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
const isLocal =
  /localhost|127\.0\.0\.1|::1/i.test(uri || '') ||
  process.env.ALLOW_RESET_UTILITY_FINANCE === '1';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_RESET_UTILITY_FINANCE !== '1') {
  console.error('Refusing: NODE_ENV=production. Set ALLOW_RESET_UTILITY_FINANCE=1 to override.');
  process.exit(1);
}

if (!isLocal && process.env.ALLOW_RESET_UTILITY_FINANCE !== '1') {
  console.error('Refusing: database does not look local. Set ALLOW_RESET_UTILITY_FINANCE=1 to override.');
  process.exit(1);
}

if (!confirmed && !dryRun) {
  console.error('Add --yes to confirm or --dry-run to preview.');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const UtilityBill = require(path.join(root, 'server/models/hr/UtilityBill'));
const AccountsPayable = require(path.join(root, 'server/models/finance/AccountsPayable'));
const JournalEntry = require(path.join(root, 'server/models/finance/JournalEntry'));
const GeneralLedger = require(path.join(root, 'server/models/finance/GeneralLedger'));
const Account = require(path.join(root, 'server/models/finance/Account'));

const reverseJournalBalances = async (entry) => {
  if (!entry || entry.status !== 'posted' || !Array.isArray(entry.lines)) return;
  for (const line of entry.lines) {
    const accountRef = line.account?._id || line.account;
    if (!accountRef) continue;
    const delta = (Number(line.credit) || 0) - (Number(line.debit) || 0);
    if (!dryRun) {
      await Account.findByIdAndUpdate(accountRef, { $inc: { balance: delta } });
    }
  }
};

(async () => {
  await mongoose.connect(uri);
  const bill = await UtilityBill.findOne({ billId: billIdArg });
  if (!bill) {
    console.error(`Utility bill not found: ${billIdArg}`);
    process.exit(1);
  }

  const apIds = new Set();
  if (bill.financeApBillId) apIds.add(String(bill.financeApBillId));
  const apByRef = await AccountsPayable.findOne({
    referenceId: bill._id,
    referenceType: 'utility_bill'
  });
  if (apByRef) apIds.add(String(apByRef._id));
  const apByNumber = await AccountsPayable.findOne({ billNumber: billIdArg });
  if (apByNumber) apIds.add(String(apByNumber._id));

  const journalFilter = {
    $or: [
      { reference: billIdArg },
      { reference: new RegExp(`^${billIdArg}`) },
      ...[...apIds].map((id) => ({ referenceId: new mongoose.Types.ObjectId(id) }))
    ]
  };
  const journals = await JournalEntry.find(journalFilter);
  const journalIds = journals.map((j) => j._id);
  const glCount = journalIds.length
    ? await GeneralLedger.countDocuments({ journalEntry: { $in: journalIds } })
    : 0;

  console.log('Preview:', {
    billId: bill.billId,
    auditStatus: bill.auditStatus,
    apIds: [...apIds],
    journals: journals.map((j) => ({ id: j._id.toString(), entryNumber: j.entryNumber })),
    glLines: glCount
  });

  if (dryRun) {
    await mongoose.disconnect();
    return;
  }

  for (const entry of journals) {
    await reverseJournalBalances(entry);
  }

  if (journalIds.length) {
    await GeneralLedger.deleteMany({ journalEntry: { $in: journalIds } });
    await JournalEntry.deleteMany({ _id: { $in: journalIds } });
  }

  if (apIds.size) {
    await AccountsPayable.deleteMany({ _id: { $in: [...apIds] } });
  }

  bill.financeApBillId = null;
  bill.financePostedAt = null;
  bill.financePostedBy = null;
  if (Array.isArray(bill.workflowHistory)) {
    bill.workflowHistory = bill.workflowHistory.filter(
      (h) => h.module !== 'finance' && !String(h.comments || '').includes('Posted to Finance')
        && !String(h.comments || '').includes('Finance GL posted')
    );
  }
  await bill.save();

  console.log(`Done. ${billIdArg} finance link cleared; AP and journals removed. Re-test via Audit approve or Post to Finance.`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
