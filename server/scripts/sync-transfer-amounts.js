const mongoose = require('mongoose');
const xlsx = require('xlsx');
require('dotenv').config();

const LandTransfer = require('../models/tajResidencia/LandTransfer');

async function syncTransferAmounts() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);

    const path = require('path');
    const workbook = xlsx.readFile(path.join(process.cwd(), 'docs', 'Land Transfer detail.xlsx'));
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    let updatedCount = 0;
    for (const row of data) {
      const refNo = row['Reference No.'];
      const totalCost = Number(row['Total Cost']) || 0;

      if (!refNo) continue;

      const transfer = await LandTransfer.findOne({ referenceNo: refNo });
      if (transfer) {
        if (transfer.totalTransferPayments !== totalCost) {
          transfer.totalTransferPayments = totalCost;
          await transfer.save();
          console.log(`Updated Transfer ${refNo} to amount ${totalCost}`);
          updatedCount++;
        }
      } else {
        console.log(`Transfer not found for reference: ${refNo}`);
      }
    }

    console.log(`\nSuccessfully updated ${updatedCount} Land Transfers.`);
    process.exit(0);
  } catch (err) {
    console.error('Error syncing transfer amounts:', err);
    process.exit(1);
  }
}

syncTransferAmounts();
