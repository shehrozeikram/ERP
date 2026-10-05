/**
 * Centralized Store bill kind: regular "Bills" vs "Utility Bills".
 * Utility = electricity / gas / water / internet / phone / rent style charges.
 */

export const UTILITY_BILL_TYPES = [
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

export const isUtilityBillType = (utilityType) =>
  UTILITY_BILL_TYPES.some((t) => normalize(t) === normalize(utilityType));

export const isUtilityCategoryName = (categoryName = '') => {
  const n = normalize(categoryName);
  if (!n) return false;
  return UTILITY_CATEGORY_KEYWORDS.some((k) => n === k || n.includes(k));
};

export const lineLooksUtility = (line = {}) => {
  if (isUtilityBillType(line.utilityType)) return true;
  if (isUtilityCategoryName(line.categoryName)) return true;
  const storeCat = line.storeItem?.category;
  if (storeCat && typeof storeCat === 'object' && isUtilityCategoryName(storeCat.name)) return true;
  return false;
};

/**
 * Classify a centralized-store bill as utility or regular.
 */
export const isCentralizedUtilityBill = (bill = {}) => {
  const src = bill && typeof bill === 'object' ? bill : {};
  const lines =
    Array.isArray(src.billLines) && src.billLines.length
      ? src.billLines
      : Array.isArray(src.lineItems)
        ? src.lineItems
        : [];
  if (!lines.length) {
    return (
      isUtilityBillType(src.utilityType) &&
      !['Other', 'Maintenance', 'Security', 'Cleaning'].includes(String(src.utilityType || ''))
    );
  }
  return lines.some(lineLooksUtility);
};

/**
 * Validate that all lines are the same kind (all utility OR all non-utility).
 */
export const validateBillLinesSameKind = (lines = []) => {
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

export const categoryMatchesBillKind = (categoryName, kind) => {
  if (!kind) return true;
  const isUtil = isUtilityCategoryName(categoryName);
  return kind === 'utility' ? isUtil : !isUtil;
};

export const storeItemMatchesBillKind = (storeItem, kind) => {
  if (!kind || !storeItem) return true;
  if (
    isUtilityBillType(storeItem.utilityType) &&
    !['Other', 'Maintenance', 'Security', 'Cleaning'].includes(String(storeItem.utilityType || ''))
  ) {
    return kind === 'utility';
  }
  const catName = storeItem.category?.name || '';
  return categoryMatchesBillKind(catName, kind);
};

/** Kind locked by existing lines on the form */
export const getLockedBillKindFromLines = (lines = []) => {
  const result = validateBillLinesSameKind(lines);
  return result.kind;
};

/**
 * Document header subtitle for centralized store bills: "Bill" | "Utility Bill".
 * Accepts UtilityBill docs or AP bills with nested sourceUtilityBill.
 */
export const getCentralizedStoreDocumentTypeLabel = (bill = {}) => {
  if (!bill || typeof bill !== 'object') return 'Bill';
  const source =
    bill.sourceUtilityBill && typeof bill.sourceUtilityBill === 'object'
      ? bill.sourceUtilityBill
      : bill;
  return isCentralizedUtilityBill(source) ? 'Utility Bill' : 'Bill';
};
