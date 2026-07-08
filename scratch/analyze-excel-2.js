require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../server/config/database');
const LandPurchase = require('../server/models/tajResidencia/LandPurchase');
const XLSX = require('xlsx');
const path = require('path');

async function run() {
  await connectDB();
  const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

  let missingPurchase = 0;
  for (const row of data) {
    const dealNo = row['Deal No.'];
    if (dealNo !== null && dealNo !== undefined) {
      const purchase = await LandPurchase.findOne({ dealNo: Number(dealNo) });
      if (!purchase) missingPurchase++;
    }
  }
  console.log(`Missing Purchases: ${missingPurchase}`);
  await disconnectDB();
}
run();
