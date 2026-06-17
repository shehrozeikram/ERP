const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandParty = require('../models/tajResidencia/LandParty');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
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

module.exports = router;
