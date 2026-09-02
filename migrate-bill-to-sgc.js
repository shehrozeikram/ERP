require('dotenv').config();
const mongoose = require('mongoose');

const SGC_COMPANY_ID = new mongoose.Types.ObjectId("6a34d5818f72dc6ab5ef14fc");
const SGC_GENERAL_EXPENSE_ACC = new mongoose.Types.ObjectId("6a4cbcb45af7d0948f77ca85"); // 5001
const SGC_AP_ACC = new mongoose.Types.ObjectId("6a4cbcb45af7d0948f77ca58"); // 2001

const BILL_NUMBER = "OTH050493";
const JE_ENTRY_NUMBER = "BILL-000110";

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    console.log('=== STARTING MIGRATION TO SARDAR GROUP OF COMPANIES ===');

    // 1. Update AccountsPayable
    const apResult = await db.collection('accountspayables').updateOne(
      { billNumber: BILL_NUMBER },
      {
        $set: {
          companyId: SGC_COMPANY_ID,
          company: 'SARDAR GROUP OF COMPANIES',
          'lineItems.0.company': 'SARDAR GROUP OF COMPANIES'
        }
      }
    );
    console.log(`Updated AccountsPayable: matched ${apResult.matchedCount}, modified ${apResult.modifiedCount}`);

    // 2. Update JournalEntry
    const je = await db.collection('journalentries').findOne({ entryNumber: JE_ENTRY_NUMBER });
    if (je) {
      const updatedLines = je.lines.map(line => {
        if (line.debit > 0) {
          return { ...line, account: SGC_GENERAL_EXPENSE_ACC };
        } else {
          return { ...line, account: SGC_AP_ACC };
        }
      });

      const jeResult = await db.collection('journalentries').updateOne(
        { _id: je._id },
        {
          $set: {
            companyId: SGC_COMPANY_ID,
            lines: updatedLines
          }
        }
      );
      console.log(`Updated JournalEntry: matched ${jeResult.matchedCount}, modified ${jeResult.modifiedCount}`);

      // 3. Update GeneralLedger
      const glDebitResult = await db.collection('generalledgers').updateOne(
        { journalEntry: je._id, debit: { $gt: 0 } },
        {
          $set: {
            companyId: SGC_COMPANY_ID,
            account: SGC_GENERAL_EXPENSE_ACC
          }
        }
      );
      console.log(`Updated GeneralLedger (Debit): matched ${glDebitResult.matchedCount}, modified ${glDebitResult.modifiedCount}`);

      const glCreditResult = await db.collection('generalledgers').updateOne(
        { journalEntry: je._id, credit: { $gt: 0 } },
        {
          $set: {
            companyId: SGC_COMPANY_ID,
            account: SGC_AP_ACC
          }
        }
      );
      console.log(`Updated GeneralLedger (Credit): matched ${glCreditResult.matchedCount}, modified ${glCreditResult.modifiedCount}`);
    }

    // 4. Update UtilityBill
    const ubResult = await db.collection('utilitybills').updateOne(
      { billId: BILL_NUMBER },
      {
        $set: {
          companyId: SGC_COMPANY_ID,
          site: 'SARDAR GROUP OF COMPANIES',
          'billLines.0.site': 'SARDAR GROUP OF COMPANIES',
          'billLines.0.expenseAccount': SGC_GENERAL_EXPENSE_ACC
        }
      }
    );
    console.log(`Updated UtilityBill: matched ${ubResult.matchedCount}, modified ${ubResult.modifiedCount}`);

    console.log('\n=== VERIFICATION ===');
    const verifyAP = await db.collection('accountspayables').findOne({ billNumber: BILL_NUMBER });
    console.log('AP companyId:', verifyAP.companyId, 'company:', verifyAP.company);

    const verifyJE = await db.collection('journalentries').findOne({ entryNumber: JE_ENTRY_NUMBER });
    console.log('JE companyId:', verifyJE.companyId, 'lines accounts:', verifyJE.lines.map(l => l.account));

    const verifyGL = await db.collection('generalledgers').find({ journalEntry: je._id }).toArray();
    console.log('GL count:', verifyGL.length, 'companies:', verifyGL.map(g => g.companyId), 'accounts:', verifyGL.map(g => g.account));

    console.log('\n=== SUCCESS: Migration completed cleanly! ===');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();
