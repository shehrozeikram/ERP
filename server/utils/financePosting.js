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

module.exports = { co, acct, withCompany };
