import { getBillNarrationDisplay } from './documentNarrationDisplay';
import { getCentralizedStoreDocumentTypeLabel } from './centralizedStoreBillKind';

export { getCentralizedStoreDocumentTypeLabel };

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
  if (si && typeof si === 'object' && si.itemCode) return String(si.itemCode).trim();
  if (line?.productCode && String(line.productCode).trim() !== '' && String(line.productCode).trim() !== '—') {
    return String(line.productCode).trim();
  }
  if (line?.code && String(line.code).trim() !== '' && String(line.code).trim() !== '—') {
    return String(line.code).trim();
  }
  const text = [line?.itemName, line?.description, line?.notes].filter(Boolean).join(' ');
  const match = text.match(/\[([A-Za-z0-9_-]+)\]/);
  if (match && match[1]) return match[1].trim();
  return '—';
};

export const getStoreLineDescription = (line) => {
  const name = (line?.itemName || '').trim();
  const desc = (line?.description || '').trim();
  if (name && desc) {
    if (name === desc) return name;
    if (desc.includes(name)) return desc;
    if (name.includes(desc)) return name;
    return `${name} — ${desc}`;
  }
  return name || desc || '—';
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

/** Same company resolution used on AP bill detail + print. */
export const getBillCompany = (bill) => {
  if (!bill) return '—';
  if (bill.companyId && typeof bill.companyId === 'object' && bill.companyId.name) return bill.companyId.name;
  if (bill.customCompany && typeof bill.customCompany === 'string' && bill.customCompany.trim()) {
    return bill.customCompany.trim();
  }
  if (bill.companyName && typeof bill.companyName === 'string' && bill.companyName.trim()) {
    return bill.companyName.trim();
  }
  if (bill.company?.name && typeof bill.company.name === 'string') return bill.company.name;
  if (bill.company && typeof bill.company === 'string' && bill.company.trim()) return bill.company.trim();
  if (Array.isArray(bill.lineItems)) {
    const lineWithComp = bill.lineItems.find(
      (l) => l.company && typeof l.company === 'string' && l.company.trim()
    );
    if (lineWithComp) return lineWithComp.company.trim();
  }
  return '—';
};

export const getBillProject = (bill) => {
  if (!bill) return '—';
  if (bill.project && typeof bill.project === 'string' && bill.project.trim()) return bill.project.trim();
  if (Array.isArray(bill.lineItems)) {
    const lineWithProj = bill.lineItems.find(
      (l) => l.project && typeof l.project === 'string' && l.project.trim()
    );
    if (lineWithProj) return lineWithProj.project.trim();
  }
  return '—';
};

/** Address / location line shown on vendor bill invoice body (detail + print). */
export const getBillInvoiceLocation = (bill) => {
  const company = getBillCompany(bill);
  if (company !== '—') {
    const project = getBillProject(bill);
    return project !== '—' ? `${company} — ${project}` : company;
  }
  const vendorCity =
    typeof bill?.vendor?.address === 'object' ? bill?.vendor?.address?.city : null;
  return vendorCity || bill?.department || 'N/A';
};

/**
 * Amount after Due Date for Finance Vendor Bills.
 * Prefers AP field, then linked Centralized Store / Utility bill.
 */
export const getDuePaymentAmountFromBill = (bill) => {
  if (!bill) return 0;
  const fromAp = Number(bill.duePaymentAmount);
  if (fromAp > 0) return fromAp;
  const src = bill.sourceUtilityBill;
  const fromSrc = Number(src?.duePaymentAmount);
  if (fromSrc > 0) return fromSrc;
  const srcLines = Array.isArray(src?.billLines) ? src.billLines : [];
  const fromSrcLines = srcLines.reduce((s, l) => s + (Number(l.duePaymentAmount) || 0), 0);
  if (fromSrcLines > 0) return fromSrcLines;
  const apLines = Array.isArray(bill.lineItems) ? bill.lineItems : (bill.billLines || []);
  return apLines.reduce((s, l) => s + (Number(l.duePaymentAmount) || 0), 0);
};

/**
 * Payable base for open balance / payment: after due date, use duePaymentAmount when higher.
 * Keeps original totalAmount for display; payment cap switches dynamically.
 */
export const getPayableAmountFromBill = (bill) => {
  const total = Math.round((Number(bill?.totalAmount) || 0) * 100) / 100;
  const duePay = Math.round((Number(getDuePaymentAmountFromBill(bill)) || 0) * 100) / 100;
  if (!(duePay > total + 0.009)) return total;
  const dueRaw = bill?.dueDate;
  if (!dueRaw) return total;
  const due = new Date(dueRaw);
  if (Number.isNaN(due.getTime())) return total;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (due >= startOfToday) return total;
  return duePay;
};

/** Per-line Amount after Due Date (AP line or matching source utility line). */
export const getLineDuePaymentAmount = (bill, line, idx = 0) => {
  const fromLine = Number(line?.duePaymentAmount);
  if (fromLine > 0) return fromLine;
  const srcLine = bill?.sourceUtilityBill?.billLines?.[idx];
  return Number(srcLine?.duePaymentAmount) || 0;
};
