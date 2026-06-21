const mongoose = require('mongoose');
const Account = require('../models/finance/Account');
const JournalEntry = require('../models/finance/JournalEntry');
const Payroll = require('../models/hr/Payroll');
const Employee = require('../models/hr/Employee');
const PayrollPeriodPaymentApplication = require('../models/finance/PayrollPeriodPaymentApplication');
const FinanceHelper = require('./financeHelper');
const { parsePeriod, MONTH_NAMES } = require('./financePayrollQueue');
const { PAYROLL_FINAL_APPROVED_STATUSES } = require('./payrollAuthorityPayrollStatus');
const { resolveIftikharAccountsManager } = require('./payrollFinanceAuthorities');
const {
  aggregatePayrollBreakdown,
  validatePayrollAccrualTotals
} = require('./payrollBreakdown');
const { buildPayrollBpvPaymentJournalLines } = require('./payrollAccrual');
const {
  getRequiredFinanceAuthoritySlots,
  matchUserToFinanceSlots
} = require('./financeAuthoritySlots');
const { withVoucherNarration } = require('./documentNarration');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const normalizeCompanyName = (value) => String(value || '').trim() || 'Unassigned';

const resolvePlacementCompanyName = (placementCompany) => {
  if (!placementCompany) return '';
  if (typeof placementCompany === 'string') return placementCompany;
  if (typeof placementCompany === 'object' && placementCompany.name) return placementCompany.name;
  return '';
};

const resolvePayrollFinanceAuthorities = async ({ financeControllerUser }) => {
  const iftikhar = await resolveIftikharAccountsManager();
  const fc = financeControllerUser;
  if (!fc) {
    throw new Error('GM Finance approver is required.');
  }
  if (!mongoose.Types.ObjectId.isValid(String(fc))) {
    throw new Error('Invalid GM Finance user id');
  }
  return {
    accountsManagerUser: iftikhar._id,
    financeControllerUser: fc
  };
};

const accountsManagerApproval = (accountsManagerUserId) => ({
  authorityKey: 'accountsManagerUser',
  authorityLabel: 'Sr Manager Accounts',
  approver: accountsManagerUserId,
  decision: 'approved',
  approvedAt: new Date(),
  comments: 'Sr Manager Accounts — auto-approved on submission'
});

const postDraftJournal = async (je, userId) => {
  if (!je) throw new Error('Journal entry missing');
  if (je.status === 'draft') {
    await je.post(userId);
    const GeneralLedger = require('../models/finance/GeneralLedger');
    const glCount = await GeneralLedger.countDocuments({ journalEntry: je._id });
    if (glCount === 0) {
      await FinanceHelper.postToGeneralLedger(je._id);
    }
    return je;
  }
  if (je.status === 'posted') return je;
  throw new Error(`Journal entry cannot be finalized from status: ${je.status}`);
};

const getPendingPayrollsForPeriod = async (month, year) => {
  const { month: m, year: y } = parsePeriod(month, year);
  return Payroll.find({
    month: m,
    year: y,
    status: { $in: PAYROLL_FINAL_APPROVED_STATUSES }
  }).populate({
    path: 'employee',
    select: 'placementCompany',
    populate: { path: 'placementCompany', select: 'name' }
  });
};

const filterPayrollsByCompany = (payrolls, companyName) => {
  const target = normalizeCompanyName(companyName);
  return payrolls.filter((row) => {
    // Note: Cash-salary employees are included so their Net Salary shows up as 'Cash Payment' in the BPV lines.
    const employeeCompany = resolvePlacementCompanyName(row.employee?.placementCompany) || 'Unassigned';
    return normalizeCompanyName(employeeCompany) === target;
  });
};

const sumPendingNet = (payrolls) =>
  round2(payrolls.reduce((sum, row) => sum + (Number(row.netSalary) || 0), 0));

const ensurePayrollPaymentAccounts = async (companyId) => {
  const { ensurePayrollFinanceAccounts } = require('./payrollAccrual');
  await ensurePayrollFinanceAccounts(companyId);
};

