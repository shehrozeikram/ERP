const mongoose = require('mongoose');
require('dotenv').config();

const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandTransfer = require('../models/tajResidencia/LandTransfer');

async function createMissingTransfers() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    
    const kakMoza = await LandMoza.findOne({ name: /kak/i });
    if (!kakMoza) {
      console.log('Kak Moza not found');
      process.exit(1);
    }
    const kakDeal = await LandPurchase.findOne({ purchaseNo: 'LP-501', moza: kakMoza._id });
    if (!kakDeal) {
      console.log('Kak Deal LP-501 not found');
      process.exit(1);
    }
    
    const missingData = [
      {
        transferNo: 'LT-0019',
        referenceNo: 'LTN-000823_R20',
        intiqalNo: '1092',
        size: { kanal: 2, marla: 0, sarsai: 0 }
      },
      {
        transferNo: 'LT-0018',
        referenceNo: 'LTN-000825_R19',
        intiqalNo: '1109',
        size: { kanal: 0, marla: 19, sarsai: 4.5 }
      },
      {
        transferNo: 'LT-0017',
        referenceNo: 'LTN-000820_R18',
        intiqalNo: '830',
        size: { kanal: 2, marla: 2, sarsai: 0 }
      },
      {
        transferNo: 'LT-0016',
        referenceNo: 'LTN-000822_R17',
        intiqalNo: '829',
        size: { kanal: 12, marla: 0, sarsai: 0 }
      },
      {
        transferNo: 'LT-0015',
        referenceNo: 'LTN-000821_R16',
        intiqalNo: '827',
        size: { kanal: 5, marla: 16, sarsai: 0 }
      }
    ];

    for (const d of missingData) {
      const exists = await LandTransfer.findOne({ transferNo: d.transferNo });
      if (exists) {
        console.log(`Transfer ${d.transferNo} already exists, checking if we need to link it...`);
        if (exists.landPurchase.toString() !== kakDeal._id.toString()) {
            exists.landPurchase = kakDeal._id;
            exists.moza = kakMoza._id;
            await exists.save();
            console.log(`Linked existing ${d.transferNo} to Kak LP-501.`);
        }
        continue;
      }

      const totalSizeInKanal = d.size.kanal + (d.size.marla / 20) + (d.size.sarsai / 180);

      await LandTransfer.create({
        referenceNo: d.referenceNo,
        transferNo: d.transferNo,
        landPurchase: kakDeal._id,
        dealNo: 0.12,
        purchaseNo: kakDeal.purchaseNo,
        transferDate: new Date('2005-12-23T00:00:00.000Z'),
        intiqalNo: d.intiqalNo,
        moza: kakMoza._id,
        seller: kakDeal.seller,
        purchaser: kakDeal.purchaser,
        lines: [{
          khewatNo: '1',
          khasraNo: '1',
          khasraArea: d.size
        }],
        purchaseArea: kakDeal.totalArea,
        transferArea: d.size,
        totalSizeInKanal: totalSizeInKanal,
        ratePerKanal: kakDeal.ratePerKanal,
        transferPayments: [],
        createdBy: kakDeal.createdBy,
        isActive: true
      });
      console.log(`Created new transfer ${d.transferNo}`);
    }

    console.log('All missing Kak transfers created/linked!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

createMissingTransfers();
