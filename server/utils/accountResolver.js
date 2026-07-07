const mongoose = require('mongoose');
const Account = require('../models/finance/Account');
const { findHistoricalCompany } = require('./financeCompanyContext');

const ACCOUNT_NUMBER_TO_CODE = {
  '1001': 'CASH',
  '1002': 'BANK',
  '1100': 'RECEIVABLE',
  '1110': 'VENDOR_ADVANCE',
  '1120': 'STAFF_ADVANCE',
  '1125': 'EMPLOYEE_LOAN',
  '1200': 'INVENTORY',
  '2001': 'PAYABLE',
  '2004': 'WHT_PAYABLE',
  '2100': 'GRNI',
  '2140': 'GRNI_ALT',
  '2200': 'SALARIES_PAYABLE',
  '2210': 'PF_PAYABLE',
  '2211': 'EOBI_PAYABLE',
  '2211-01': 'EOBI_PAYABLE_EMP',
  '2211-02': 'EOBI_PAYABLE_ER',
  '2212': 'OTHER_PAYROLL_DED',
  '4010': 'REVENUE_CAM',
  '4020': 'REVENUE_ELECTRICITY',
  '4030': 'REVENUE_RENT',
  '5000': 'COGS',
  '5001': 'EXPENSE_GENERAL',
  '5002': 'EXPENSE_SALARIES',
  '6200': 'UTILITIES'
};

const normalizeCompanyObjectId = async (companyId) => {
  if (!companyId) {
    const historical = await findHistoricalCompany();
    return historical?._id || null;
  }
  if (mongoose.Types.ObjectId.isValid(String(companyId))) {
    return new mongoose.Types.ObjectId(String(companyId));
  }
  return null;
};

const getAccountByNumber = async (companyId, accountNumber) => {
  const cid = await normalizeCompanyObjectId(companyId);
  const number = String(accountNumber || '').trim();
  if (!number) return null;

  if (cid) {
    const scoped = await Account.findOne({ companyId: cid, accountNumber: number, isActive: true });
    if (scoped) return scoped;
  }

  return Account.findOne({ 
    accountNumber: number, 
    isActive: true, 
    $or: [{ companyId: null }, { companyId: { $exists: false } }] 
  });
};

const getAccountByCode = async (companyId, accountCode) => {
  const cid = await normalizeCompanyObjectId(companyId);
  const code = String(accountCode || '').trim().toUpperCase();
  if (!code) return null;
  
  if (cid) {
    const scoped = await Account.findOne({ companyId: cid, accountCode: code, isActive: true });
    if (scoped) return scoped;
  }
  
  return Account.findOne({ 
    accountCode: code, 
    isActive: true, 
    $or: [{ companyId: null }, { companyId: { $exists: false } }] 
  });
};

const resolveSystemAccount = async (companyId, accountNumber) => {
  const number = String(accountNumber || '').trim();
  if (!number) return null;

  const code = ACCOUNT_NUMBER_TO_CODE[number];
  if (code) {
    const byCode = await getAccountByCode(companyId, code);
    if (byCode) return byCode;
  }
  return getAccountByNumber(companyId, number);
};

const mapAccountToCompany = async (companyId, accountDocOrId) => {
  const cid = await normalizeCompanyObjectId(companyId);
  
  let account = accountDocOrId;
  if (!account) return null;
  if (mongoose.Types.ObjectId.isValid(String(account))) {
    account = await Account.findById(account).lean();
  }
  if (!account?._id) return null;

  if (cid && account.companyId && String(account.companyId) === String(cid)) {
    return account;
  }

  if (account.accountCode) {
    const byCode = await getAccountByCode(cid, account.accountCode);
    if (byCode) return byCode;
  }

  if (account.accountNumber) {
    const byNumber = await getAccountByNumber(cid, account.accountNumber);
    if (byNumber) return byNumber;
  }

  // Fallback: If it's a global account, it can be used across companies
  if (!account.companyId) {
    return account;
  }

  return null;
};

module.exports = {
  ACCOUNT_NUMBER_TO_CODE,
  normalizeCompanyObjectId,
  getAccountByNumber,
  getAccountByCode,
  resolveSystemAccount,
  mapAccountToCompany
};
