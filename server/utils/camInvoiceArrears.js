const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');

const GRACE_PERIOD_DAYS = 6;

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Payable amount to carry from one invoice into the next CAM bill.
 * Mirrors calculateOverdueArrears for a single prior invoice.
 */
const getCamCarryForwardFromPrevious = (previousInvoice, asOfDate = new Date()) => {
  if (!previousInvoice) return 0;

  const filterTypes = ['CAM'];
  const baseChargesTotal = (previousInvoice.charges || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
    || Number(previousInvoice.subtotal || 0);
  const baseBalance = Math.max(0, Number(previousInvoice.balance ?? 0));
  if (baseBalance <= 0) {
    const fallback = Math.max(0, Number(previousInvoice.grandTotal || 0) - Number(previousInvoice.totalPaid || 0));
    if (fallback <= 0) return 0;
  }

  const payableBase = baseBalance > 0
    ? baseBalance
    : Math.max(0, Number(previousInvoice.grandTotal || 0) - Number(previousInvoice.totalPaid || 0));
  if (payableBase <= 0) return 0;

  const todayStart = new Date(asOfDate);
  todayStart.setHours(0, 0, 0, 0);
  const dueStart = previousInvoice.dueDate ? new Date(previousInvoice.dueDate) : null;
  if (dueStart) dueStart.setHours(0, 0, 0, 0);
  const dueWithGrace = dueStart ? new Date(dueStart) : null;
  if (dueWithGrace) dueWithGrace.setDate(dueWithGrace.getDate() + GRACE_PERIOD_DAYS);
  const isOverdue = !!(dueWithGrace && todayStart > dueWithGrace);

  let overdueAmount = payableBase;
  if (isOverdue) {
    const lateSurcharge = Math.max(Math.round(baseChargesTotal * 0.1), 0);
    const originalGrandTotal = Number(previousInvoice.subtotal || 0) + Number(previousInvoice.totalArrears || 0);
    const grandTotal = Number(previousInvoice.grandTotal || 0);
    const surchargeAlreadyIncluded = grandTotal > originalGrandTotal;
    overdueAmount = surchargeAlreadyIncluded ? payableBase : payableBase + lateSurcharge;
  }

  const baseForTypes = (previousInvoice.charges || [])
    .filter((c) => filterTypes.includes(String(c.type || '').toUpperCase()))
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const proportion = baseChargesTotal > 0 ? baseForTypes / baseChargesTotal : 1;

  return round2(overdueAmount * proportion);
};

/**
 * Outstanding CAM balance for display (latest unpaid CAM invoice by billing period).
 */
const getLatestUnpaidCamBalance = (invoices = []) => {
  const unpaid = (invoices || []).filter((inv) => {
    if (!inv.chargeTypes?.includes('CAM')) return false;
    if (inv.status === 'Cancelled') return false;
    if (!['unpaid', 'partial_paid'].includes(inv.paymentStatus)) return false;
    return (Number(inv.balance) || 0) > 0;
  });
  if (!unpaid.length) return 0;
  unpaid.sort((a, b) => {
    const ap = a.periodTo ? new Date(a.periodTo).getTime() : 0;
    const bp = b.periodTo ? new Date(b.periodTo).getTime() : 0;
    if (bp !== ap) return bp - ap;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  const latest = unpaid[0];
  const hasOnlyCam = latest.chargeTypes?.length === 1 && latest.chargeTypes[0] === 'CAM';
  if (hasOnlyCam) return round2(latest.balance || 0);
  const camCharges = (latest.charges || []).filter((c) => c.type === 'CAM');
  const camTotal = camCharges.reduce((s, c) => s + (Number(c.amount) || 0) + (Number(c.arrears) || 0), 0);
  const invoiceTotal = Number(latest.grandTotal) || 0;
  if (invoiceTotal <= 0) return 0;
  return round2((Number(latest.balance) || 0) * (camTotal / invoiceTotal));
};

/**
 * Rebuild CAM invoice arrears chain in billing-period order (CAM-only invoices).
 */
const repairCamInvoiceChain = async (propertyId, options = {}) => {
  const { fromInvoiceNumber, dryRun = false } = options;
  if (!propertyId) return { updated: [], skipped: [], dryRun };

  const invoices = await PropertyInvoice.find({
    property: propertyId,
    chargeTypes: { $in: ['CAM'] },
    status: { $ne: 'Cancelled' }
  })
    .sort({ periodTo: 1, createdAt: 1 })
    .select('invoiceNumber invoiceDate createdAt periodFrom periodTo dueDate chargeTypes charges subtotal totalArrears grandTotal totalPaid balance paymentStatus status');

  if (invoices.length < 2) {
    return { updated: [], skipped: invoices.map((i) => i.invoiceNumber), message: 'Fewer than 2 CAM invoices', dryRun };
  }

  let startIndex = 1;
  if (fromInvoiceNumber) {
    const idx = invoices.findIndex((i) => i.invoiceNumber === fromInvoiceNumber);
    if (idx > 0) startIndex = idx;
  }

  const updated = [];
  const skipped = [];
  const chain = invoices.map((i) => i.toObject());

  for (let i = startIndex; i < chain.length; i++) {
    const previous = chain[i - 1];
    const current = chain[i];

    if (!['unpaid', 'partial_paid'].includes(current.paymentStatus)) {
      skipped.push(current.invoiceNumber);
      continue;
    }

    // Chain repair: arrears = previous invoice balance (matches Dec→Jan→Feb pattern).
    const carryForward = round2(
      Math.max(0, Number(previous.balance ?? 0))
        || Math.max(0, Number(previous.grandTotal || 0) - Number(previous.totalPaid || 0))
    );

    const updatedCharges = (current.charges || []).map((ch) => {
      if (String(ch.type || '').toUpperCase() !== 'CAM') return ch;
      const amount = Number(ch.amount) || 0;
      return {
        ...ch,
        arrears: carryForward,
        total: round2(amount + carryForward)
      };
    });

    const subtotal = round2(updatedCharges.reduce((sum, ch) => sum + (Number(ch.amount) || 0), 0));
    const totalArrears = round2(updatedCharges.reduce((sum, ch) => sum + (Number(ch.arrears) || 0), 0));
    const grandTotal = round2(subtotal + totalArrears);

    const oldArrears = (current.charges || [])
      .filter((c) => String(c.type || '').toUpperCase() === 'CAM')
      .reduce((s, c) => s + (Number(c.arrears) || 0), 0);

    if (Math.abs(oldArrears - carryForward) < 0.01 && Math.abs((current.grandTotal || 0) - grandTotal) < 0.01) {
      skipped.push(current.invoiceNumber);
      chain[i] = { ...current, charges: updatedCharges, subtotal, totalArrears, grandTotal };
      continue;
    }

    if (!dryRun) {
      const doc = await PropertyInvoice.findById(current._id);
      if (!doc) continue;
      doc.charges = updatedCharges;
      doc.subtotal = subtotal;
      doc.totalArrears = totalArrears;
      doc.grandTotal = grandTotal;
      await doc.save();
      chain[i] = {
        ...current,
        _id: doc._id,
        charges: doc.charges,
        subtotal: doc.subtotal,
        totalArrears: doc.totalArrears,
        grandTotal: doc.grandTotal,
        balance: doc.balance,
        totalPaid: doc.totalPaid,
        paymentStatus: doc.paymentStatus,
        dueDate: doc.dueDate
      };
    } else {
      chain[i] = {
        ...current,
        charges: updatedCharges,
        subtotal,
        totalArrears,
        grandTotal,
        balance: grandTotal - (current.totalPaid || 0)
      };
    }

    updated.push({
      invoiceNumber: current.invoiceNumber,
      periodTo: current.periodTo,
      previousInvoice: previous.invoiceNumber,
      oldArrears: round2(oldArrears),
      newArrears: carryForward,
      newGrandTotal: chain[i].grandTotal,
      newBalance: chain[i].balance
    });
  }

  return { updated, skipped, dryRun, propertyId: String(propertyId) };
};

module.exports = {
  GRACE_PERIOD_DAYS,
  getCamCarryForwardFromPrevious,
  getLatestUnpaidCamBalance,
  repairCamInvoiceChain
};
