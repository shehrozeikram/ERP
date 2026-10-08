/**
 * Finance payment flow for CEO-approved Manual Salary sheets.
 * Pattern mirrors payroll period payments (draft BPV → finance authority → post → Paid).
 */

const mongoose = require('mongoose');
const ManualSalary = require('../models/hr/ManualSalary');
const ManualSalaryPaymentApplication = require('../models/finance/ManualSalaryPaymentApplication');
const JournalEntry = require('../models/finance/JournalEntry');
const Account = require('../models/finance/Account');
const FinanceHelper = require('./financeHelper');
const { acct, co } = require('./financePosting');
const { resolveIftikharAccountsManager } = require('./payrollFinanceAuthorities');
const {
  getRequiredFinanceAuthoritySlots,
  matchUserToFinanceSlots
} = require('./financeAuthoritySlots');
const { withVoucherNarration } = require('./documentNarration');

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PENDING_FINANCE_STATUSES = ['Pending Finance', 'Approved by CEO'];
const PAYABLE_STATUSES = [...PENDING_FINANCE_STATUSES];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const parsePeriod = (month, year) => {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!m || m < 1 || m > 12 || !y) {
    const err = new Error('Invalid month or year');
    err.statusCode = 400;
    throw err;
  }
  return { month: m, year: y, periodLabel: `${MONTH_NAMES[m]} ${y}` };
};

const actorSig = (user) =>
  user?.digitalSignature
  || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || '');

async function listManualSalaryFinanceQueue() {
  const rows = await ManualSalary.aggregate([
    {
      $match: {
        workflowStatus: {
          $in: [...PENDING_FINANCE_STATUSES, 'Payment Pending', 'Paid']
        }
      }
    },
    {
      $group: {
        _id: { month: '$month', year: '$year' },
        totalRecords: { $sum: 1 },
        pendingFinance: {
          $sum: {
            $cond: [{ $in: ['$workflowStatus', PENDING_FINANCE_STATUSES] }, 1, 0]
          }
        },
        paymentPending: {
          $sum: { $cond: [{ $eq: ['$workflowStatus', 'Payment Pending'] }, 1, 0] }
        },
        paid: {
          $sum: { $cond: [{ $eq: ['$workflowStatus', 'Paid'] }, 1, 0] }
        },
        pendingAmount: {
          $sum: {
            $cond: [
              { $in: ['$workflowStatus', PENDING_FINANCE_STATUSES] },
              { $ifNull: ['$netPayable', 0] },
              0
            ]
          }
        },
        paymentPendingAmount: {
          $sum: {
            $cond: [
              { $eq: ['$workflowStatus', 'Payment Pending'] },
              { $ifNull: ['$netPayable', 0] },
              0
            ]
          }
        },
        paidAmount: {
          $sum: {
            $cond: [
              { $eq: ['$workflowStatus', 'Paid'] },
              { $ifNull: ['$netPayable', 0] },
              0
            ]
          }
        }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } }
  ]);

  return rows.map((r) => {
    const month = r._id.month;
    const year = r._id.year;
    let status = 'pending_payment';
    if (r.pendingFinance > 0) status = 'pending_payment';
    else if (r.paymentPending > 0) status = 'payment_pending';
    else if (r.paid > 0) status = 'paid';
    return {
      month,
      year,
      periodLabel: `${MONTH_NAMES[month]} ${year}`,
      totalRecords: r.totalRecords,
      pendingFinance: r.pendingFinance,
      paymentPending: r.paymentPending,
      paid: r.paid,
      pendingAmount: round2(r.pendingAmount),
      paymentPendingAmount: round2(r.paymentPendingAmount),
      paidAmount: round2(r.paidAmount),
      status
    };
  });
}

