const mongoose = require('mongoose');
require('dotenv').config();

const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandTransfer = require('../models/tajResidencia/LandTransfer');

async function createMissingSheikhpurTransfers() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    
    const sheikhpurMoza = await LandMoza.findOne({ name: /sheikhpur/i });
    if (!sheikhpurMoza) {
      console.log('Sheikhpur Moza not found');
      process.exit(1);
    }
    
    const sheikhpurDeal = await LandPurchase.findOne({ dealNo: 0.12, moza: sheikhpurMoza._id });
    if (!sheikhpurDeal) {
      console.log('Sheikhpur Deal 0.12 not found');
      process.exit(1);
    }
    
    const missingData = [
      {
        transferNo: 'LT-0030',
        referenceNo: 'LTN-000815_R31',
        intiqalNo: '5832',
        size: { kanal: 1, marla: 1, sarsai: 6 }
      },
      {
        transferNo: 'LT-0029',
        referenceNo: 'LTN-000815_R30',
        intiqalNo: '5805',
        size: { kanal: 4, marla: 0, sarsai: 8 }
      },
      {
        transferNo: 'LT-0028',
        referenceNo: 'LTN-000815_R29',
        intiqalNo: '5804',
        size: { kanal: 2, marla: 1, sarsai: 5 }
      },
      {
        transferNo: 'LT-0027',
        referenceNo: 'LTN-000818_R28',
        intiqalNo: '10390',
        size: { kanal: 2, marla: 1, sarsai: 5 }
      },
      {
        transferNo: 'LT-0026',
        referenceNo: 'LTN-000817_R27',
        intiqalNo: '7457',
        size: { kanal: 0, marla: 8, sarsai: 3 }
      },
      {
        transferNo: 'LT-0025',
        referenceNo: 'LTN-000816_R26',
        intiqalNo: '7048',
        size: { kanal: 6, marla: 3, sarsai: 1 }
      },
      {
        transferNo: 'LT-0024',
        referenceNo: 'LTN-000808_R25',
        intiqalNo: '5807',
        size: { kanal: 6, marla: 0, sarsai: 0 }
      },
      {
        transferNo: 'LT-0023',
        referenceNo: 'LTN-000815_R24',
        intiqalNo: '5802',
        size: { kanal: 6, marla: 12, sarsai: 6 }
      },
      {
        transferNo: 'LT-0022',
        referenceNo: 'LTN-000814_R23',
        intiqalNo: '5649',
        size: { kanal: 1, marla: 10, sarsai: 0 }
      },
      {
        transferNo: 'LT-0021',
        referenceNo: 'LTN-000811_R22',
        intiqalNo: '9855',
        size: { kanal: 0, marla: 5, sarsai: 3.5 }
      },
      {
        transferNo: 'LT-0020',
        referenceNo: 'LTN-000810_R21',
        intiqalNo: '9412',
        size: { kanal: 0, marla: 15, sarsai: 1 }
      },
      {
        transferNo: 'LT-0014',
        referenceNo: 'LTN-000813_R15',
        intiqalNo: '5504',
        size: { kanal: 5, marla: 12, sarsai: 6 }
      }
    ];

    for (const d of missingData) {
      const exists = await LandTransfer.findOne({ transferNo: d.transferNo });
      if (exists) {
        console.log(`Transfer ${d.transferNo} already exists, checking link...`);
        if (exists.landPurchase.toString() !== sheikhpurDeal._id.toString()) {
            exists.landPurchase = sheikhpurDeal._id;
            exists.moza = sheikhpurMoza._id;
            await exists.save();
            console.log(`Linked existing ${d.transferNo} to Sheikhpur Deal 0.12.`);
        }
        continue;
      }

      const totalSizeInKanal = d.size.kanal + (d.size.marla / 20) + (d.size.sarsai / 180);

      await LandTransfer.create({
        referenceNo: d.referenceNo,
        transferNo: d.transferNo,
        landPurchase: sheikhpurDeal._id,
        dealNo: 0.12,
        purchaseNo: sheikhpurDeal.purchaseNo,
        transferDate: new Date('2005-12-23T00:00:00.000Z'),
        intiqalNo: d.intiqalNo,
        moza: sheikhpurMoza._id,
        seller: sheikhpurDeal.seller,
        purchaser: sheikhpurDeal.purchaser,
        lines: [{
          khewatNo: '1',
          khasraNo: '1',
          khasraArea: d.size
        }],
        purchaseArea: sheikhpurDeal.totalArea,
        transferArea: d.size,
        totalSizeInKanal: totalSizeInKanal,
        ratePerKanal: sheikhpurDeal.ratePerKanal,
        transferPayments: [],
        createdBy: sheikhpurDeal.createdBy,
        isActive: true
      });
      console.log(`Created new transfer ${d.transferNo}`);
    }

    console.log('All missing Sheikhpur transfers created/linked!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

createMissingSheikhpurTransfers();
