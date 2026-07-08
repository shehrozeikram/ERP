require('dotenv').config({ path: __dirname + '/../../.env' });
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const { connectDB, disconnectDB } = require('../config/database');

const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandParty = require('../models/tajResidencia/LandParty');
const LandMoza = require('../models/tajResidencia/LandMoza');

const parseArea = (str) => {
  if (!str) return { kanal: 0, marla: 0, sarsai: 0 };
  const s = String(str).toLowerCase().trim();
  let kanal = 0, marla = 0, sarsai = 0;
  
  const kMatch = s.match(/([\d.]+)\s*kanal/);
  if (kMatch) kanal = parseFloat(kMatch[1]);
  
  const mMatch = s.match(/([\d.]+)\s*marla/);
  if (mMatch) marla = parseFloat(mMatch[1]);
  
  const sMatch = s.match(/([\d.]+)\s*sarsai/);
  if (sMatch) sarsai = parseFloat(sMatch[1]);
  
  if (!kMatch && !mMatch && !sMatch && !isNaN(parseFloat(s))) {
    kanal = parseFloat(s);
  }
  
  return { kanal, marla, sarsai };
};

const excelDateToJSDate = (serial) => {
  if (!serial) return null;
  if (typeof serial === 'number') {
    const utc_days  = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;                                        
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  }
  const d = new Date(serial);
  if (!isNaN(d.getTime())) return d;
  return null;
};

const run = async () => {
  await connectDB();
  
  const file = path.join(__dirname, '../../docs/Land Transfer detail.xlsx');
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
  
  console.log(`Read ${data.length} rows.`);

  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--prod');
  
  if (isDryRun) {
    console.log('--- DRY RUN (pass --prod to save) ---');
  }

  const mozas = await LandMoza.find();
  const getMozaId = async (name) => {
    let n = (name || 'Unknown Moza').toLowerCase().trim();
    if (n === 'ropa') n = 'rupa';
    const found = mozas.find(m => m.name.toLowerCase().trim() === n);
    if (found) return found._id;
    if (isDryRun) return `NEW_MOZA_${n}`;
    const newMoza = await LandMoza.create({ name: n, slug: n.replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-4) });
    mozas.push(newMoza);
    return newMoza._id;
  };

  const getOrCreateParty = async (name, type) => {
    const n = String(name || `Unknown ${type}`).trim();
    let p = await LandParty.findOne({ name: { $regex: new RegExp(`^${n}$`, 'i') }, partyType: type });
    if (!p) {
      if (isDryRun) {
        return `NEW_PARTY_${type}_${n}`;
      } else {
        const randomNum = Math.floor(1000000 + Math.random() * 9000000);
        const randomEnd = Math.floor(Math.random() * 10);
        p = await LandParty.create({ 
          name: n, 
          partyType: type,
          cnic: `00000-${randomNum}-${randomEnd}`,
          phoneNumber: '00000000000'
        });
      }
    }
    return isDryRun ? p._id || p : p._id;
  };

  let successCount = 0;
  let skipCount = 0;
  
  const paymentColumns = [
    '2% Deficiency', '7E - Tax', 'Advance Tax', 'Agent Commission', 'Commission',
    'CVT', 'Distrcit Council Fee', 'Fard Fee', 'Form No.32', 'Form No.32-A',
    'Gain Tax', 'Intiqal Transfer Fee', 'Miscellaneous Charges', 'Other',
    'Other / Miscellenous Cost', 'Patwari Fee', 'PLRA', 'Possession', 'Stamp Duty', 'Tehsil Fee'
  ];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    let dealNo = row['Deal No.'];
    if (dealNo === null || dealNo === undefined) {
      dealNo = 999000 + i;
    }
    
    // Append row number to ensure strictly unique reference number
    const baseRef = row['Reference No.'] ? String(row['Reference No.']).trim() : 'T';
    const referenceNo = `${baseRef}_R${i+2}`;
    
    const mozaId = await getMozaId(row['Moza']);
    const sellerId = await getOrCreateParty(row['Seller Name'], 'seller');
    const purchaserId = await getOrCreateParty(row['Purchaser Name'], 'buyer');
    const transferDate = excelDateToJSDate(row['Transfer Date']) || new Date();
    const transferArea = parseArea(row['Land']);
    
    let purchase = await LandPurchase.findOne({ dealNo: Number(dealNo) });
    if (!purchase && !isDryRun) {
      purchase = await LandPurchase.create({
        purchaseNo: `DUMMY-PURCHASE-${dealNo}-${Date.now().toString().slice(-4)}`,
        dealNo: Number(dealNo),
        purchaseDate: transferDate,
        seller: sellerId,
        moza: mozaId,
        totalArea: transferArea
      });
    }

    const transferPayments = [];
    let totalTransferPayments = 0;
    
    for (const col of paymentColumns) {
      let val = row[col];
      if (typeof val === 'string') {
        val = val.replace(/,/g, '');
        val = parseFloat(val);
      }
      if (val && !isNaN(val) && val > 0) {
        let pType = col;
        if (pType === 'Distrcit Council Fee') pType = 'District Council Fee';
        if (pType === 'Other / Miscellenous Cost') pType = 'Miscellaneous Cost';
        
        transferPayments.push({
          paymentType: pType,
          status: 'Pending',
          amount: val
        });
        totalTransferPayments += val;
      }
    }
    
    const payload = {
      referenceNo: String(referenceNo),
      transferNo: String(referenceNo),
      landPurchase: isDryRun ? 'DUMMY_PURCHASE' : purchase._id,
      dealNo: purchase ? purchase.dealNo : Number(dealNo),
      purchaseNo: purchase ? purchase.purchaseNo : `DUMMY-${dealNo}`,
      transferDate,
      intiqalNo: row['Inteqal No.'] ? String(row['Inteqal No.']) : '',
      registryNo: row['Registry No.'] ? String(row['Registry No.']) : '',
      moza: mozaId,
      seller: sellerId,
      purchaser: purchaserId,
      lines: [], 
      purchaseArea: purchase ? purchase.totalArea : transferArea,
      transferArea,
      transferPayments,
      totalTransferPayments,
      status: 'Closed',
      paymentStatus: 'Pending'
    };
    
    if (isDryRun) {
      successCount++;
    } else {
      try {
        await LandTransfer.create(payload);
        successCount++;
      } catch (err) {
        console.error(`Row ${i + 2}: Failed to create transfer - ${err.message}`);
        skipCount++;
      }
    }
  }
  
  console.log(`\nDone. Success: ${successCount}, Skipped: ${skipCount}`);
  process.exit(0);
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
