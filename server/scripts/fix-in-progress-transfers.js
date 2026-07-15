const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandParty = require('../models/tajResidencia/LandParty');

// The exact mapping found in Land Transfer detail.xlsx
const purchaserMap = {
  'LTN-000823': { id: '6a4e05d51c6a0b07d8430bc9', name: 'Sardar M Sagheer Khan' },
  'LTN-000825': { id: '6a4e05d51c6a0b07d8430bc9', name: 'Sardar M Sagheer Khan' },
  'LTN-000820': { id: '6a4e05d51c6a0b07d8430bc9', name: 'Sardar M Sagheer Khan' },
  'LTN-000822': { id: '6a4e05d51c6a0b07d8430bc9', name: 'Sardar M Sagheer Khan' },
  'LTN-000821': { id: '6a4e05d51c6a0b07d8430bc9', name: 'Sardar M Sagheer Khan' },
  
  'LTN-000815': { id: '6a4e05d61c6a0b07d8430c4a', name: 'Sardar Rashid Ilyas Khan' },
  'LTN-000818': { id: '6a4e05d61c6a0b07d8430c4a', name: 'Sardar Rashid Ilyas Khan' },
  'LTN-000817': { id: '6a4e05d61c6a0b07d8430c4a', name: 'Sardar Rashid Ilyas Khan' },
  'LTN-000816': { id: '6a4e05d61c6a0b07d8430c4a', name: 'Sardar Rashid Ilyas Khan' },
  'LTN-000808': { id: '6a4e05d61c6a0b07d8430c4a', name: 'Sardar Rashid Ilyas Khan' },
  
  'LTN-000814': { id: '6a4e05d51c6a0b07d8430bc9', name: 'Sardar M Sagheer Khan' },
  'LTN-000811': { id: '6a4e05d61c6a0b07d8430c31', name: 'Sardar Tanveer Ilyas' },
  'LTN-000810': { id: '6a4e05d61c6a0b07d8430c31', name: 'Sardar Tanveer Ilyas' },
  'LTN-000813': { id: '6a4e05d51c6a0b07d8430bc9', name: 'Sardar M Sagheer Khan' }
};

async function run() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const uri = isProduction ? process.env.MONGODB_URI : (process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local');
    
    console.log(`Connecting to Database (${isProduction ? 'PRODUCTION' : 'LOCAL DEV'})...`);
    await mongoose.connect(uri);
    console.log('Connected.');

    const transfers = await LandTransfer.find({ isActive: true });
    
    let updatedCount = 0;
    
    for (const transfer of transfers) {
      const ref = transfer.referenceNo || '';
      // Find matching key from the purchaserMap
      const mapKey = Object.keys(purchaserMap).find(key => ref.startsWith(key));
      
      if (mapKey) {
        const target = purchaserMap[mapKey];
        const currentPurchaserName = (transfer.purchaserName || '').trim();
        
        // Only update if purchaser is empty/unassigned
        if (!transfer.purchaser || currentPurchaserName === '' || currentPurchaserName.toLowerCase() === 'in progress') {
          console.log(`Fixing Transfer [Ref: ${ref}, No: ${transfer.transferNo}]:`);
          console.log(`  - Target Owner: ${target.name} (ID: ${target.id})`);
          
          // Get the purchaser party details from DB to fetch CNIC
          const party = await LandParty.findById(target.id);
          
          transfer.purchaser = new mongoose.Types.ObjectId(target.id);
          transfer.purchaserName = target.name;
          if (party && party.cnic) {
            transfer.purchaserCnic = party.cnic;
          }
          
          await transfer.save();
          console.log(`  - Successfully updated.`);
          updatedCount++;
        }
      }
    }

    console.log(`\n--- UPDATE SUMMARY ---`);
    console.log(`Total transfers successfully updated: ${updatedCount}`);
    
    await mongoose.disconnect();
    console.log('Database disconnected.');
    process.exit(0);
  } catch (error) {
    console.error('Update script failed:', error);
    process.exit(1);
  }
}

run();
