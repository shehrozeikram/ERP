const {
  calculateMonthlyTaxFYAwareWithOneTimeArrears
} = require('./taxCalculator');
const { activeAmount, additionalAllowancesTotal } = require('./allowanceHelpers');
const PayrollTaxSettings = require('../models/hr/PayrollTaxSettings');
const {
  ALLOWANCE_TAX_KEYS,
  defaultAllowancePolicies
} = require('../models/hr/PayrollTaxSettings');

const DEFAULT_SALARY_MEDICAL_EXEMPT_PERCENT = 10;

const defaultSettings = () => ({
  salaryMedicalExemptPercent: DEFAULT_SALARY_MEDICAL_EXEMPT_PERCENT,
  applyScope: 'all',
  selectedEmployeeIds: [],
  allowancePolicies: defaultAllowancePolicies()
});

const normalizeSettings = (raw) => {
  const base = defaultSettings();
  if (!raw) return base;

  const policies = { ...base.allowancePolicies };
  ALLOWANCE_TAX_KEYS.forEach((key) => {
    const p = raw.allowancePolicies?.[key] || {};
    const mode = ['taxable', 'fully_exempt', 'partial_exempt'].includes(p.mode)
      ? p.mode
      : 'taxable';
    let exemptPercent = Number(p.exemptPercent) || 0;
    if (mode === 'fully_exempt') exemptPercent = 100;
    if (mode === 'taxable') exemptPercent = 0;
    exemptPercent = Math.min(100, Math.max(0, exemptPercent));
    policies[key] = { mode, exemptPercent };
  });

  return {
    salaryMedicalExemptPercent:
      raw.salaryMedicalExemptPercent != null
        ? Math.min(100, Math.max(0, Number(raw.salaryMedicalExemptPercent)))
        : DEFAULT_SALARY_MEDICAL_EXEMPT_PERCENT,
    applyScope: raw.applyScope === 'selected' ? 'selected' : 'all',
    selectedEmployeeIds: (raw.selectedEmployeeIds || []).map((id) => String(id)),
    allowancePolicies: policies
  };
};

const employeeUsesAllowanceTaxPolicy = (employeeId, settings) => {
  if (settings.applyScope === 'all') return true;
  if (!employeeId) return false;
  return settings.selectedEmployeeIds.includes(String(employeeId));
};

const taxableAndExemptPartsForAllowance = (amount, policy) => {
  const amt = Math.max(0, Number(amount) || 0);
  if (!amt) return { taxable: 0, exempt: 0 };

  const mode = policy?.mode || 'taxable';
  const exemptPercent =
    mode === 'fully_exempt'
      ? 100
      : mode === 'partial_exempt'
        ? Math.min(100, Math.max(0, Number(policy.exemptPercent) || 0))
        : 0;

  const exempt = Math.round((amt * exemptPercent) / 100);
  return { taxable: amt - exempt, exempt };
};

const buildTaxResult = ({
  mainSalary,
  arrearsAmt,
  salaryBase,
  salaryExempt,
  salaryAfterMedical,
  allowanceTaxable,
  allowanceExempt,
  allowanceBreakdown,
  usesAllowanceTaxPolicy,
  hireDate,
  payrollMonth,
  payrollYear
}) => {
  const {
    monthlyTax,
    fyMonths,
    annualTaxableIncome,
    annualTax
  } = calculateMonthlyTaxFYAwareWithOneTimeArrears(
    salaryBase,
    arrearsAmt,
    hireDate,
    payrollMonth,
    payrollYear
  );

  const totalIncome = mainSalary + arrearsAmt;

  return {
    mainSalary,
    arrears: arrearsAmt,
    // Recurring monthly taxable (gross−medical + taxable allowances) — NOT including arrears
    mainTaxableIncome: Math.round(salaryBase),
    // One-time arrears added to annual only (not × FY months)
    arrearsTaxableIncome: Math.round(arrearsAmt),
    annualTaxableIncome,
    annualTax,
    fyMonths,
    mainTax: monthlyTax,
    arrearsTax: 0,
    totalTax: monthlyTax,
    mainNetSalary: Math.round(mainSalary - monthlyTax),
    arrearsNetAmount: Math.round(arrearsAmt),
    totalNetSalary: Math.round(totalIncome - monthlyTax),
    salaryMedicalExempt: salaryExempt,
    salaryAfterMedical: Math.round(salaryAfterMedical),
    salaryBase: Math.round(salaryBase),
    allowanceTaxable: Math.round(allowanceTaxable),
    allowanceExempt: Math.round(allowanceExempt),
    allowanceBreakdown: allowanceBreakdown || undefined,
    usesAllowanceTaxPolicy
  };
};

