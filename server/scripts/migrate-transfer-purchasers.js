const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandParty = require('../models/tajResidencia/LandParty');

async function run() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const uri = isProduction ? process.env.MONGODB_URI : (process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local');
    
    console.log(`Connecting to Database (${isProduction ? 'PRODUCTION' : 'LOCAL DEV'})...`);
    await mongoose.connect(uri);
    console.log('Connected.');

    const transfers = await LandTransfer.find({ isActive: true })
      .populate({
        path: 'landPurchase',
        populate: { path: 'purchaser' }
      });

    console.log(`Total active transfers found in database: ${transfers.length}`);

    let updatedCount = 0;
    let skipCount = 0;

    for (const transfer of transfers) {
      // Check if purchaser is unassigned (null/undefined or empty string)
      const currentPurchaserId = transfer.purchaser;
      const currentPurchaserName = (transfer.purchaserName || '').trim();

      if (!currentPurchaserId || currentPurchaserName === '' || currentPurchaserName.toLowerCase() === 'in progress') {
        const parentPurchase = transfer.landPurchase;
        
        if (parentPurchase && parentPurchase.purchaser) {
          const newPurchaserId = parentPurchase.purchaser._id;
          const newPurchaserName = parentPurchase.purchaser.name;

          console.log(`Migrating Transfer [Ref: ${transfer.referenceNo}, No: ${transfer.transferNo}]:`);
          console.log(`  - Parent Purchase ID: ${parentPurchase.purchaseNo} (Deal No: ${parentPurchase.dealNo})`);
          console.log(`  - Old Purchaser: (Empty/In Progress)`);
          console.log(`  - New Inherited Purchaser: ${newPurchaserName} (ID: ${newPurchaserId})`);

          transfer.purchaser = newPurchaserId;
          transfer.purchaserName = newPurchaserName;
          
          // Also set the CNIC if available on the parent purchaser
          if (parentPurchase.purchaser.cnic) {
            transfer.purchaserCnic = parentPurchase.purchaser.cnic;
          }

          await transfer.save();
          updatedCount++;
        } else {
          console.log(`⚠️ Warning: Transfer [Ref: ${transfer.referenceNo}] has no purchaser, and parent Purchase [No: ${transfer.purchaseNo || 'N/A'}] also has no purchaser set.`);
          skipCount++;
        }
      }
    }

    console.log('\n--- MIGRATION SUMMARY ---');
    console.log(`Transfers successfully updated: ${updatedCount}`);
    console.log(`Transfers skipped (no parent purchaser available): ${skipCount}`);
    
    await mongoose.disconnect();
    console.log('Database disconnected.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed with error:', error);
    process.exit(1);
  }
}

run();
