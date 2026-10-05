/**
 * Centralized Store bill kind: regular "Bills" vs "Utility Bills".
 * Utility = electricity / gas / water / internet / phone / rent style charges.
 */

const UTILITY_BILL_TYPES = [
  'Electricity',
  'Water',
  'Gas',
  'Internet',
  'Phone'
];

const UTILITY_CATEGORY_KEYWORDS = [
  'electric',
  'iesco',
  'gas',
  'sngpl',
  'water',
  'internet',
  'ptcl',
  'nayatel',
  'phone',
  'telecom'
];

const normalize = (value) => String(value || '').trim().toLowerCase();

const isUtilityBillType = (utilityType) =>
  UTILITY_BILL_TYPES.some((t) => normalize(t) === normalize(utilityType));

const isUtilityCategoryName = (categoryName = '') => {
  const n = normalize(categoryName);
  if (!n) return false;
  return UTILITY_CATEGORY_KEYWORDS.some((k) => n === k || n.includes(k));
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
    // Header alone is weak if type was defaulted; prefer lines when present
    const lines = Array.isArray(bill.billLines) ? bill.billLines : [];
    if (!lines.length) return true;
  }
  const lines = Array.isArray(bill.billLines) ? bill.billLines : [];
  if (!lines.length) {
    return isUtilityBillType(bill.utilityType) && !['Other', 'Maintenance', 'Security', 'Cleaning'].includes(
      String(bill.utilityType || '')
    );
  }
  // Bill is utility if ANY line is utility (mixed bills treated as utility for list; create blocks mix)
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
