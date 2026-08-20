import { getBillNarrationDisplay } from './documentNarrationDisplay';

/** Shared formatters and line helpers for centralized store bills (detail + audit workflow). */

export const displayBillValue = (v) =>
  (v != null && String(v).trim() !== '' ? String(v).trim() : '—');

export const formatInvoiceDateDmy = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export const formatInvoiceTime12h = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export const formatDecimalPk = (amount) =>
  new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(amount) || 0
  );

export const isCentralizedStoreBill = (bill) =>
  Boolean(bill?.useCentralizedStore && Array.isArray(bill?.billLines) && bill.billLines.length > 0);

export const getStoreInvoiceOrgTitle = (bill) =>
  (
    displayBillValue(bill?.site) ||
    displayBillValue(bill?.accountHead) ||
    displayBillValue(bill?.provider) ||
    'Bill'
  ).trim();

export const getVendorSupplierLine = (bill) => {
  const v = bill?.vendorId;
  if (v && typeof v === 'object') {
    const sid =
      v.supplierId != null && String(v.supplierId).trim() !== '' ? `${String(v.supplierId).trim()} ` : '';
    return `${sid}${v.name || ''}`.trim() || displayBillValue(bill?.provider);
  }
  return displayBillValue(bill?.provider);
};

export const getStoreLineProductCode = (line) => {
  const snap = displayBillValue(line?.itemCode);
  if (snap !== '—') return snap;
  const si = line?.storeItem;
  if (si && typeof si === 'object' && si.code) return String(si.code).trim();
  return '—';
};

export const getStoreLineDescription = (line) => {
  const parts = [line?.itemName, line?.description].filter(Boolean);
  return parts.join(' — ') || '—';
};

export const isChartOfAccountsBill = (bill) => {
  if (bill?.referenceType === 'utility_bill' || bill?.module === 'taj_utilities') return false;
  if (bill?.useCentralizedStore) return false;
  if (bill?.referenceType === 'manual' || bill?.module === 'finance') return true;
  const lines = bill?.billLines || bill?.lineItems || [];
  return lines.some((l) => l?.account || l?.accountNumber || l?.category);
};

export const getStoreLineCategoryOrCode = (line, isCoaBill) => {
  if (isCoaBill) {
    if (line?.category && String(line.category).trim() !== '' && String(line.category).trim() !== '—') {
      return String(line.category).trim();
    }
    if (line?.accountName && String(line.accountName).trim() !== '') {
      const num = line.accountNumber ? ` (${String(line.accountNumber).trim()})` : '';
      return `${String(line.accountName).trim()}${num}`;
    }
    if (line?.account && typeof line.account === 'object' && line.account.name) {
      const num = line.account.accountNumber ? ` (${String(line.account.accountNumber).trim()})` : '';
      return `${String(line.account.name).trim()}${num}`;
    }
    if (line?.accountNumber && String(line.accountNumber).trim() !== '') {
      return `Account ${String(line.accountNumber).trim()}`;
    }
    if (line?.categoryName && String(line.categoryName).trim() !== '') {
      return String(line.categoryName).trim();
    }
    if (line?.itemCode && String(line.itemCode).trim() !== '—') {
      return String(line.itemCode).trim();
    }
    return '—';
  }
  return getStoreLineProductCode(line);
};

export const getStoreInvoiceNarration = (bill) => getBillNarrationDisplay(bill);

export const getStoreInvoiceLinesTotal = (bill) =>
  (bill?.billLines || []).reduce((s, l) => s + (Number(l?.amount) || 0), 0) || Number(bill?.amount) || 0;
