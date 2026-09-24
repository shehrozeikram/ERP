const { calculateMonthlyTax, calculateMonthlyTaxFYAware } = require('./taxCalculator');
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

/**
 * Legacy: medical exemption on gross+allowances bundle, arrears added into same taxable base.
 * Formula: taxable = (mainSalary − 10% medical) + arrears → single FBR tax
 */
const calculateTaxLegacy = (mainSalary, arrears = 0, hireDate = null, payrollMonth = null, payrollYear = null) => {
  const taxFor = (amount) =>
    hireDate && payrollMonth && payrollYear
      ? calculateMonthlyTaxFYAware(amount, hireDate, payrollMonth, payrollYear)
      : calculateMonthlyTax(amount);

  const salaryMedicalExempt = Math.round(mainSalary * 0.1);
  const salaryAfterMedical = mainSalary - salaryMedicalExempt;
  const arrearsAmt = Math.max(0, Number(arrears) || 0);
  // Arrears included in the same taxable base (not taxed separately)
  const mainTaxableIncome = salaryAfterMedical + arrearsAmt;
  const totalTax = taxFor(mainTaxableIncome);
  const totalIncome = mainSalary + arrearsAmt;

  return {
    mainSalary,
    arrears: arrearsAmt,
    mainTaxableIncome: Math.round(mainTaxableIncome),
    // Informational: arrears amount included in mainTaxableIncome (do not add again)
    arrearsTaxableIncome: Math.round(arrearsAmt),
    mainTax: Math.round(totalTax),
    arrearsTax: 0,
    totalTax: Math.round(totalTax),
    mainNetSalary: Math.round(mainSalary - totalTax),
    arrearsNetAmount: Math.round(arrearsAmt),
    totalNetSalary: Math.round(totalIncome - totalTax),
    salaryMedicalExempt,
    salaryAfterMedical: Math.round(salaryAfterMedical),
    salaryBase: Math.round(salaryAfterMedical),
    allowanceTaxable: Math.round(salaryAfterMedical),
    allowanceExempt: 0,
    usesAllowanceTaxPolicy: false
  };
};

/**
 * Dynamic tax calculation driven by PayrollTaxes page settings.
 *
 * Monthly taxable =
 *   (gross − medical% of gross) + taxable allowances + arrears
 *
 * Then DOJ / FY annualization (July–June):
 *   annual taxable = monthly taxable × remaining FY months from join
 *   (e.g. DOJ 1 Sep → ×10; hired before FY → ×12)
 *   monthly tax = FBR tax(annual) ÷ those same months
 *
 * Example (sheet): gross 200,000 − 10% + arrears 10,000 = 190,000
 *   DOJ 1 Sep → ×10 = 1,900,000 annual taxable → FBR slab → ÷10 monthly tax
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

  // Step 1: Each allowance gets its own exemption policy from Payroll Taxes
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

  // Step 2–3: (gross − medical% of gross) + taxable allowances + arrears
  const salaryExemptPercent = config.salaryMedicalExemptPercent;
  const salaryExempt = Math.round((gross * salaryExemptPercent) / 100);
  const salaryAfterMedical = gross - salaryExempt;
  const salaryBase = salaryAfterMedical + allowanceTaxable; // without arrears (breakdown)
  const mainTaxableIncome = salaryBase + arrearsAmt; // combined taxable for FBR

  const taxFor = (amount) =>
    hireDate && payrollMonth && payrollYear
      ? calculateMonthlyTaxFYAware(amount, hireDate, payrollMonth, payrollYear)
      : calculateMonthlyTax(amount);

  const totalTax = taxFor(mainTaxableIncome);
  const mainSalary = gross + totalAllowances;
  const totalIncome = mainSalary + arrearsAmt;

  return {
    mainSalary,
    arrears: arrearsAmt,
    mainTaxableIncome: Math.round(mainTaxableIncome),
    // Informational only — already included in mainTaxableIncome; do not add again for totals
    arrearsTaxableIncome: Math.round(arrearsAmt),
    mainTax: Math.round(totalTax),
    arrearsTax: 0,
    totalTax: Math.round(totalTax),
    mainNetSalary: Math.round(mainSalary - totalTax),
    arrearsNetAmount: Math.round(arrearsAmt),
    totalNetSalary: Math.round(totalIncome - totalTax),
    salaryMedicalExempt: salaryExempt,
    salaryAfterMedical: Math.round(salaryAfterMedical),
    salaryBase: Math.round(salaryBase),
    allowanceTaxable: Math.round(allowanceTaxable),
    allowanceExempt: Math.round(allowanceExempt),
    allowanceBreakdown,
    usesAllowanceTaxPolicy: true
  };
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
