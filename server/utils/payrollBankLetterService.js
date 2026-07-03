const Payroll = require('../models/hr/Payroll');
const CompanyBank = require('../models/finance/CompanyBank');
const PayrollBankLetter = require('../models/finance/PayrollBankLetter');
const SystemSettings = require('../models/general/SystemSettings');
const { populateApplication } = require('./payrollPeriodPayment');
const { mapBankLetterRow } = require('./financePayrollQueue');

const employeeDisplayName = (emp) =>
  [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim() || emp?.employeeId || '—';

const resolveCompanyBank = async (companyId) => {
  if (!companyId) return null;
  const primary = await CompanyBank.findOne({ company: companyId, isActive: true, isPrimary: true }).lean();
  if (primary) return primary;
  return CompanyBank.findOne({ company: companyId, isActive: true }).sort({ createdAt: 1 }).lean();
};

const loadGlobalCompanyProfile = async () => {
  const settings = await SystemSettings.getSingleton();
  return settings?.companyProfile || {};
};

const buildLetterRef = (globalProfile = {}, app = {}) => {
  const prefix = String(globalProfile.salaryLetterRefPrefix || '').trim();
  if (prefix) {
    return `${prefix}-${String(app.month || new Date().getMonth() + 1).padStart(2, '0')}`;
  }
  return `SGC-S-${String(app.month || new Date().getMonth() + 1).padStart(2, '0')}`;
};

const buildCompanyLetterContext = (app, companyBank, globalProfile = {}) => ({
  name: app.companyName,
  legalName: app.companyName,
  bankName: companyBank?.bankName || globalProfile.bankName || '',
  bankAccount: companyBank?.accountNumber || globalProfile.bankAccount || '',
  bankIBAN: companyBank?.iban || globalProfile.bankIBAN || '',
  bankBranchName: companyBank?.branch || globalProfile.bankBranchName || globalProfile.bankBranchCode || '',
  bankBranchCode: companyBank?.branch || globalProfile.bankBranchCode || '',
  city: globalProfile.city || 'Islamabad',
  salaryLetterRefPrefix: globalProfile.salaryLetterRefPrefix || ''
});

const buildLetterPayload = async (app) => {
  if (!app) {
    const err = new Error('Payroll payment not found');
    err.statusCode = 404;
    throw err;
  }
  if (app.workflowStatus !== 'fully_approved') {
    const err = new Error('Bank letter can only be generated after payment is fully approved');
    err.statusCode = 400;
    throw err;
  }

  const payrollIds = Array.isArray(app.payrollIds) ? app.payrollIds.filter(Boolean) : [];
  const payrolls = payrollIds.length
    ? await Payroll.find({ _id: { $in: payrollIds } })
      .populate({
        path: 'employee',
        select: 'firstName lastName employeeId idCard branchCode bankAccountNumber accountNumber bankName cashSalary',
        populate: { path: 'bankName', select: 'name' }
      })
      .lean()
    : [];

  if (!payrolls.length) {
    const err = new Error('No payroll rows found for this payment');
    err.statusCode = 404;
    throw err;
  }

  let [companyBank, globalProfile] = await Promise.all([
    resolveCompanyBank(app.companyId),
    loadGlobalCompanyProfile()
  ]);

  if (app.paymentMeta?.bankAccountId) {
    const Account = require('../models/finance/Account');
    const voucherAccount = await Account.findById(app.paymentMeta.bankAccountId).lean();
    if (voucherAccount) {
      companyBank = {
        ...(companyBank || {}),
        bankName: voucherAccount.name || companyBank?.bankName || '',
        accountNumber: voucherAccount.accountNumber || companyBank?.accountNumber || ''
      };
    }
  }

  const je = app.journalEntryId && typeof app.journalEntryId === 'object'
    ? app.journalEntryId
    : null;
  const chequeNumber = String(
    app.paymentMeta?.reference || je?.reference || ''
  ).trim();

  const rows = payrolls
    .filter((p) => p.employee && !p.isCashSalary)
    .map((p) => mapBankLetterRow(p, p.employee, p.employee.bankName))
    .sort((a, b) => String(a.employeeId).localeCompare(String(b.employeeId), undefined, { numeric: true }));

  const totalNetSalary = rows.reduce((sum, row) => sum + (Number(row.netSalary) || 0), 0);
  const letterRef = buildLetterRef(globalProfile, app);

  const letter = {
    paymentApplicationId: app._id,
    journalEntryId: je?._id || app.journalEntryId,
    voucherNumber: je?.entryNumber || '',
    periodLabel: `${app.periodLabel || ''} — ${app.companyName}`.trim(),
    companyName: app.companyName,
    chequeNumber,
    reference: chequeNumber,
    letterRef,
    letterDate: app.finalizedAt || app.paymentMeta?.paymentDate || new Date(),
    employeeCount: rows.length,
    totalNetSalary,
    rows
  };

  return {
    letter,
    company: buildCompanyLetterContext(app, companyBank, globalProfile),
    payment: {
      _id: app._id,
      companyName: app.companyName,
      amount: app.amount,
      workflowStatus: app.workflowStatus,
      finalizedAt: app.finalizedAt,
      journalEntryId: je?._id || app.journalEntryId,
      voucherNumber: je?.entryNumber || '',
      chequeNumber
    }
  };
};

const recordBankLetterGeneration = async (app, { format = 'print', generatedBy, attachment = null } = {}) => {
  const { letter, company } = await buildLetterPayload(app);
  const record = await PayrollBankLetter.create({
    paymentApplicationId: app._id,
    journalEntryId: letter.journalEntryId,
    month: app.month,
    year: app.year,
    periodLabel: app.periodLabel,
    companyName: app.companyName,
    companyId: app.companyId || null,
    voucherNumber: letter.voucherNumber,
    chequeNumber: letter.chequeNumber,
    companyAccountNumber: company.bankAccount || '',
    companyBankName: company.bankName || '',
    companyBankBranch: company.bankBranchName || '',
    employeeCount: letter.employeeCount,
    totalNetSalary: letter.totalNetSalary,
    letterRef: letter.letterRef,
    format,
    generatedBy,
    generatedAt: new Date(),
    attachment: attachment || undefined
  });

  return { letter, company, record };
};

const listBankLettersForPeriod = async (month, year, { companyName } = {}) => {
  const query = { month: parseInt(month, 10), year: parseInt(year, 10) };
  if (companyName) query.companyName = String(companyName).trim();

  return PayrollBankLetter.find(query)
    .sort({ generatedAt: -1 })
    .populate('generatedBy', 'firstName lastName email')
    .populate('journalEntryId', 'entryNumber reference status')
    .populate('paymentApplicationId', 'workflowStatus amount finalizedAt')
    .lean();
};

const generateBankLetterForPayment = async (paymentApplicationId, { format = 'print', generatedBy } = {}) => {
  const app = await populateApplication({ _id: paymentApplicationId });
  if (!app) {
    const err = new Error('Payroll payment not found');
    err.statusCode = 404;
    throw err;
  }
  return recordBankLetterGeneration(app, { format, generatedBy });
};

const generateBankLetterForCompanyPayment = async (month, year, companyName, options = {}) => {
  const PayrollPeriodPaymentApplication = require('../models/finance/PayrollPeriodPaymentApplication');
  const { normalizeCompanyName } = require('./payrollPeriodPayment');
  const normalized = normalizeCompanyName(companyName);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  const latest = await PayrollPeriodPaymentApplication.findOne({
    month: m,
    year: y,
    companyName: normalized,
    workflowStatus: 'fully_approved'
  }).sort({ finalizedAt: -1, updatedAt: -1 });

  if (!latest) {
    const err = new Error(`No fully approved payment found for ${normalized}`);
    err.statusCode = 404;
    throw err;
  }

  const app = await populateApplication({ _id: latest._id });
  return recordBankLetterGeneration(app, options);
};

module.exports = {
  buildLetterPayload,
  generateBankLetterForPayment,
  generateBankLetterForCompanyPayment,
  listBankLettersForPeriod,
  employeeDisplayName
};
