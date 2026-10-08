/**
 * Centralized Store bill kind: regular "Bills" vs "Utility Bills".
 * Utility = electricity / gas / water / internet / phone meter-style charges.
 */

const UTILITY_BILL_TYPES = [
  'Electricity',
  'Water',
  'Gas',
  'Internet',
  'Phone'
];

/** Exact / known utility category titles (normalized). */
const UTILITY_CATEGORY_EXACT = new Set([
  'electricity',
  'gas',
  'water',
  'internet',
  'phone',
  'iesco',
  'sngpl',
  'cda water',
  'ptcl',
  'nayatel',
  'ptcl-nayatel',
  'ptcl nayatel',
  'utilities',
  'utilities charges',
  'utility charges',
  'internet / broadband',
  'internet/broadband'
]);

/**
 * Expense categories that contain utility-ish words but are regular bill lines
 * (e.g. bottled drinking water, electrical repairs).
 */
const NON_UTILITY_CATEGORY_EXCEPTIONS = [
  'drinking water',
  'r&m - electrical',
  'r&m electrical',
  'electrical'
];

const normalize = (value) => String(value || '').trim().toLowerCase();

const isUtilityBillType = (utilityType) =>
  UTILITY_BILL_TYPES.some((t) => normalize(t) === normalize(utilityType));

const isUtilityCategoryName = (categoryName = '') => {
  const n = normalize(categoryName);
  if (!n) return false;

  if (NON_UTILITY_CATEGORY_EXCEPTIONS.some((ex) => n === ex || n.includes(ex))) {
    return false;
  }

  if (UTILITY_CATEGORY_EXACT.has(n)) return true;

  if (
    n.includes('iesco')
    || n.includes('sngpl')
    || n.includes('nayatel')
    || n.includes('electricity')
    || n.includes('utilities charge')
    || n.includes('utility charge')
  ) {
    return true;
  }
  if (/\bptcl\b/.test(n)) return true;

  return /\b(gas|water|internet|phone|telecom)\b/.test(n)
    && !n.includes('drinking');
};

const lineLooksUtility = (line = {}) => {
  if (isUtilityBillType(line.utilityType)) return true;
  if (isUtilityCategoryName(line.categoryName)) return true;
  const storeCat = line.storeItem?.category;
  if (storeCat && typeof storeCat === 'object' && isUtilityCategoryName(storeCat.name)) return true;
  return false;
};

/**
 * Classify a centralized-store bill as utility or regular.
 * Uses header utilityType and line items / categories.
 */
const isCentralizedUtilityBill = (bill = {}) => {
  if (isUtilityBillType(bill.utilityType) && bill.utilityType !== 'Other') {
    const lines = Array.isArray(bill.billLines) ? bill.billLines : [];
    if (!lines.length) return true;
  }
  const lines = Array.isArray(bill.billLines) ? bill.billLines : [];
  if (!lines.length) {
    return isUtilityBillType(bill.utilityType) && !['Other', 'Maintenance', 'Security', 'Cleaning'].includes(
      String(bill.utilityType || '')
    );
  }
  return lines.some(lineLooksUtility);
};

/**
 * Validate that all lines are the same kind (all utility OR all non-utility).
 * @returns {{ ok: boolean, kind: 'utility'|'bill'|null, message?: string }}
 */
const validateBillLinesSameKind = (lines = []) => {
  const rows = Array.isArray(lines) ? lines.filter(Boolean) : [];
  if (!rows.length) return { ok: true, kind: null };

  let sawUtility = false;
  let sawRegular = false;
  rows.forEach((line) => {
    if (lineLooksUtility(line)) sawUtility = true;
    else sawRegular = true;
  });

  if (sawUtility && sawRegular) {
    return {
      ok: false,
      kind: null,
      message:
        'Cannot mix Utility bill items (Electricity, Gas, Water, Internet, Phone) with other bill categories on the same bill.'
    };
  }

  return { ok: true, kind: sawUtility ? 'utility' : 'bill' };
};

const categoryMatchesBillKind = (categoryName, kind) => {
  if (!kind) return true;
  const isUtil = isUtilityCategoryName(categoryName);
  return kind === 'utility' ? isUtil : !isUtil;
};

const storeItemMatchesBillKind = (storeItem, kind) => {
  if (!kind || !storeItem) return true;
  if (isUtilityBillType(storeItem.utilityType) && !['Other', 'Maintenance', 'Security', 'Cleaning'].includes(
    String(storeItem.utilityType || '')
  )) {
    return kind === 'utility';
  }
  const catName = storeItem.category?.name || '';
  return categoryMatchesBillKind(catName, kind);
};

module.exports = {
  UTILITY_BILL_TYPES,
  isUtilityBillType,
  isUtilityCategoryName,
  lineLooksUtility,
  isCentralizedUtilityBill,
  validateBillLinesSameKind,
  categoryMatchesBillKind,
  storeItemMatchesBillKind
};
