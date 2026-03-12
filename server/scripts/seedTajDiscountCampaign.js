/**
 * Seed the "Taj discount on installments" campaign for Recovery.
 * Run: node server/scripts/seedTajDiscountCampaign.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const RecoveryCampaign = require('../models/finance/RecoveryCampaign');

async function run() {
  const uri = process.env.NODE_ENV === 'production'
    ? process.env.MONGODB_URI
    : (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI);

  if (!uri) {
    console.error('❌ No MongoDB URI found in environment variables');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  const name = 'Taj discount on installments';
  const existing = await RecoveryCampaign.findOne({ name });
  if (existing) {
    console.log(`ℹ️  Campaign "${name}" already exists (ID: ${existing._id})`);
  } else {
    const campaign = new RecoveryCampaign({
      name,
      message: `Dear {{customerName}},\n\nWe are pleased to offer you a special discount on installments for Taj. Please contact us at {{mobileNumber}} for more details.\n\nThank you.`,
      isActive: true
    });
    await campaign.save();
    console.log(`✅ Created campaign "${name}" (ID: ${campaign._id})`);
  }

  await mongoose.disconnect();
  console.log('✅ Done');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
