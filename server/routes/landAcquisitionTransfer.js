const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandParty = require('../models/tajResidencia/LandParty');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
const LandPossession = require('../models/tajResidencia/LandPossession');
const LandRegistry = require('../models/tajResidencia/LandRegistry');
const {
  parseAreaInput,
  normalizeArea,
  toSarsais,
  MARLA_PER_KANAL,
  SARSAIS_PER_KANAL
} = require('../utils/landAreaUnits');
const FinanceHelper = require('../utils/financeHelper');
const { co, acct, withCompany } = require('../utils/financePosting');

const router = express.Router();

const areaToDecimalKanal = (area) => {
  const a = normalizeArea(area);
  return a.kanal + (a.marla / MARLA_PER_KANAL) + (a.sarsai / SARSAIS_PER_KANAL);
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const parseLines = (lines = []) => {
  if (!Array.isArray(lines)) return [];
  return lines.map((line) => ({
    khasraEntry: line.khasraEntry || undefined,
    khewatNo: String(line.khewatNo || '').trim(),
    khasraNo: String(line.khasraNo || '').trim(),
    khasraArea: parseAreaInput(line.khasraArea)
  })).filter((line) => line.khasraEntry || line.khasraNo);
};

const parseTransferPayments = (payments = []) => {
  if (!Array.isArray(payments)) return [];
  return payments
    .map((row) => ({
      paymentType: String(row.paymentType || '').trim(),
      status: row.status === 'Paid' ? 'Paid' : 'Pending',
      description: String(row.description || '').trim(),
      amount: roundMoney(row.amount),
      amountInWords: String(row.amountInWords || '').trim(),
      paymentDate: row.paymentDate ? new Date(row.paymentDate) : undefined,
      paymentMode: String(row.paymentMode || '').trim(),
      drawnOn: String(row.drawnOn || '').trim(),
      refNo: String(row.refNo || '').trim(),
      payeeName: String(row.payeeName || '').trim(),
      instrument: String(row.instrument || '').trim(),
      instrumentDate: row.instrumentDate ? new Date(row.instrumentDate) : undefined
    }))
    .filter((row) => row.paymentType);
};

const sumTransferPayments = (payments = []) =>
  payments.reduce((sum, row) => sum + roundMoney(row.amount), 0);

const mapTransfer = (doc) => (doc?.toObject ? doc.toObject() : doc);

async function nextTransferNumbers() {
  const transfers = await LandTransfer.find({})
    .select('referenceNo transferNo')
    .lean();

  let maxUtn = 0;
  let maxLtn = 0;
  for (const row of transfers) {
    const ltnTransferMatch = String(row.transferNo || '').match(/LT-(\d+)/i);
    if (ltnTransferMatch) {
      const n = Number(ltnTransferMatch[1]);
      if (!Number.isNaN(n) && n > maxUtn) maxUtn = n;
    }
    const ltnMatch = String(row.referenceNo || '').match(/LTN-(\d+)/i);
    if (ltnMatch) {
      const n = Number(ltnMatch[1]);
      if (!Number.isNaN(n) && n > maxLtn) maxLtn = n;
    }
  }

  const next = Math.max(maxUtn, maxLtn) + 1;
  return {
    transferNo: `LT-${String(next).padStart(4, '0')}`,
    referenceNo: `LTN-${String(next).padStart(6, '0')}`
  };
};

const buildTransferPayload = (body, purchase) => {
  const purchaseArea = parseAreaInput(body.purchaseArea);
  const transferArea = parseAreaInput(body.transferArea);
  const purchaseSizeInKanal = roundMoney(areaToDecimalKanal(purchaseArea));
  const transferSizeInKanal = roundMoney(areaToDecimalKanal(transferArea));
  const ratePerKanal = roundMoney(purchase?.ratePerKanal || body.ratePerKanal || 0);
  const transferPayments = parseTransferPayments(body.transferPayments);
  const totalTransferPayments = roundMoney(sumTransferPayments(transferPayments));

  return {
    referenceNo: String(body.referenceNo || '').trim(),
    transferDate: body.transferDate ? new Date(body.transferDate) : null,
    intiqalNo: String(body.intiqalNo || '').trim(),
    registryNo: String(body.registryNo || '').trim(),
    purchaser: body.purchaser || undefined,
    purchaserCnic: String(body.purchaserCnic || '').trim(),
    purchaserName: String(body.purchaserName || '').trim(),
    seller: body.seller || undefined,
    sellerCnic: String(body.sellerCnic || '').trim(),
    sellerName: String(body.sellerName || '').trim(),
    lines: parseLines(body.lines),
    purchaseArea,
    transferArea,
    purchaseSizeInKanal,
    transferSizeInKanal,
    ratePerKanal,
    transferPayments,
    totalTransferPayments,
    totalTransferPaymentsInWords: String(body.totalTransferPaymentsInWords || '').trim(),
    status: body.status === 'Closed' ? 'Closed' : 'Open'
  };
};

const validateTransferPayload = async (payload, purchase, { isCreate = false } = {}) => {
  if (!payload.referenceNo) {
    const err = new Error('Reference number is required');
    err.status = 400;
    throw err;
  }
  if (!payload.transferDate || Number.isNaN(payload.transferDate.getTime())) {
    const err = new Error('Transfer date is required');
    err.status = 400;
    throw err;
  }
  if (!payload.lines.length) {
    const err = new Error('At least one khasra is required');
    err.status = 400;
    throw err;
  }
  if (!toSarsais(payload.transferArea)) {
    const err = new Error('Transfer size is required');
    err.status = 400;
    throw err;
  }
  if (toSarsais(payload.transferArea) > toSarsais(payload.purchaseArea)) {
    const err = new Error('Transfer size cannot exceed selected purchase land size');
    err.status = 400;
    throw err;
  }

  if (isCreate) {
    const duplicateRef = await LandTransfer.findOne({
      referenceNo: payload.referenceNo,
      isActive: true
    });
    if (duplicateRef) {
      const err = new Error('Reference number already exists');
      err.status = 400;
      throw err;
    }
  }

  if (payload.purchaser) {
    const purchaser = await LandParty.findOne({ _id: payload.purchaser, partyType: 'buyer', isActive: true });
    if (!purchaser) {
      const err = new Error('Purchaser not found');
      err.status = 404;
      throw err;
    }
  }

  if (!payload.seller) {
    const err = new Error('Seller is required');
    err.status = 400;
    throw err;
  }

  const seller = await LandParty.findOne({ _id: payload.seller, partyType: 'seller', isActive: true });
  if (!seller) {
    const err = new Error('Seller not found');
    err.status = 404;
    throw err;
  }

  const mozaId = purchase.moza?._id || purchase.moza;
  for (const line of payload.lines) {
    if (!line.khasraEntry) continue;
    const entry = await LandMozaKhasraEntry.findOne({ _id: line.khasraEntry, moza: mozaId });
    if (!entry) {
      const err = new Error('Selected khasra is not part of this moza');
      err.status = 400;
      throw err;
    }
  }
};

const populateTransfer = (query) => query
  .populate('landPurchase', 'purchaseNo dealNo ratePerKanal agreedAmount')
  .populate('seller', 'name cnic phoneNumber')
  .populate('purchaser', 'name cnic phoneNumber')
  .populate('moza', 'name slug');

// GET /transfers/next-numbers
router.get('/transfers/next-numbers', asyncHandler(async (req, res) => {
  const data = await nextTransferNumbers();
  res.json({ success: true, data });
}));

/**
 * Creates ONE single BPV for a land transfer payment.
 * debitLines = [{ paymentType, amount }] — one debit line per selected payment type.
 * One credit line for the bank account for the total.
 *
 * NOTE: LandTransfer has no companyId, so we resolve companyId from the bank account itself.
 */
async function createSingleBPV({ transfer, bankAccountId, debitLines, totalAmount, narration, paymentDate, createdBy }) {
  if (!totalAmount || !bankAccountId || !debitLines.length) return null;

  try {
    const Account = require('../models/finance/Account');

    // 1. Find bank account directly by ID (LandTransfer has no companyId)
    const bankAcc = await Account.findById(bankAccountId).lean();
    if (!bankAcc) {
      console.warn('[BPV] Bank account not found:', bankAccountId);
      return null;
    }

    // 2. Use the bank account's companyId for scoped lookups
    const companyId = bankAcc.companyId || null;
    const A = acct(companyId);

    // 3. Resolve Land Acquisition expense account
    //    Priority: name match → account number 5001 → any Expense account in same company
    let expenseAcc = null;

    if (companyId) {
      expenseAcc = await Account.findOne({
        companyId,
        name: /Land Acquisition/i,
        isActive: true
      }).lean();
    }
    if (!expenseAcc) {
      expenseAcc = await Account.findOne({ name: /Land Acquisition/i, isActive: true }).lean();
    }
    if (!expenseAcc) {
      expenseAcc = await A.resolve('5001'); // General Expense
    }
    if (!expenseAcc && companyId) {
      expenseAcc = await Account.findOne({ companyId, type: 'Expense', isActive: true }).lean();
    }
    if (!expenseAcc) {
      expenseAcc = await Account.findOne({ type: 'Expense', isActive: true }).lean();
    }
    if (!expenseAcc) {
      console.warn('[BPV] No expense account found for Land Transfer BPV');
      return null;
    }

    // 4. Build journal lines: one debit per payment type + one credit for bank
    const journalLines = [
      ...debitLines.map(({ paymentType, amount }) => ({
        account: expenseAcc._id,
        description: `Land Transfer – ${paymentType} (${transfer.transferNo})`,
        debit: roundMoney(amount),
        credit: 0,
        department: 'general'
      })),
      {
        account: bankAcc._id,
        description: `Bank Payment – Transfer ${transfer.transferNo}`,
        debit: 0,
        credit: roundMoney(totalAmount),
        department: 'general'
      }
    ];

    // 5. Create and post the single BPV
    const payload = {
      date: paymentDate || new Date(),
      reference: `LT-${transfer.transferNo}`,
      referenceType: 'payment',
      referenceId: transfer._id,
      description: narration || `BPV: Land Transfer Payment – ${transfer.transferNo}`,
      department: 'general',
      module: 'general',
      journalCode: 'BANK',
      voucherSeries: 'BPV',
      createdBy,
      lines: journalLines
    };

    if (companyId) payload.companyId = companyId;

    const entry = await FinanceHelper.createAndPostJournalEntry(payload);
    console.log(`[BPV] Created BPV ${entry.entryNumber || entry._id} for Transfer ${transfer.transferNo}`);
    return entry._id;
  } catch (error) {
    console.error('[BPV] Error creating BPV for Land Transfer payment:', error.message);
    return null;
  }
}


// GET /transfers/deals
router.get('/transfers', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const purchase = String(req.query.purchase || '').trim();
  const moza = String(req.query.moza || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const skip = (page - 1) * limit;

  const filter = { isActive: true };
  if (purchase) filter.landPurchase = purchase;
  if (moza) {
    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(moza)) {
      filter.moza = new mongoose.Types.ObjectId(moza);
    } else {
      filter.moza = moza;
    }
  }

  let transfers = await populateTransfer(LandTransfer.find(filter))
    .sort({ createdAt: -1 })
    .lean();

  if (search) {
    const q = search.toLowerCase();
    transfers = transfers.filter((row) =>
      String(row.referenceNo || '').toLowerCase().includes(q)
      || String(row.transferNo || '').toLowerCase().includes(q)
      || String(row.purchaseNo || '').toLowerCase().includes(q)
      || String(row.dealNo || '').includes(q)
      || String(row.intiqalNo || '').toLowerCase().includes(q)
      || String(row.registryNo || '').toLowerCase().includes(q)
      || String(row.moza?.name || '').toLowerCase().includes(q)
      || String(row.sellerName || '').toLowerCase().includes(q)
      || String(row.purchaserName || '').toLowerCase().includes(q)
    );
  }

  const total = transfers.length;
  const pageRows = transfers.slice(skip, skip + limit);

  res.json({
    success: true,
    data: {
      transfers: pageRows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
    }
  });
}));