async function getManualSalaryFinancePeriodDetail(month, year) {
  const { month: m, year: y, periodLabel } = parsePeriod(month, year);
  const records = await ManualSalary.find({ month: m, year: y })
    .populate('ceoApprovedBy', 'firstName lastName email')
    .populate('assignedHod', 'firstName lastName')
    .populate('assignedAvp', 'firstName lastName')
    .sort({ name: 1 })
    .lean();

  const paymentApps = await ManualSalaryPaymentApplication.find({ month: m, year: y })
    .populate('journalEntryId', 'entryNumber status voucherSeries')
    .populate('financeApprovalAuthorities.financeControllerUser', 'firstName lastName email')
    .populate('financeApprovalAuthorities.accountsManagerUser', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .lean();

  const summary = {
    employeeCount: records.length,
    pendingFinanceCount: records.filter((r) => PAYABLE_STATUSES.includes(r.workflowStatus)).length,
    paymentPendingCount: records.filter((r) => r.workflowStatus === 'Payment Pending').length,
    paidCount: records.filter((r) => r.workflowStatus === 'Paid').length,
    totalNetPayable: round2(records.reduce((s, r) => s + (Number(r.netPayable) || 0), 0)),
    pendingNetPayable: round2(
      records
        .filter((r) => PAYABLE_STATUSES.includes(r.workflowStatus))
        .reduce((s, r) => s + (Number(r.netPayable) || 0), 0)
    )
  };

  return { month: m, year: y, periodLabel, records, paymentApps, summary };
}

async function resolvePaymentAccounts(companyId, bankAccountId) {
  const A = acct(companyId);
  const expense = await A.resolve(FinanceHelper.ACCOUNTS.EXPENSE_SALARIES);
  if (!expense) {
    const err = new Error('Salaries expense account (5002) not found for this company');
    err.statusCode = 400;
    throw err;
  }
  let bank = null;
  if (bankAccountId && mongoose.Types.ObjectId.isValid(String(bankAccountId))) {
    bank = await Account.findById(bankAccountId);
  }
  if (!bank) {
    bank = await A.resolve(FinanceHelper.ACCOUNTS.BANK)
      || await Account.findOne({ companyId: co(companyId) || companyId, type: 'Asset', isActive: true });
  }
  if (!bank) {
    const err = new Error('Bank / cash account not found. Select a pay-from account.');
    err.statusCode = 400;
    throw err;
  }
  return { expense, bank };
}

async function submitManualSalaryPayment(month, year, opts = {}) {
  const { month: m, year: y, periodLabel } = parsePeriod(month, year);
  const financeControllerUser = opts.financeControllerUser;
  if (!financeControllerUser) {
    const err = new Error('GM Finance is required');
    err.statusCode = 400;
    throw err;
  }

  const records = await ManualSalary.find({
    month: m,
    year: y,
    workflowStatus: { $in: PAYABLE_STATUSES }
  });
  if (!records.length) {
    const err = new Error('No manual salary records pending finance payment for this period');
    err.statusCode = 400;
    throw err;
  }

  const netTotal = round2(records.reduce((s, r) => s + (Number(r.netPayable) || 0), 0));
  const grossTotal = round2(records.reduce((s, r) => s + (Number(r.grossSalary) || 0), 0));
  if (netTotal <= 0) {
    const err = new Error('Net payable total must be greater than zero');
    err.statusCode = 400;
    throw err;
  }

  const companyId = opts.companyId || null;
  const { expense, bank } = await resolvePaymentAccounts(companyId, opts.bankAccountId);
  const iftikhar = await resolveIftikharAccountsManager();

  const paymentDate = opts.paymentDate ? new Date(opts.paymentDate) : new Date();
  const narration = String(opts.narration || `Manual salary payment — ${periodLabel}`).slice(0, 500);
  const reference = String(opts.reference || '').trim();

  const lines = [
    {
      account: expense._id,
      description: `Manual salary expense — ${periodLabel} (${records.length} employees)`,
      debit: netTotal,
      credit: 0
    },
    {
      account: bank._id,
      description: `Manual salary payment — ${periodLabel}`,
      debit: 0,
      credit: netTotal
    }
  ];

  let je = new JournalEntry({
    date: paymentDate,
    description: narration,
    reference: reference || `MSAL-${m}-${y}`,
    module: 'payroll',
    voucherSeries: opts.paymentMethod === 'cash' ? 'CPV' : 'BPV',
    companyId: co(companyId) || companyId || undefined,
    status: 'draft',
    lines,
    createdBy: opts.actorId,
    customMeta: {
      source: 'manual_salary',
      month: m,
      year: y,
      periodLabel
    }
  });
  je = withVoucherNarration(je, narration);
  await je.save();

  const app = await ManualSalaryPaymentApplication.create({
    month: m,
    year: y,
    periodLabel,
    companyId: co(companyId) || companyId || null,
    companyName: opts.companyName || '',
    amount: netTotal,
    employeeCount: records.length,
    manualSalaryIds: records.map((r) => r._id),
    paymentMeta: {
      paymentMethod: opts.paymentMethod || 'bank_transfer',
      reference,
      narration,
      paymentDate,
      bankAccountId: bank._id,
      grossSalary: grossTotal
    },
    journalEntryId: je._id,
    workflowStatus: 'pending_authority',
    financeApprovalAuthorities: {
      accountsManagerUser: iftikhar?._id || null,
      financeControllerUser
    },
    financeAuthorityApprovals: iftikhar?._id
      ? [{
          authorityKey: 'accountsManagerUser',
          authorityLabel: 'Sr Manager Accounts',
          approver: iftikhar._id,
          decision: 'approved',
          approvedAt: new Date(),
          comments: 'Sr Manager Accounts — auto-approved on submission'
        }]
      : [],
    createdBy: opts.actorId
  });

  await ManualSalary.updateMany(
    { _id: { $in: records.map((r) => r._id) } },
    {
      $set: {
        workflowStatus: 'Payment Pending',
        paymentApplicationId: app._id,
        paymentJournalEntryId: je._id
      }
    }
  );

  return {
    application: app,
    journalEntryId: je._id,
    periodLabel,
    employeeCount: records.length,
    pendingAmount: netTotal,
    grossSalary: grossTotal
  };
}

async function populateManualSalaryPaymentApp(query) {
  return ManualSalaryPaymentApplication.findOne(query)
    .populate('journalEntryId')
    .populate('financeApprovalAuthorities.accountsManagerUser', 'firstName lastName email digitalSignature')
    .populate('financeApprovalAuthorities.financeControllerUser', 'firstName lastName email digitalSignature')
    .populate('financeAuthorityApprovals.approver', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');
}

async function finalizeManualSalaryPayment(app, actorId) {
  const je = await JournalEntry.findById(app.journalEntryId);
  if (!je) throw new Error('Journal entry missing for manual salary payment');

  if (je.status === 'draft') {
    await je.post(actorId);
    const GeneralLedger = require('../models/finance/GeneralLedger');
    const glCount = await GeneralLedger.countDocuments({ journalEntry: je._id });
    if (glCount === 0) {
      await FinanceHelper.postToGeneralLedger(je._id);
    }
  }

  app.workflowStatus = 'fully_approved';
  app.finalizedAt = new Date();
  await app.save();

  await ManualSalary.updateMany(
    { _id: { $in: app.manualSalaryIds } },
    {
      $set: {
        workflowStatus: 'Paid',
        paidAt: new Date(),
        paidBy: actorId
      }
    }
  );

  return app;
}

async function recordManualSalaryAuthorityApproval(app, user, comments = '') {
  const requiredSlots = getRequiredFinanceAuthoritySlots(app);
  const requiredKeys = new Set(requiredSlots.map((s) => s.key));
  if (!requiredKeys.size) {
    requiredKeys.add('financeControllerUser');
  }

  const matched = matchUserToFinanceSlots(requiredSlots, user);
  const isAdmin = ['super_admin', 'admin', 'developer'].includes(user.role);
  if (!matched.length && !isAdmin) {
    const err = new Error('You are not assigned as a finance authority for this payment');
    err.statusCode = 403;
    throw err;
  }

  const approvals = Array.isArray(app.financeAuthorityApprovals) ? [...app.financeAuthorityApprovals] : [];
  const approvedKeys = new Set(
    approvals.filter((a) => a.decision !== 'rejected').map((a) => String(a.authorityKey || ''))
  );

  const toApprove = matched.length
    ? matched.filter((s) => !approvedKeys.has(s.key))
    : (isAdmin
      ? requiredSlots.filter((s) => !approvedKeys.has(s.key))
      : []);

  if (!toApprove.length) {
    const err = new Error('You have already approved your assigned finance authority slot');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  toApprove.forEach((slot) => {
    approvals.push({
      authorityKey: slot.key,
      authorityLabel: slot.label,
      approver: user.id || user._id,
      decision: 'approved',
      approvedAt: now,
      comments: comments || ''
    });
  });
  app.financeAuthorityApprovals = approvals;

  const approvedNow = new Set(
    app.financeAuthorityApprovals
      .filter((a) => a.decision !== 'rejected')
      .map((a) => String(a.authorityKey || ''))
  );
  const remaining = [...requiredKeys].filter((k) => !approvedNow.has(k)).length;
  await app.save();

  let finalized = false;
  if (remaining === 0) {
    await finalizeManualSalaryPayment(app, user.id || user._id);
    finalized = true;
  }

  return { remaining, finalized };
}

async function recordManualSalaryAuthorityRejection(app, user, comments = '') {
  app.workflowStatus = 'rejected';
  app.rejectionObservation = comments || 'Rejected by finance authority';
  app.financeAuthorityApprovals = [
    ...(app.financeAuthorityApprovals || []),
    {
      authorityKey: 'financeControllerUser',
      authorityLabel: 'GM Finance',
      approver: user.id || user._id,
      decision: 'rejected',
      approvedAt: new Date(),
      comments: comments || ''
    }
  ];
  await app.save();

  // Cancel draft JE
  const je = await JournalEntry.findById(app.journalEntryId);
  if (je && je.status === 'draft') {
    je.status = 'cancelled';
    await je.save();
  }

  await ManualSalary.updateMany(
    { _id: { $in: app.manualSalaryIds }, workflowStatus: 'Payment Pending' },
    {
      $set: { workflowStatus: 'Pending Finance' },
      $unset: { paymentApplicationId: 1, paymentJournalEntryId: 1 }
    }
  );

  return app;
}

module.exports = {
  MONTH_NAMES,
  PENDING_FINANCE_STATUSES,
  listManualSalaryFinanceQueue,
  getManualSalaryFinancePeriodDetail,
  submitManualSalaryPayment,
  populateManualSalaryPaymentApp,
  recordManualSalaryAuthorityApproval,
  recordManualSalaryAuthorityRejection,
  finalizeManualSalaryPayment,
  actorSig
};
