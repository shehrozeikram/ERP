const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandParty = require('../models/tajResidencia/LandParty');

const excelPath = path.join(__dirname, '../../docs/land installment & payee.xlsx');

function excelDateToJSDate(serial) {
  if (!serial) return null;
  if (typeof serial === 'string') {
    const d = new Date(serial);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof serial === 'number') {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  }
  return null;
}

async function runDryRun() {
  const isApply = process.argv.includes('--apply');
  console.log(`=== RUNNING LAND INSTALLMENT & PAYEE IMPORT (${isApply ? 'APPLY MODE' : 'DRY RUN MODE'}) ===\n`);

  const { connectDB } = require('../config/database');
  await connectDB();


  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets['Sheet1'];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // Load existing Moza map
  const mozas = await LandMoza.find({});
  const mozaMap = {};
  mozas.forEach(m => {
    mozaMap[m.name.trim().toLowerCase()] = m._id;
  });

  let currentDeal = null;
  const parsedDeals = [];

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const colIndex = row[0];
    const dateVal = row[1];
    const dealNoVal = row[2];
    const sellerVal = row[3];
    const mozaVal = row[4];
    const khasraVal = row[5];
    const kanalVal = row[6];
    const marlaVal = row[7];
    const sarsaiVal = row[8];
    const rateVal = row[9];
    const purchaseVal = row[10];

    // Installment columns
    const instDesc = row[11];
    const instAmount = row[12];
    const instReceived = row[13];
    const instBalance = row[14];
    const instDueDate = row[15];
    const instStatus = row[16];

    // Payment columns
    const payRefNo = row[17];
    const payDesc = row[18];
    const payAmount = row[19];
    const payChequeNo = row[20];
    const payChequeDate = row[21];
    const payPayeeName = row[22];

    // Check if this row is a Header/Main Deal Row
    const isNewDealRow = (dealNoVal !== undefined && dealNoVal !== null && dealNoVal !== '' && typeof dealNoVal === 'number');

    if (isNewDealRow) {
      if (currentDeal) {
        parsedDeals.push(currentDeal);
      }
      currentDeal = {
        index: colIndex,
        date: excelDateToJSDate(dateVal),
        dealNo: Number(dealNoVal),
        sellerName: sellerVal ? String(sellerVal).trim() : '',
        mozaName: mozaVal ? String(mozaVal).trim() : '',
        khasra: khasraVal ? String(khasraVal).trim() : '',
        kanal: Number(kanalVal) || 0,
        marla: Number(marlaVal) || 0,
        sarsai: Number(sarsaiVal) || 0,
        ratePerKanal: Number(rateVal) || 0,
        agreedAmount: Number(purchaseVal) || 0,
        installments: [],
        payments: []
      };
    } else if (currentDeal) {
      // Check if it's an installment/payment sub-row
      const isInstallmentHeaderOrTotal = instDesc === 'Installment' || instDesc === 'Total';
      const isPaymentHeaderOrTotal = payDesc === 'Description' || payDesc === 'Total';

      if (!isInstallmentHeaderOrTotal && (instDesc || instAmount !== undefined)) {
        currentDeal.installments.push({
          description: instDesc ? String(instDesc).trim() : 'Installment',
          amount: Number(instAmount) || 0,
          received: Number(instReceived) || 0,
          balance: Number(instBalance) || 0,
          dueDate: excelDateToJSDate(instDueDate),
          status: instStatus ? String(instStatus).trim() : 'Pending'
        });
      }

      if (!isPaymentHeaderOrTotal && (payDesc || payAmount !== undefined || payChequeNo || payPayeeName)) {
        currentDeal.payments.push({
          refNo: payRefNo ? String(payRefNo).trim() : '',
          description: payDesc ? String(payDesc).trim() : '',
          amountPaid: Number(payAmount) || 0,
          chequeNo: payChequeNo ? String(payChequeNo).trim() : '',
          chequeDate: excelDateToJSDate(payChequeDate),
          payeeName: payPayeeName ? String(payPayeeName).trim() : ''
        });
      }
    }
  }
  if (currentDeal) {
    parsedDeals.push(currentDeal);
  }

  console.log(`Total Deal Blocks parsed from Excel: ${parsedDeals.length}`);

  let matchedCount = 0;
  let missingCount = 0;
  let totalInsts = 0;
  let totalPays = 0;

  for (const deal of parsedDeals) {
    totalInsts += deal.installments.length;
    totalPays += deal.payments.length;

    const mozaId = mozaMap[deal.mozaName.toLowerCase()];
    let query = { dealNo: deal.dealNo };
    if (mozaId) {
      query.moza = mozaId;
    }

    let dbDeal = await LandPurchase.findOne(query);
    if (!dbDeal) {
      // Fallback: match strictly by dealNo if Moza name format differs slightly
      dbDeal = await LandPurchase.findOne({ dealNo: deal.dealNo });
    }

    if (dbDeal) {
      matchedCount++;
    } else {
      missingCount++;
      if (missingCount <= 10) {
        console.log(`[MISSING IN DB] Deal No: ${deal.dealNo}, Moza: ${deal.mozaName}, Seller: ${deal.sellerName}`);
      }
    }
  }

  console.log('\n--- SUMMARY STATS ---');
  console.log(`Deals Matched in DB: ${matchedCount}`);
  console.log(`Deals Missing in DB: ${missingCount}`);
  console.log(`Total Installments Parsed: ${totalInsts}`);
  console.log(`Total Payments Parsed: ${totalPays}`);

  if (isApply) {
    console.log('\nApplying updates to MongoDB...');
    let updatedCount = 0;

    for (const deal of parsedDeals) {
      const mozaId = mozaMap[deal.mozaName.toLowerCase()];
      let query = { dealNo: deal.dealNo };
      if (mozaId) query.moza = mozaId;

      let dbDeal = await LandPurchase.findOne(query);
      if (!dbDeal) {
        dbDeal = await LandPurchase.findOne({ dealNo: deal.dealNo });
      }
      if (!dbDeal) continue;

      const formattedInstallments = deal.installments.map(inst => {
        let status = 'Pending';
        if (inst.received >= inst.amount && inst.amount > 0) {
          status = 'Paid';
        } else if (inst.received > 0) {
          status = 'Partial';
        }

        return {
          description: inst.description || 'Installment',
          amount: inst.amount,
          paidAmount: inst.received,
          dueDate: inst.dueDate || new Date(),
          status: status
        };
      });

      // Also merge payment remarks/details if payments exist
      let narrationParts = deal.payments.map(p => 
        [p.description, p.payeeName ? `Payee: ${p.payeeName}` : '', p.chequeNo ? `Chq: ${p.chequeNo}` : ''].filter(Boolean).join(' | ')
      ).filter(Boolean);

      dbDeal.installments = formattedInstallments;
      if (narrationParts.length > 0) {
        dbDeal.paymentRemarks = narrationParts.join('; ');
      }

      await dbDeal.save();
      updatedCount++;
    }
    console.log(`Successfully updated ${updatedCount} LandPurchase records in DB.`);
  } else {
    console.log('\nDry run complete. No DB records were modified. Pass --apply to execute the update.');
  }

  await mongoose.disconnect();
}

runDryRun().catch(err => {
  console.error('Error running script:', err);
  process.exit(1);
});
