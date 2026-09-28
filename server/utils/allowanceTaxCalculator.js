const {
  calculateMonthlyTaxFYAwareWithOneTimeArrears,
  calculateMonthlyTaxPartialPayAware,
  getFYMonthSequence
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

/**
 * Recurring monthly taxable income after medical % + allowance tax policies.
 * Does NOT include arrears.
 */
const computeRecurringMonthlyTaxable = ({
  grossSalary = 0,
  allowances = {},
  settings = null,
  employeeId = null
}) => {
  const config = normalizeSettings(settings);
  const gross = Math.max(0, Number(grossSalary) || 0);
  const totalAllowances = additionalAllowancesTotal(allowances);

  if (!employeeUsesAllowanceTaxPolicy(employeeId, config)) {
    const main = gross + totalAllowances;
    const salaryExempt = Math.round(main * 0.1);
    return {
      salaryBase: main - salaryExempt,
      salaryExempt,
      salaryAfterMedical: main - salaryExempt,
      allowanceTaxable: main - salaryExempt,
      allowanceExempt: 0,
      allowanceBreakdown: undefined,
      usesAllowanceTaxPolicy: false,
      mainSalary: main
    };
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

  return {
    salaryBase,
    salaryExempt,
    salaryAfterMedical,
    allowanceTaxable,
    allowanceExempt,
    allowanceBreakdown,
    usesAllowanceTaxPolicy: true,
    mainSalary: gross + totalAllowances
  };
};

/** Taxable recurring amount from a stored payroll row (prior months — read only). */
const taxableFromPayrollRecord = (payroll, settings, employeeId) => {
  if (!payroll) return 0;
  const gross = Math.max(0, Number(payroll.grossSalary) || 0);
  const { salaryBase } = computeRecurringMonthlyTaxable({
    grossSalary: gross,
    allowances: payroll.allowances || {},
    settings,
    employeeId
  });
  return Math.max(0, Math.round(salaryBase));
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
  payrollYear,
  priorMonthTaxables = null,
  standardMonthlyTaxable = null
}) => {
  const usePartial =
    Array.isArray(priorMonthTaxables) &&
    standardMonthlyTaxable != null &&
    Number.isFinite(Number(standardMonthlyTaxable));

  const taxParts = usePartial
    ? calculateMonthlyTaxPartialPayAware({
      currentMonthTaxable: salaryBase,
      priorMonthTaxables,
      standardMonthlyTaxable,
      arrears: arrearsAmt,
      hireDate,
      payrollMonth,
      payrollYear
    })
    : calculateMonthlyTaxFYAwareWithOneTimeArrears(
      salaryBase,
      arrearsAmt,
      hireDate,
      payrollMonth,
      payrollYear
    );

  const {
    monthlyTax,
    fyMonths,
    annualTaxableIncome,
    annualTax
  } = taxParts;

  const totalIncome = mainSalary + arrearsAmt;

  return {
    mainSalary,
    arrears: arrearsAmt,
    mainTaxableIncome: Math.round(salaryBase),
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
    usesAllowanceTaxPolicy,
    usedPartialPayMethod: Boolean(usePartial),
    partialPay: usePartial
      ? {
        priorMonthTaxables,
        standardMonthlyTaxable: Math.round(Number(standardMonthlyTaxable) || 0),
        remainingMonths: taxParts.remainingMonths,
        elapsedMonths: taxParts.elapsedMonths,
        actualTaxableSum: taxParts.actualTaxableSum,
        projectedTaxable: taxParts.projectedTaxable
      }
      : undefined
  };
};

/**
 * Legacy: medical exemption on gross+allowances bundle.
 */
const calculateTaxLegacy = (
  mainSalary,
  arrears = 0,
  hireDate = null,
  payrollMonth = null,
  payrollYear = null,
  partialOpts = null
) => {
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
    payrollYear,
    priorMonthTaxables: partialOpts?.priorMonthTaxables,
    standardMonthlyTaxable: partialOpts?.standardMonthlyTaxable
  });
};

