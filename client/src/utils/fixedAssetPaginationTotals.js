export function computeFixedAssetTotals(assets) {
  return (assets || []).reduce(
    (acc, a) => ({
      count: acc.count + 1,
      totalCost: acc.totalCost + Number(a.purchaseCost || 0),
      totalAccumDepreciation: acc.totalAccumDepreciation + Number(a.accumulatedDepreciation || 0),
      totalBookValue: acc.totalBookValue + Number(a.currentBookValue || 0)
    }),
    { count: 0, totalCost: 0, totalAccumDepreciation: 0, totalBookValue: 0 }
  );
}

export function getPaginationSlice(page, rowsPerPage, total) {
  if (!total) return { start: 0, end: 0 };
  return {
    start: page * rowsPerPage + 1,
    end: Math.min((page + 1) * rowsPerPage, total)
  };
}
