/** @typedef {{ isActive?: boolean, amount?: number }} AllowanceEntry */

const defaultEntry = () => ({ isActive: false, amount: 0 });

/**
 * Active allowance amount (supports legacy number shape).
 * @param {AllowanceEntry|number|null|undefined} entry
 */
const activeAmount = (entry) => {
  if (entry == null) return 0;
  if (typeof entry === 'number') return entry > 0 ? entry : 0;
  return entry.isActive ? Number(entry.amount) || 0 : 0;
};

const hasVehicleOrFuel = (allowances) => {
  const a = allowances || {};
  return !!(a.vehicle?.isActive || a.fuel?.isActive);
};

/** True when employee uses split vehicle/fuel fields (ignore legacy vehicleFuel). */
const usesSplitVehicleFuelFields = (allowances) => {
  const a = allowances || {};
  return a.vehicle != null || a.fuel != null || hasVehicleOrFuel(a);
};

/** Combined vehicle + fuel for totals (legacy vehicleFuel only if split fields absent). */
const vehicleFuelTotal = (allowances) => {
  const a = allowances || {};
  if (usesSplitVehicleFuelFields(a)) {
    return activeAmount(a.vehicle) + activeAmount(a.fuel);
  }
  return activeAmount(a.vehicleFuel);
};

const vehicleAllowanceAmount = (allowances) => {
  const a = allowances || {};
  if (a.vehicle) return activeAmount(a.vehicle);
  if (!usesSplitVehicleFuelFields(a) && a.vehicleFuel?.isActive) return activeAmount(a.vehicleFuel);
  return 0;
};

const fuelAllowanceAmount = (allowances) => activeAmount((allowances || {}).fuel);

/** Sum active additional allowances (respects isActive on each type). */
const additionalAllowancesTotal = (allowances) => {
  const a = allowances || {};
  return (
    activeAmount(a.conveyance) +
    activeAmount(a.food) +
    vehicleFuelTotal(a) +
    activeAmount(a.medical) +
    activeAmount(a.houseRent) +
    activeAmount(a.special) +
    activeAmount(a.other)
  );
};

/**
 * Normalize allowances for API persistence (clears legacy vehicleFuel).
 * @param {object|null|undefined} src
 */
const buildAllowancesPayload = (src) => {
  if (!src || typeof src !== 'object') return null;
  const parse = (e) => ({
    isActive: !!e?.isActive,
    amount: parseFloat(e?.amount) || 0
  });
  return {
    conveyance: parse(src.conveyance),
    food: parse(src.food),
    vehicle: parse(src.vehicle),
    fuel: parse(src.fuel),
    vehicleFuel: defaultEntry(),
    medical: parse(src.medical),
    houseRent: parse(src.houseRent),
    special: parse(src.special),
    other: parse(src.other)
  };
};

/**
 * Copy employee master allowances into payroll (vehicle + fuel separate).
 * @param {object} employeeAllowances
 */
const payrollAllowancesFromEmployee = (employeeAllowances = {}) => {
  const a = employeeAllowances;
  const pick = (key) => ({
    isActive: a[key]?.isActive || false,
    amount: a[key]?.isActive ? Number(a[key].amount) || 0 : 0
  });
  const vehicleAmt = vehicleAllowanceAmount(a);
  const fuelAmt = fuelAllowanceAmount(a);
  const legacyOnly = !usesSplitVehicleFuelFields(a) && a.vehicleFuel?.isActive;
  return {
    conveyance: pick('conveyance'),
    food: pick('food'),
    vehicle: legacyOnly
      ? { isActive: true, amount: activeAmount(a.vehicleFuel) }
      : { isActive: !!a.vehicle?.isActive, amount: vehicleAmt },
    fuel: legacyOnly ? defaultEntry() : { isActive: !!a.fuel?.isActive, amount: fuelAmt },
    vehicleFuel: defaultEntry(),
    medical: pick('medical'),
    houseRent: pick('houseRent'),
    special: pick('special'),
    other: pick('other')
  };
};

/**
 * Merge monthly payroll allowance overrides with employee master defaults.
 */
const mergePayrollAllowances = (payrollDataAllowances, employeeAllowances = {}) => {
  const master = payrollAllowancesFromEmployee(employeeAllowances);
  if (!payrollDataAllowances) return master;
  const keys = ['conveyance', 'food', 'vehicle', 'fuel', 'medical', 'houseRent', 'special', 'other'];
  const out = { ...master };
  keys.forEach((key) => {
    if (payrollDataAllowances[key] !== undefined) {
      out[key] = {
        isActive: payrollDataAllowances[key]?.isActive ?? master[key]?.isActive ?? false,
        amount:
          payrollDataAllowances[key]?.amount !== undefined
            ? parseFloat(payrollDataAllowances[key].amount) || 0
            : master[key]?.amount || 0
      };
    }
  });
  out.vehicleFuel = defaultEntry();
  return out;
};

/**
 * After employee master allowance changes, refresh draft/approved payroll snapshots.
 * @param {import('mongoose').Document} employee
 */