/**
 * Legacy: medical exemption on gross+allowances bundle.
 * annual = (main−10%) × FY months + arrears (once) → FBR ÷ FY months
 */
const calculateTaxLegacy = (mainSalary, arrears = 0, hireDate = null, payrollMonth = null, payrollYear = null) => {
  const salaryMedicalExempt = Math.round(mainSalary * 0.1);
  const salaryAfterMedical = mainSalary - salaryMedicalExempt;
  const arrearsAmt = Math.max(0, Number(arrears) || 0);

  return buildTaxResult({
    mainSalary,
    arrearsAmt,
    salaryBase: salaryAfterMedical,
    salaryExempt: salaryMedicalExempt,
    salaryAfterMedical,
    allowanceTaxable: salaryAfterMedical,
    allowanceExempt: 0,
    allowanceBreakdown: undefined,
    usesAllowanceTaxPolicy: false,
    hireDate,
    payrollMonth,
    payrollYear
  });
};

/**
 * Dynamic tax calculation driven by PayrollTaxes page settings.
 *
 * Recurring monthly taxable =
 *   (gross − medical% of gross) + taxable allowances
 *
 * DOJ / FY annualization (July–June):
 *   annual taxable = recurring monthly × FY months  +  arrears (ONCE, not × months)
 *   monthly tax    = FBR(annual) ÷ FY months
 *
 * Example — Javed Karim, DOJ 24/08/2026 (late join → Sep–Jun = 10):
 *   230,000 − 23,000 = 207,000 × 10 = 2,070,000 + 59,354 = 2,129,354
 *   → slab ≈ 108,228 ÷ 10 ≈ 10,823 monthly tax
 */
const calculatePayrollTaxWithSettings = ({
  grossSalary = 0,
  allowances = {},
  arrears = 0,
  employeeId = null,
  settings = null,
  hireDate = null,
  payrollMonth = null,
  payrollYear = null
}) => {
  const config = normalizeSettings(settings);
  const gross = Math.max(0, Number(grossSalary) || 0);
  const arrearsAmt = Math.max(0, Number(arrears) || 0);
  const totalAllowances = additionalAllowancesTotal(allowances);

  if (!employeeUsesAllowanceTaxPolicy(employeeId, config)) {
    return calculateTaxLegacy(gross + totalAllowances, arrearsAmt, hireDate, payrollMonth, payrollYear);
  }

  let allowanceTaxable = 0;
  let allowanceExempt = 0;
  const allowanceBreakdown = {};

  ALLOWANCE_TAX_KEYS.forEach((key) => {
    const amount = activeAmount(allowances?.[key]);
    const parts = taxableAndExemptPartsForAllowance(amount, config.allowancePolicies[key]);
    allowanceTaxable += parts.taxable;
    allowanceExempt += parts.exempt;
    allowanceBreakdown[key] = {
      amount,
      ...parts,
      mode: config.allowancePolicies[key]?.mode || 'taxable'
    };
  });

  const salaryExemptPercent = config.salaryMedicalExemptPercent;
  const salaryExempt = Math.round((gross * salaryExemptPercent) / 100);
  const salaryAfterMedical = gross - salaryExempt;
  const salaryBase = salaryAfterMedical + allowanceTaxable;

  return buildTaxResult({
    mainSalary: gross + totalAllowances,
    arrearsAmt,
    salaryBase,
    salaryExempt,
    salaryAfterMedical,
    allowanceTaxable,
    allowanceExempt,
    allowanceBreakdown,
    usesAllowanceTaxPolicy: true,
    hireDate,
    payrollMonth,
    payrollYear
  });
};

const loadPayrollTaxSettings = async () => {
  const doc = await PayrollTaxSettings.getOrCreate();
  return normalizeSettings(doc.toObject());
};

module.exports = {
  ALLOWANCE_TAX_KEYS,
  defaultAllowancePolicies,
  defaultSettings,
  normalizeSettings,
  employeeUsesAllowanceTaxPolicy,
  calculatePayrollTaxWithSettings,
  calculateTaxLegacy,
  loadPayrollTaxSettings
};