const buildDetailedPayrollPaymentLines = async ({
  companyId,
  totals,
  bankAccount,
  periodLabel,
  companyName
}) => {
  validatePayrollAccrualTotals(totals);
  return buildPayrollBpvPaymentJournalLines({
    companyId,
    totals,
    bankAccount,
    periodLabel,
    companyName
  });
};

const populateApplication = (query) =>
  PayrollPeriodPaymentApplication.findOne(query)
    .populate('financeApprovalAuthorities.accountsOfficerUser', 'firstName lastName email employeeId digitalSignature')
    .populate('financeApprovalAuthorities.accountsManagerUser', 'firstName lastName email employeeId digitalSignature')
    .populate('financeApprovalAuthorities.financeControllerUser', 'firstName lastName email employeeId digitalSignature')
    .populate('financeAuthorityApprovals.approver', 'firstName lastName email employeeId digitalSignature')
    .populate('journalEntryId');

const finalizeApplication = async (app, userId) => {
  const payrollIds = Array.isArray(app.payrollIds) ? app.payrollIds.filter(Boolean) : [];
  const payrolls = payrollIds.length
    ? await Payroll.find({ _id: { $in: payrollIds }, status: { $in: PAYROLL_FINAL_APPROVED_STATUSES } })
    : await filterPayrollsByCompany(await getPendingPayrollsForPeriod(app.month, app.year), app.companyName);

  if (!payrolls.length) {
    throw new Error(`No pending payroll records remain for ${app.companyName}`);
  }

  const je = await JournalEntry.findById(app.journalEntryId);
  await postDraftJournal(je, userId);

  const paymentMethodLabel =
    app.paymentMeta?.paymentMethod === 'cash' ? 'Cash' : 'Bank Transfer';

  let paid = 0;
  for (const payroll of payrolls) {
    await payroll.markAsPaid(paymentMethodLabel);
    paid += 1;
  }

  app.workflowStatus = 'fully_approved';
  app.finalizedAt = new Date();
  app.rejectionObservation = '';
  await app.save();

  return { app, paid, journalEntry: je };
};

const rejectApplication = async (app, user, comments) => {
  app.workflowStatus = 'rejected';
  app.rejectionObservation = String(comments || '').trim();
  await app.save();

  const je = app.journalEntryId ? await JournalEntry.findById(app.journalEntryId) : null;
  if (je && je.status === 'draft') {
    je.status = 'cancelled';
    await je.save();
  }

  return app;
};

const recordAuthorityApproval = async (app, user, comments = '') => {
  if (app.workflowStatus !== 'pending_authority') {
    throw new Error('Approval only applies while payroll payment is pending signatures');
  }
  const slots = getRequiredFinanceAuthoritySlots(app);
  if (!slots.length) {
    throw new Error('Finance approval authorities are not configured on this payroll payment');
  }
  const matchedSlots = matchUserToFinanceSlots(slots, user);
  if (!matchedSlots.length) {
    throw new Error('Your user is not assigned as a finance authority for this voucher');
  }

  const approvals = Array.isArray(app.financeAuthorityApprovals) ? [...app.financeAuthorityApprovals] : [];
  const approvedKeys = new Set(
    approvals
      .filter((a) => String(a?.decision || 'approved').trim() !== 'rejected')
      .map((a) => String(a?.authorityKey || '').trim())
      .filter(Boolean)
  );
  const pendingMatchedSlots = matchedSlots.filter((slot) => !approvedKeys.has(slot.key));
  if (!pendingMatchedSlots.length) {
    throw new Error('You have already approved your assigned finance authority slot');
  }

  const now = new Date();
  pendingMatchedSlots.forEach((slot) => {
    approvals.push({
      authorityKey: slot.key,
      authorityLabel: slot.label,
      approver: user._id || user.id,
      decision: 'approved',
      approvedAt: now,
      comments
    });
  });
  app.financeAuthorityApprovals = approvals;
  await app.save();

  const requiredKeys = new Set(slots.map((s) => s.key));
  const approvedNow = new Set(
    app.financeAuthorityApprovals
      .filter((a) => String(a?.decision || 'approved').trim() !== 'rejected')
      .map((a) => String(a?.authorityKey || '').trim())
      .filter(Boolean)
  );
  const remaining = [...requiredKeys].filter((k) => !approvedNow.has(k)).length;

  if (remaining === 0) {
    await finalizeApplication(app, user._id || user.id);
  }

  return { remaining, finalized: remaining === 0 };
};

