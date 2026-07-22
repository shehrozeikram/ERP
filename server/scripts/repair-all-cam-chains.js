require('dotenv').config();
const mongoose = require('mongoose');
const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');
const { repairCamInvoiceChain } = require('../utils/camInvoiceArrears');

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp';
  await mongoose.connect(mongoURI);
  console.log('✅ Connected to MongoDB');
};

const repairAllProperties = async () => {
  try {
    await connectDB();

    const propertyIds = await PropertyInvoice.distinct('property', {
      chargeTypes: { $in: ['CAM'] },
      status: { $ne: 'Cancelled' }
    });

    console.log(`🔍 Found ${propertyIds.length} properties with CAM invoices.`);

    let totalUpdated = 0;
    for (const propertyId of propertyIds) {
      if (!propertyId) continue;
      const res = await repairCamInvoiceChain(propertyId, { dryRun: false });
      if (res.updated && res.updated.length > 0) {
        totalUpdated += res.updated.length;
        console.log(`✅ Property ${propertyId}: Updated ${res.updated.length} invoice(s) in chain`);
      }
    }

    console.log(`🎉 Migration complete! Total invoices repaired across all properties: ${totalUpdated}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during CAM chain migration:', err);
    process.exit(1);
  }
};

repairAllProperties();
