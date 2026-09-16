require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const AccountsPayable = require('../models/finance/AccountsPayable');
const ApPaymentApplication = require('../models/finance/ApPaymentApplication');

async function syncBills() {
  try {
    await mongoose.connect(process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI);
    console.log('Connected to DB');

    const bills = await AccountsPayable.find({
      $or: [
        { paymentPending: { $gt: 0 } },
        { amountPaid: { $gt: 0 } }
      ]
    });

    console.log(`Found ${bills.length} bills with paymentPending or amountPaid > 0`);

    let fixedCount = 0;

    for (const bill of bills) {
      // Find all ApPaymentApplications where this bill is referenced
      const apps = await ApPaymentApplication.find({
        $or: [
          { accountsPayableId: bill._id },
          { 'bills.billId': bill._id }
        ]
      });

      if (apps.length === 0) {
        console.log(`Fixing bill ${bill.billNumber} - no vouchers found`);
        bill.paymentPending = 0;
        bill.amountPaid = 0;
        if (bill.status === 'paid' || bill.status === 'partial') {
          bill.status = 'approved';
        }
        bill.payments = [];
        await bill.save();
        fixedCount++;
      } else {
        // Recalculate actual pending/paid to be safe
        let actualPending = 0;
        let actualPaid = 0;

        for (const app of apps) {
          const amountForBill = app.accountsPayableId?.toString() === bill._id.toString() ? app.amount : (app.bills.find(b => b.billId?.toString() === bill._id.toString())?.amount || 0);
          
          if (app.workflowStatus === 'fully_approved') {
            actualPaid += amountForBill;
          } else {
            actualPending += amountForBill;
          }
        }

        if (bill.paymentPending !== actualPending || bill.amountPaid !== actualPaid) {
          console.log(`Syncing amounts for bill ${bill.billNumber}: pending ${bill.paymentPending} -> ${actualPending}, paid ${bill.amountPaid} -> ${actualPaid}`);
          bill.paymentPending = actualPending;
          bill.amountPaid = actualPaid;
          if (bill.amountPaid >= bill.totalAmount) {
            bill.status = 'paid';
          } else if (bill.amountPaid > 0) {
            bill.status = 'partial';
          } else {
             bill.status = 'approved';
          }
          await bill.save();
          fixedCount++;
        }
      }
    }

    console.log(`Finished syncing. Fixed ${fixedCount} bills.`);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

syncBills();
