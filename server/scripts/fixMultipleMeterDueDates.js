const mongoose = require('mongoose');
require('dotenv').config();
const dayjs = require('dayjs');

const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');
const Electricity = require('../models/tajResidencia/Electricity');

async function fixMultipleMeterDueDates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database');

    // Find all invoices with multiple meters (invoice numbers containing "-M" pattern like "-M1", "-M2", etc.)
    const multipleMeterInvoices = await PropertyInvoice.find({
      invoiceNumber: { $regex: /-M\d+$/ },
      chargeTypes: { $in: ['ELECTRICITY'] },
      periodTo: { $exists: true, $ne: null }
    }).lean();

    console.log(`📋 Found ${multipleMeterInvoices.length} invoices with multiple meters`);

    let updatedInvoices = 0;
    for (const invoice of multipleMeterInvoices) {
      if (invoice.periodTo) {
        const periodToDate = new Date(invoice.periodTo);
        const correctDueDate = dayjs(periodToDate).add(15, 'day').toDate();
        const currentDueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;

        // Only update if dueDate is not already 15 days after periodTo (with 1 day tolerance)
        const daysDifference = currentDueDate 
          ? Math.abs(dayjs(correctDueDate).diff(dayjs(currentDueDate), 'day'))
          : 999;

        if (daysDifference > 1) {
          await PropertyInvoice.updateOne(
            { _id: invoice._id },
            { $set: { dueDate: correctDueDate } }
          );
          updatedInvoices++;
          console.log(`  ✅ Updated invoice ${invoice.invoiceNumber}: dueDate set to ${correctDueDate.toISOString().split('T')[0]} (was ${currentDueDate ? currentDueDate.toISOString().split('T')[0] : 'null'})`);
        }
      }
    }

    // Find all electricity bills that are referenced by multiple meter invoices
    const electricityBillIds = multipleMeterInvoices
      .map(inv => {
        if (inv.electricityBill) {
          return typeof inv.electricityBill === 'object' ? inv.electricityBill.toString() : inv.electricityBill.toString();
        }
        return null;
      })
      .filter(Boolean);

    const uniqueBillIds = [...new Set(electricityBillIds)];
    
    if (uniqueBillIds.length > 0) {
      const electricityBillsToUpdate = await Electricity.find({
        _id: { $in: uniqueBillIds.map(id => new mongoose.Types.ObjectId(id)) },
        toDate: { $exists: true, $ne: null }
      }).lean();

      console.log(`📋 Found ${electricityBillsToUpdate.length} electricity bills linked to multiple meter invoices`);

      let updatedBills = 0;
      for (const bill of electricityBillsToUpdate) {
        if (bill.toDate) {
          const toDate = new Date(bill.toDate);
          const correctDueDate = dayjs(toDate).add(15, 'day').toDate();
          const currentDueDate = bill.dueDate ? new Date(bill.dueDate) : null;

          // Only update if dueDate is not already 15 days after toDate (with 1 day tolerance)
          const daysDifference = currentDueDate 
            ? Math.abs(dayjs(correctDueDate).diff(dayjs(currentDueDate), 'day'))
            : 999;

          if (daysDifference > 1) {
            await Electricity.updateOne(
              { _id: bill._id },
              { $set: { dueDate: correctDueDate } }
            );
            updatedBills++;
            console.log(`  ✅ Updated electricity bill ${bill.invoiceNumber}: dueDate set to ${correctDueDate.toISOString().split('T')[0]} (was ${currentDueDate ? currentDueDate.toISOString().split('T')[0] : 'null'})`);
          }
        }
      }
      console.log(`\n✅ Summary:`);
      console.log(`  - Updated ${updatedInvoices} invoices`);
      console.log(`  - Updated ${updatedBills} electricity bills`);
    } else {
      console.log(`\n✅ Summary:`);
      console.log(`  - Updated ${updatedInvoices} invoices`);
      console.log(`  - No electricity bills found to update`);
    }

    console.log(`\n✅ Fix completed successfully!`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing due dates:', error);
    process.exit(1);
  }
}

fixMultipleMeterDueDates();
