const AccountResolver = require('./accountResolver');

/** Extract companyId from an options/doc object or raw id. */
const co = (source) => {
  if (source == null) return null;
  if (typeof source === 'object') {
    if ('companyId' in source && source.companyId !== undefined) {
      return source.companyId;
    }
    if (source._bsontype === 'ObjectId' || (source.constructor && source.constructor.name === 'ObjectId') || typeof source.toHexString === 'function') {
      return source;
    }
    return null; // source is an object without companyId
  }
  return source;
};

/** Company-scoped account helpers — reuse instead of ad-hoc lookups. */
const acct = (companyId) => ({
  resolve: (num) => AccountResolver.resolveSystemAccount(companyId, num),
  map: (idOrDoc) => AccountResolver.mapAccountToCompany(companyId, idOrDoc),
  async bank(bankAccountId, fallbackNum) {
    if (bankAccountId) {
      const mapped = await AccountResolver.mapAccountToCompany(companyId, bankAccountId);
      if (mapped) return mapped;
    }
    return fallbackNum ? AccountResolver.resolveSystemAccount(companyId, fallbackNum) : null;
  }
});
const withCompany = (payload, companyId) => (companyId ? { ...payload, companyId } : payload);

const mongoose = require('mongoose');

/**
 * Resolve or create intercompany accounts (2301 Payable / 1130 Receivable) for intercompany transactions.
 */
const resolveIntercompanyAccounts = async ({ targetCompanyId, payingCompanyId, createdBy }) => {
  const Account = mongoose.model('Account');
  const A_target = acct(targetCompanyId);
  const A_paying = acct(payingCompanyId);

  // Target Company Intercompany Payable
  let icTargetAcc = await A_target.resolve('2301') || await Account.findOne({ companyId: targetCompanyId, type: 'Liability', name: /intercompany/i });
  if (!icTargetAcc) {
    icTargetAcc = await Account.create({
      accountNumber: '2301',
      name: 'Intercompany Payable / Loan Account',
      type: 'Liability',
      category: 'Current Liabilities',
      detailType: 'Intercompany Payable',
      companyId: targetCompanyId,
      createdBy
    });
  }

  // Paying Company Intercompany Receivable
  let icPayingAcc = await A_paying.resolve('1130') || await A_paying.resolve('2301') || await Account.findOne({ companyId: payingCompanyId, name: /intercompany/i });
  if (!icPayingAcc) {
    icPayingAcc = await Account.create({
      accountNumber: '1130',
      name: 'Intercompany Receivable / Due From Subsidiary',
      type: 'Asset',
      category: 'Current Asset',
      detailType: 'Other Current Assets',
      companyId: payingCompanyId,
      createdBy
    });
  }

  return { icTargetAcc, icPayingAcc };
};

module.exports = { co, acct, withCompany, resolveIntercompanyAccounts };
