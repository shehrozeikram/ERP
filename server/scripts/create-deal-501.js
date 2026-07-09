const mongoose = require('mongoose');
require('dotenv').config();

const LandMoza = require('../models/tajResidencia/LandMoza');
const LandParty = require('../models/tajResidencia/LandParty');
const LandPurchase = require('../models/tajResidencia/LandPurchase');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Get or Create a Dummy Moza
    let moza = await LandMoza.findOne();
    if (!moza) {
      moza = await LandMoza.create({
        name: 'Dummy Moza',
        slug: 'dummy-moza',
        isActive: true
      });
      console.log('Created dummy Moza');
    }

    // 2. Get or Create a Dummy Seller
    let seller = await LandParty.findOne({ partyType: 'seller' });
    if (!seller) {
      seller = await LandParty.create({
        name: 'John Doe Seller',
        partyType: 'seller',
        cnic: '12345-1234567-1',
        phoneNumber: '03001234567',
        isActive: true
      });
      console.log('Created dummy Seller');
    }

    // 3. Delete existing Deal No 501 if it exists
    const existing = await LandPurchase.findOne({ dealNo: 501 });
    if (existing) {
      console.log('Deal No 501 already exists with Purchase No:', existing.purchaseNo);
      
      // Delete associated transfers
      const LandTransfer = require('../models/tajResidencia/LandTransfer');
      await LandTransfer.deleteMany({ landPurchase: existing._id });
      console.log('Deleted associated Land Transfers');

      // Delete the purchase
      await LandPurchase.deleteOne({ _id: existing._id });
      console.log('Deleted existing Deal No 501');
    }

    // 4. Create Deal No 501
    const purchase = await LandPurchase.create({
      purchaseNo: 'LP-501',
      dealNo: 501,
      purchaseDate: new Date(),
      project: 'Taj Residencia',
      seller: seller._id,
      moza: moza._id,
      lines: [{
        khewatNo: '1',
        khasraNo: '10',
        khasraArea: { kanal: 10, marla: 0, sarsai: 0 }
      }],
      totalArea: { kanal: 10, marla: 0, sarsai: 0 },
      totalSizeInKanal: 10,
      ratePerKanal: 2000000,
      agreedAmount: 20000000,
      tokenAmount: 0,
      balanceAmount: 20000000,
      installments: [],
      isActive: true
    });

    console.log('Successfully created Deal No 501:', purchase.purchaseNo);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
