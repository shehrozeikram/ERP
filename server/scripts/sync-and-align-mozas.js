const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const { connectDB } = require('../config/database');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');

async function main() {
  console.log('=== RUNNING MOZA CONSOLIDATION AND SYNC SCRIPT ===\n');
  await connectDB();

  // 1. Ensure Kak moza is active
  const kak = await LandMoza.findOne({ slug: 'kak' });
  if (kak && !kak.isActive) {
    kak.isActive = true;
    await kak.save();
    console.log('✅ Activated Kak Moza');
  }

  // 2. Link Kaak Khasras to Kak Moza
  const kaakMoza = await LandMoza.findOne({ slug: 'kaak' });
  if (kaakMoza && kak) {
    const existingInKak = await LandMozaKhasraEntry.countDocuments({ moza: kak._id });
    if (existingInKak === 0) {
      const res = await LandMozaKhasraEntry.updateMany({ moza: kaakMoza._id }, { $set: { moza: kak._id } });
      console.log(`✅ Moved ${res.modifiedCount} khasra entries from Kaak to Kak Moza`);
    }
    kaakMoza.isActive = false;
    await kaakMoza.save();
  }

  const muzaKaak = await LandMoza.findOne({ slug: 'muza-kaak' });
  if (muzaKaak && kak) {
    const existingInKak = await LandMozaKhasraEntry.countDocuments({ moza: kak._id });
    if (existingInKak === 0) {
      const res = await LandMozaKhasraEntry.updateMany({ moza: muzaKaak._id }, { $set: { moza: kak._id } });
      console.log(`✅ Moved ${res.modifiedCount} khasra entries from Muza Kaak to Kak Moza`);
    }
    muzaKaak.isActive = false;
    await muzaKaak.save();
  }

  // 3. Consolidate Rupa mozas
  const activeRupa = await LandMoza.findOne({ slug: 'rupa', isActive: true });
  if (activeRupa) {
    const inactiveRupas = await LandMoza.find({ name: /rupa/i, _id: { $ne: activeRupa._id } });
    for (const oldRupa of inactiveRupas) {
      const resP = await LandPurchase.updateMany({ moza: oldRupa._id }, { $set: { moza: activeRupa._id } });
      const resT = await LandTransfer.updateMany({ moza: oldRupa._id }, { $set: { moza: activeRupa._id } });
      const resK = await LandMozaKhasraEntry.updateMany({ moza: oldRupa._id }, { $set: { moza: activeRupa._id } });
      if (resP.modifiedCount || resT.modifiedCount || resK.modifiedCount) {
        console.log(`✅ Consolidated ${oldRupa.name} (${oldRupa._id}) into RUPA -> ${resP.modifiedCount} purchases, ${resT.modifiedCount} transfers, ${resK.modifiedCount} khasras updated.`);
      }
    }
  }

  // 4. Ensure Sheikhpur is active and entryCount is synced
  const sheikhpur = await LandMoza.findOne({ slug: 'sheikhpur' });
  if (sheikhpur) {
    sheikhpur.isActive = true;
    await sheikhpur.save();
    console.log('✅ Verified Sheikhpur Moza is active');
  }

  // 5. Update entry counts across all active mozas
  const activeMozas = await LandMoza.find({ isActive: true }).sort({ name: 1 });
  for (const m of activeMozas) {
    const kCount = await LandMozaKhasraEntry.countDocuments({ moza: m._id });
    m.entryCount = kCount;
    await m.save();

    const pCount = await LandPurchase.countDocuments({ moza: m._id });
    const tCount = await LandTransfer.countDocuments({ moza: m._id });
    console.log(`- Moza: "${m.name}" (${m._id}) | Khasras: ${m.entryCount} | Purchases: ${pCount} | Transfers: ${tCount}`);
  }

  console.log('\nMoza consolidation and sync completed successfully.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error running script:', err);
  process.exit(1);
});
