const mongoose = require('mongoose');
require('dotenv').config();

const LandParty = require('../models/tajResidencia/LandParty');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandRegistry = require('../models/tajResidencia/LandRegistry');
const LandPossession = require('../models/tajResidencia/LandPossession');

async function mergeDuplicateParties() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);

    const mapping = [
      { bad: "Sardar Group of Companies", good: "Sardar Group of Companies Pvt Ltd" },
      { bad: "Sardar Tanveer Ilyas sb", good: "Sardar Tanveer Ilyas" },
      { bad: "Sardar Muhammad Idrees", good: "M idress khan" },
      { bad: "Sardar Muhammad Sagheer", good: "Sardar M Sagheer Khan" },
      { bad: "Sardar Muhammad Shareef", good: "Sardar M Shareef" }
    ];

    for (const pair of mapping) {
      console.log(`\n--- Merging [${pair.bad}] into [${pair.good}] ---`);
      
      const badParties = await LandParty.find({ name: { $regex: new RegExp(`^${pair.bad.trim()}$`, 'i') } });
      const goodParties = await LandParty.find({ name: { $regex: new RegExp(`^${pair.good.trim()}$`, 'i') } });

      if (goodParties.length === 0) {
        console.log(`Good party [${pair.good}] not found! If the bad one exists, maybe we can just rename it.`);
        if (badParties.length === 1) {
          console.log(`Renaming bad party to good name since good doesn't exist...`);
          badParties[0].name = pair.good;
          await badParties[0].save();
        }
        continue;
      }

      // Pick the first good one (or the active one)
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
        
        console.log(`LandPurchases Updated - Purchasers: ${purchasePurchasers.modifiedCount}, Sellers: ${purchaseSellers.modifiedCount}, Dealers: ${purchaseDealers.modifiedCount}`);

        // Update Land Transfers
        const transferPurchasers = await LandTransfer.updateMany({ purchaser: badParty._id }, { purchaser: goodParty._id });
        const transferSellers = await LandTransfer.updateMany({ seller: badParty._id }, { seller: goodParty._id });
        
        console.log(`LandTransfers Updated - Purchasers: ${transferPurchasers.modifiedCount}, Sellers: ${transferSellers.modifiedCount}`);

        // Update Land Registries
        const registryPurchasers = await LandRegistry.updateMany({ purchaser: badParty._id }, { purchaser: goodParty._id });
        const registrySellers = await LandRegistry.updateMany({ seller: badParty._id }, { seller: goodParty._id });
        
        console.log(`LandRegistries Updated - Purchasers: ${registryPurchasers.modifiedCount}, Sellers: ${registrySellers.modifiedCount}`);

        // Update Land Possessions
        const possessionPurchasers = await LandPossession.updateMany({ purchaser: badParty._id }, { purchaser: goodParty._id });
        const possessionSellers = await LandPossession.updateMany({ seller: badParty._id }, { seller: goodParty._id });
        
        console.log(`LandPossessions Updated - Purchasers: ${possessionPurchasers.modifiedCount}, Sellers: ${possessionSellers.modifiedCount}`);

        // Deactivate the bad party
        badParty.isActive = false;
        await badParty.save();
        console.log(`Deactivated bad party [${badParty.name}].`);
      }
    }

    console.log('\nAll duplicate parties merged successfully!');
    process.exit(0);

  } catch (err) {
    console.error('Error merging parties:', err);
    process.exit(1);
  }
}

mergeDuplicateParties();
