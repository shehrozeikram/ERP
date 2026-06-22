const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandParty = require('../models/tajResidencia/LandParty');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
const LandPossession = require('../models/tajResidencia/LandPossession');
const {
  parseAreaInput,
  normalizeArea,
  toSarsais,
  MARLA_PER_KANAL,
  SARSAIS_PER_KANAL
} = require('../utils/landAreaUnits');

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
      amount: roundMoney(row.amount),
      amountInWords: String(row.amountInWords || '').trim()
    }))
    .filter((row) => row.paymentType);
};

const sumTransferPayments = (payments = []) =>
  payments.reduce((sum, row) => sum + roundMoney(row.amount), 0);

const mapTransfer = (doc) => (doc?.toObject ? doc.toObject() : doc);

async function nextTransferNumbers() {
  const transfers = await LandTransfer.find({ isActive: true })
    .select('referenceNo transferNo')
    .lean();

  let maxUtn = 0;
  let maxLtn = 0;
  for (const row of transfers) {
    const utnMatch = String(row.transferNo || '').match(/UTN-(\d+)/i);
    if (utnMatch) {
      const n = Number(utnMatch[1]);
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
    transferNo: `UTN-${next}`,
    referenceNo: `LTN-${String(next).padStart(6, '0')}`
  };
};

const buildTransferPayload = (body, purchase) => {
  const purchaseArea = parseAreaInput(body.purchaseArea);
  const transferArea = parseAreaInput(body.transferArea);
  const purchaseSizeInKanal = roundMoney(areaToDecimalKanal(purchaseArea));
  const transferSizeInKanal = roundMoney(areaToDecimalKanal(transferArea));
  const ratePerKanal = roundMoney(purchase?.ratePerKanal || body.ratePerKanal || 0);
  const transferredCost = roundMoney(transferSizeInKanal * ratePerKanal);
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
    transferredCost,
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

// GET /transfers
router.get('/transfers', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const purchase = String(req.query.purchase || '').trim();
  const moza = String(req.query.moza || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const skip = (page - 1) * limit;

  const filter = { isActive: true };
  if (purchase) filter.landPurchase = purchase;
  if (moza) filter.moza = moza;

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
  const registryMozaMap = {};
  for (const t of transfers) {
    const mozaId = String(t.moza?._id || t.moza);
    const mozaName = t.moza?.name || 'Unknown';
    if (!registryMozaMap[mozaId]) registryMozaMap[mozaId] = { mozaName, totalSarsais: 0 };
    registryMozaMap[mozaId].totalSarsais += toSarsaisLocal(t.transferArea);
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
  let totalPossessedSarsais = 0;
  for (const pos of possessions) {
    const mozaId = String(pos.moza?._id || pos.moza);
    const mozaName = pos.moza?.name || 'Unknown';
    if (!possessionMozaMap[mozaId]) possessionMozaMap[mozaId] = { mozaName, totalSarsais: 0 };
    const sarsais = toSarsaisLocal(pos.totalArea);
    possessionMozaMap[mozaId].totalSarsais += sarsais;
    totalPossessedSarsais += sarsais;
  }

  const possessionMozaRows = Object.values(possessionMozaMap).map((m) => {
    const area = fromSarsais(m.totalSarsais);
    return { mozaName: m.mozaName, kanal: area.kanal, marla: area.marla, sarsai: area.sarsai };
  }).sort((a, b) => b.kanal - a.kanal || b.marla - a.marla);

  const possessionTotalArea = fromSarsais(totalPossessedSarsais);
  const possessionMozaTotals = { kanal: possessionTotalArea.kanal, marla: possessionTotalArea.marla, sarsai: possessionTotalArea.sarsai };

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
      possessionMozaSummary: { rows: possessionMozaRows, totals: possessionMozaTotals }
    }
  });
}));

module.exports = router;
