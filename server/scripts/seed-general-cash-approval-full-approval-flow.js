#!/usr/bin/env node
/**
 * Create a General-module Cash Approval, advance it to the first employee in the
 * advance picker list, and walk it through every approval stage:
 *
 *   Manager / HOD → Pre-Audit → Audit Director → CEO Secretariat → CEO
 *   → Finance authorities (3) → Advance Issued
 *
 * Usage:
 *   node server/scripts/seed-general-cash-approval-full-approval-flow.js
 *   node server/scripts/seed-general-cash-approval-full-approval-flow.js --amount 25000
 *   node server/scripts/seed-general-cash-approval-full-approval-flow.js --skip-issue-advance
 *
 * Optional actor overrides (Mongo user IDs):
 *   --requester --manager --hod --pre-audit --audit-director
 *   --ceo-secretariat --ceo --officer --manager-finance --controller
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const CashApproval = require('../models/procurement/CashApproval');
const User = require('../models/User');
require('../models/Role');
require('../models/hr/Department');
const Account = require('../models/finance/Account');
const Employee = require('../models/hr/Employee');
const FinanceHelper = require('../utils/financeHelper');
const {
  buildGeneralCashApprovalDocument,
  applyGeneralSubmitApprovers,
  getFirstPendingDepartmentStepIndex,
  approverIdFromStep
} = require('../utils/generalCashApproval');
const {
  listEmployeesForAdvancePicker,
  resolveGeneralAdvanceRecipient,
  resolveEmployeeAdvanceAccount,
  ensureEmployeeAdvanceAccount,
  employeeDisplayName
} = require('../utils/employeeAdvanceAccount');
const { isAuditDirectorUser, canActAsAuditDirector } = require('../utils/auditDirectorRole');
const { getEligibleUtilityBillApproverUserIds } = require('../utils/utilityBillApproverEligibility');

const arg = (name, fallback = '') => {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
};
const hasFlag = (name) => process.argv.includes(`--${name}`);

const amount = Math.max(100, Number(arg('amount', '15000')) || 15000);
const skipIssueAdvance = hasFlag('skip-issue-advance');

const uri =
  process.env.MONGODB_URI_LOCAL ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/sgc_erp_local';

const norm = (v) => String(v || '').toLowerCase().trim();
const uid = (u) => String(u?._id || u?.id || '').trim();
const nameOf = (u) => {
  if (!u) return '—';
  const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return n || u.email || uid(u);
};

const pushHistory = (ca, from, to, userId, comments, module) => {
  if (!Array.isArray(ca.workflowHistory)) ca.workflowHistory = [];
  ca.workflowHistory.push({
    fromStatus: from,
    toStatus: to,
    changedBy: userId,
    changedAt: new Date(),
    comments: comments || '',
    module: module || 'General'
  });
};

const upsertCaAuthorityApproval = (ca, { key, label, approverId, approvedAt, comments }) => {
  if (!key || !approverId) return;
  const approvals = Array.isArray(ca.authorityApprovals) ? [...ca.authorityApprovals] : [];
  const idx = approvals.findIndex((a) => String(a?.authorityKey || '').trim() === key);
  const entry = {
    authorityKey: key,
    authorityLabel: label || key,
    approver: approverId,
    approvedAt: approvedAt || new Date(),
    comments: comments || ''
  };
  if (idx >= 0) approvals[idx] = { ...approvals[idx], ...entry };
  else approvals.push(entry);
  ca.authorityApprovals = approvals;
};

const FINANCE_SLOTS = [
  { key: 'accountsOfficerUser', label: 'Accounts Officer / AM' },
  { key: 'accountsManagerUser', label: 'Sr Manager Accounts' },
  { key: 'financeControllerUser', label: 'GM Finance' }
];

const getRequiredFinanceSlots = (ca) => {
  const fa = ca?.financeApprovalAuthorities || {};
  return FINANCE_SLOTS.filter((s) => String(fa[s.key] || '').trim()).map((s) => ({
    ...s,
    userId: String(fa[s.key])
  }));
};

const addFinanceApproval = (ca, slotKey, slotLabel, approverId, comments = '') => {
  const approvals = Array.isArray(ca.financeAuthorityApprovals) ? [...ca.financeAuthorityApprovals] : [];
  approvals.push({
    authorityKey: slotKey,
    authorityLabel: slotLabel,
    approver: approverId,
    decision: 'approved',
    approvedAt: new Date(),
    comments
  });
  ca.financeAuthorityApprovals = approvals;
};

const isCashPaymentMethod = (paymentMethod) =>
  String(paymentMethod || '').toLowerCase().replace(/\s+/g, '_') === 'cash';

async function resolveBankAccount(bankAccountId, paymentMethod) {
  let bankAccount = bankAccountId ? await Account.findById(bankAccountId) : null;
  if (!bankAccount) {
    bankAccount = await FinanceHelper.getAccountByNumber(
      isCashPaymentMethod(paymentMethod) ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
    );
  }
  if (!bankAccount) {
    const fallback = await Account.findOne({ isActive: true, allowTransactions: true }).sort({ accountNumber: 1 });
    if (!fallback) throw new Error('No bank/cash account found for advance payment voucher');
    return fallback;
  }
  return bankAccount;
}

async function postGeneralAdvanceBpv(ca, actorId, opts = {}) {
  const payAmount = Math.round((Number(opts.advanceAmount) || Number(ca.totalAmount) || 0) * 100) / 100;
  if (payAmount <= 0) throw new Error('Advance amount must be greater than zero');

  const paymentMethod = opts.paymentMethod || 'bank_transfer';
  const payRef = String(opts.reference || `SEED-${ca.caNumber}`).trim();
  const postingDate = opts.paymentDate ? new Date(opts.paymentDate) : new Date();
  const employee = await Employee.findById(ca.advanceToEmployee);
  if (!employee) throw new Error('Advance employee not found on cash approval');

  let advanceAccount = ca.advanceGlAccount ? await Account.findById(ca.advanceGlAccount) : null;
  if (!advanceAccount) advanceAccount = await resolveEmployeeAdvanceAccount(employee, { createdBy: actorId });
  if (!advanceAccount) advanceAccount = await ensureEmployeeAdvanceAccount(employee, { createdBy: actorId });
  if (!advanceAccount) throw new Error(`Could not resolve employee advance GL for ${employeeDisplayName(employee)}`);

  ca.advanceGlAccount = advanceAccount._id;
  ca.advanceGlAccountNumber = advanceAccount.accountNumber;

  const bankAccount = await resolveBankAccount(opts.bankAccountId, paymentMethod);
  const employeeName = employeeDisplayName(employee);
  const isCash = isCashPaymentMethod(paymentMethod);

  const voucher = await FinanceHelper.createAndPostJournalEntry({
    date: postingDate,
    reference: payRef,
    description: `Cash approval advance — ${employeeName} — ${ca.caNumber}`,
    department: 'general',
    module: 'general',
    referenceId: ca._id,
    referenceType: 'payment',
    journalCode: isCash ? 'CASH' : 'BANK',
    voucherSeries: isCash ? 'CPV' : 'BPV',
    createdBy: actorId,
    lines: [
      {
        account: advanceAccount._id,
        description: `Employee advance — ${ca.caNumber} (${employeeName})`,
        debit: payAmount,
        department: 'general'
      },
      {
        account: bankAccount._id,
        description: `Bank payment — ${payRef}`,
        credit: payAmount,
        department: 'finance'
      }
    ]
  });

  ca.voucherEntryId = voucher._id;
  ca.advanceVoucherNo = voucher.entryNumber || '';
  return voucher;
}

async function loadActiveUsers() {
  return User.find({ isActive: true })
    .select('_id firstName lastName email role department roleRef roles subRoles employeeId')
    .populate('roleRef', 'name displayName permissions isActive')
    .populate('roles', 'name displayName permissions isActive')
    .lean();
}

function haystack(user) {
  const roleRef = `${user?.roleRef?.name || ''} ${user?.roleRef?.displayName || ''}`;
  const roles = (user?.roles || []).map((r) => `${r?.name || ''} ${r?.displayName || ''}`).join(' ');
  return norm(`${user.role} ${user.department} ${roleRef} ${roles} ${user.email}`);
}

async function pickActorUsers(overrides = {}) {
  const all = await loadActiveUsers();
  if (!all.length) throw new Error('No active users in database');

  const byId = (id) => (id ? all.find((u) => uid(u) === String(id)) : null);
  const pickFirst = (predicate, label) => {
    const hit = all.find(predicate);
    if (!hit) throw new Error(`Could not auto-pick user for: ${label}. Pass --${label} <userId>`);
    return hit;
  };

  const eligibleMgr = await getEligibleUtilityBillApproverUserIds();
  const eligibleList = all.filter((u) => eligibleMgr.has(uid(u)));

  const requester =
    byId(overrides.requester) ||
    pickFirst(
      (u) => norm(u.department).includes('finance') || norm(u.role).includes('finance'),
      'requester'
    );

  const exclude = new Set([uid(requester)]);
  const manager =
    byId(overrides.manager) ||
    eligibleList.find((u) => !exclude.has(uid(u))) ||
    all.find((u) => !exclude.has(uid(u)));
  if (!manager) throw new Error('Could not pick Manager approver');
  exclude.add(uid(manager));

  const hod =
    byId(overrides.hod) ||
    eligibleList.find((u) => !exclude.has(uid(u))) ||
    all.find((u) => !exclude.has(uid(u)));
  if (!hod) throw new Error('Could not pick Head Of Department approver');
  exclude.add(uid(hod));

  const preAudit =
    byId(overrides.preAudit) ||
    pickFirst(
      (u) => !exclude.has(uid(u)) && haystack(u).includes('audit') && !isAuditDirectorUser(u),
      'pre-audit'
    );
  exclude.add(uid(preAudit));

  const auditDirector =
    byId(overrides.auditDirector) ||
    all.find((u) => !exclude.has(uid(u)) && canActAsAuditDirector(u)) ||
    all.find((u) => canActAsAuditDirector(u));
  if (!auditDirector) throw new Error('Could not pick Audit Director (--audit-director)');
  exclude.add(uid(auditDirector));

  const ceoSecretariat =
    byId(overrides.ceoSecretariat) ||
    pickFirst(
      (u) =>
        !exclude.has(uid(u)) &&
        (['hr_manager', 'higher_management'].includes(u.role) ||
          haystack(u).includes('hr') ||
          haystack(u).includes('secretariat')),
      'ceo-secretariat'
    );
  exclude.add(uid(ceoSecretariat));

  const ceo =
    byId(overrides.ceo) ||
    all.find((u) => !exclude.has(uid(u)) && u.role === 'higher_management') ||
    all.find((u) => u.role === 'higher_management') ||
    all.find((u) => u.role === 'super_admin');
  if (!ceo) throw new Error('Could not pick CEO (--ceo)');
  exclude.add(uid(ceo));

  const financeUsers = all
    .filter((u) => haystack(u).includes('finance') || haystack(u).includes('account'))
    .filter((u) => !exclude.has(uid(u)));

  const officer =
    byId(overrides.officer) ||
    financeUsers[0] ||
    pickFirst((u) => !exclude.has(uid(u)), 'officer');
  exclude.add(uid(officer));

  const managerFinance =
    byId(overrides.managerFinance) ||
    financeUsers.find((u) => !exclude.has(uid(u))) ||
    all.find((u) => !exclude.has(uid(u)));
  if (!managerFinance) throw new Error('Could not pick Sr Manager Accounts (--manager-finance)');
  exclude.add(uid(managerFinance));

  const controller =
    byId(overrides.controller) ||
    financeUsers.find((u) => !exclude.has(uid(u))) ||
    all.find((u) => !exclude.has(uid(u)));
  if (!controller) throw new Error('Could not pick GM Finance (--controller)');

  return {
    requester,
    manager,
    hod,
    preAudit,
    auditDirector,
    ceoSecretariat,
    ceo,
    finance: { officer, managerFinance, controller }
  };
}

async function approveDepartmentStep(ca, actor, label) {
  const chain = ca.departmentApprovalChain || [];
  const idx = getFirstPendingDepartmentStepIndex(chain);
  if (idx === -1) throw new Error('No pending department approval step');
  if (approverIdFromStep(chain[idx]) !== uid(actor)) {
    throw new Error(`${label} is not the current pending approver (expected ${approverIdFromStep(chain[idx])})`);
  }
  chain[idx].status = 'approved';
  chain[idx].actedAt = new Date();
  chain[idx].comment = `Seed script — ${label} approval`;
  ca.departmentApprovalChain = chain;

  const allApproved = chain.every((step) => step.status === 'approved');
  if (allApproved) {
    ca.departmentApprovalStatus = 'Approved';
    ca.departmentApprovedBy = actor._id;
    ca.departmentApprovedAt = new Date();
    pushHistory(ca, 'Pending Approval', 'Pending Audit', actor._id, 'All department approvals complete', 'General');
    ca.status = 'Pending Audit';
  } else {
    pushHistory(ca, 'Pending Approval', 'Pending Approval', actor._id, `${label} approved`, 'General');
  }
}

async function run() {
  await mongoose.connect(uri);
  console.log(`Connected: ${uri.replace(/\/\/.*@/, '//***@')}\n`);

  const actors = await pickActorUsers({
    requester: arg('requester'),
    manager: arg('manager'),
    hod: arg('hod'),
    preAudit: arg('pre-audit'),
    auditDirector: arg('audit-director'),
    ceoSecretariat: arg('ceo-secretariat'),
    ceo: arg('ceo'),
    officer: arg('officer'),
    managerFinance: arg('manager-finance'),
    controller: arg('controller')
  });

  const employees = await listEmployeesForAdvancePicker({ limit: 1, createdBy: actors.requester._id });
  if (!employees.length) throw new Error('No active employees found for advance picker');
  const employee = employees[0];
  console.log(`Advance employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId || employee._id})`);

  const advanceRecipient = await resolveGeneralAdvanceRecipient(
    { advanceToEmployee: employee._id },
    actors.requester._id
  );

  const body = {
    requestingDepartment: String(actors.requester.department || 'Finance').trim() || 'Finance',
    purpose: `Seed script cash approval — automated test ${new Date().toISOString().slice(0, 10)}`,
    items: [
      {
        itemName: 'Office supplies / petty cash float',
        description: 'Automated seed line for finance testing',
        quantity: 1,
        unit: 'lot',
        unitPrice: amount,
        amount
      }
    ],
    ...advanceRecipient
  };

  const built = buildGeneralCashApprovalDocument(body, actors.requester._id, advanceRecipient);
  if (!built.ok) throw new Error(built.errors.join('; '));

  const ca = new CashApproval({
    ...built.doc,
    status: 'Draft',
    departmentApprovalStatus: 'Draft',
    workflowHistory: []
  });

  await applyGeneralSubmitApprovers(ca, [uid(actors.manager), uid(actors.hod)], uid(actors.requester));
  await ca.save();
  console.log(`Created ${ca.caNumber} — status: ${ca.status}, amount: PKR ${ca.totalAmount}`);

  await approveDepartmentStep(ca, actors.manager, 'Manager');
  await ca.save();
  console.log(`✓ Manager approved (${nameOf(actors.manager)})`);

  await approveDepartmentStep(ca, actors.hod, 'Head Of Department');
  await ca.save();
  console.log(`✓ HOD approved (${nameOf(actors.hod)}) → ${ca.status}`);

  const preAt = new Date();
  ca.preAuditInitialApprovedBy = actors.preAudit._id;
  ca.preAuditInitialApprovedAt = preAt;
  ca.preAuditInitialComments = 'Seed script pre-audit initial approval';
  upsertCaAuthorityApproval(ca, {
    key: 'preAuditInitial',
    label: 'Pre-Audit Authority',
    approverId: actors.preAudit._id,
    approvedAt: preAt,
    comments: ca.preAuditInitialComments
  });
  pushHistory(ca, 'Pending Audit', 'Pending Audit', actors.preAudit._id, ca.preAuditInitialComments, 'Pre-Audit');
  await ca.save();
  console.log(`✓ Pre-audit initial (${nameOf(actors.preAudit)})`);

  pushHistory(
    ca,
    'Pending Audit',
    'Forwarded to Audit Director',
    actors.preAudit._id,
    'Forwarded to Audit Director',
    'Pre-Audit'
  );
  ca.status = 'Forwarded to Audit Director';
  await ca.save();
  console.log('✓ Forwarded to Audit Director');

  const dirAt = new Date();
  pushHistory(ca, 'Forwarded to Audit Director', 'Send to CEO Office', actors.auditDirector._id, 'Audit director approved', 'Pre-Audit');
  ca.status = 'Send to CEO Office';
  ca.auditApprovedBy = actors.auditDirector._id;
  ca.auditApprovedAt = dirAt;
  ca.auditRemarks = 'Seed script audit director approval';
  upsertCaAuthorityApproval(ca, {
    key: 'auditDirectorApproval',
    label: 'Audit Director',
    approverId: actors.auditDirector._id,
    approvedAt: dirAt,
    comments: ca.auditRemarks
  });
  await ca.save();
  console.log(`✓ Audit Director approved (${nameOf(actors.auditDirector)}) → ${ca.status}`);

  const fwdAt = new Date();
  pushHistory(ca, 'Send to CEO Office', 'Forwarded to CEO', actors.ceoSecretariat._id, 'Forwarded to CEO', 'CEO Secretariat');
  ca.status = 'Forwarded to CEO';
  ca.ceoForwardedBy = actors.ceoSecretariat._id;
  ca.ceoForwardedAt = fwdAt;
  upsertCaAuthorityApproval(ca, {
    key: 'ceoSecretariatForward',
    label: 'PS to CEO',
    approverId: actors.ceoSecretariat._id,
    approvedAt: fwdAt,
    comments: 'Seed script CEO secretariat forward'
  });
  await ca.save();
  console.log(`✓ CEO Secretariat forwarded (${nameOf(actors.ceoSecretariat)}) → ${ca.status}`);

  const ceoAt = new Date();
  pushHistory(ca, 'Forwarded to CEO', 'Pending Finance', actors.ceo._id, 'CEO approved', 'CEO');
  ca.status = 'Pending Finance';
  ca.ceoApprovedBy = actors.ceo._id;
  ca.ceoApprovedAt = ceoAt;
  ca.ceoApprovalComments = 'Seed script CEO approval';
  upsertCaAuthorityApproval(ca, {
    key: 'ceoApproval',
    label: 'CEO',
    approverId: actors.ceo._id,
    approvedAt: ceoAt,
    comments: ca.ceoApprovalComments
  });
  await ca.save();
  console.log(`✓ CEO approved (${nameOf(actors.ceo)}) → ${ca.status}`);

  ca.financeApprovalAuthorities = {
    accountsOfficerUser: actors.finance.officer._id,
    accountsManagerUser: actors.finance.managerFinance._id,
    financeControllerUser: actors.finance.controller._id
  };
  ca.financeAuthorityApprovals = [];
  ca.financeAuthoritiesAssignedBy = actors.finance.officer._id;
  ca.financeAuthoritiesAssignedAt = new Date();
  ca.advanceAmount = ca.totalAmount;

  const voucher = await postGeneralAdvanceBpv(ca, actors.finance.officer._id, {
    advanceAmount: ca.totalAmount,
    reference: `SEED-TT-${ca.caNumber}`
  });
  pushHistory(ca, 'Pending Finance', 'Pending Finance', actors.finance.officer._id, `BPV ${ca.advanceVoucherNo} posted`, 'Finance');
  await ca.save();
  console.log(`✓ Finance BPV posted: ${ca.advanceVoucherNo || voucher.entryNumber}`);

  for (const slot of getRequiredFinanceSlots(ca)) {
    const actor =
      slot.key === 'accountsOfficerUser'
        ? actors.finance.officer
        : slot.key === 'accountsManagerUser'
          ? actors.finance.managerFinance
          : actors.finance.controller;
    addFinanceApproval(ca, slot.key, slot.label, actor._id, `Seed script — ${slot.label}`);
    await ca.save();
    console.log(`✓ Finance authority: ${slot.label} (${nameOf(actor)})`);
  }

  pushHistory(ca, 'Pending Finance', 'Finance Authority Approved', actors.finance.controller._id, 'All finance authorities approved', 'Finance');
  ca.status = 'Finance Authority Approved';
  await ca.save();
  console.log(`✓ All finance authorities approved → ${ca.status}`);

  if (!skipIssueAdvance) {
    const issuedAt = new Date();
    pushHistory(
      ca,
      'Finance Authority Approved',
      'Advance Issued',
      actors.finance.officer._id,
      `Advance PKR ${ca.totalAmount} issued (seed script)`,
      'Finance'
    );
    ca.status = 'Advance Issued';
    ca.advancePaymentMethod = 'Bank Transfer';
    ca.advanceIssuedBy = actors.finance.officer._id;
    ca.advanceIssuedAt = issuedAt;
    ca.signedCheckNumber = `SEED-TT-${ca.caNumber}`;
    ca.signedCheckDate = issuedAt;
    await ca.save();
    console.log(`✓ Advance issued → ${ca.status}`);
  }

  console.log('\n── Summary ──');
  console.log(`CA Number:     ${ca.caNumber}`);
  console.log(`CA ID:         ${ca._id}`);
  console.log(`Status:        ${ca.status}`);
  console.log(`Employee:      ${employee.firstName} ${employee.lastName} (${employee.employeeId || employee._id})`);
  console.log(`Amount:        PKR ${ca.totalAmount}`);
  console.log(`Voucher:       ${ca.advanceVoucherNo || '—'}`);
  console.log(`Advance GL:    ${ca.advanceGlAccountNumber || '—'}`);
  if (ca.advanceIssuedAt) console.log(`Advance issued: ${ca.advanceIssuedAt.toISOString()}`);
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\nFailed:', err.message || err);
    try {
      await mongoose.disconnect();
    } catch (_) {
      /* ignore */
    }
    process.exit(1);
  });
