const mongoose = require('mongoose');
require('dotenv').config();
const LandPurchase = require('../server/models/tajResidencia/LandPurchase');

async function check() {
  await mongoose.connect('mongodb://localhost:27017/sgc_erp');
  const purchases = await LandPurchase.find().populate('moza', 'name').lean();
  console.log("Purchases count:", purchases.length);
  
  const d12 = purchases.filter(p => String(p.dealNo) === '0.12' || p.dealNo === 0.12 || String(p.dealNo) === '0.120');
  console.log("Filtered 0.12:", d12.map(p => ({
    _id: p._id,
    purchaseNo: p.purchaseNo,
    dealNo: p.dealNo,
    moza: p.moza?.name
  })));

  process.exit();
}
check();
