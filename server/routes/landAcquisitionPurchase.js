const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandParty = require('../models/tajResidencia/LandParty');
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

const parseLines = (lines = []) => {
  if (!Array.isArray(lines)) return [];
  return lines.map((line) => ({
    khasraEntry: line.khasraEntry || undefined,
    khewatNo: String(line.khewatNo || '').trim(),
    khasraNo: String(line.khasraNo || '').trim(),
    khasraArea: parseAreaInput(line.khasraArea)
  })).filter((line) => line.khasraEntry || line.khasraNo);
};

const mapPurchase = (doc) => {
  const row = doc?.toObject ? doc.toObject() : doc;
  return row;
};

async function nextPurchaseNumbers() {
  const purchases = await LandPurchase.find({ isActive: true })
    .select('purchaseNo dealNo')
    .lean();

  let maxDeal = 500;
  let maxLp = 0;
  for (const row of purchases) {
    const deal = Number(row.dealNo);
    if (!Number.isNaN(deal) && deal > maxDeal) maxDeal = deal;

    const match = String(row.purchaseNo || '').match(/LP-(\d+)/i);
    if (match) {
      const n = Number(match[1]);
      if (!Number.isNaN(n) && n > maxLp) maxLp = n;
    }
  }

  return {
    dealNo: maxDeal + 1,
    purchaseNo: `LP-${String(maxLp + 1).padStart(3, '0')}`
  };
}

const buildPurchasePayload = (body) => {
  const totalArea = parseAreaInput(body.totalArea);
  const ratePerKanal = Math.max(0, Number(body.ratePerKanal) || 0);
  const totalSizeInKanal = areaToDecimalKanal(totalArea);
  const agreedAmount = Math.round(totalSizeInKanal * ratePerKanal * 100) / 100;
  const tokenAmount = Math.max(0, Number(body.tokenAmount) || 0);
  const balanceAmount = Math.max(0, Math.round((agreedAmount - tokenAmount) * 100) / 100);

  return {
    purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
    project: String(body.project || 'Taj Residencia').trim() || 'Taj Residencia',
    seller: body.seller || undefined,
    purchaser: body.purchaser || undefined,
    dealer: body.dealer || null,
    moza: body.moza || undefined,
    lines: parseLines(body.lines),
    totalArea,
    totalSizeInKanal: Math.round(totalSizeInKanal * 10000) / 10000,
    ratePerKanal,
    ratePerKanalInWords: String(body.ratePerKanalInWords || '').trim(),
    agreedAmount,
    agreedAmountInWords: String(body.agreedAmountInWords || '').trim(),
    govtLandValue: Math.max(0, Number(body.govtLandValue) || 0),
    govtLandValueInWords: String(body.govtLandValueInWords || '').trim(),
    tokenAmount,
    tokenAmountInWords: String(body.tokenAmountInWords || '').trim(),
    balanceAmount,
    paymentMode: String(body.paymentMode || '').trim(),
    paymentRemarks: String(body.paymentRemarks || '').trim()
  };
};

const validatePurchasePayload = async (payload, { isCreate = false } = {}) => {
  if (!payload.purchaseDate || Number.isNaN(payload.purchaseDate.getTime())) {
    const err = new Error('Purchase date is required');
    err.status = 400;
    throw err;
  }
  if (!payload.seller) {
    const err = new Error('Seller is required');
    err.status = 400;
    throw err;
  }
  if (!payload.purchaser) {
    const err = new Error('Purchaser is required');
    err.status = 400;
    throw err;
  }
  if (!payload.moza) {
    const err = new Error('Moza is required');
    err.status = 400;
    throw err;
  }
  if (!payload.lines.length) {
    const err = new Error('At least one khasra is required');
    err.status = 400;
    throw err;
  }
  if (!toSarsais(payload.totalArea)) {
    const err = new Error('Total land size is required');
    err.status = 400;
    throw err;
  }

  const moza = await LandMoza.findOne({ _id: payload.moza, isActive: true });
  if (!moza) {
    const err = new Error('Moza not found');
    err.status = 404;
    throw err;
  }

  const seller = await LandParty.findOne({ _id: payload.seller, partyType: 'seller', isActive: true });
  if (!seller) {
    const err = new Error('Seller not found');
    err.status = 404;
    throw err;
  }

  const purchaser = await LandParty.findOne({ _id: payload.purchaser, partyType: 'buyer', isActive: true });
  if (!purchaser) {
    const err = new Error('Purchaser not found');
    err.status = 404;
    throw err;
  }

  if (payload.dealer) {
    const dealer = await LandParty.findOne({ _id: payload.dealer, partyType: 'dealer', isActive: true });
    if (!dealer) {
      const err = new Error('Dealer not found');
      err.status = 404;
      throw err;
    }
  }

  if (isCreate) {
    // numbers assigned on create
  }
};

