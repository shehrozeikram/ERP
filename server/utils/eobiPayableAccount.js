/**
 * EOBI Payable (2211) — parent control account with employee / employer sub-accounts.
 */
const Account = require('../models/finance/Account');
const AccountResolver = require('./accountResolver');

const EOBI_PAYABLE_PARENT_NUMBER = '2211';
const EOBI_PAYABLE_EMP_NUMBER = '2211-01';
const EOBI_PAYABLE_ER_NUMBER = '2211-02';
const EOBI_PAYABLE_EMP_CODE = 'EOBI_PAYABLE_EMP';
const EOBI_PAYABLE_ER_CODE = 'EOBI_PAYABLE_ER';

const EOBI_SUB_ACCOUNT_TEMPLATES = [
  {
    accountNumber: EOBI_PAYABLE_EMP_NUMBER,
    accountCode: EOBI_PAYABLE_EMP_CODE,
    name: 'EOBI Payable — Employee Contribution',
    description: 'Employee share of EOBI deducted from salary — remitted to EOBI'
  },
  {
    accountNumber: EOBI_PAYABLE_ER_NUMBER,
    accountCode: EOBI_PAYABLE_ER_CODE,
    name: 'EOBI Payable — Employer Contribution',
    description: 'Employer matching EOBI contribution — remitted to EOBI'
  }
];

const ensureEobiPayableParent = async (companyId, createdBy = null) => {
  let parent = await AccountResolver.resolveSystemAccount(companyId, EOBI_PAYABLE_PARENT_NUMBER);
  if (!parent) {
    parent = await Account.create({
      companyId,
      accountNumber: EOBI_PAYABLE_PARENT_NUMBER,
      accountCode: 'EOBI_PAYABLE',
      name: 'EOBI Payable',
      type: 'Liability',
      category: 'Current Liability',
      detailType: 'Other Current Liabilities',
      description: 'EOBI statutory payable (control — post to employee/employer sub-accounts)',
      isActive: true,
      isSystem: true,
      allowTransactions: false,
      balance: 0,
      metadata: createdBy ? { createdBy } : undefined
    });
  } else if (parent.allowTransactions !== false) {
    await Account.updateOne({ _id: parent._id }, { $set: { allowTransactions: false } });
    parent.allowTransactions = false;
  }
  return parent;
};

const ensureEobiPayableSubAccount = async (companyId, parent, template, createdBy = null) => {
  let acc = await Account.findOne({
    companyId,
    accountNumber: template.accountNumber,
    isActive: true
  });
  if (!acc) {
    acc = await Account.findOne({
      companyId,
      accountCode: template.accountCode,
      isActive: true
    });
  }
  if (!acc) {
    acc = await Account.create({
      companyId,
      accountNumber: template.accountNumber,
      accountCode: template.accountCode,
      name: template.name,
      type: 'Liability',
      category: 'Current Liability',
      detailType: 'Other Current Liabilities',
      parentAccount: parent._id,
      description: template.description,
      isActive: true,
      isSystem: true,
      allowTransactions: true,
      balance: 0,
      metadata: createdBy ? { createdBy } : undefined
    });
  } else if (!acc.parentAccount) {
    await Account.updateOne({ _id: acc._id }, { $set: { parentAccount: parent._id } });
    acc.parentAccount = parent._id;
  }
  return acc;
};

/** Ensure parent 2211 + employee (2211-01) and employer (2211-02) sub-accounts for a company. */
const ensureEobiPayableAccounts = async (companyId, createdBy = null) => {
  if (!companyId) {
    const err = new Error('companyId is required to ensure EOBI Payable accounts');
    err.statusCode = 400;
    throw err;
  }
  const parent = await ensureEobiPayableParent(companyId, createdBy);
  const employee = await ensureEobiPayableSubAccount(
    companyId,
    parent,
    EOBI_SUB_ACCOUNT_TEMPLATES[0],
    createdBy
  );
  const employer = await ensureEobiPayableSubAccount(
    companyId,
    parent,
    EOBI_SUB_ACCOUNT_TEMPLATES[1],
    createdBy
  );
  return { parent, employee, employer };
};

module.exports = {
  EOBI_PAYABLE_PARENT_NUMBER,
  EOBI_PAYABLE_EMP_NUMBER,
  EOBI_PAYABLE_ER_NUMBER,
  EOBI_PAYABLE_EMP_CODE,
  EOBI_PAYABLE_ER_CODE,
  ensureEobiPayableAccounts
};
