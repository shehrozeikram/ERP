const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { connectDB } = require('../config/database');
const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandRegistry = require('../models/tajResidencia/LandRegistry');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandParty = require('../models/tajResidencia/LandParty');

async function syncTransferParties() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();

    console.log('Fetching active LandTransfers, LandRegistries, and LandPurchases...');
    const [transfers, registries, purchases] = await Promise.all([
      LandTransfer.find({ isActive: true }),
      LandRegistry.find({ isActive: true }).populate('seller purchaser dealer'),
      LandPurchase.find({ isActive: true }).populate('seller purchaser dealer')
    ]);

    console.log(`Found ${transfers.length} transfers, ${registries.length} registries, ${purchases.length} purchases.`);

    // Build lookup maps for fast matching
    const registryByNo = new Map();
    const registryByInteqal = new Map();
    for (const r of registries) {
      if (r.registryNo && r.registryNo.trim()) {
        registryByNo.set(r.registryNo.trim().toLowerCase(), r);
      }
      if (r.inteqalNo && r.inteqalNo.trim()) {
        registryByInteqal.set(r.inteqalNo.trim().toLowerCase(), r);
      }
    }

    const purchaseByDealNo = new Map();
    for (const p of purchases) {
      if (p.dealNo) {
        purchaseByDealNo.set(Number(p.dealNo), p);
      }
    }

    let transferUpdatedCount = 0;
    let registryUpdatedCount = 0;
    let registryMatchedCount = 0;
    let purchaseFallbackCount = 0;
    let noMatchCount = 0;

    for (const t of transfers) {
      const regNo = (t.registryNo || '').trim().toLowerCase();
      const intNo = (t.intiqalNo || '').trim().toLowerCase();

      let matchedRegistry = null;
      if (regNo) {
        matchedRegistry = registryByNo.get(regNo);
      }
      if (!matchedRegistry && intNo) {
        matchedRegistry = registryByInteqal.get(intNo);
      }

      let newSellerId = t.seller;
      let newSellerName = t.sellerName;
      let newPurchaserId = t.purchaser;
      let newPurchaserName = t.purchaserName;
      let targetDealerId = null;

      if (matchedRegistry) {
        registryMatchedCount++;
        // 1) Update LandTransfer from LandRegistry
        if (matchedRegistry.seller) {
          newSellerId = matchedRegistry.seller._id || matchedRegistry.seller;
          newSellerName = matchedRegistry.seller.name || matchedRegistry.sellerName || newSellerName;
        }
        if (matchedRegistry.purchaser) {
          newPurchaserId = matchedRegistry.purchaser._id || matchedRegistry.purchaser;
          newPurchaserName = matchedRegistry.purchaser.name || matchedRegistry.purchaserName || newPurchaserName;
        }
        if (matchedRegistry.dealer) {
          targetDealerId = matchedRegistry.dealer._id || matchedRegistry.dealer;
        }

        // 2) Reverse sync: If LandRegistry itself is missing seller, purchaser, or dealer, update LandRegistry from LandTransfer / LandPurchase!
        const matchedPurchase = t.landPurchase ? purchases.find(p => String(p._id) === String(t.landPurchase)) : purchaseByDealNo.get(Number(t.dealNo));
        const regUpdateDoc = {};
        if (!matchedRegistry.seller && (t.seller || matchedPurchase?.seller)) {
          regUpdateDoc.seller = t.seller || matchedPurchase.seller._id || matchedPurchase.seller;
        }
        if (!matchedRegistry.purchaser && (t.purchaser || matchedPurchase?.purchaser)) {
          regUpdateDoc.purchaser = t.purchaser || matchedPurchase.purchaser._id || matchedPurchase.purchaser;
        }
        if (!matchedRegistry.dealer && matchedPurchase?.dealer) {
          regUpdateDoc.dealer = matchedPurchase.dealer._id || matchedPurchase.dealer;
        }
        if (Object.keys(regUpdateDoc).length > 0) {
          await LandRegistry.updateOne({ _id: matchedRegistry._id }, { $set: regUpdateDoc });
          registryUpdatedCount++;
        }
      } else {
        // Fallback to linked LandPurchase for LandTransfer
        const matchedPurchase = t.landPurchase ? purchases.find(p => String(p._id) === String(t.landPurchase)) : purchaseByDealNo.get(Number(t.dealNo));
        if (matchedPurchase) {
          purchaseFallbackCount++;
          if (!newSellerId && matchedPurchase.seller) {
            newSellerId = matchedPurchase.seller._id || matchedPurchase.seller;
            newSellerName = matchedPurchase.seller.name || matchedPurchase.sellerName || newSellerName;
          }
          if (!newPurchaserId && matchedPurchase.purchaser) {
            newPurchaserId = matchedPurchase.purchaser._id || matchedPurchase.purchaser;
            newPurchaserName = matchedPurchase.purchaser.name || matchedPurchase.purchaserName || newPurchaserName;
          }
          if (matchedPurchase.dealer) {
            targetDealerId = matchedPurchase.dealer._id || matchedPurchase.dealer;
          }
        } else {
          noMatchCount++;
        }
      }

      // Check if LandTransfer or linked LandPurchase needs updating
      let changed = false;
      const updateDoc = {};

      if (newSellerId && String(newSellerId) !== String(t.seller)) {
        updateDoc.seller = newSellerId;
        updateDoc.sellerName = newSellerName;
        changed = true;
      }
      if (newPurchaserId && String(newPurchaserId) !== String(t.purchaser)) {
        updateDoc.purchaser = newPurchaserId;
        updateDoc.purchaserName = newPurchaserName;
        changed = true;
      }

      if (changed) {
        await LandTransfer.updateOne({ _id: t._id }, { $set: updateDoc });
        transferUpdatedCount++;
      }

      // Update linked LandPurchase dealer if targetDealerId exists and differs
      if (targetDealerId && t.landPurchase) {
        const p = purchases.find(p => String(p._id) === String(t.landPurchase));
        if (p && String(p.dealer?._id || p.dealer) !== String(targetDealerId)) {
          await LandPurchase.updateOne({ _id: p._id }, { $set: { dealer: targetDealerId } });
        }
      }
    }

    console.log('--- SYNC COMPLETED ---');
    console.log(`Total Transfers evaluated: ${transfers.length}`);
    console.log(`Matched via LandRegistry (Registry No / Inteqal No): ${registryMatchedCount}`);
    console.log(`Matched via LandPurchase fallback: ${purchaseFallbackCount}`);
    console.log(`No match found: ${noMatchCount}`);
    console.log(`LandTransfer records updated: ${transferUpdatedCount}`);
    console.log(`LandRegistry records updated with Seller/Purchaser/Dealer: ${registryUpdatedCount}`);

    process.exit(0);
  } catch (err) {
    console.error('Error syncing transfer parties:', err);
    process.exit(1);
  }
}

syncTransferParties();
