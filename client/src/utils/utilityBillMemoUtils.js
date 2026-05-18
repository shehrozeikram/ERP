/** True when bill is a consolidated parent with line breakdown to show in memo tables. */
export function hasConsolidatedBreakdown(bill) {
  return Boolean(bill?.isConsolidated && Array.isArray(bill.consolidatedFrom) && bill.consolidatedFrom.length > 0);
}

/** Source bills sorted by billId for stable memo / print order. */
export function sortedConsolidatedLines(bill) {
  if (!hasConsolidatedBreakdown(bill)) return [];
  return [...bill.consolidatedFrom].sort((a, b) => String(a.billId || '').localeCompare(String(b.billId || '')));
}

export function consolidatedMemoSecondaryHeading(bill, fallback = '') {
  if (hasConsolidatedBreakdown(bill)) {
    return `Consolidated — ${bill.consolidatedFrom.length} utility bills`;
  }
  return fallback;
}

/** Sum amount + last month across consolidated line items (or any bill-shaped rows). */
export function sumConsolidatedLineAmounts(lines = []) {
  return (Array.isArray(lines) ? lines : []).reduce(
    (acc, line) => ({
      amountTotal: acc.amountTotal + (Number(line?.amount) || 0),
      lastMonthTotal: acc.lastMonthTotal + (Number(line?.lastMonthAmount) || 0)
    }),
    { amountTotal: 0, lastMonthTotal: 0 }
  );
}

export function getConsolidatedLineTotals(bill) {
  return sumConsolidatedLineAmounts(sortedConsolidatedLines(bill));
}

/** Column widths for fixed-layout utility memo tables (must sum ~100%). */
export const UTILITY_MEMO_COL_WIDTHS = ['11%', '14%', '20%', '27%', '13%', '15%'];

export const utilityMemoTableSx = {
  width: '100%',
  minWidth: 720,
  tableLayout: 'fixed',
  '& th': {
    overflow: 'hidden',
    wordBreak: 'break-word'
  },
  '& td': {
    overflow: 'hidden',
    wordBreak: 'break-word'
  }
};

export const utilityMemoDateCellSx = {
  fontWeight: 700,
  textAlign: 'left',
  whiteSpace: 'normal',
  wordBreak: 'normal',
  minWidth: 76
};

export const utilityMemoRefCellSx = {
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  minWidth: 0
};
