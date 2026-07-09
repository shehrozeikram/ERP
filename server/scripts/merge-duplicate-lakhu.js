const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sgc_erp';
    
    console.log(`Connecting to MongoDB at ${uri}...`);
    await mongoose.connect(uri);
    console.log('Connected to MongoDB successfully.');
    
    const LandMoza = require('../models/tajResidencia/LandMoza');
    const LandPurchase = require('../models/tajResidencia/LandPurchase');
    const LandTransfer = require('../models/tajResidencia/LandTransfer');
    const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');

    // Find all Mozas named "Lakhu"
    const lakhuMozas = await LandMoza.find({ name: /Lakhu/i });
    
    if (lakhuMozas.length <= 1) {
      console.log(`Found ${lakhuMozas.length} Lakhu Moza(s). No duplicates to merge.`);
      process.exit(0);
    }
    
    console.log(`Found ${lakhuMozas.length} duplicate Lakhu Mozas. Analyzing to find the primary one...`);
    
    let primaryMoza = null;
    let maxKhasras = -1;
    
    // Find the one with the most Khasra entries to be the "primary" one
    for (const moza of lakhuMozas) {
      const khasraCount = await LandMozaKhasraEntry.countDocuments({ moza: moza._id });
      console.log(` - Moza ${moza._id} (${moza.name}) has ${khasraCount} Khasra entries.`);
      
      if (khasraCount > maxKhasras) {
        maxKhasras = khasraCount;
        primaryMoza = moza;
      }
    }
    
    console.log(`\nSelected Primary Moza: ${primaryMoza._id} (${primaryMoza.name}) with ${maxKhasras} Khasra entries.`);
    
    const duplicateIds = lakhuMozas
      .filter(m => m._id.toString() !== primaryMoza._id.toString())
      .map(m => m._id);
      
    console.log(`Migrating data from ${duplicateIds.length} duplicate Moza(s)...`);
    
    // Migrate Land Purchases
    const purchaseUpdate = await LandPurchase.updateMany(
      { moza: { $in: duplicateIds } },
      { $set: { moza: primaryMoza._id } }
    );
    console.log(` => Migrated ${purchaseUpdate.modifiedCount} Land Purchase deals.`);
    
    // Migrate Land Transfers (just in case they exist)
    const transferUpdate = await LandTransfer.updateMany(
      { moza: { $in: duplicateIds } },
      { $set: { moza: primaryMoza._id } }
    );
    console.log(` => Migrated ${transferUpdate.modifiedCount} Land Transfers.`);
    
    // Migrate any stray Khasra Entries
    const entryUpdate = await LandMozaKhasraEntry.updateMany(
      { moza: { $in: duplicateIds } },
      { $set: { moza: primaryMoza._id } }
    );
    console.log(` => Migrated ${entryUpdate.modifiedCount} stray Khasra Entries.`);
    
    // Delete the duplicates
    const deleteRes = await LandMoza.deleteMany({ _id: { $in: duplicateIds } });
    console.log(`\nSuccessfully deleted ${deleteRes.deletedCount} duplicate Lakhu Moza(s).`);
    console.log('Merge complete! Production database is now clean.');
    
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
