const mongoose = require('mongoose');
require('dotenv').config();

const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandMoza = require('../models/tajResidencia/LandMoza');

async function updateKakDeal() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const kakMoza = await LandMoza.findOne({ name: /kak/i });
    if (!kakMoza) {
      console.log('Kak moza not found in DB. Cannot proceed.');
      process.exit(1);
    }

    // Find the Kak deal No 0.12
    const kakDeal = await LandPurchase.findOne({ dealNo: 0.12, moza: kakMoza._id });
    if (!kakDeal) {
      console.log('Kak Deal No 0.12 not found in production.');
      process.exit(1);
    }

    console.log(`Found Kak Deal No 0.12 (Purchase No: ${kakDeal.purchaseNo}). Updating values...`);

    // The desired values from the image
    const desiredArea = { kanal: 22, marla: 17, sarsai: 4.5 };
    const desiredTotalSizeInKanal = 22 + (17 / 20) + (4.5 / 180); // 22.875
    const desiredRatePerKanal = 249464.50;
    const desiredTotalPrice = 5706500;

    // Check if LP-501 is already taken by another deal
    const existing501 = await LandPurchase.findOne({ purchaseNo: 'LP-501' });
    if (!existing501 || existing501._id.toString() === kakDeal._id.toString()) {
       kakDeal.purchaseNo = 'LP-501';
    } else {
       console.log('Warning: LP-501 is taken by another deal. Leaving purchaseNo as', kakDeal.purchaseNo);
    }

    // Update the values
    kakDeal.totalArea = desiredArea;
    kakDeal.totalSizeInKanal = desiredTotalSizeInKanal;
    kakDeal.ratePerKanal = desiredRatePerKanal;
    kakDeal.agreedAmount = desiredTotalPrice;
    
    // Recalculate balance if token amount was paid
    const token = kakDeal.tokenAmount || 0;
    kakDeal.balanceAmount = desiredTotalPrice - token;

    // Update lines array so the khasra entry matches the new total size
    if (kakDeal.lines && kakDeal.lines.length > 0) {
      // Just set the first line to hold the entire area and remove the rest
      kakDeal.lines[0].khasraArea = desiredArea;
      kakDeal.lines = [kakDeal.lines[0]];
    } else {
      kakDeal.lines = [{
        khewatNo: '1',
        khasraNo: '1',
        khasraArea: desiredArea
      }];
    }

    await kakDeal.save();
    console.log(`Successfully updated Kak Deal No 0.12!`);
    console.log(`New Area: ${desiredArea.kanal} Kanal ${desiredArea.marla} Marla ${desiredArea.sarsai} Sarsai`);
    console.log(`New Rate: ${desiredRatePerKanal}`);
    console.log(`New Total: ${desiredTotalPrice}`);
    console.log(`Purchase No: ${kakDeal.purchaseNo}`);

    process.exit(0);
  } catch (error) {
    console.error('Error updating Kak deal:', error);
    process.exit(1);
  }
}

updateKakDeal();
