/**
 * Daily cron: when a utility / centralized-store bill due date has passed,
 * mark it Overdue and flag duePaymentAmount as payable (without changing bill.amount).
 * Finance payment/open balance then uses duePaymentAmount dynamically once due date passed.
 * Linked Finance AP bills are flipped to overdue so the payment surfaces.
 * Runs every day at 01:15 AM Asia/Karachi.
 */
const cron = require('node-cron');

async function runUtilityBillOverdueSweep() {
  try {
    const UtilityBill = require('../models/hr/UtilityBill');
    const AccountsPayable = require('../models/finance/AccountsPayable');

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const overdueBills = await UtilityBill.find({
      dueDate: { $lt: startOfToday },
      status: { $nin: ['Paid'] },
      $or: [
        { status: { $ne: 'Overdue' } },
        { duePaymentApplied: { $ne: true }, duePaymentAmount: { $gt: 0 } }
      ],
      $expr: { $lt: [{ $ifNull: ['$paidAmount', 0] }, { $ifNull: ['$amount', 0] }] }
    }).select(
      '_id billId financeApBillId amount paidAmount status dueDate duePaymentAmount duePaymentApplied duePaymentAppliedAt notes'
    );

    let utilityMarked = 0;
    let paymentApplied = 0;
    let apMarked = 0;

    for (const bill of overdueBills) {
      const duePay = Number(bill.duePaymentAmount) || 0;
      // Never mutate bill.amount — only apply scheduled payment flag / notes
      if (duePay > 0 && !bill.duePaymentApplied) {
        bill.duePaymentApplied = true;
        bill.duePaymentAppliedAt = now;
        paymentApplied += 1;
        const marker = `Due payment applied: PKR ${duePay.toLocaleString('en-PK')} (bill amount unchanged: PKR ${Number(bill.amount || 0).toLocaleString('en-PK')})`;
        const notes = String(bill.notes || '');
        if (!notes.includes('Due payment applied:')) {
          bill.notes = notes ? `${notes}\n${marker}` : marker;
        }
      }

      if (bill.status !== 'Paid' && bill.status !== 'Partial') {
        bill.status = 'Overdue';
      }
      await bill.save();
      utilityMarked += 1;

      if (bill.financeApBillId) {
        const ap = await AccountsPayable.findById(bill.financeApBillId);
        if (ap && (ap.balanceDue || 0) > 0 && !['paid', 'cancelled'].includes(String(ap.status || '').toLowerCase())) {
          // Surface for payment; do not rewrite AP totalAmount from utility bill.amount
          if (duePay > 0) {
            const apNotes = String(ap.internalNotes || ap.notes || '');
            const marker = `Utility due payment: PKR ${duePay.toLocaleString('en-PK')}`;
            if (!apNotes.includes('Utility due payment:')) {
              if (ap.internalNotes !== undefined) {
                ap.internalNotes = apNotes ? `${apNotes}\n${marker}` : marker;
              } else {
                ap.notes = apNotes ? `${apNotes}\n${marker}` : marker;
              }
            }
          }
          if (String(ap.status).toLowerCase() !== 'overdue') {
            ap.status = 'overdue';
            apMarked += 1;
          }
          await ap.save();
        }
      }
    }

    // Also catch AP rows (utility_bill / taj_utilities) past due that were never flipped
    const overdueAp = await AccountsPayable.find({
      dueDate: { $lt: startOfToday },
      balanceDue: { $gt: 0 },
      status: { $nin: ['paid', 'cancelled', 'overdue'] },
      $or: [{ referenceType: 'utility_bill' }, { module: 'taj_utilities' }]
    });

    for (const ap of overdueAp) {
      ap.status = 'overdue';
      await ap.save();
      apMarked += 1;
    }

    if (utilityMarked || apMarked || paymentApplied) {
      console.log(
        `[UtilityBillOverdue] marked ${utilityMarked} utility bill(s), applied ${paymentApplied} due payment(s), ${apMarked} AP overdue`
      );
    }
  } catch (err) {
    console.error('[UtilityBillOverdue] sweep failed:', err.message);
  }
}

function startUtilityBillOverdueCron() {
  cron.schedule('15 1 * * *', runUtilityBillOverdueSweep, { timezone: 'Asia/Karachi' });
  console.log('✅ Utility Bill Overdue Cron started (01:15 AM PKT daily)');
  setTimeout(() => {
    runUtilityBillOverdueSweep().catch(() => {});
  }, 20_000);
}

module.exports = {
  startUtilityBillOverdueCron,
  runUtilityBillOverdueSweep
};
