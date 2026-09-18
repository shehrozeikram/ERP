const mongoose = require('mongoose');
const AccountsPayable = require('./server/models/finance/AccountsPayable');
const ApPaymentApplication = require('./server/models/finance/ApPaymentApplication');
const FinanceHelper = require('./server/utils/financeHelper');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sgc_erp').then(async () => {
  console.log('Connected');
  
  // 1. Create a dummy bill
  const bill = new AccountsPayable({
    billNumber: 'TEST-BILL-1',
    vendor: { vendorId: new mongoose.Types.ObjectId(), name: 'Test Vendor' },
    billDate: new Date(),
    dueDate: new Date(),
    totalAmount: 1000,
    amountPaid: 0,
    paymentPending: 1000,
    status: 'approved',
    approval: { required: true, approvedBy: new mongoose.Types.ObjectId() }
  });
  await bill.save();
  
  console.log('Bill after create:', bill.paymentPending, bill.outstandingAmount, bill.status);
  
  // 2. Simulate deletion logic
  const amountToRemove = 500;
  bill.paymentPending = Math.round((Number(bill.paymentPending || 0) - amountToRemove) * 100) / 100;
  if (bill.paymentPending < 0) bill.paymentPending = 0;
  
  FinanceHelper._updateDocumentStatus(bill);
  await bill.save();
  
  console.log('Bill after delete:', bill.paymentPending, bill.balanceDue, bill.status);
  
  process.exit(0);
}).catch(console.error);