const recordAuthorityRejection = async (app, user, comments = '') => {
  if (app.workflowStatus !== 'pending_authority') {
    throw new Error('Rejection only applies while payroll payment is pending signatures');
  }
  const observation = String(comments || '').trim();
  if (!observation) {
    throw new Error('Rejection observation is required');
  }
  const slots = getRequiredFinanceAuthoritySlots(app);
  if (!slots.length) {
    throw new Error('Finance approval authorities are not configured on this payroll payment');
  }
  const matchedSlots = matchUserToFinanceSlots(slots, user);
  if (!matchedSlots.length) {
    throw new Error('Your user is not assigned as a finance authority for this voucher');
  }

  const approvals = Array.isArray(app.financeAuthorityApprovals) ? [...app.financeAuthorityApprovals] : [];
  const decidedKeys = new Set(approvals.map((a) => String(a?.authorityKey || '').trim()).filter(Boolean));
  const pendingMatchedSlots = matchedSlots.filter((slot) => !decidedKeys.has(slot.key));
  if (!pendingMatchedSlots.length) {
    throw new Error('You have already acted on your assigned finance authority slot');
  }

  const now = new Date();
  pendingMatchedSlots.forEach((slot) => {
    approvals.push({
      authorityKey: slot.key,
      authorityLabel: slot.label,
      approver: user._id || user.id,
      decision: 'rejected',
      approvedAt: now,
      comments: observation
    });
  });
  app.financeAuthorityApprovals = approvals;
  await rejectApplication(app, user, observation);
  return app;
};

