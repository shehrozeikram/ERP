const mongoose = require('mongoose');
require('dotenv').config();

const LandParty = require('../models/tajResidencia/LandParty');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandRegistry = require('../models/tajResidencia/LandRegistry');
const LandPossession = require('../models/tajResidencia/LandPossession');

async function mergeRashidIlyas() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);

    const mapping = [
      { bad: "Sardar Rashid Ilyas", good: "Sardar Rashid Ilyas Khan" }
    ];

    for (const pair of mapping) {
      console.log(`\n--- Merging [${pair.bad}] into [${pair.good}] ---`);
      
      const badParties = await LandParty.find({ name: { $regex: new RegExp(`^${pair.bad.trim()}$`, 'i') } });
      const goodParties = await LandParty.find({ name: { $regex: new RegExp(`^${pair.good.trim()}$`, 'i') } });

      if (goodParties.length === 0) {
        console.log(`Good party [${pair.good}] not found!`);
        if (badParties.length === 1) {
          console.log(`Renaming bad party to good name...`);
          badParties[0].name = pair.good;
          await badParties[0].save();
        }
        continue;
      }

      // Pick the active good one, or the first one
      const goodParty = goodParties.find(p => p.isActive) || goodParties[0];

      if (badParties.length === 0) {
        console.log(`Bad party [${pair.bad}] not found. Skipping.`);
        continue;
      }

      for (const badParty of badParties) {
        if (badParty._id.toString() === goodParty._id.toString()) continue;

        console.log(`Found Bad Party ID: ${badParty._id}, Migrating to Good Party ID: ${goodParty._id}...`);

        // Update Land Purchases
        const purchasePurchasers = await LandPurchase.updateMany({ purchaser: badParty._id }, { purchaser: goodParty._id });
        const purchaseSellers = await LandPurchase.updateMany({ seller: badParty._id }, { seller: goodParty._id });
        const purchaseDealers = await LandPurchase.updateMany({ dealer: badParty._id }, { dealer: goodParty._id });
        
        // Update Land Transfers
        const transferPurchasers = await LandTransfer.updateMany({ purchaser: badParty._id }, { purchaser: goodParty._id });
        const transferSellers = await LandTransfer.updateMany({ seller: badParty._id }, { seller: goodParty._id });
        
        // Update Land Registries
        const registryPurchasers = await LandRegistry.updateMany({ purchaser: badParty._id }, { purchaser: goodParty._id });
        const registrySellers = await LandRegistry.updateMany({ seller: badParty._id }, { seller: goodParty._id });
        
        // Update Land Possessions
        const possessionPurchasers = await LandPossession.updateMany({ purchaser: badParty._id }, { purchaser: goodParty._id });
        const possessionSellers = await LandPossession.updateMany({ seller: badParty._id }, { seller: goodParty._id });
        
        console.log(`Updates done!`);
        
        // Deactivate the bad party
        badParty.isActive = false;
        await badParty.save();
        console.log(`Deactivated bad party [${badParty.name}].`);
      }
    }

    console.log('\nSardar Rashid Ilyas successfully merged!');
    process.exit(0);

  } catch (err) {
    console.error('Error merging parties:', err);
    process.exit(1);
  }
}

mergeRashidIlyas();
