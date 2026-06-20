const Account = require('../models/finance/Account');
const JournalEntry = require('../models/finance/JournalEntry');
const FinanceHelper = require('./financeHelper');
const {
  PAYROLL_PAYMENT_CREDIT_SLOTS,
  PAYROLL_ACCRUAL_DEBIT_SLOTS,
  buildPayrollVoucherLineDescription,
  resolvePayrollCreditSlotAmount,
  validatePayrollAccrualTotals,
  validatePayrollBpvPaymentTotals
} = require('./payrollBreakdown');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const ensurePayrollFinanceAccounts = async (companyId) => {
  const { STANDARD_SYSTEM_ACCOUNTS } = require('./companyChartOfAccounts');
  const requiredNumbers = new Set([
    '5002',
    FinanceHelper.ACCOUNTS.SALARIES_PAYABLE,
    FinanceHelper.ACCOUNTS.WHT_PAYABLE,
    FinanceHelper.ACCOUNTS.EMPLOYEE_LOAN,
    FinanceHelper.ACCOUNTS.STAFF_ADVANCE,
    FinanceHelper.ACCOUNTS.PF_PAYABLE,
    FinanceHelper.ACCOUNTS.EOBI_PAYABLE,
    FinanceHelper.ACCOUNTS.EOBI_EXPENSE,
    FinanceHelper.ACCOUNTS.OTHER_PAYROLL_DED
  ]);

  const templates = STANDARD_SYSTEM_ACCOUNTS.filter((row) => requiredNumbers.has(row.accountNumber));
  for (const template of templates) {
    const existing = await Account.findOne({ companyId, accountNumber: template.accountNumber }).select('_id').lean();
    if (existing) continue;
    await Account.create({
      companyId,
      accountNumber: template.accountNumber,
      accountCode: template.accountCode,
      name: template.name,
      type: template.type,
      category: template.category,
      detailType: template.detailType,
      description: template.name,
      isActive: true,
      isSystem: template.isSystem,
      balance: 0
    });
  }
};

const resolveAccount = async (companyId, accountNumber, label) => {
  const AccountResolver = require('./accountResolver');
  const account = await AccountResolver.resolveSystemAccount(companyId, accountNumber);
  if (!account) {
    const err = new Error(`${label} account (${accountNumber}) not found for this company.`);
    err.statusCode = 400;
    throw err;
  }
  return account;
};

/**
 * Accrual at payroll approval:
 * Dr Salaries Expense (gross) + EOBI employer expense
 * Cr statutory deductions + Salaries Payable (net)
 */
const buildPayrollAccrualJournalLines = async ({
  companyId,
  totals,
  periodLabel = '',
  companyName = '',
  employeeName = ''
}) => {
  await ensurePayrollFinanceAccounts(companyId);
  validatePayrollAccrualTotals(totals);

  const labelContext = employeeName
    ? `${employeeName} — ${periodLabel} — ${companyName}`
    : `${periodLabel} — ${companyName}`;
  const lines = [];

  for (const slot of PAYROLL_ACCRUAL_DEBIT_SLOTS) {
    const amount = round2(totals[slot.key]);
    if (amount <= 0) continue;
    const account = await resolveAccount(companyId, slot.accountNumber, slot.label);
    lines.push({
      account: account._id,
      description: buildPayrollVoucherLineDescription(slot, periodLabel, labelContext),
      debit: amount,
      department: 'hr'
    });
  }

  for (const slot of PAYROLL_PAYMENT_CREDIT_SLOTS) {
    const amount = resolvePayrollCreditSlotAmount(totals, slot);
    if (amount <= 0) continue;
    const account = await resolveAccount(companyId, slot.accountNumber, slot.label);
    lines.push({
      account: account._id,
      description: buildPayrollVoucherLineDescription(slot, periodLabel, labelContext),
      credit: amount,
      department: 'hr'
    });
  }

  const netAmount = round2(totals.netPayable);
  if (netAmount > 0) {
    const payableAccount = await resolveAccount(
      companyId,
      FinanceHelper.ACCOUNTS.SALARIES_PAYABLE,
      'Salaries Payable'
    );
    lines.push({
      account: payableAccount._id,
      description: `Salaries Payable — Net — ${labelContext}`,
      credit: netAmount,
      department: 'hr'
    });
  }

  return lines;
};

/**
 * BPV at bank payment — clears net salaries payable only.
 * Deductions were credited at accrual; salary schedule on BPV remains informational.
 */
const buildPayrollBpvPaymentJournalLines = async ({
  companyId,
  totals,
  bankAccount,
  periodLabel = '',
  companyName = ''
}) => {
  await ensurePayrollFinanceAccounts(companyId);
  validatePayrollBpvPaymentTotals(totals);

  if (!bankAccount) {
    const err = new Error('Bank or cash account is required for payroll payment.');
    err.statusCode = 400;
    throw err;
  }

  const netAmount = round2(totals.netPayable);
  const payableAccount = await resolveAccount(
    companyId,
    FinanceHelper.ACCOUNTS.SALARIES_PAYABLE,
    'Salaries Payable'
  );

  return [
    {
      account: payableAccount._id,
      description: `Salaries Payable — Net Payment — ${periodLabel} — ${companyName}`,
      debit: netAmount,
      department: 'hr'
    },
    {
      account: bankAccount._id,
      description: `Payroll Bank Payment — ${periodLabel} — ${companyName}`,
      credit: netAmount,
      department: 'hr'
    }
  ];
};

const payrollAccrualAlreadyPosted = async (payrollId) => {
  if (!payrollId) return false;
  const existing = await JournalEntry.findOne({
    referenceId: payrollId,
    referenceType: 'payroll',
    module: 'payroll',
    status: { $in: ['posted', 'draft'] },
    isReversed: { $ne: true }
  }).select('_id entryNumber status').lean();
  return Boolean(existing);
};

module.exports = {
  ensurePayrollFinanceAccounts,
  buildPayrollAccrualJournalLines,
  buildPayrollBpvPaymentJournalLines,
  payrollAccrualAlreadyPosted
};