const assertNoConflictingPaymentApplication = async (month, year, companyName, { excludeId = null } = {}) => {
  const query = {
    month,
    year,
    companyName,
    workflowStatus: { $in: ['draft', 'pending_authority'] }
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  const existing = await PayrollPeriodPaymentApplication.findOne(query).select('_id workflowStatus').lean();
  if (!existing) return;

  const err = new Error(
    existing.workflowStatus === 'draft'
      ? `A draft payroll payment for ${companyName} already exists. Open, submit, or delete it first.`
      : `A payroll payment for ${companyName} is already pending finance approval.`
  );
  err.statusCode = 400;
  throw err;
};

const buildPayrollPaymentContext = async (month, year, options = {}) => {
  const { month: m, year: y } = parsePeriod(month, year);
  const {
    companyName,
    paymentMethod = 'bank_transfer',
    reference = '',
    narration = '',
    paymentDate,
    bankAccountId = null
  } = options;

  const normalizedCompany = normalizeCompanyName(companyName);
  if (!normalizedCompany) {
    const err = new Error('Company is required for payroll payment');
    err.statusCode = 400;
    throw err;
  }

  const allPending = await getPendingPayrollsForPeriod(m, y);
  const payrolls = filterPayrollsByCompany(allPending, normalizedCompany);
  if (!payrolls.length) {
    const err = new Error(`No pending AVP-approved payrolls to pay for ${normalizedCompany}`);
    err.statusCode = 400;
    throw err;
  }

  const amount = sumPendingNet(payrolls);
  const paymentBreakdown = aggregatePayrollBreakdown(payrolls);
  if (paymentBreakdown.grossSalary <= 0) {
    const err = new Error('Payroll gross salary must be greater than zero');
    err.statusCode = 400;
    throw err;
  }
  if (amount <= 0) {
    const err = new Error('Payroll net bank payment must be greater than zero');
    err.statusCode = 400;
    throw err;
  }

  const companyId = payrolls[0]?.employee?.placementCompany?._id
    || payrolls[0]?.employee?.placementCompany
    || null;
  if (!companyId) {
    const err = new Error('Company is required for payroll payment accounts');
    err.statusCode = 400;
    throw err;
  }

  const AccountResolver = require('./accountResolver');
  let bankAccount = bankAccountId
    ? await AccountResolver.mapAccountToCompany(companyId, bankAccountId)
    : null;
  if (bankAccountId && !bankAccount) {
    const err = new Error('Selected bank or cash account was not found for this company.');
    err.statusCode = 400;
    throw err;
  }
  if (!bankAccount) {
    bankAccount = await AccountResolver.resolveSystemAccount(
      companyId,
      paymentMethod === 'cash' ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
    );
  }
  if (!bankAccount) {
    const err = new Error('Salaries payable or bank/cash account not found for this company. Seed the company chart of accounts first.');
    err.statusCode = 400;
    throw err;
  }

  const periodLabel = `${MONTH_NAMES[m]} ${y}`;
  const isCash = paymentMethod === 'cash';
  const postingDate = paymentDate ? new Date(paymentDate) : new Date();
  const payRef = reference || `PAYROLL-${m}-${y}-${normalizedCompany.replace(/\s+/g, '-').toUpperCase()}`;
  const narrationText = String(narration || '').trim();

  const journalLines = await buildDetailedPayrollPaymentLines({
    companyId,
    totals: paymentBreakdown,
    bankAccount,
    periodLabel,
    companyName: normalizedCompany
  });

  return {
    month: m,
    year: y,
    periodLabel,
    normalizedCompany,
    payrolls,
    amount,
    paymentBreakdown,
    companyId,
    bankAccount,
    isCash,
    postingDate,
    payRef,
    narrationText,
    journalLines,
    paymentMethod
  };
};

const buildJournalPayloadFromContext = (ctx, { createdBy, submitted = false }) => {
  const defaultDescription = submitted
    ? `Payroll payment — ${ctx.periodLabel} — ${ctx.normalizedCompany} (${ctx.payrolls.length} employees, gross ${ctx.paymentBreakdown.grossSalary.toLocaleString('en-PK')}, net bank ${ctx.amount.toLocaleString('en-PK')}, pending GM Finance approval)`
    : `Payroll payment draft — ${ctx.periodLabel} — ${ctx.normalizedCompany} (${ctx.payrolls.length} employees, gross ${ctx.paymentBreakdown.grossSalary.toLocaleString('en-PK')}, net bank ${ctx.amount.toLocaleString('en-PK')})`;

  return withVoucherNarration({
    companyId: ctx.companyId,
    date: ctx.postingDate,
    reference: ctx.payRef,
    description: defaultDescription,
    department: 'hr',
    module: 'payroll',
    referenceType: 'payment',
    journalCode: 'BANK',
    voucherSeries: ctx.isCash ? 'CPV' : 'BPV',
    createdBy,
    lines: ctx.journalLines
  }, ctx.narrationText);
};

const applyJournalPayload = async (journalEntry, payload) => {
  journalEntry.companyId = payload.companyId;
  journalEntry.date = payload.date;
  journalEntry.reference = payload.reference;
  journalEntry.description = payload.description;
  journalEntry.department = payload.department;
  journalEntry.module = payload.module;
  journalEntry.referenceType = payload.referenceType;
  journalEntry.voucherSeries = payload.voucherSeries;
  journalEntry.lines = payload.lines;
  await journalEntry.save();
  return journalEntry;
};

const savePayrollPeriodPaymentDraft = async (month, year, options = {}) => {
  const {
    draftId = null,
    createdBy
  } = options;

  const ctx = await buildPayrollPaymentContext(month, year, options);

  if (draftId) {
    const app = await PayrollPeriodPaymentApplication.findById(draftId);
    if (!app) {
      const err = new Error('Draft payroll payment not found');
      err.statusCode = 404;
      throw err;
    }
    if (app.workflowStatus !== 'draft') {
      const err = new Error('Only draft payroll payments can be updated');
      err.statusCode = 400;
      throw err;
    }
    if (normalizeCompanyName(app.companyName) !== ctx.normalizedCompany) {
      const err = new Error('Company cannot be changed on an existing draft');
      err.statusCode = 400;
      throw err;
    }

    await assertNoConflictingPaymentApplication(ctx.month, ctx.year, ctx.normalizedCompany, { excludeId: app._id });

    const journalPayload = buildJournalPayloadFromContext(ctx, { createdBy, submitted: false });
    const je = await JournalEntry.findById(app.journalEntryId);
    if (!je || je.status !== 'draft') {
      const err = new Error('Linked BPV draft is missing or no longer editable');
      err.statusCode = 400;
      throw err;
    }
    await applyJournalPayload(je, journalPayload);

    app.amount = ctx.amount;
    app.employeeCount = ctx.payrolls.length;
    app.payrollIds = ctx.payrolls.map((row) => row._id);
    app.paymentMeta = {
      paymentMethod: ctx.paymentMethod,
      reference: ctx.payRef,
      narration: ctx.narrationText || undefined,
      paymentDate: ctx.postingDate,
      bankAccountId: ctx.bankAccount._id,
      grossSalary: ctx.paymentBreakdown.grossSalary,
      breakdown: ctx.paymentBreakdown
    };
    await app.save();

    return {
      application: app,
      journalEntry: je,
      pendingAmount: ctx.amount,
      grossSalary: ctx.paymentBreakdown.grossSalary,
      paymentBreakdown: ctx.paymentBreakdown,
      employeeCount: ctx.payrolls.length,
      companyName: ctx.normalizedCompany
    };
  }

  await assertNoConflictingPaymentApplication(ctx.month, ctx.year, ctx.normalizedCompany);

  const journalPayload = buildJournalPayloadFromContext(ctx, { createdBy, submitted: false });
  const journalEntry = await FinanceHelper.createDraftJournalEntry(journalPayload);

  const app = await PayrollPeriodPaymentApplication.create({
    month: ctx.month,
    year: ctx.year,
    periodLabel: ctx.periodLabel,
    companyName: ctx.normalizedCompany,
    companyId: ctx.companyId || null,
    amount: ctx.amount,
    employeeCount: ctx.payrolls.length,
    payrollIds: ctx.payrolls.map((row) => row._id),
    paymentMeta: {
      paymentMethod: ctx.paymentMethod,
      reference: ctx.payRef,
      narration: ctx.narrationText || undefined,
      paymentDate: ctx.postingDate,
      bankAccountId: ctx.bankAccount._id,
      grossSalary: ctx.paymentBreakdown.grossSalary,
      breakdown: ctx.paymentBreakdown
    },
    journalEntryId: journalEntry._id,
    workflowStatus: 'draft',
    financeApprovalAuthorities: {},
    financeAuthorityApprovals: [],
    createdBy
  });

  return {
    application: app,
    journalEntry,
    pendingAmount: ctx.amount,
    grossSalary: ctx.paymentBreakdown.grossSalary,
    paymentBreakdown: ctx.paymentBreakdown,
    employeeCount: ctx.payrolls.length,
    companyName: ctx.normalizedCompany
  };
};

const submitPayrollPeriodPaymentDraft = async (draftId, options = {}) => {
  const {
    financeControllerUser,
    paymentMethod,
    reference,
    narration,
    paymentDate,
    bankAccountId,
    actorId
  } = options;

  const app = await PayrollPeriodPaymentApplication.findById(draftId);
  if (!app) {
    const err = new Error('Draft payroll payment not found');
    err.statusCode = 404;
    throw err;
  }
  if (app.workflowStatus !== 'draft') {
    const err = new Error('Only draft payroll payments can be submitted for approval');
    err.statusCode = 400;
    throw err;
  }

  const ctx = await buildPayrollPaymentContext(app.month, app.year, {
    companyName: app.companyName,
    paymentMethod: paymentMethod || app.paymentMeta?.paymentMethod || 'bank_transfer',
    reference: reference || app.paymentMeta?.reference || '',
    narration: narration ?? app.paymentMeta?.narration ?? '',
    paymentDate: paymentDate || app.paymentMeta?.paymentDate,
    bankAccountId: bankAccountId || app.paymentMeta?.bankAccountId || null
  });

  const authorities = await resolvePayrollFinanceAuthorities({ financeControllerUser });
  const journalPayload = buildJournalPayloadFromContext(ctx, {
    createdBy: actorId || app.createdBy,
    submitted: true
  });

  const je = await JournalEntry.findById(app.journalEntryId);
  if (!je || je.status !== 'draft') {
    const err = new Error('Linked BPV draft is missing or no longer editable');
    err.statusCode = 400;
    throw err;
  }
  await applyJournalPayload(je, journalPayload);

  app.amount = ctx.amount;
  app.employeeCount = ctx.payrolls.length;
  app.payrollIds = ctx.payrolls.map((row) => row._id);
  app.paymentMeta = {
    paymentMethod: ctx.paymentMethod,
    reference: ctx.payRef,
    narration: ctx.narrationText || undefined,
    paymentDate: ctx.postingDate,
    bankAccountId: ctx.bankAccount._id,
    grossSalary: ctx.paymentBreakdown.grossSalary,
    breakdown: ctx.paymentBreakdown
  };
  app.workflowStatus = 'pending_authority';
  app.financeApprovalAuthorities = authorities;
  app.financeAuthorityApprovals = [
    accountsManagerApproval(authorities.accountsManagerUser)
  ];
  app.rejectionObservation = '';
  await app.save();

  return {
    application: app,
    journalEntry: je,
    pendingAmount: ctx.amount,
    grossSalary: ctx.paymentBreakdown.grossSalary,
    paymentBreakdown: ctx.paymentBreakdown,
    employeeCount: ctx.payrolls.length,
    companyName: ctx.normalizedCompany
  };
};

const resolvePayrollVoucherSummaryForJournalEntry = async (journalEntryId) => {
  if (!journalEntryId) return null;

  const app = await PayrollPeriodPaymentApplication.findOne({ journalEntryId }).lean();
  if (!app) return null;

  let breakdown = app.paymentMeta?.breakdown || null;
  if (!breakdown?.grossSalary) {
    const payrollIds = Array.isArray(app.payrollIds) ? app.payrollIds.filter(Boolean) : [];
    if (payrollIds.length) {
      const payrolls = await Payroll.find({ _id: { $in: payrollIds } }).lean();
      if (payrolls.length) {
        breakdown = aggregatePayrollBreakdown(payrolls);
      }
    }
  }

  if (!breakdown?.grossSalary) return null;

  return {
    companyName: app.companyName,
    periodLabel: app.periodLabel,
    employeeCount: app.employeeCount || 0,
    breakdown
  };
};

const deletePayrollPeriodPaymentDraft = async (draftId) => {
  const app = await PayrollPeriodPaymentApplication.findById(draftId);
  if (!app) {
    const err = new Error('Draft payroll payment not found');
    err.statusCode = 404;
    throw err;
  }
  if (app.workflowStatus !== 'draft') {
    const err = new Error('Only draft payroll payments can be deleted');
    err.statusCode = 400;
    throw err;
  }

  const je = app.journalEntryId ? await JournalEntry.findById(app.journalEntryId) : null;
  if (je && je.status === 'draft') {
    je.status = 'cancelled';
    await je.save();
  }

  await PayrollPeriodPaymentApplication.deleteOne({ _id: app._id });

  return {
    deletedApplicationId: app._id,
    cancelledJournalEntryId: je?._id || null,
    companyName: app.companyName,
    periodLabel: app.periodLabel
  };
};

/** @deprecated Use savePayrollPeriodPaymentDraft + submitPayrollPeriodPaymentDraft */
const submitPayrollPeriodPayment = async (month, year, options = {}) => {
  const draft = await savePayrollPeriodPaymentDraft(month, year, options);
  return submitPayrollPeriodPaymentDraft(draft.application._id, options);
};

module.exports = {
  savePayrollPeriodPaymentDraft,
  submitPayrollPeriodPaymentDraft,
  deletePayrollPeriodPaymentDraft,
  submitPayrollPeriodPayment,
  populateApplication,
  recordAuthorityApproval,
  recordAuthorityRejection,
  finalizeApplication,
  normalizeCompanyName,
  resolveIftikharAccountsManager,
  resolvePayrollVoucherSummaryForJournalEntry
};