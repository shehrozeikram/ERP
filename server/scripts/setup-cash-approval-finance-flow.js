#!/usr/bin/env node
/*
 * Prepare a Cash Approval for Finance workflow testing in one command.
 *
 * What it does:
 * 1) Finds CA by caNumber
 * 2) Moves it to Pending Finance
 * 3) Assigns finance authorities (auto-picks finance users, or uses provided IDs)
 * 4) Clears prior finance approvals
 * 5) Optionally creates and links a voucher JE
 *
 * Usage examples:
 *   node server/scripts/setup-cash-approval-finance-flow.js --ca CA-202605-0012
 *   node server/scripts/setup-cash-approval-finance-flow.js --ca CA-202605-0012 --no-voucher
 *   node server/scripts/setup-cash-approval-finance-flow.js --ca CA-202605-0012 --officer <uid> --manager <uid> --controller <uid>
 */

const mongoose = require('mongoose');

const CashApproval = require('../models/procurement/CashApproval');
const JournalEntry = require('../models/finance/JournalEntry');
const Account = require('../models/finance/Account');
const GeneralLedger = require('../models/finance/GeneralLedger');
const User = require('../models/User');
const FinanceHelper = require('../utils/financeHelper');

const arg = (name, fallback = '') => {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
};
const hasFlag = (name) => process.argv.includes(`--${name}`);

const caNumber = arg('ca');
const officerId = arg('officer');
const managerId = arg('manager');
const controllerId = arg('controller');
const createVoucher = !hasFlag('no-voucher');
const doResetLinkedVoucher = !hasFlag('keep-existing-voucher');

if (!caNumber) {
  console.error('Missing required argument: --ca <CA-NUMBER>');
  process.exit(1);
}

const uri =
  process.env.MONGODB_URI_LOCAL ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/sgc_erp_local';

const norm = (v) => String(v || '').toLowerCase().trim();

async function pickFinanceUsers() {
  const all = await User.find({ isActive: true }).select('_id firstName lastName role email department roleRef roles');

  const scored = all
    .map((u) => {
      const role = norm(u.role);
      const dept = norm(u.department);
      const roleRefName = norm(u.roleRef?.name || u.roleRef?.displayName);
      const roleNames = Array.isArray(u.roles)
        ? u.roles.map((r) => `${norm(r?.name)} ${norm(r?.displayName)}`).join(' ')
        : '';
      const hay = `${role} ${dept} ${roleRefName} ${roleNames} ${norm(u.email)}`;
      const financeHit = /(finance|account|accounts)/i.test(hay);
      const managerHit = /(manager|gm|head|controller)/i.test(hay);
      return { user: u, financeHit, managerHit };
    })
    .filter((x) => x.financeHit)
    .sort((a, b) => Number(b.managerHit) - Number(a.managerHit));

  if (scored.length < 3) {
    throw new Error('Could not auto-pick 3 finance users. Pass --officer --manager --controller explicitly.');
  }

  return {
    officer: scored[0].user,
    manager: scored[1].user,
    controller: scored[2].user
  };
}

async function unlinkAndDeleteVoucher(ca) {
  if (!ca.voucherEntryId) return;

  const je = await JournalEntry.findById(ca.voucherEntryId);
  if (!je) {
    ca.voucherEntryId = null;
    ca.advanceVoucherNo = '';
    return;
  }

  for (const line of je.lines || []) {
    const delta = (Number(line.debit) || 0) - (Number(line.credit) || 0);
    if (!line.account) continue;
    await Account.findByIdAndUpdate(line.account, { $inc: { balance: -delta } });
  }
  await GeneralLedger.deleteMany({ journalEntry: je._id });
  await JournalEntry.deleteOne({ _id: je._id });

  ca.voucherEntryId = null;
  ca.advanceVoucherNo = '';
}

async function createLinkedVoucher(ca, createdById) {
  const amount = Math.round((Number(ca.totalAmount) || 0) * 100) / 100;
  if (amount <= 0) throw new Error('Cash approval total amount is zero; cannot create voucher');

  let debitAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.EXPENSE_GENERAL);
  let creditAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.PAYABLE);
  if (!debitAccount || !creditAccount) {
    const fallback = await Account.find({ isActive: true }).limit(2);
    if (fallback.length < 2) throw new Error('Could not resolve debit/credit accounts');
    debitAccount = debitAccount || fallback[0];
    creditAccount = creditAccount || fallback[1];
  }

  const je = await FinanceHelper.createAndPostJournalEntry({
    date: new Date(),
    reference: ca.caNumber,
    description: `Cash Approval voucher created for ${ca.caNumber}`,
    department: 'finance',
    module: 'finance',
    referenceId: ca._id,
    referenceType: 'payment',
    journalCode: 'BANK',
    createdBy: createdById,
    lines: [
      { account: debitAccount._id, description: `Cash approval expense (${ca.caNumber})`, debit: amount, department: 'finance' },
      { account: creditAccount._id, description: `Payable for cash approval (${ca.caNumber})`, credit: amount, department: 'finance' }
    ]
  });

  ca.voucherEntryId = je._id;
  ca.advanceVoucherNo = je.entryNumber || '';
  return je;
}

async function run() {
  await mongoose.connect(uri);
  console.log(`Connected DB for CA: ${caNumber}`);

  const ca = await CashApproval.findOne({ caNumber });
  if (!ca) throw new Error(`Cash Approval not found: ${caNumber}`);

  let officer;
  let manager;
  let controller;

  if (officerId && managerId && controllerId) {
    [officer, manager, controller] = await Promise.all([
      User.findById(officerId),
      User.findById(managerId),
      User.findById(controllerId)
    ]);
    if (!officer || !manager || !controller) {
      throw new Error('One or more provided authority user IDs were not found');
    }
  } else {
    const picked = await pickFinanceUsers();
    officer = picked.officer;
    manager = picked.manager;
    controller = picked.controller;
  }

  if (doResetLinkedVoucher) {
    await unlinkAndDeleteVoucher(ca);
  }

  ca.status = 'Pending Finance';
  ca.financeApprovalAuthorities = {
    accountsOfficerUser: officer._id,
    accountsManagerUser: manager._id,
    financeControllerUser: controller._id
  };
  ca.financeAuthorityApprovals = [];
  ca.financeRejectedBy = null;
  ca.financeRejectedAt = null;
  ca.financeRejectionComments = '';
  ca.financeAuthoritiesAssignedBy = officer._id;
  ca.financeAuthoritiesAssignedAt = new Date();

  if (createVoucher) {
    const je = await createLinkedVoucher(ca, officer._id);
    console.log(`Voucher created: ${je.entryNumber}`);
  } else {
    ca.voucherEntryId = null;
    ca.advanceVoucherNo = '';
    console.log('Voucher creation skipped (--no-voucher)');
  }

  await ca.save();
  console.log('Finance setup complete.');
  console.log(`CA: ${ca.caNumber}`);
  console.log(`Status: ${ca.status}`);
  console.log(`Authorities: ${officer.firstName} ${officer.lastName}, ${manager.firstName} ${manager.lastName}, ${controller.firstName} ${controller.lastName}`);
  console.log(`Voucher No: ${ca.advanceVoucherNo || 'N/A'}`);
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err.message || err);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });

