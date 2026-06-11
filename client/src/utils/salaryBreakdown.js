/** Auto-calculated gross split used in Salary & Benefits (66.66% / 23.34% / 10%). */
export const computeAutoSalaryBreakdown = (gross = 0) => {
  const g = Number(gross) || 0;
  return {
    gross: g,
    basic: Math.round(g * 0.6666),
    houseRent: Math.round(g * 0.2334),
    medical: Math.round(g * 0.1)
  };
};
