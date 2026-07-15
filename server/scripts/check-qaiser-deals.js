const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandParty = require('../models/tajResidencia/LandParty');
const LandMoza = require('../models/tajResidencia/LandMoza');

async function run() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const uri = isProduction ? process.env.MONGODB_URI : (process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local');
    
    await mongoose.connect(uri);
    console.log('Connected.');

    // 1. Check purchases where seller is Qaiser Maskeen (or has dealNo 0.12 or LP-500/LP-501)
    const purchases = await LandPurchase.find()
      .populate('seller', 'name')
      .populate('purchaser', 'name')
      .populate('moza', 'name')
      .lean();

    console.log('--- ALL LAND PURCHASES ---');
    for (const p of purchases) {
      if (p.purchaseNo === 'LP-500' || p.purchaseNo === 'LP-501' || (p.seller?.name || '').includes('Qaiser')) {
        console.log(`Purchase: ${p.purchaseNo} | Deal: ${p.dealNo} | Moza: ${p.moza?.name} | Seller: ${p.seller?.name} | Purchaser: ${p.purchaser?.name || 'null'}`);
      }
    }

    // 2. Check parties containing "Rashid" or "Sagheer" to get their exact object IDs
    const parties = await LandParty.find({ name: /Sardar/i }).lean();
    console.log('\n--- SARDAR PARTIES ---');
    for (const p of parties) {
      console.log(`Party: ${p.name} | ID: ${p._id} | Type: ${p.partyType}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
