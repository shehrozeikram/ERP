const fs = require('fs');
if (fs.existsSync('.env')) require('dotenv').config({ path: '.env' });
else if (fs.existsSync('server/.env')) require('dotenv').config({ path: 'server/.env' });
const mongoose = require('mongoose');

async function run() {
  try {
    const uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sgc_erp';
    await mongoose.connect(uri);
    require('./server/models/finance/Account');
    require('./server/models/finance/JournalEntry');
    require('./server/models/finance/GeneralLedger');
    require('./server/models/finance/AccountsPayable');
    const ApPaymentApplication = require('./server/models/finance/ApPaymentApplication');
    const AccountsPayable = require('./server/models/finance/AccountsPayable');
    const JournalEntry = require('./server/models/finance/JournalEntry');

    // Find any AP payment application
    const app = await ApPaymentApplication.findOne().sort({ createdAt: -1 });
    if (!app) { console.log('No AP payment apps'); return; }
    
    console.log('Found App:', app._id, 'status:', app.workflowStatus, 'amount:', app.amount);
    
    if (app.bills && app.bills.length > 0) {
        for (const b of app.bills) {
            const bill = await AccountsPayable.findById(b.billId);
            console.log('Linked bill:', bill.billNumber, 'total:', bill.totalAmount, 'amountPaid:', bill.amountPaid, 'paymentPending:', bill.paymentPending, 'status:', bill.status);
        }
    } else if (app.accountsPayableId) {
        const bill = await AccountsPayable.findById(app.accountsPayableId);
        console.log('Linked bill:', bill?.billNumber, 'total:', bill?.totalAmount, 'amountPaid:', bill?.amountPaid, 'paymentPending:', bill?.paymentPending, 'status:', bill?.status);
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
