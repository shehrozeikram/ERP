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
 * Legacy: 10% medical exemption on (mainSalary + arrears) combined.
 * Allowances are bundled into mainSalary in this path.
 */
const calculateTaxLegacy = (mainSalary, arrears = 0, hireDate = null, payrollMonth = null, payrollYear = null) => {
  // Base salary tax
  const salaryMedicalExempt = Math.round(mainSalary * 0.1);
  const mainTaxableIncome = mainSalary - salaryMedicalExempt;
  const mainTax = calculateMonthlyTax(mainTaxableIncome);

  // Arrears tax (taxed separately)
  const arrearsTaxableIncome = arrears;
  const arrearsTax = calculateMonthlyTax(arrearsTaxableIncome);

  const totalTax = mainTax + arrearsTax;
  const totalIncome = mainSalary + arrears;

  return {
    mainSalary,
    arrears,
    mainTaxableIncome: Math.round(mainTaxableIncome),
    arrearsTaxableIncome: Math.round(arrearsTaxableIncome),
    mainTax: Math.round(mainTax),
    arrearsTax: Math.round(arrearsTax),
    totalTax: Math.round(totalTax),
    mainNetSalary: Math.round(mainSalary - mainTax),
    arrearsNetAmount: Math.round(arrears - arrearsTax),
    totalNetSalary: Math.round(totalIncome - totalTax),
    salaryMedicalExempt,
    allowanceTaxable: Math.round(mainTaxableIncome),
    allowanceExempt: 0,
    usesAllowanceTaxPolicy: false
  };
};

/**
 * Dynamic tax calculation driven by PayrollTaxes page settings.
 *
 * Formula (when conveyance is Fully taxable and medical exempt is 10%):
 *   taxable = (grossSalary + conveyance + other taxable allowances) − 10%
 *   tax     = FBR slab on taxable
 *
 * Steps:
 *   1. Each allowance → taxable / fully_exempt / partial_exempt from Payroll Taxes
 *   2. salaryBase = grossSalary + sum(taxable allowance amounts)
 *   3. Apply salaryMedicalExemptPercent on salaryBase (e.g. 10%)
 *   4. Arrears taxed separately (no medical exempt on arrears)
 *
 * Example: gross=200,000 + conveyance=10,000 (taxable), food exempt
 *   → (210,000 − 21,000) = 189,000 taxable → FBR monthly tax
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

  // Step 2–3: (gross + taxable allowances) − medical%  e.g. (gross + conveyance) − 10%
  const salaryExemptPercent = config.salaryMedicalExemptPercent;
  const salaryBase = gross + allowanceTaxable;
  const salaryExempt = Math.round((salaryBase * salaryExemptPercent) / 100);
  const mainTaxableIncome = salaryBase - salaryExempt;
  const mainTax = calculateMonthlyTax(mainTaxableIncome);

  // Step 4: Arrears tax (separate; no medical exempt)
  const arrearsTaxableIncome = arrearsAmt;
  const arrearsTax = calculateMonthlyTax(arrearsTaxableIncome);

  const totalTax = mainTax + arrearsTax;
  const mainSalary = gross + totalAllowances;
  const totalIncome = mainSalary + arrearsAmt;

  return {
    mainSalary,
    arrears: arrearsAmt,
    mainTaxableIncome: Math.round(mainTaxableIncome),
    arrearsTaxableIncome: Math.round(arrearsTaxableIncome),
    mainTax: Math.round(mainTax),
    arrearsTax: Math.round(arrearsTax),
    totalTax: Math.round(totalTax),
    mainNetSalary: Math.round(mainSalary - mainTax),
    arrearsNetAmount: Math.round(arrearsAmt - arrearsTax),
    totalNetSalary: Math.round(totalIncome - totalTax),
    salaryMedicalExempt: salaryExempt,
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
