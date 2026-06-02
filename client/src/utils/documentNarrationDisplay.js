/**
 * Narration / description text for list tables (AP, utility bills, cash approvals).
 */

export const getBillNarrationDisplay = (bill) => {
  const notes = String(bill?.notes || '').trim();
  if (notes) return notes;

  const forWhat = String(bill?.forWhat || '').trim();
  if (forWhat) return forWhat;

  const description = String(bill?.description || '').trim();
  if (description) return description;

  const billLines = Array.isArray(bill?.billLines) ? bill.billLines : [];
  if (billLines.length) {
    const lineTexts = billLines
      .map((line) => {
        const parts = [line?.description, line?.itemName].filter((x) => String(x || '').trim());
        return parts.map((x) => String(x).trim()).join(' — ');
      })
      .filter(Boolean);
    if (lineTexts.length === 1) return lineTexts[0];
    if (lineTexts.length > 1) return lineTexts.join('; ');
  }

  const lineItems = Array.isArray(bill?.lineItems) ? bill.lineItems : [];
  const itemDescs = lineItems
    .map((li) => String(li?.description || '').trim())
    .filter(Boolean);
  if (itemDescs.length === 1) return itemDescs[0];
  if (itemDescs.length > 1) return itemDescs.join('; ');

  const fallback = String(bill?.internalNotes || '').trim();
  return fallback || '—';
};

export const getCashApprovalNarrationDisplay = (ca) => {
  const purpose = String(ca?.purpose || '').trim();
  if (purpose) return purpose;

  const items = Array.isArray(ca?.items) ? ca.items : [];
  const descs = items
    .map((it) => {
      const d = String(it?.description || it?.itemName || '').trim();
      const spec = String(it?.specification || '').trim();
      if (d && spec && d !== spec) return `${d} — ${spec}`;
      return d || spec;
    })
    .filter(Boolean);
  if (descs.length === 1) return descs[0];
  if (descs.length > 1) return descs.join('; ');
  return '—';
};
