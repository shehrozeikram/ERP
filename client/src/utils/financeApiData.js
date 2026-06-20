/**
 * Normalize list payloads from /finance/* APIs.
 * Backend may return an array or { accounts, pagination, ... }.
 */
export function asFinanceList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.accounts)) return payload.accounts;
  if (Array.isArray(payload.transactions)) return payload.transactions;
  if (Array.isArray(payload.rows)) return payload.rows;
  return [];
}

/** Extract a list from a typical axios finance response. */
export function financeListFromResponse(res) {
  const body = res?.data;
  if (!body) return [];
  return asFinanceList(body.data ?? body.accounts ?? body);
}
