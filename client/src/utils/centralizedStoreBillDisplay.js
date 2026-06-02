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

export const getStoreInvoiceNarration = (bill) =>
  displayBillValue(bill?.notes) || displayBillValue(bill?.forWhat) || '—';

export const getStoreInvoiceLinesTotal = (bill) =>
  (bill?.billLines || []).reduce((s, l) => s + (Number(l?.amount) || 0), 0) || Number(bill?.amount) || 0;
