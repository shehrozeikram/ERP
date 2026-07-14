const mongoose = require('mongoose');
require('dotenv').config();

const LandMoza = require('../models/tajResidencia/LandMoza');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandTransfer = require('../models/tajResidencia/LandTransfer');

async function fixDuplicateKakMoza() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // 1. Find all Mozas that might be "Kak" or "Kaak"
    const kakMozas = await LandMoza.find({ name: /kak|kaak/i });
    console.log(`Found ${kakMozas.length} Mozas matching Kak/Kaak.`);

    let goodMoza = null;
    let badMoza = null;

    for (const moza of kakMozas) {
      const count = await LandMozaKhasraEntry.countDocuments({ moza: moza._id });
      console.log(`- Moza: ${moza.name} (ID: ${moza._id}) has ${count} khasra records. isActive: ${moza.isActive}`);
      
      if (count > 0) {
        goodMoza = moza;
      } else {
        badMoza = moza;
      }
    }

    if (!goodMoza) {
      console.log('Could not find the Kak Moza with khasra records!');
      process.exit(1);
    }

    if (!badMoza) {
      console.log('Could not find a bad Kak Moza. Maybe there is only one?');
      if (goodMoza.isActive === false) {
          console.log('Activating the good Moza...');
          goodMoza.isActive = true;
          await goodMoza.save();
      }
      process.exit(0);
    }

    console.log(`\nGood Moza ID: ${goodMoza._id} (with khasras)`);
    console.log(`Bad Moza ID: ${badMoza._id} (0 khasras)`);

    // 2. Ensure good Moza is active, bad Moza is inactive
    if (!goodMoza.isActive) {
      goodMoza.isActive = true;
      await goodMoza.save();
      console.log('Activated good Moza.');
    }
    if (badMoza.isActive) {
      badMoza.isActive = false;
      await badMoza.save();
      console.log('Deactivated bad Moza.');
    }

    // 3. Update the LandPurchase (LP-501)
    const purchase = await LandPurchase.findOne({ purchaseNo: 'LP-501' });
    if (purchase && purchase.moza.toString() !== goodMoza._id.toString()) {
      console.log(`Updating LandPurchase LP-501 to use good Moza...`);
      purchase.moza = goodMoza._id;
      await purchase.save();
    }

    // 4. Update the LandTransfers
    const transfers = await LandTransfer.find({ moza: badMoza._id });
    if (transfers.length > 0) {
      console.log(`Found ${transfers.length} transfers linked to bad Moza. Moving them to good Moza...`);
      for (const t of transfers) {
        t.moza = goodMoza._id;
        await t.save();
      }
      console.log('Transfers updated.');
    } else {
      console.log('No transfers found linked to bad Moza.');
    }

    // Also check if any transfers are linked to LP-501 but somehow missing the moza update
    const lp501Transfers = await LandTransfer.find({ landPurchase: purchase?._id });
    for (const t of lp501Transfers) {
      if (t.moza.toString() !== goodMoza._id.toString()) {
        t.moza = goodMoza._id;
        await t.save();
        console.log(`Fixed moza for transfer ${t.transferNo}`);
      }
    }

    console.log('\nSuccessfully migrated everything to the Kak Moza with 496 khasras!');
    process.exit(0);

  } catch (err) {
    console.error('Error fixing duplicate Kak mozas:', err);
    process.exit(1);
  }
}

fixDuplicateKakMoza();
