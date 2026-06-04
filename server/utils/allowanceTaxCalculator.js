const { calculateMonthlyTax } = require('./taxCalculator');
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

/** Legacy: 10% medical exemption on gross + all allowances combined. */
const calculateTaxLegacy = (mainSalary, arrears = 0) => {
  const mainTaxableIncome = mainSalary - mainSalary * 0.1;
  const mainTax = calculateMonthlyTax(mainTaxableIncome);
  const arrearsTax = arrears > 0 ? calculateMonthlyTax(arrears) : 0;
  const totalTax = mainTax + arrearsTax;
  const mainNetSalary = mainSalary - mainTax;
  const arrearsNetAmount = arrears - arrearsTax;

  return {
    mainSalary,
    arrears,
    mainTaxableIncome: Math.round(mainTaxableIncome),
    arrearsTaxableIncome: Math.round(arrears),
    mainTax: Math.round(mainTax),
    arrearsTax: Math.round(arrearsTax),
    totalTax: Math.round(totalTax),
    mainNetSalary: Math.round(mainNetSalary),
    arrearsNetAmount: Math.round(arrearsNetAmount),
    totalNetSalary: Math.round(mainNetSalary + arrearsNetAmount),
    salaryMedicalExempt: Math.round(mainSalary * 0.1),
    allowanceTaxable: Math.round(mainSalary),
    allowanceExempt: 0,
    usesAllowanceTaxPolicy: false
  };
};

/**
 * Salary: salaryMedicalExemptPercent on gross only.
 * Allowances: per-type policy when employee is in scope.
 */
const calculatePayrollTaxWithSettings = ({
  grossSalary = 0,
  allowances = {},
  arrears = 0,
  employeeId = null,
  settings = null
}) => {
  const config = normalizeSettings(settings);
  const gross = Math.max(0, Number(grossSalary) || 0);
  const arrearsAmt = Math.max(0, Number(arrears) || 0);
  const totalAllowances = additionalAllowancesTotal(allowances);

  if (!employeeUsesAllowanceTaxPolicy(employeeId, config)) {
    return calculateTaxLegacy(gross + totalAllowances, arrearsAmt);
  }

  const salaryExemptPercent = config.salaryMedicalExemptPercent;
  const salaryExempt = Math.round((gross * salaryExemptPercent) / 100);
  const salaryTaxable = gross - salaryExempt;

  let allowanceTaxable = 0;
  let allowanceExempt = 0;
  const allowanceBreakdown = {};

  ALLOWANCE_TAX_KEYS.forEach((key) => {
    const amount = activeAmount(allowances?.[key]);
    const parts = taxableAndExemptPartsForAllowance(
      amount,
      config.allowancePolicies[key]
    );
    allowanceTaxable += parts.taxable;
    allowanceExempt += parts.exempt;
    allowanceBreakdown[key] = {
      amount,
      ...parts,
      mode: config.allowancePolicies[key]?.mode || 'taxable'
    };
  });

  const mainTaxableIncome = salaryTaxable + allowanceTaxable;
  const mainTax = calculateMonthlyTax(mainTaxableIncome);
  const arrearsTax = arrearsAmt > 0 ? calculateMonthlyTax(arrearsAmt) : 0;
  const totalTax = mainTax + arrearsTax;

  const mainSalary = gross + totalAllowances;
  const mainNetSalary = mainSalary - mainTax;
  const arrearsNetAmount = arrearsAmt - arrearsTax;

  return {
    mainSalary,
    arrears: arrearsAmt,
    mainTaxableIncome: Math.round(mainTaxableIncome),
    arrearsTaxableIncome: Math.round(arrearsAmt),
    mainTax: Math.round(mainTax),
    arrearsTax: Math.round(arrearsTax),
    totalTax: Math.round(totalTax),
    mainNetSalary: Math.round(mainNetSalary),
    arrearsNetAmount: Math.round(arrearsNetAmount),
    totalNetSalary: Math.round(mainNetSalary + arrearsNetAmount),
    salaryMedicalExempt: salaryExempt,
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
