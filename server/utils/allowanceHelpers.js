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

/** Combined vehicle + fuel for totals (falls back to legacy vehicleFuel). */
const vehicleFuelTotal = (allowances) => {
  const a = allowances || {};
  if (hasVehicleOrFuel(a)) {
    return activeAmount(a.vehicle) + activeAmount(a.fuel);
  }
  return activeAmount(a.vehicleFuel);
};

const vehicleAllowanceAmount = (allowances) => {
  const a = allowances || {};
  if (a.vehicle) return activeAmount(a.vehicle);
  if (!hasVehicleOrFuel(a) && a.vehicleFuel?.isActive) return activeAmount(a.vehicleFuel);
  return 0;
};

const fuelAllowanceAmount = (allowances) => activeAmount((allowances || {}).fuel);

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
  const legacyOnly = !hasVehicleOrFuel(a) && a.vehicleFuel?.isActive;
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

module.exports = {
  activeAmount,
  vehicleFuelTotal,
  vehicleAllowanceAmount,
  fuelAllowanceAmount,
  buildAllowancesPayload,
  payrollAllowancesFromEmployee,
  mergePayrollAllowances
};
