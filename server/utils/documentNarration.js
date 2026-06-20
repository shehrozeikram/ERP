/**
 * Source-document narration for finance vouchers (journal entry description + line narration).
 * Mirrors client/src/utils/documentNarrationDisplay.js where applicable.
 */

const trim = (value) => String(value ?? '').trim();

const getBillNarration = (bill) => {
  const notes = trim(bill?.notes);
  if (notes) return notes;

  const forWhat = trim(bill?.forWhat);
  if (forWhat) return forWhat;

  const description = trim(bill?.description);
  if (description) return description;

  const billLines = Array.isArray(bill?.billLines) ? bill.billLines : [];
  if (billLines.length) {
    const lineTexts = billLines
      .map((line) => {
        const parts = [line?.description, line?.itemName].filter((x) => trim(x));
        return parts.map((x) => trim(x)).join(' — ');
      })
      .filter(Boolean);
    if (lineTexts.length === 1) return lineTexts[0];
    if (lineTexts.length > 1) return lineTexts.join('; ');
  }

  const lineItems = Array.isArray(bill?.lineItems) ? bill.lineItems : [];
  const itemDescs = lineItems.map((li) => trim(li?.description)).filter(Boolean);
  if (itemDescs.length === 1) return itemDescs[0];
  if (itemDescs.length > 1) return itemDescs.join('; ');

  return trim(bill?.internalNotes) || '';
};

const getCashApprovalNarration = (ca) => {
  const purpose = trim(ca?.purpose);
  if (purpose) return purpose;

  const items = Array.isArray(ca?.items) ? ca.items : [];
  const descs = items
    .map((it) => {
      const d = trim(it?.description || it?.itemName);
      const spec = trim(it?.specification);
      if (d && spec && d !== spec) return `${d} — ${spec}`;
      return d || spec;
    })
    .filter(Boolean);
  if (descs.length === 1) return descs[0];
  if (descs.length > 1) return descs.join('; ');
  return '';
};

const getGrnNarration = (grn) => {
  const narration = trim(grn?.narration);
  if (narration) return narration;
  return trim(grn?.indent?.title) || '';
};

const getSinNarration = (sin) => {
  const requiredFor = trim(sin?.requiredFor);
  if (requiredFor) return requiredFor;
  const justification = trim(sin?.justification);
  if (justification) return justification;
  return trim(sin?.purpose) || '';
};

const getArInvoiceNarration = (invoice) => {
  const notes = trim(invoice?.notes);
  if (notes) return notes;

  const lineItems = Array.isArray(invoice?.lineItems) ? invoice.lineItems : [];
  const descs = lineItems.map((li) => trim(li?.description)).filter(Boolean);
  if (descs.length === 1) return descs[0];
  if (descs.length > 1) return descs.join('; ');
  return '';
};

const getVendorAdvanceNarration = (advance) => trim(advance?.reference) || trim(advance?.notes) || '';

const getPurchaseReturnNarration = (pr) => {
  const notes = trim(pr?.notes);
  if (notes) return notes;
  const reason = trim(pr?.reason);
  if (reason) return reason.replace(/_/g, ' ');
  return '';
};

/** Apply narration to journal payload header and all line descriptions. */
const withVoucherNarration = (payload, narration) => {
  const text = trim(narration);
  if (!text || !payload) return payload;

  const entryDesc = text.slice(0, 500);
  const lineDesc = text.slice(0, 200);
  const next = { ...payload, description: entryDesc };
  if (Array.isArray(next.lines)) {
    next.lines = next.lines.map((line) => ({ ...line, description: lineDesc }));
  }
  return next;
};

module.exports = {
  getBillNarration,
  getCashApprovalNarration,
  getGrnNarration,
  getSinNarration,
  getArInvoiceNarration,
  getVendorAdvanceNarration,
  getPurchaseReturnNarration,
  withVoucherNarration
};
