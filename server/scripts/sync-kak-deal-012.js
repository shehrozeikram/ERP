const mongoose = require('mongoose');
require('dotenv').config();

const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandParty = require('../models/tajResidencia/LandParty');

const LOCAL_URI = 'mongodb://localhost:27017/sgc_erp';
const PROD_URI = process.env.MONGODB_URI;

async function syncKakDeal() {
  try {
    console.log('Connecting to Local Database...');
    const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
    
    const LocalLandPurchase = localConn.model('LandPurchase', LandPurchase.schema);
    const LocalLandMoza = localConn.model('LandMoza', LandMoza.schema);
    
    const kakMozaLocal = await LocalLandMoza.findOne({ name: /kak/i });
    if (!kakMozaLocal) {
      console.log('Kak moza not found in local DB. Cannot proceed.');
      process.exit(1);
    }

    const localDeals = await LocalLandPurchase.find({ 
      dealNo: 0.12, 
      moza: kakMozaLocal._id 
    }).lean();

    if (localDeals.length === 0) {
      console.log('No deal 0.12 found for Kak moza in local DB.');
      process.exit(1);
    }

    const kakDealToSync = localDeals[0];
    console.log(`Found Deal 0.12 for Kak in Local DB: Purchase No ${kakDealToSync.purchaseNo}`);

    console.log('\nConnecting to Production Database...');
    const prodConn = await mongoose.createConnection(PROD_URI).asPromise();
    
    const ProdLandPurchase = prodConn.model('LandPurchase', LandPurchase.schema);
    const ProdLandMoza = prodConn.model('LandMoza', LandMoza.schema);

    const kakMozaProd = await ProdLandMoza.findOne({ name: /kak/i });
    if (!kakMozaProd) {
      console.log('Kak moza not found in Production DB. Cannot sync.');
      process.exit(1);
    }

    // Check if it already exists
    const existing = await ProdLandPurchase.findOne({ 
      dealNo: 0.12, 
      moza: kakMozaProd._id 
    });

    if (existing) {
      console.log('Deal 0.12 for Kak already exists in Production DB!');
      
      if (!existing.isActive) {
         console.log('It is currently inactive. Reactivating...');
         existing.isActive = true;
         await existing.save();
         console.log('Reactivated successfully.');
      }
    } else {
      console.log('Deal is missing in Production DB. Inserting...');
      
      // Clean up fields before insertion to prevent _id conflicts
      delete kakDealToSync._id;
      delete kakDealToSync.__v;
      delete kakDealToSync.createdAt;
      delete kakDealToSync.updatedAt;
      
      // Ensure moza ID matches production's Kak Moza ID
      kakDealToSync.moza = kakMozaProd._id;

      // Ensure purchaseNo doesn't conflict
      const purchaseNoConflict = await ProdLandPurchase.findOne({ purchaseNo: kakDealToSync.purchaseNo });
      if (purchaseNoConflict) {
        console.log(`Warning: Purchase No ${kakDealToSync.purchaseNo} already exists in Production DB.`);
        console.log('Please resolve purchaseNo manually or modify this script to assign a new one.');
        process.exit(1);
      }

      await ProdLandPurchase.create(kakDealToSync);
      console.log('Successfully synced Kak Deal No 0.12 to Production DB!');
    }

    console.log('\nDone.');
    process.exit(0);

  } catch (error) {
    console.error('Error syncing deal:', error);
    process.exit(1);
  }
}

syncKakDeal();
