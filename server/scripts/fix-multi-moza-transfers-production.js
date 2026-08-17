const mongoose = require('mongoose');
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');

const rootEnv = path.join(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });
const serverEnv = path.join(__dirname, '../.env');
if (fs.existsSync(serverEnv)) require('dotenv').config({ path: serverEnv });

const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandMoza = require('../models/tajResidencia/LandMoza');

async function fixMultiMozaTransfers(targetUri) {
  const uri = targetUri || process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL || 'mongodb://127.0.0.1:27017/sgc_erp';
  console.log('\n==================================================');
  console.log('Connecting to MongoDB:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
  await mongoose.connect(uri);

  // Read Excel file
  const excelPath = path.join(__dirname, '../../docs/Deals with multiple moza\'s.xlsx');
  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets['Sheet2'];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const dataRows = rawRows.slice(3).filter(r => r && r[1] && String(r[1]).startsWith('LP-'));

  console.log(`Excel contains ${dataRows.length} purchase rows across multi-moza deals.`);

  // Load all Mozas into memory for fast lookup
  const mozas = await LandMoza.find({ isActive: true }).lean();
  const mozaMap = new Map();
  for (const m of mozas) {
    mozaMap.set(m.name.trim().toLowerCase(), m._id);
  }

  // Group Excel purchases by dealNo
  const excelDeals = new Map();
  for (const r of dataRows) {
    const purchaseNo = String(r[1]).trim();
    const dealNo = Number(r[2]);
    const excelMozaName = String(r[4] || '').trim();

    if (!excelDeals.has(dealNo)) excelDeals.set(dealNo, []);
    excelDeals.get(dealNo).push({ purchaseNo, dealNo, excelMozaName });
  }

  console.log(`Found ${excelDeals.size} unique multi-moza deal numbers in Excel.`);

  let totalUpdatedTransfers = 0;
  let skippedTransfers = 0;

  for (const [dealNo, purchases] of excelDeals.entries()) {
    // Find all LandPurchases in DB for this dealNo
    const dbPurchases = await LandPurchase.find({ dealNo, isActive: true }).populate('moza', 'name').lean();
    if (dbPurchases.length <= 1) {
      continue;
    }

    // Find all transfers for this dealNo
    const transfers = await LandTransfer.find({ dealNo, isActive: true }).populate('moza', 'name');
    if (transfers.length === 0) continue;

    console.log(`\nProcessing Deal ${dealNo} (${dbPurchases.length} purchases, ${transfers.length} transfers)...`);

    // Map purchases by Moza ID
    const purchaseByMozaId = new Map();
    for (const p of dbPurchases) {
      if (p.moza && p.moza._id) {
        purchaseByMozaId.set(String(p.moza._id), p);
      }
    }

    for (const transfer of transfers) {
      const currentMozaId = transfer.moza ? String(transfer.moza._id || transfer.moza) : null;
      
      if (currentMozaId && purchaseByMozaId.has(currentMozaId)) {
        const matchingPurchase = purchaseByMozaId.get(currentMozaId);
        
        // If current transfer is linked to wrong purchase or unlinked
        if (String(transfer.landPurchase) !== String(matchingPurchase._id)) {
          console.log(`  🔄 Re-linking Transfer ${transfer.referenceNo || transfer.transferNo} (Deal ${dealNo}):`);
          console.log(`     Old Purchase: ${transfer.purchaseNo || 'None'} -> New Purchase: ${matchingPurchase.purchaseNo} (Moza: ${matchingPurchase.moza?.name})`);

          transfer.landPurchase = matchingPurchase._id;
          transfer.purchaseNo = matchingPurchase.purchaseNo;
          await transfer.save();
          totalUpdatedTransfers++;
        }
      } else {
        skippedTransfers++;
      }
    }
  }

  console.log('\n==================================================');
  console.log(`✅ Multi-Moza Re-Linking Summary for DB (${mongoose.connection.name}):`);
  console.log(`   Total Transfers Updated: ${totalUpdatedTransfers}`);
  console.log(`   Transfers Skipped / Unchanged: ${skippedTransfers}`);
  console.log('==================================================\n');

  await mongoose.disconnect();
}

async function run() {
  const possibleUris = [
    process.env.MONGODB_URI,
    process.env.MONGODB_URI_LOCAL,
    'mongodb://127.0.0.1:27017/sgc_erp_local',
    'mongodb://127.0.0.1:27017/sgc_erp',
    'mongodb://127.0.0.1:27017/sgc-erp-backend'
  ].filter(Boolean);

  const targetUris = [...new Set(possibleUris)];

  for (const uri of targetUris) {
    try {
      await fixMultiMozaTransfers(uri);
    } catch (err) {
      console.error(`❌ Error executing migration on ${uri}:`, err.message);
      try { await mongoose.disconnect(); } catch (e) {}
    }
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { fixMultiMozaTransfers };
