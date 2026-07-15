const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandMoza = require('../models/tajResidencia/LandMoza');

async function run() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const uri = isProduction ? process.env.MONGODB_URI : (process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local');
    
    console.log(`Connecting to Database...`);
    await mongoose.connect(uri);
    console.log('Connected.');

    const transfers = await LandTransfer.find({ isActive: true })
      .populate('moza')
      .populate('seller')
      .lean();

    const inProgressList = [];

    for (const t of transfers) {
      const currentPurchaserName = (t.purchaserName || '').trim();
      if (!t.purchaser && (currentPurchaserName === '' || currentPurchaserName.toLowerCase() === 'in progress')) {
        inProgressList.push(t);
      }
    }

    console.log(`\nFound ${inProgressList.length} transfers making up the "In Progress" area:`);
    console.log('--------------------------------------------------');

    let totalSarsais = 0;
    for (const t of inProgressList) {
      const k = t.transferArea?.kanal || 0;
      const m = t.transferArea?.marla || 0;
      const s = t.transferArea?.sarsai || 0;
      const sarsais = k * 180 + m * 9 + s;
      totalSarsais += sarsais;

      console.log(`Ref: ${t.referenceNo} | Transfer No: ${t.transferNo}`);
      console.log(`  - Moza: ${t.moza?.name || 'Unknown'}`);
      console.log(`  - Deal No: ${t.dealNo} | Purchase No: ${t.purchaseNo}`);
      console.log(`  - Seller: ${t.sellerName || t.seller?.name || 'Unknown'}`);
      console.log(`  - Area: ${k} Kanal, ${m} Marla, ${s} Sarsai`);
      console.log('--------------------------------------------------');
    }

    const grandKanal = Math.floor(totalSarsais / 180);
    const remMarla = totalSarsais % 180;
    const grandMarla = Math.floor(remMarla / 9);
    const grandSarsai = remMarla % 9;

    console.log(`Total Area of "In Progress" transfers: ${grandKanal} Kanal, ${grandMarla} Marla, ${grandSarsai} Sarsai`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