// GET /transfers/:id
router.get('/transfers/:id', asyncHandler(async (req, res) => {
  const transfer = await populateTransfer(
    LandTransfer.findOne({ _id: req.params.id, isActive: true })
  );

  if (!transfer) {
    return res.status(404).json({ success: false, message: 'Land transfer not found' });
  }

  res.json({ success: true, data: mapTransfer(transfer) });
}));

// POST /transfers
router.post('/transfers', asyncHandler(async (req, res) => {
  const purchase = await LandPurchase.findOne({ _id: req.body.landPurchase, isActive: true })
    .populate('seller', 'name cnic')
    .populate('moza', 'name');

  if (!purchase) {
    return res.status(404).json({ success: false, message: 'Land purchase not found' });
  }

  const payload = buildTransferPayload(req.body, purchase);
  await validateTransferPayload(payload, purchase, { isCreate: true });

  const numbers = await nextTransferNumbers();
  const sellerId = payload.seller || purchase.seller?._id || purchase.seller;
  const sellerParty = await LandParty.findOne({ _id: sellerId, partyType: 'seller', isActive: true }).lean();

  const transfer = await LandTransfer.create({
    ...payload,
    transferNo: numbers.transferNo,
    referenceNo: payload.referenceNo || numbers.referenceNo,
    landPurchase: purchase._id,
    dealNo: purchase.dealNo,
    purchaseNo: purchase.purchaseNo,
    moza: purchase.moza?._id || purchase.moza,
    seller: sellerId,
    sellerCnic: payload.sellerCnic || sellerParty?.cnic || '',
    sellerName: payload.sellerName || sellerParty?.name || '',
    createdBy: req.user?._id || req.user?.id
  });

  const populated = await populateTransfer(LandTransfer.findById(transfer._id));
  res.status(201).json({ success: true, message: 'Land transfer created', data: mapTransfer(populated) });
}));

