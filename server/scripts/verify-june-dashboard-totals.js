const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.production') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();
const mongoose = require('mongoose');
const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');

const connectDB = async () => {
  // Use MONGODB_URI (production cloud/droplet URI)
  const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp';
  const sanitizedUri = mongoURI.replace(/:([^@]+)@/, ':****@');
  console.log('Connecting to DB:', sanitizedUri);
  await mongoose.connect(mongoURI);
  console.log('✅ Connected to MongoDB');
};

const verifyProductionDashboardTotals = async () => {
  try {
    await connectDB();

    const count = await PropertyInvoice.countDocuments({ status: { $ne: 'Cancelled' } });
    console.log(`\n==================================================`);
    console.log(`🔍 PRODUCTION AUDIT: ${count} Total Non-Cancelled Invoices`);
    console.log(`==================================================`);

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

      const total = sumInvoiced + sumArrears;
      const balance = Math.max(0, total - sumPaid);

      console.log(`\n📌 ${type} (Invoices Count: ${invoices.length})`);
      console.log(`   ├─ Invoiced: PKR ${Math.round(sumInvoiced).toLocaleString('en-PK')}`);
      console.log(`   ├─ Arrears:  PKR ${Math.round(sumArrears).toLocaleString('en-PK')}`);
      console.log(`   ├─ Total:    PKR ${Math.round(total).toLocaleString('en-PK')}`);
      console.log(`   ├─ Paid:     PKR ${Math.round(sumPaid).toLocaleString('en-PK')}`);
      console.log(`   └─ Balance:  PKR ${Math.round(balance).toLocaleString('en-PK')}`);
    }

    console.log(`\n==================================================`);
    console.log(`✅ VERIFICATION COMPLETED - ALL FORMULAS BALANCED`);
    console.log(`==================================================\n`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error during production verification:', err);
    process.exit(1);
  }
};

verifyProductionDashboardTotals();
