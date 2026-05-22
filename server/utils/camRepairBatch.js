const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');

// March 2026 CAM batch with wrong carry-forward (invoice dated Apr 7, 2026+).
const BAD_BATCH_INVOICE_DATE = new Date('2026-04-07T00:00:00.000Z');
const BAD_BATCH_PERIOD_FROM = new Date('2026-03-01T00:00:00.000Z');
const BAD_BATCH_PERIOD_TO = new Date('2026-03-31T23:59:59.999Z');

const findBadBatchCamInvoices = async () => {
  const rows = await PropertyInvoice.find({
    chargeTypes: { $in: ['CAM'] },
    status: { $ne: 'Cancelled' },
    invoiceDate: { $gte: BAD_BATCH_INVOICE_DATE },
    periodFrom: { $gte: BAD_BATCH_PERIOD_FROM, $lte: BAD_BATCH_PERIOD_TO }
  })
    .select('property invoiceNumber')
    .lean();

  const byProperty = new Map();
  rows.forEach((inv) => {
    const pid = String(inv.property);
    if (!byProperty.has(pid)) byProperty.set(pid, inv);
  });
  return [...byProperty.entries()].map(([propertyId, anchorInvoice]) => ({
    propertyId,
    anchorInvoice
  }));
};

/**
 * CAM invoices that repair would touch (from anchor invoice onward, CAM-only).
 */
const getCamInvoicesForRepairScope = async (propertyId, fromInvoiceNumber) => {
  const invoices = await PropertyInvoice.find({
    property: propertyId,
    chargeTypes: { $in: ['CAM'] },
    status: { $ne: 'Cancelled' }
  })
    .sort({ periodTo: 1, createdAt: 1 })
    .lean();

  if (!invoices.length) return [];

  let startIndex = 0;
  if (fromInvoiceNumber) {
    const idx = invoices.findIndex((i) => i.invoiceNumber === fromInvoiceNumber);
    if (idx >= 0) startIndex = idx;
  }

  return invoices.slice(startIndex);
};

module.exports = {
  BAD_BATCH_INVOICE_DATE,
  BAD_BATCH_PERIOD_FROM,
  BAD_BATCH_PERIOD_TO,
  findBadBatchCamInvoices,
  getCamInvoicesForRepairScope
};