// PUT /transfers/:id
router.put('/transfers/:id', asyncHandler(async (req, res) => {
  const existing = await LandTransfer.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land transfer not found' });
  }

  const purchase = await LandPurchase.findOne({ _id: existing.landPurchase, isActive: true });
  if (!purchase) {
    return res.status(404).json({ success: false, message: 'Linked land purchase not found' });
  }

  const payload = buildTransferPayload(req.body, purchase);
  if (payload.referenceNo !== existing.referenceNo) {
    const duplicateRef = await LandTransfer.findOne({
      referenceNo: payload.referenceNo,
      isActive: true,
      _id: { $ne: existing._id }
    });
    if (duplicateRef) {
      return res.status(400).json({ success: false, message: 'Reference number already exists' });
    }
  }

  await validateTransferPayload(payload, purchase);

  Object.assign(existing, payload);
  existing.updatedBy = req.user?._id || req.user?.id;
  await existing.save();

  const populated = await populateTransfer(LandTransfer.findById(existing._id));
  res.json({ success: true, message: 'Land transfer updated', data: mapTransfer(populated) });
}));

// PATCH /transfers/:id/close
router.patch('/transfers/:id/close', asyncHandler(async (req, res) => {
  const existing = await LandTransfer.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land transfer not found' });
  }

  existing.status = 'Closed';
  existing.updatedBy = req.user?._id || req.user?.id;
  await existing.save();

  const populated = await populateTransfer(LandTransfer.findById(existing._id));
  res.json({ success: true, message: 'Land transfer closed', data: mapTransfer(populated) });
}));