const syncDraftPayrollsAllowancesFromEmployee = async (employee) => {
  if (!employee?._id) return { updated: 0 };

  const Payroll = require('../models/hr/Payroll');
  const { calculateTaxWithSeparateArrears } = require('./taxCalculator');

  const payrolls = await Payroll.find({
    employee: employee._id,
    status: { $in: ['Draft', 'Approved'] }
  });

  let updated = 0;

  for (const payroll of payrolls) {
    payroll.allowances = payrollAllowancesFromEmployee(employee.allowances);
    payroll.conveyanceAllowance = activeAmount(payroll.allowances.conveyance);
    payroll.foodAllowance = activeAmount(payroll.allowances.food);
    payroll.vehicleAllowance = vehicleAllowanceAmount(payroll.allowances);
    payroll.fuelAllowance = fuelAllowanceAmount(payroll.allowances);
    payroll.vehicleFuelAllowance = vehicleFuelTotal(payroll.allowances);

    const grossBase =
      (payroll.basicSalary || 0) +
      (payroll.houseRentAllowance || 0) +
      (payroll.medicalAllowance || 0);
    const addl = additionalAllowancesTotal(payroll.allowances);
    const arrears = payroll.arrears || 0;

    payroll.totalEarnings =
      grossBase +
      addl +
      (payroll.overtimeAmount || 0) +
      (payroll.performanceBonus || 0) +
      (payroll.otherBonus || 0) +
      arrears;

    const mainSalary = payroll.totalEarnings - arrears;
    const taxCalculation = calculateTaxWithSeparateArrears(mainSalary, arrears);
    payroll.incomeTax = Math.round(taxCalculation.totalTax);
    payroll.eobi = getEmployeeEobiDeduction(employee);

    payroll.totalDeductions =
      (payroll.incomeTax || 0) +
      (payroll.healthInsurance || 0) +
      (payroll.loanDeductions || 0) +
      (payroll.eobi || 0) +
      (payroll.attendanceDeduction || 0) +
      (payroll.leaveDeduction || 0) +
      (payroll.otherDeductions || 0);

    payroll.netSalary = payroll.totalEarnings - payroll.totalDeductions;
    await payroll.save();
    updated += 1;
  }

  return { updated };
};

/**
 * Recalculate income tax on all Draft payrolls after tax settings change.
 * Approved payrolls are not modified.
 */
const syncDraftPayrollsTaxFromSettings = async (settings) => {
  const Payroll = require('../models/hr/Payroll');
  const { calculatePayrollTaxWithSettings, normalizeSettings } = require('./allowanceTaxCalculator');
  const config = normalizeSettings(settings);

  const payrolls = await Payroll.find({ status: 'Draft' });
  let updated = 0;

  for (const payroll of payrolls) {
    const grossSalary =
      payroll.grossSalary ||
      (payroll.basicSalary || 0) +
        (payroll.houseRentAllowance || 0) +
        (payroll.medicalAllowance || 0);
    const arrears = payroll.arrears || 0;
    const employeeId = payroll.employee;

    const taxCalculation = calculatePayrollTaxWithSettings({
      grossSalary,
      allowances: payroll.allowances,
      arrears,
      employeeId,
      settings: config
    });

    payroll.incomeTax = Math.round(taxCalculation.totalTax);
    payroll.taxCalculation = {
      mainTax: taxCalculation.mainTax,
      arrearsTax: taxCalculation.arrearsTax,
      totalTax: taxCalculation.totalTax,
      mainTaxableIncome: taxCalculation.mainTaxableIncome,
      arrearsTaxableIncome: taxCalculation.arrearsTaxableIncome,
      usesAllowanceTaxPolicy: taxCalculation.usesAllowanceTaxPolicy
    };

    payroll.totalDeductions =
      (payroll.incomeTax || 0) +
      (payroll.healthInsurance || 0) +
      (payroll.loanDeductions || 0) +
      (payroll.eobi || 0) +
      (payroll.attendanceDeduction || 0) +
      (payroll.leaveDeduction || 0) +
      (payroll.otherDeductions || 0);

    payroll.netSalary = (payroll.totalEarnings || 0) - payroll.totalDeductions;
    await payroll.save();
    updated += 1;
  }

  return { updated };
};

/** EOBI deduction from employee master (0 when inactive). */
const getEmployeeEobiDeduction = (employee) => {
  if (!employee?.eobi?.isActive) return 0;
  const amount = Number(employee.eobi.amount);
  if (Number.isFinite(amount) && amount >= 0) return Math.round(amount);
  return 370;
};

module.exports = {
  activeAmount,
  usesSplitVehicleFuelFields,
  vehicleFuelTotal,
  vehicleAllowanceAmount,
  fuelAllowanceAmount,
  additionalAllowancesTotal,
  buildAllowancesPayload,
  payrollAllowancesFromEmployee,
  mergePayrollAllowances,
  syncDraftPayrollsAllowancesFromEmployee,
  syncDraftPayrollsTaxFromSettings,
  getEmployeeEobiDeduction
};
