const mongoose = require('mongoose');
const LandPurchase = require('../server/models/tajResidencia/LandPurchase');

async function check() {
  const uri = "mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority";
  await mongoose.connect(uri);
  const purchases = await LandPurchase.find().populate('moza', 'name').lean();
  console.log("Prod purchases count:", purchases.length);
  
  const d12 = purchases.filter(p => String(p.dealNo) === '0.12' || p.dealNo === 0.12);
  console.log("Filtered 0.12:", d12.map(p => ({
    _id: p._id,
    purchaseNo: p.purchaseNo,
    dealNo: p.dealNo,
    moza: p.moza?.name
  })));

  process.exit();
}
check();
