/**
 * Single source of truth for invoice "due date + grace period" business logic.
 * Use this everywhere we display Grand Total / Balance so behaviour is consistent.
 *
 * Rule:
 * - If the full base amount is paid on or before (dueDate + GRACE_PERIOD_DAYS) → "Payable Within Due Date" (no surcharge).
 * - If not, and today is after due+grace → "Payable After Due Date" (base + 10% late surcharge on charges for the month).
 */

export const GRACE_PERIOD_DAYS = 6;

/**
 * Base amount for the invoice (charges for the month + arrears). No surcharge.
 * @param {Object} invoice - Invoice object with charges, subtotal, totalArrears
 * @returns {number}
 */
export function getBaseAmount(invoice) {
  if (!invoice) return 0;
  let chargesForMonth = invoice.subtotal || 0;
  if (invoice.charges && Array.isArray(invoice.charges) && invoice.charges.length > 0) {
    const totalChargesAmount = invoice.charges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
    if (totalChargesAmount > 0) chargesForMonth = totalChargesAmount;
  }
  return chargesForMonth + (invoice.totalArrears || 0);
}

/**
 * Grand total to display: "Payable Within Due Date" or "Payable After Due Date" depending on
 * whether the full base amount was paid within due date + grace period.
 * @param {Object} invoice - Invoice with dueDate, payments (array of { amount, paymentDate }), charges, subtotal, totalArrears
 * @returns {number}
 */
export function getAdjustedGrandTotal(invoice) {
  if (!invoice) return 0;

  const chargesForMonth = (() => {
    let c = invoice.subtotal || 0;
    if (invoice.charges && Array.isArray(invoice.charges) && invoice.charges.length > 0) {
      const sum = invoice.charges.reduce((s, ch) => s + (ch.amount || 0), 0);
      if (sum > 0) c = sum;
    }
    return c;
  })();
  const arrears = (invoice.chargeTypes?.includes('ELECTRICITY') && invoice.effectiveArrears != null)
    ? invoice.effectiveArrears
    : (invoice.totalArrears || 0);
  const baseAmount = chargesForMonth + arrears;

  // IMPORTANT: Business wants late-surcharge behaviour ONLY for Electricity invoices.
  // For CAM, RENT, and other invoice types we just show the stored grandTotal/baseAmount
  // and DO NOT apply any grace-period / surcharge adjustments here.
  const chargeTypes = Array.isArray(invoice.chargeTypes) ? invoice.chargeTypes : [];
  const isElectricityInvoice = chargeTypes.includes('ELECTRICITY');
  if (!isElectricityInvoice) {
    return invoice.grandTotal ?? baseAmount;
  }

  const invoiceDueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  if (!invoiceDueDate) return invoice.grandTotal ?? baseAmount;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dueStart = new Date(invoiceDueDate);
  dueStart.setHours(0, 0, 0, 0);
  const graceEndDate = new Date(dueStart);
  graceEndDate.setDate(graceEndDate.getDate() + GRACE_PERIOD_DAYS);
  const isOverdue = todayStart > graceEndDate;

  let paidWithinGracePeriod = false;
  if (invoice.payments && Array.isArray(invoice.payments) && invoice.payments.length > 0) {
    const paymentsWithinGrace = invoice.payments.filter((p) => {
      if (!p.paymentDate) return false;
      const d = new Date(p.paymentDate);
      d.setHours(0, 0, 0, 0);
      return d <= graceEndDate;
    });
    const totalPaidWithinGrace = paymentsWithinGrace.reduce((sum, p) => sum + (p.amount || 0), 0);
    if (totalPaidWithinGrace >= baseAmount) paidWithinGracePeriod = true;
  }

  if (!isOverdue || paidWithinGracePeriod) return baseAmount;

  const latePaymentSurcharge = Math.max(Math.round(chargesForMonth * 0.1), 0);
  return baseAmount + latePaymentSurcharge;
}

/**
 * Balance to display: max(0, adjustedGrandTotal - totalPaid).
 * @param {Object} invoice
 * @returns {number}
 */
export function getAdjustedBalance(invoice) {
  if (!invoice) return 0;
  const total = getAdjustedGrandTotal(invoice);
  const paid = invoice.totalPaid || 0;
  return Math.max(0, total - paid);
}
