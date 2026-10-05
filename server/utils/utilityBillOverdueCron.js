/**
 * Daily cron: when a utility / centralized-store bill due date has passed,
 * mark it Overdue and flip linked Finance AP bills to overdue so the payment
 * surfaces in Accounts Payable.
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
      status: { $nin: ['Paid', 'Overdue'] },
      $expr: { $lt: [{ $ifNull: ['$paidAmount', 0] }, { $ifNull: ['$amount', 0] }] }
    }).select('_id billId financeApBillId amount paidAmount status dueDate');

    let utilityMarked = 0;
    let apMarked = 0;

    for (const bill of overdueBills) {
      bill.status = 'Overdue';
      await bill.save();
      utilityMarked += 1;

      if (bill.financeApBillId) {
        const ap = await AccountsPayable.findById(bill.financeApBillId);
        if (ap && (ap.balanceDue || 0) > 0 && !['paid', 'cancelled'].includes(String(ap.status || '').toLowerCase())) {
          if (String(ap.status).toLowerCase() !== 'overdue') {
            ap.status = 'overdue';
            await ap.save();
            apMarked += 1;
          }
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

    if (utilityMarked || apMarked) {
      console.log(
        `[UtilityBillOverdue] marked ${utilityMarked} utility bill(s) and ${apMarked} AP bill(s) overdue`
      );
    }
  } catch (err) {
    console.error('[UtilityBillOverdue] sweep failed:', err.message);
  }
}

function startUtilityBillOverdueCron() {
  cron.schedule('15 1 * * *', runUtilityBillOverdueSweep, { timezone: 'Asia/Karachi' });
  console.log('✅ Utility Bill Overdue Cron started (01:15 AM PKT daily)');
  // Run once shortly after boot so due payments surface without waiting for midnight
  setTimeout(() => {
    runUtilityBillOverdueSweep().catch(() => {});
  }, 20_000);
}

module.exports = {
  startUtilityBillOverdueCron,
  runUtilityBillOverdueSweep
};
