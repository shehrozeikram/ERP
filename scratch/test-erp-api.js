const { fetchStatementFromERP } = require('../server/utils/erpIntegration');
const mongoose = require('mongoose');
require('dotenv').config({ path: '../server/.env' });
const RecoveryAssignment = require('../server/models/finance/RecoveryAssignment');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/sgc_erp', { useNewUrlParser: true, useUnifiedTopology: true });
  
  const orderCodes = ['119586', '116363', '119533'];
  for (const code of orderCodes) {
    console.log(`\nTesting OrderCode: ${code}`);
    
    // Fetch from ERP
    const erpData = await fetchStatementFromERP(code);
    console.log('ERP Data:', erpData);
    
    // Fetch from local DB
    const localData = await RecoveryAssignment.findOne({ orderCode: code }).lean();
    if (localData) {
      console.log('Local DB Data:', {
        salePrice: localData.salePrice,
        received: localData.received,
        currentlyDue: localData.currentlyDue
      });
    } else {
      console.log('Local DB Data: Not found in RecoveryAssignment');
    }
  }
  process.exit(0);
}

test();