// DELETE /transfers/:id
router.delete('/transfers/:id', asyncHandler(async (req, res) => {
  const existing = await LandTransfer.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land transfer not found' });
  }

  existing.isActive = false;
  existing.updatedBy = req.user?._id || req.user?.id;
  await existing.save();

  res.json({ success: true, message: 'Land transfer deleted' });
}));

// GET /reports/land-summary — Land Summary Report by Moza
router.get('/reports/land-summary', asyncHandler(async (req, res) => {
  const SARSAIS_PER_MARLA = 9;
  const MARLA_PER_KANAL_CONST = 20;
  const TOTAL_SARSAIS_PER_KANAL = SARSAIS_PER_MARLA * MARLA_PER_KANAL_CONST;

  // Helper to convert {kanal, marla, sarsai} to total sarsais
  const toSarsaisLocal = (area) => {
    const a = area || {};
    return ((Number(a.kanal) || 0) * TOTAL_SARSAIS_PER_KANAL)
      + ((Number(a.marla) || 0) * SARSAIS_PER_MARLA)
      + (Number(a.sarsai) || 0);
  };

  // Helper to convert sarsais back to {kanal, marla, sarsai}
  const fromSarsais = (total) => {
    const kanal = Math.floor(total / TOTAL_SARSAIS_PER_KANAL);
    const rem1 = total % TOTAL_SARSAIS_PER_KANAL;
    const marla = Math.floor(rem1 / SARSAIS_PER_MARLA);
    const sarsai = Math.round((rem1 % SARSAIS_PER_MARLA) * 1000) / 1000;
    return { kanal, marla, sarsai };
  };

  // 1. Fetch all active purchases with moza info
  const purchases = await LandPurchase.find({ isActive: true })
    .populate('moza', 'name')
    .lean();

  // 2. Fetch all active transfers for transfer charges aggregation
  const transfers = await LandTransfer.find({ isActive: true })
    .populate('moza', 'name')
    .lean();

  // Build a map: purchaseId -> totalTransferPayments (transfer charges)
  const transferChargesByPurchase = {};
  for (const t of transfers) {
    const pid = String(t.landPurchase);
    transferChargesByPurchase[pid] = (transferChargesByPurchase[pid] || 0)
      + (Number(t.totalTransferPayments) || 0);
  }

  // 3. Group purchases by moza
  const mozaMap = {};
  for (const p of purchases) {
    const mozaId = String(p.moza?._id || p.moza);
    const mozaName = p.moza?.name || 'Unknown';
    if (!mozaMap[mozaId]) {
      mozaMap[mozaId] = {
        mozaId,
        mozaName,
        totalSarsais: 0,
        landValue: 0,
        transferCharges: 0,
        commission: 0
      };
    }
    mozaMap[mozaId].totalSarsais += toSarsaisLocal(p.totalArea);
    mozaMap[mozaId].landValue += Number(p.agreedAmount) || 0;
    mozaMap[mozaId].transferCharges += transferChargesByPurchase[String(p._id)] || 0;
    // Commission: govtLandValue is used as a proxy for commission/allied expense
    mozaMap[mozaId].commission += Number(p.govtLandValue) || 0;
  }

  // 4. Build result rows
  const rows = Object.values(mozaMap).map((m) => {
    const area = fromSarsais(m.totalSarsais);
    const totalAllied = m.landValue + m.transferCharges + m.commission;
    return {
      mozaName: m.mozaName,
      kanal: area.kanal,
      marla: area.marla,
      sarsai: area.sarsai,
      landValue: Math.round(m.landValue * 100) / 100,
      transferCharges: Math.round(m.transferCharges * 100) / 100,
      commission: Math.round(m.commission * 100) / 100,
      totalAllied: Math.round(totalAllied * 100) / 100
    };
  }).sort((a, b) => b.kanal - a.kanal || b.marla - a.marla);

  // 5. Grand totals
  const grandTotalSarsais = rows.reduce((s, r) => s + toSarsaisLocal({ kanal: r.kanal, marla: r.marla, sarsai: r.sarsai }), 0);
  const grandArea = fromSarsais(grandTotalSarsais);
  const totals = {
    kanal: grandArea.kanal,
    marla: grandArea.marla,
    sarsai: grandArea.sarsai,
    landValue: Math.round(rows.reduce((s, r) => s + r.landValue, 0) * 100) / 100,
    transferCharges: Math.round(rows.reduce((s, r) => s + r.transferCharges, 0) * 100) / 100,
    commission: Math.round(rows.reduce((s, r) => s + r.commission, 0) * 100) / 100,
    totalAllied: Math.round(rows.reduce((s, r) => s + r.totalAllied, 0) * 100) / 100
  };

  // 6. Owner (purchaser) summary by land transfer
  const purchaserMap = {};
  for (const t of transfers) {
    const name = t.purchaserName || 'In Progress';
    if (!purchaserMap[name]) purchaserMap[name] = { ownerName: name, totalSarsais: 0 };
    purchaserMap[name].totalSarsais += toSarsaisLocal(t.transferArea);
  }

  const ownerRows = Object.values(purchaserMap).map((o) => {
    const area = fromSarsais(o.totalSarsais);
    return { ownerName: o.ownerName, kanal: area.kanal, marla: area.marla, sarsai: area.sarsai };
  }).sort((a, b) => b.kanal - a.kanal || b.marla - a.marla);

  const ownerTotalSarsais = ownerRows.reduce((s, r) => s + toSarsaisLocal({ kanal: r.kanal, marla: r.marla, sarsai: r.sarsai }), 0);
  const ownerTotalArea = fromSarsais(ownerTotalSarsais);
  const ownerTotals = { kanal: ownerTotalArea.kanal, marla: ownerTotalArea.marla, sarsai: ownerTotalArea.sarsai };

  // 6a. Registry summary by moza
  const registries = await LandRegistry.find({ isActive: true }).populate('moza', 'name').lean();
  const registryMozaMap = {};
  for (const r of registries) {
    const mozaId = String(r.moza?._id || r.moza);
    const mozaName = r.moza?.name || 'Unknown';
    if (!registryMozaMap[mozaId]) registryMozaMap[mozaId] = { mozaName, totalSarsais: 0 };
    registryMozaMap[mozaId].totalSarsais += toSarsaisLocal(r.totalArea);
  }

  const registryMozaRows = Object.values(registryMozaMap).map((m) => {
    const area = fromSarsais(m.totalSarsais);
    return { mozaName: m.mozaName, kanal: area.kanal, marla: area.marla, sarsai: area.sarsai };
  }).sort((a, b) => b.kanal - a.kanal || b.marla - a.marla);

  const registryTotalSarsais = registryMozaRows.reduce((s, r) => s + toSarsaisLocal({ kanal: r.kanal, marla: r.marla, sarsai: r.sarsai }), 0);
  const registryTotalArea = fromSarsais(registryTotalSarsais);
  const registryMozaTotals = { kanal: registryTotalArea.kanal, marla: registryTotalArea.marla, sarsai: registryTotalArea.sarsai };

  // 7. Overall Dashboard Totals & Possession by moza
  const possessions = await LandPossession.find({ isActive: true })
    .populate('moza', 'name')
    .lean();

  const possessionMozaMap = {};
  const unregisteredPossessionMozaMap = {};
  let totalPossessedSarsais = 0;
  let totalUnregisteredPossessedSarsais = 0;
  for (const pos of possessions) {
    const mozaId = String(pos.moza?._id || pos.moza);
    const mozaName = pos.moza?.name || 'Unknown';
    const sarsais = toSarsaisLocal(pos.totalArea);

    if (!pos.registry && !(pos.lines && pos.lines.some(l => l.registry))) {
      // Unregistered possession
      if (!unregisteredPossessionMozaMap[mozaId]) unregisteredPossessionMozaMap[mozaId] = { mozaName, totalSarsais: 0 };
      unregisteredPossessionMozaMap[mozaId].totalSarsais += sarsais;
      totalUnregisteredPossessedSarsais += sarsais;
    } else {
      // Registered possession
      if (!possessionMozaMap[mozaId]) possessionMozaMap[mozaId] = { mozaName, totalSarsais: 0 };
      possessionMozaMap[mozaId].totalSarsais += sarsais;
      totalPossessedSarsais += sarsais;
    }
  }

  const possessionMozaRows = Object.values(possessionMozaMap).map((m) => {
    const area = fromSarsais(m.totalSarsais);
    return { mozaName: m.mozaName, kanal: area.kanal, marla: area.marla, sarsai: area.sarsai };
  }).sort((a, b) => b.kanal - a.kanal || b.marla - a.marla);

  const possessionTotalArea = fromSarsais(totalPossessedSarsais);
  const possessionMozaTotals = { kanal: possessionTotalArea.kanal, marla: possessionTotalArea.marla, sarsai: possessionTotalArea.sarsai };

  const unregisteredPossessionMozaRows = Object.values(unregisteredPossessionMozaMap).map((m) => {
    const area = fromSarsais(m.totalSarsais);
    return { mozaName: m.mozaName, kanal: area.kanal, marla: area.marla, sarsai: area.sarsai };
  }).sort((a, b) => b.kanal - a.kanal || b.marla - a.marla);

  const unregisteredPossessionTotalArea = fromSarsais(totalUnregisteredPossessedSarsais);
  const unregisteredPossessionMozaTotals = { kanal: unregisteredPossessionTotalArea.kanal, marla: unregisteredPossessionTotalArea.marla, sarsai: unregisteredPossessionTotalArea.sarsai };

  // 7a. Pending Possession summary by moza
  const pendingPossessionMozaMap = {};
  let totalPendingSarsais = 0;
  for (const mozaId in registryMozaMap) {
    const regSarsais = registryMozaMap[mozaId].totalSarsais;
    const posSarsais = possessionMozaMap[mozaId] ? possessionMozaMap[mozaId].totalSarsais : 0;
    const pendingSarsais = Math.max(0, regSarsais - posSarsais);
    if (pendingSarsais > 0) {
      pendingPossessionMozaMap[mozaId] = { mozaName: registryMozaMap[mozaId].mozaName, totalSarsais: pendingSarsais };
      totalPendingSarsais += pendingSarsais;
    }
  }

  const pendingPossessionMozaRows = Object.values(pendingPossessionMozaMap).map((m) => {
    const area = fromSarsais(m.totalSarsais);
    return { mozaName: m.mozaName, kanal: area.kanal, marla: area.marla, sarsai: area.sarsai };
  }).sort((a, b) => b.kanal - a.kanal || b.marla - a.marla);

  const pendingTotalArea = fromSarsais(totalPendingSarsais);
  const pendingPossessionMozaTotals = { kanal: pendingTotalArea.kanal, marla: pendingTotalArea.marla, sarsai: pendingTotalArea.sarsai };

  const totalPurchaseSarsais = grandTotalSarsais;
  const remainingSarsais = Math.max(0, totalPurchaseSarsais - totalPossessedSarsais);

  const dashboardTotals = {
    purchased: fromSarsais(totalPurchaseSarsais),
    possessed: fromSarsais(totalPossessedSarsais),
    remaining: fromSarsais(remainingSarsais)
  };

  res.json({
    success: true,
    data: {
      landSummary: { rows, totals },
      ownerSummary: { rows: ownerRows, totals: ownerTotals },
      dashboardTotals,
      registryMozaSummary: { rows: registryMozaRows, totals: registryMozaTotals },
      possessionMozaSummary: { rows: possessionMozaRows, totals: possessionMozaTotals },
      pendingPossessionMozaSummary: { rows: pendingPossessionMozaRows, totals: pendingPossessionMozaTotals },
      unregisteredPossessionMozaSummary: { rows: unregisteredPossessionMozaRows, totals: unregisteredPossessionMozaTotals }
    }
  });
}));
// POST /transfers/:id/payments
router.post('/transfers/:id/payments', asyncHandler(async (req, res) => {
  const existing = await LandTransfer.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land transfer not found' });
  }

  // Build a map of { paymentType -> amount } from the request
  // Preferred: paymentTypesWithAmounts = [{ paymentType, amount }, ...]
  // Fallback: paymentTypes array + split total equally
  let typeAmountMap = {};

  if (Array.isArray(req.body.paymentTypesWithAmounts) && req.body.paymentTypesWithAmounts.length) {
    for (const entry of req.body.paymentTypesWithAmounts) {
      const pt = String(entry.paymentType || '').trim();
      if (pt) typeAmountMap[pt] = roundMoney(entry.amount);
    }
  } else if (Array.isArray(req.body.paymentTypes) && req.body.paymentTypes.length) {
    const pts = req.body.paymentTypes.map((t) => String(t).trim()).filter(Boolean);
    const total = roundMoney(req.body.amount);
    const perType = roundMoney(total / pts.length);
    pts.forEach((pt, i) => {
      typeAmountMap[pt] = i === pts.length - 1
        ? roundMoney(total - perType * (pts.length - 1))
        : perType;
    });
  } else if (req.body.paymentType) {
    const pt = String(req.body.paymentType).trim();
    typeAmountMap[pt] = roundMoney(req.body.amount);
  }

  const paymentTypes = Object.keys(typeAmountMap);
  if (!paymentTypes.length) {
    return res.status(400).json({ success: false, message: 'At least one payment type is required' });
  }

  const bankAccountId = req.body.bankAccountId || undefined;
  const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
  const paymentMode = String(req.body.paymentMode || '').trim();
  const refNo = String(req.body.refNo || '').trim();
  const narration = String(req.body.narration || '').trim();
  const whtRate = Number(req.body.whtRate) || 0;
  const createdBy = req.user?._id || req.user?.id;

  // Update/insert each selected payment type row — NO per-type voucher
  const debitLines = []; // collected for the single BPV
  for (const pt of paymentTypes) {
    const ptAmount = typeAmountMap[pt];

    const existingRow = existing.transferPayments.find(
      (row) => row.paymentType === pt && row.status !== 'Paid'
    );

    if (existingRow) {
      existingRow.status = 'Paid';
      if (ptAmount > 0) existingRow.amount = ptAmount;
      existingRow.paymentDate = paymentDate;
      existingRow.paymentMode = paymentMode;
      existingRow.bankAccountId = bankAccountId;
      existingRow.whtRate = whtRate;
      existingRow.refNo = refNo;
      existingRow.narration = narration;
    } else {
      existing.transferPayments.push({
        paymentType: pt,
        status: 'Paid',
        amount: ptAmount,
        amountInWords: String(req.body.amountInWords || '').trim(),
        paymentDate,
        paymentMode,
        bankAccountId,
        whtRate,
        refNo,
        narration
      });
    }

    if (ptAmount > 0) {
      debitLines.push({ paymentType: pt, amount: ptAmount });
    }
  }

  // Recompute totals
  existing.totalTransferPayments = roundMoney(sumTransferPayments(existing.transferPayments));
  existing.totalTransferPaymentsInWords = String(req.body.totalTransferPaymentsInWords || existing.totalTransferPaymentsInWords || '').trim();

  // Compute overall paymentStatus
  const allPaid = existing.transferPayments.every((r) => r.status === 'Paid');
  const somePaid = existing.transferPayments.some((r) => r.status === 'Paid');
  existing.paymentStatus = allPaid ? 'Paid' : somePaid ? 'Partial Paid' : 'Pending';

  existing.updatedBy = createdBy;
  await existing.save();

  // ── Create ONE single BPV for this payment action ────────────────────────────
  if (bankAccountId && debitLines.length > 0) {
    const totalAmount = debitLines.reduce((s, l) => s + l.amount, 0);
    const bpvNarration = narration
      || `BPV: Land Transfer ${existing.transferNo} – ${debitLines.map(l => l.paymentType).join(', ')}`;

    const voucherId = await createSingleBPV({
      transfer: existing,
      bankAccountId,
      debitLines,
      totalAmount,
      narration: bpvNarration,
      paymentDate,
      createdBy
    });

    // Attach voucher ID to all rows updated in this session
    if (voucherId) {
      for (const pt of paymentTypes) {
        const row = existing.transferPayments.find(
          (r) => r.paymentType === pt && r.status === 'Paid'
        );
        if (row && !row.voucherEntryId) row.voucherEntryId = voucherId;
      }
      await existing.save();
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const populated = await LandTransfer.findById(existing._id)
    .populate('landPurchase', 'purchaseNo dealNo ratePerKanal agreedAmount')
    .populate('seller', 'name cnic phoneNumber')
    .populate('purchaser', 'name cnic phoneNumber')
    .populate('moza', 'name slug');

  res.status(201).json({ success: true, message: 'Transfer payment recorded', data: mapTransfer(populated) });
}));



module.exports = router;
