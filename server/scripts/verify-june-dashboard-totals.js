require('dotenv').config({ path: './server/.env' });
require('dotenv').config();
const mongoose = require('mongoose');
const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp';
  console.log('Connecting to:', mongoURI);
  await mongoose.connect(mongoURI);
  console.log('✅ Connected to MongoDB');
};

const verifyJune2026Totals = async () => {
  try {
    await connectDB();

    const count = await PropertyInvoice.countDocuments({ status: { $ne: 'Cancelled' } });
    console.log(`🔍 Total non-cancelled invoices in DB: ${count}`);

    const chargeTypes = ['CAM', 'ELECTRICITY', 'WATER', 'RENT'];

    for (const type of chargeTypes) {
      const invoices = await PropertyInvoice.find({
        status: { $ne: 'Cancelled' },
        chargeTypes: { $in: [type] }
      }).lean();

      let sumInvoiced = 0;
      let sumArrears = 0;
      let sumPaid = 0;

      for (const inv of invoices) {
        const chargeObj = inv.charges?.find(c => String(c.type || '').toUpperCase() === type);
        const amount = chargeObj ? (Number(chargeObj.amount) || 0) : (Number(inv.subtotal) || 0);
        const arrears = chargeObj ? (Number(chargeObj.arrears) || 0) : (Number(inv.totalArrears) || 0);

        sumInvoiced += amount;
        sumArrears += arrears;
        sumPaid += Number(inv.totalPaid) || 0;
      }

      console.log(`\n📌 ${type} Invoices Count (${invoices.length}):`);
      console.log(`   Invoiced: PKR ${Math.round(sumInvoiced).toLocaleString('en-PK')}`);
      console.log(`   Arrears:  PKR ${Math.round(sumArrears).toLocaleString('en-PK')}`);
      console.log(`   Total:    PKR ${Math.round(sumInvoiced + sumArrears).toLocaleString('en-PK')}`);
      console.log(`   Paid:     PKR ${Math.round(sumPaid).toLocaleString('en-PK')}`);
      console.log(`   Balance:  PKR ${Math.round((sumInvoiced + sumArrears) - sumPaid).toLocaleString('en-PK')}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error during verification:', err);
    process.exit(1);
  }
};

verifyJune2026Totals();