// GET /purchases/next-numbers
router.get('/purchases/next-numbers', asyncHandler(async (req, res) => {
  const data = await nextPurchaseNumbers();
  res.json({ success: true, data });
}));

// GET /purchases
router.get('/purchases', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const moza = String(req.query.moza || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const skip = (page - 1) * limit;

  const filter = { isActive: true };
  if (moza) filter.moza = moza;

  let purchases = await LandPurchase.find(filter)
    .populate('seller', 'name cnic phoneNumber')
    .populate('purchaser', 'name cnic phoneNumber')
    .populate('dealer', 'name cnic phoneNumber')
    .populate('moza', 'name slug')
    .sort({ dealNo: -1 })
    .lean();

  if (search) {
    const q = search.toLowerCase();
    purchases = purchases.filter((row) =>
      String(row.purchaseNo || '').toLowerCase().includes(q)
      || String(row.dealNo || '').includes(q)
      || String(row.project || '').toLowerCase().includes(q)
      || String(row.seller?.name || '').toLowerCase().includes(q)
      || String(row.seller?.cnic || '').toLowerCase().includes(q)
      || String(row.moza?.name || '').toLowerCase().includes(q)
    );
  }

  const total = purchases.length;
  const pageRows = purchases.slice(skip, skip + limit);

  res.json({
    success: true,
    data: {
      purchases: pageRows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
    }
  });
}));

// GET /purchases/:id
router.get('/purchases/:id', asyncHandler(async (req, res) => {
  const purchase = await LandPurchase.findOne({ _id: req.params.id, isActive: true })
    .populate('seller', 'name cnic phoneNumber partyDate')
    .populate('purchaser', 'name cnic phoneNumber partyDate')
    .populate('dealer', 'name cnic phoneNumber partyDate')
    .populate('moza', 'name slug');

  if (!purchase) {
    return res.status(404).json({ success: false, message: 'Land purchase not found' });
  }

  res.json({ success: true, data: mapPurchase(purchase) });
}));

// POST /purchases
router.post('/purchases', asyncHandler(async (req, res) => {
  const payload = buildPurchasePayload(req.body);
  await validatePurchasePayload(payload, { isCreate: true });

  const numbers = await nextPurchaseNumbers();
  const purchase = await LandPurchase.create({
    ...payload,
    purchaseNo: numbers.purchaseNo,
    dealNo: numbers.dealNo,
    createdBy: req.user?._id || req.user?.id
  });

  const populated = await LandPurchase.findById(purchase._id)
    .populate('seller', 'name cnic phoneNumber')
    .populate('purchaser', 'name cnic phoneNumber')
    .populate('dealer', 'name cnic phoneNumber')
    .populate('moza', 'name slug');

  res.status(201).json({ success: true, message: 'Land purchase created', data: mapPurchase(populated) });
}));

// PUT /purchases/:id
router.put('/purchases/:id', asyncHandler(async (req, res) => {
  const existing = await LandPurchase.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land purchase not found' });
  }

  const payload = buildPurchasePayload(req.body);
  await validatePurchasePayload(payload);

  Object.assign(existing, payload);
  existing.updatedBy = req.user?._id || req.user?.id;
  await existing.save();

  const populated = await LandPurchase.findById(existing._id)
    .populate('seller', 'name cnic phoneNumber')
    .populate('purchaser', 'name cnic phoneNumber')
    .populate('dealer', 'name cnic phoneNumber')
    .populate('moza', 'name slug');

  res.json({ success: true, message: 'Land purchase updated', data: mapPurchase(populated) });
}));

// DELETE /purchases/:id
router.delete('/purchases/:id', asyncHandler(async (req, res) => {
  const existing = await LandPurchase.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land purchase not found' });
  }

  existing.isActive = false;
  existing.updatedBy = req.user?._id || req.user?.id;
  await existing.save();

  res.json({ success: true, message: 'Land purchase deleted' });
}));

module.exports = router;