/**
 * Dynamic tax calculation driven by PayrollTaxes page settings.
 *
 * When priorMonthTaxables + standardMonthlyTaxable are provided, uses
 * partial-pay annualization (actual past months + project remaining at full rate).
 * Prior payroll months are READ-ONLY inputs.
 */
const calculatePayrollTaxWithSettings = ({
  grossSalary = 0,
  allowances = {},
  arrears = 0,
  employeeId = null,
  settings = null,
  hireDate = null,
  payrollMonth = null,
  payrollYear = null,
  priorMonthTaxables = null,
  standardMonthlyTaxable = null
}) => {
  const config = normalizeSettings(settings);
  const arrearsAmt = Math.max(0, Number(arrears) || 0);
  const recurring = computeRecurringMonthlyTaxable({
    grossSalary,
    allowances,
    settings: config,
    employeeId
  });

  const partialOpts = {
    priorMonthTaxables,
    standardMonthlyTaxable
  };

  if (!recurring.usesAllowanceTaxPolicy) {
    return calculateTaxLegacy(
      recurring.mainSalary,
      arrearsAmt,
      hireDate,
      payrollMonth,
      payrollYear,
      partialOpts
    );
  }

  return buildTaxResult({
    mainSalary: recurring.mainSalary,
    arrearsAmt,
    salaryBase: recurring.salaryBase,
    salaryExempt: recurring.salaryExempt,
    salaryAfterMedical: recurring.salaryAfterMedical,
    allowanceTaxable: recurring.allowanceTaxable,
    allowanceExempt: recurring.allowanceExempt,
    allowanceBreakdown: recurring.allowanceBreakdown,
    usesAllowanceTaxPolicy: true,
    hireDate,
    payrollMonth,
    payrollYear,
    priorMonthTaxables,
    standardMonthlyTaxable
  });
};

/**
 * Load taxable amounts for FY months before the current payroll month.
 * Reads existing payrolls only — never writes.
 */
const loadPriorMonthTaxablesForEmployee = async ({
  employeeId,
  hireDate,
  payrollMonth,
  payrollYear,
  settings
}) => {
  const Payroll = require('../models/hr/Payroll');
  if (!employeeId || !payrollMonth || !payrollYear) return [];

  const seq = getFYMonthSequence(hireDate, payrollMonth, payrollYear);
  const priorKeys = seq.filter(
    (k) => k.year < payrollYear || (k.year === payrollYear && k.month < payrollMonth)
  );
  if (!priorKeys.length) return [];

  const orMonths = priorKeys.map((k) => ({
    year: { $in: [k.year, String(k.year)] },
    month: { $in: [k.month, String(k.month), String(k.month).padStart(2, '0')] }
  }));

  const rows = await Payroll.find({
    employee: employeeId,
    $or: orMonths
  })
    .select('month year grossSalary allowances')
    .lean();

  const byKey = new Map();
  for (const r of rows) {
    byKey.set(`${Number(r.year)}-${Number(r.month)}`, r);
  }

  return priorKeys.map((k) => {
    const row = byKey.get(`${k.year}-${k.month}`);
    return row ? taxableFromPayrollRecord(row, settings, employeeId) : 0;
  });
};

/** Full-rate monthly taxable used to project remaining FY months. */
const computeStandardMonthlyTaxable = ({
  employee,
  settings,
  fallbackGross = 0
}) => {
  const gross =
    Number(employee?.salary?.gross) ||
    Number(fallbackGross) ||
    0;
  const allowances = employee?.allowances || {};
  const { salaryBase } = computeRecurringMonthlyTaxable({
    grossSalary: gross,
    allowances,
    settings,
    employeeId: employee?._id
  });
  return Math.max(0, Math.round(salaryBase));
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
  computeRecurringMonthlyTaxable,
  taxableFromPayrollRecord,
  calculatePayrollTaxWithSettings,
  calculateTaxLegacy,
  loadPriorMonthTaxablesForEmployee,
  computeStandardMonthlyTaxable,
  loadPayrollTaxSettings,
  getFYMonthSequence
};
