/**
 * Delete January 2026 RENT invoices for Rental Management properties.
 * Uses database directly - no API auth required.
 *
 * Run: node server/scripts/delete-rental-invoices-jan-2026.js
 */

require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');
require('../models/tajResidencia/TajProperty'); // Register for populate

const MONTH = parseInt(process.env.MONTH || '1', 10);
const YEAR = parseInt(process.env.YEAR || '2026', 10);
const lastDay = new Date(YEAR, MONTH, 0).getDate();
const PERIOD_FROM_STR = `${YEAR}-${String(MONTH).padStart(2, '0')}-01`;
const PERIOD_TO_STR = `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

async function deleteRentalInvoices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    console.log(`\n🔍 Searching for RENT invoices: January ${YEAR}`);
    console.log(`   Period: ${PERIOD_FROM_STR} to ${PERIOD_TO_STR}\n`);

    const periodFromStart = new Date(PERIOD_FROM_STR);
    const periodFromEnd = new Date(PERIOD_FROM_STR);
    periodFromEnd.setDate(periodFromEnd.getDate() + 1);
    const periodToStart = new Date(PERIOD_TO_STR);
    const periodToEnd = new Date(PERIOD_TO_STR);
    periodToEnd.setDate(periodToEnd.getDate() + 1);

    const invoices = await PropertyInvoice.find({
      chargeTypes: { $in: ['RENT'] },
      periodFrom: { $gte: periodFromStart, $lt: periodFromEnd },
      periodTo: { $gte: periodToStart, $lt: periodToEnd }
    })
      .populate('property', 'propertyName plotNumber')
      .sort({ invoiceNumber: 1 });

    if (invoices.length === 0) {
      console.log('⚠️  No January 2026 RENT invoices found.');
      process.exit(0);
    }

    console.log(`📋 Found ${invoices.length} invoice(s) to delete:\n`);
    invoices.forEach((inv, i) => {
      const propName = inv.property?.propertyName || inv.property?.plotNumber || inv.property?._id || 'N/A';
      const periodFrom = inv.periodFrom ? new Date(inv.periodFrom).toISOString().split('T')[0] : 'N/A';
      const periodTo = inv.periodTo ? new Date(inv.periodTo).toISOString().split('T')[0] : 'N/A';
      console.log(`   ${i + 1}. ${inv.invoiceNumber} | ${propName} | ${periodFrom} - ${periodTo}`);
    });

    console.log(`\n⚠️  WARNING: This will delete ${invoices.length} invoice(s)!`);
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
    await new Promise((r) => setTimeout(r, 5000));

    let deleted = 0;
    for (const inv of invoices) {
      await PropertyInvoice.findByIdAndDelete(inv._id);
      deleted++;
      const propName = inv.property?.propertyName || inv.property?.plotNumber || inv._id;
      console.log(`   ✅ Deleted: ${inv.invoiceNumber} (${propName}) - ${deleted}/${invoices.length}`);
    }

    console.log(`\n✅ Deleted ${deleted} January 2026 RENT invoice(s).\n`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  }
}

deleteRentalInvoices();
