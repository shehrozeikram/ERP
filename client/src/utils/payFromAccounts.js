const getAccountId = (account) => String(account?._id || account?.id || '');

export const getParentAccountId = (account) => {
  if (!account?.parentAccount) return null;
  const parent = account.parentAccount;
  return String(parent._id || parent);
};

export const isPayFromRootAccount = (account) => {
  if (!account || account.isActive === false || account.allowTransactions === false) return false;
  if (account.type && account.type !== 'Asset') return false;

  const name = String(account.name || '').toLowerCase();
  const num = String(account.accountNumber || '').trim();
  const detail = String(account.detailType || '').toLowerCase();
  const acctNum = parseInt(num, 10);

  return (
    (Number.isFinite(acctNum) && acctNum >= 1000 && acctNum <= 1999) ||
    /bank|cash|petty/i.test(name) ||
    detail.includes('bank') ||
    detail.includes('cash')
  );
};

const sortByAccountNumber = (a, b) =>
  String(a.accountNumber || '').localeCompare(String(b.accountNumber || ''), undefined, { numeric: true });

const flattenPayFromHierarchy = (accounts) => {
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
    accounts.filter(isPayFromRootAccount).map(getAccountId)
  );

  const eligibleIds = new Set(primaryIds);
  let expanded = true;
  while (expanded) {
    expanded = false;
    accounts.forEach((account) => {
      const accountId = getAccountId(account);
      const parentId = getParentAccountId(account);
      if (parentId && eligibleIds.has(parentId) && !eligibleIds.has(accountId)) {
        eligibleIds.add(accountId);
        expanded = true;
      }
    });
  }

  const eligibleAccounts = eligibleIds.size
    ? accounts.filter((account) => eligibleIds.has(getAccountId(account)))
    : accounts;

  return flattenPayFromHierarchy(eligibleAccounts);
};

export const formatPayFromAccountLabel = (account, depth = 0) => {
  const prefix = depth > 0 ? `${'  '.repeat(depth)}↳ ` : '';
  return `${prefix}${account.accountNumber || '—'} — ${account.name || 'Unnamed account'}`;
};

export const fetchPayFromAccounts = async (apiClient) => {
  const response = await apiClient.get('/finance/accounts', {
    params: { type: 'Asset', limit: 1000, page: 1 }
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
