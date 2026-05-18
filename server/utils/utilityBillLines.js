const UtilityStoreItem = require('../models/hr/UtilityStoreItem');
const Account = require('../models/finance/Account');
const Supplier = require('../models/hr/Supplier');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Normalize billLines from request + compute header amount/provider.
 */
const applyBillLinesToPayload = async (billData) => {
  let lines = billData.billLines;
  if (typeof lines === 'string') {
    try {
      lines = JSON.parse(lines);
    } catch {
      lines = [];
    }
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    delete billData.billLines;
    billData.useCentralizedStore = false;
    return billData;
  }

  const normalized = [];
  for (const raw of lines) {
    const amt = round2(raw.amount);
    if (amt <= 0) continue;

    let storeItem = null;
    if (raw.storeItem) {
      storeItem = await UtilityStoreItem.findById(raw.storeItem)
        .populate('expenseAccount', 'accountNumber name');
    }

    let expenseAccount = raw.expenseAccount || storeItem?.expenseAccount?._id || storeItem?.expenseAccount;
    let expenseAccountNumber = raw.expenseAccountNumber || storeItem?.expenseAccount?.accountNumber || '';
    if (expenseAccount && !expenseAccountNumber) {
      const acc = await Account.findById(expenseAccount).select('accountNumber').lean();
      expenseAccountNumber = acc?.accountNumber || '';
    }

    normalized.push({
      storeItem: storeItem?._id || raw.storeItem || null,
      itemName: (raw.itemName || storeItem?.name || 'Item').trim(),
      description: (raw.description || storeItem?.description || '').trim(),
      utilityType: raw.utilityType || storeItem?.utilityType || billData.utilityType || 'Other',
      meterNumber: raw.meterNumber || storeItem?.meterNumber || '',
      location: raw.location || storeItem?.location || '',
      site: raw.site || storeItem?.site || billData.site || '',
      amount: amt,
      expenseAccount: expenseAccount || null,
      expenseAccountNumber
    });
  }

  if (!normalized.length) {
    delete billData.billLines;
    billData.useCentralizedStore = false;
    return billData;
  }

  billData.billLines = normalized;
  billData.useCentralizedStore = true;
  billData.amount = round2(normalized.reduce((s, l) => s + l.amount, 0));
  billData.grandTotal = billData.amount;
  billData.balanceAmount = Math.max(billData.amount - (Number(billData.lastMonthAmount) || 0), 0);

  if (billData.vendorId) {
    const vendor = await Supplier.findById(billData.vendorId).select('name').lean();
    if (vendor?.name) billData.provider = vendor.name;
  }

  if (!billData.utilityType && normalized[0]) {
    billData.utilityType = normalized[0].utilityType;
  }

  return billData;
};

module.exports = { applyBillLinesToPayload, round2 };
