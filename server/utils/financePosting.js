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

const RELATED_PARTY_NAME = /payable\s+to\s+related\s+part(?:y|ies)/i;

const isRelatedPartyLiability = (account) => {
  if (!account || account.isActive === false) return false;
  if (String(account.type || '').toLowerCase() !== 'liability') return false;
  if (RELATED_PARTY_NAME.test(account.name || '')) return true;
  const detail = String(account.detailType || '').toLowerCase();
  return detail.includes('related part');
};

/**
 * True when the account is under (or is) "Payable to Related Parties" on its company.
 */
const isRelatedPartyPayFromAccount = async (account) => {
  if (!account) return false;
  if (RELATED_PARTY_NAME.test(account.name || '')) return true;
  if (String(account.type || '').toLowerCase() !== 'liability') return false;

  const Account = mongoose.model('Account');
  let parentId = account.parentAccount?._id || account.parentAccount || null;
  let guard = 0;
  while (parentId && guard < 12) {
    const parent = await Account.findById(parentId).select('name type parentAccount').lean();
    if (!parent) break;
    if (RELATED_PARTY_NAME.test(parent.name || '')) return true;
    parentId = parent.parentAccount || null;
    guard += 1;
  }
  return isRelatedPartyLiability(account);
};

const normalizeName = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/**
 * Find an existing Payable to Related Parties subaccount (or parent) on companyId
 * whose name matches counterpartyName. Never creates accounts.
 */
const findExistingRelatedPartyAccount = async (companyId, counterpartyName) => {
  if (!companyId) return null;
  const Account = mongoose.model('Account');
  const parent = await Account.findOne({
    companyId,
    isActive: { $ne: false },
    type: 'Liability',
    name: RELATED_PARTY_NAME
  }).lean();
  if (!parent) return null;

  const children = await Account.find({
    companyId,
    parentAccount: parent._id,
    isActive: { $ne: false }
  }).lean();

  const targetNorm = normalizeName(counterpartyName);
  if (targetNorm) {
    const exact = children.find((c) => normalizeName(c.name) === targetNorm);
    if (exact) return exact;
    const partial = children.find((c) => {
      const n = normalizeName(c.name);
      return n.includes(targetNorm) || targetNorm.includes(n);
    });
    if (partial) return partial;
  }

  // Fall back to parent head if no named child matches
  return parent;
};

/**
 * Resolve or create intercompany accounts (2301 Payable / 1130 Receivable) for intercompany transactions.
 * Pass createIfMissing: false to only use existing accounts (never invent COA on either company).
 */
const resolveIntercompanyAccounts = async ({
  targetCompanyId,
  payingCompanyId,
  createdBy,
  createIfMissing = true
}) => {
  const Account = mongoose.model('Account');
  const A_target = acct(targetCompanyId);
  const A_paying = acct(payingCompanyId);

  // Prefer existing Payable to Related Parties trees (no invent) when createIfMissing is false
  if (!createIfMissing) {
    const PlacementCompany = mongoose.model('PlacementCompany');
    const [targetCo, payingCo] = await Promise.all([
      PlacementCompany.findById(targetCompanyId).select('name').lean(),
      PlacementCompany.findById(payingCompanyId).select('name').lean()
    ]);
    const icTargetAcc = await findExistingRelatedPartyAccount(targetCompanyId, payingCo?.name);
    const icPayingAcc = await findExistingRelatedPartyAccount(payingCompanyId, targetCo?.name);
    return { icTargetAcc, icPayingAcc };
  }

  // Target Company Intercompany Payable
  let icTargetAcc = await A_target.resolve('2301') || await Account.findOne({ companyId: targetCompanyId, type: 'Liability', name: /intercompany/i });
  if (!icTargetAcc && createIfMissing) {
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
  if (!icPayingAcc && createIfMissing) {
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

module.exports = {
  co,
  acct,
  withCompany,
  resolveIntercompanyAccounts,
  isRelatedPartyPayFromAccount,
  isRelatedPartyLiability,
  findExistingRelatedPartyAccount
};
