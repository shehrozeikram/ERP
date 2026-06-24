const getAccountId = (account) => String(account?._id || account?.id || '');

const CASH_EQUIVALENTS_ACCOUNT_TYPE = 'cash and cash equivalents';

const CASH_EQUIVALENTS_DETAIL_TYPES = new Set([
  'bank',
  'cash and cash equivalents',
  'cash on hand',
  'client trust account',
  'money market',
  'rents held in trust',
  'savings'
]);

const normalizeAccountLabel = (value) => String(value || '').trim().toLowerCase();

export const getParentAccountId = (account) => {
  if (!account?.parentAccount) return null;
  const parent = account.parentAccount;
  return String(parent._id || parent);
};

export const isCashAndCashEquivalentsAccount = (account) => {
  if (!account || account.isActive === false || account.allowTransactions === false) return false;
  if (account.type && account.type !== 'Asset') return false;

  const category = normalizeAccountLabel(account.category);
  const accountType = normalizeAccountLabel(account.accountType);

  if (category === CASH_EQUIVALENTS_ACCOUNT_TYPE || accountType === CASH_EQUIVALENTS_ACCOUNT_TYPE) {
    return true;
  }

  const detailType = normalizeAccountLabel(account.detailType);
  return CASH_EQUIVALENTS_DETAIL_TYPES.has(detailType);
};

export const isPayFromRootAccount = isCashAndCashEquivalentsAccount;

const sortByAccountNumber = (a, b) =>
  String(a.accountNumber || '').localeCompare(String(b.accountNumber || ''), undefined, { numeric: true });

export const flattenAccountsHierarchy = (accounts) => {
  const accountIds = new Set(accounts.map(getAccountId));
  const childrenByParent = {};

  accounts.forEach((account) => {
    const parentId = getParentAccountId(account);
    const bucketKey = parentId && accountIds.has(parentId) ? parentId : 'root';
    if (!childrenByParent[bucketKey]) childrenByParent[bucketKey] = [];
    childrenByParent[bucketKey].push(account);
  });

  Object.keys(childrenByParent).forEach((key) => {
    childrenByParent[key].sort(sortByAccountNumber);
  });

  const flat = [];
  const walk = (account, depth) => {
    flat.push({ account, depth });
    (childrenByParent[getAccountId(account)] || []).forEach((child) => walk(child, depth + 1));
  };

  (childrenByParent.root || []).forEach((account) => walk(account, 0));
  return flat;
};

export const buildPayFromAccountOptions = (allAccounts) => {
  const accounts = (allAccounts || []).filter(
    (account) => account && getAccountId(account) && (account.name || account.accountNumber)
  );

  const primaryIds = new Set(
    accounts.filter(isCashAndCashEquivalentsAccount).map(getAccountId)
  );

  const eligibleIds = new Set(primaryIds);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const account of accounts) {
      const accountId = getAccountId(account);
      const parentId = getParentAccountId(account);
      if (parentId && eligibleIds.has(parentId) && !eligibleIds.has(accountId)) {
        eligibleIds.add(accountId);
        expanded = true;
      }
    }
  }

  const eligibleAccounts = eligibleIds.size
    ? accounts.filter((account) => eligibleIds.has(getAccountId(account)))
    : accounts.filter(isCashAndCashEquivalentsAccount);

  return flattenAccountsHierarchy(eligibleAccounts);
};

export const formatPayFromAccountLabel = (account, depth = 0) => {
  const prefix = depth > 0 ? `${'  '.repeat(depth)}↳ ` : '';
  return `${prefix}${account.accountNumber || '—'} — ${account.name || 'Unnamed account'}`;
};

export const fetchPayFromAccounts = async (apiClient, { companyId } = {}) => {
  const response = await apiClient.get('/finance/accounts', {
    params: {
      type: 'Asset',
      limit: 1000,
      page: 1,
      ...(companyId ? { companyId } : {})
    }
  });

  const payload = response.data?.data;
  const accounts = Array.isArray(payload?.accounts)
    ? payload.accounts
    : Array.isArray(payload)
      ? payload
      : Array.isArray(response.data?.accounts)
        ? response.data.accounts
        : [];

  return buildPayFromAccountOptions(accounts);
};

export const fetchAllPaymentAccounts = async (apiClient, { companyId } = {}) => {
  const response = await apiClient.get('/finance/accounts', {
    params: {
      limit: 2000,
      page: 1,
      ...(companyId ? { companyId } : {})
    }
  });

  const payload = response.data?.data;
  const accounts = Array.isArray(payload?.accounts)
    ? payload.accounts
    : Array.isArray(payload)
      ? payload
      : Array.isArray(response.data?.accounts)
        ? response.data.accounts
        : [];

  const eligibleAccounts = accounts.filter(
    (account) => account && getAccountId(account) && (account.name || account.accountNumber) && (account.type === 'Asset' || account.type === 'Liability')
  );

  return flattenAccountsHierarchy(eligibleAccounts);
};
