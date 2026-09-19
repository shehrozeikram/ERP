const mongoose = require('mongoose');

const uri = "mongodb+srv://shehroze:sardar1Sahab@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority";

async function run() {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("Connected to production DB.");
    
    const billsToCheck = ['INT984946', 'REN300255'];
    const apColl = mongoose.connection.collection('accountspayables');
    const appColl = mongoose.connection.collection('appaymentapplications');
    
    for (const billNo of billsToCheck) {
      console.log(`\n--- Checking ${billNo} ---`);
      const bill = await apColl.findOne({ billNumber: billNo });
      if (bill) {
        console.log(`Found ${billNo} in accountspayables:`, {
          _id: bill._id,
          status: bill.status,
          totalAmount: bill.totalAmount,
          amountPaid: bill.amountPaid,
          paymentPending: bill.paymentPending,
          advancePending: bill.advancePending,
          payments: bill.payments,
          balanceDue: bill.balanceDue
        });
        
        const apps = await appColl.find({ 
          $or: [
            { accountsPayableId: bill._id },
            { 'bills.billId': bill._id }
          ]
        }).toArray();
        
        console.log(`Found ${apps.length} ApPaymentApplications for ${billNo}:`);
        apps.forEach(app => {
          console.log({
            _id: app._id,
            amount: app.amount,
            workflowStatus: app.workflowStatus,
            journalEntryId: app.journalEntryId
          });
        });
      } else {
        console.log(`Could not find bill ${billNo} in accountspayables.`);
      }
    }
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
