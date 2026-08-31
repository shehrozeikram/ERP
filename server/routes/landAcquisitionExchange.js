const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const LandExchange = require('../models/tajResidencia/LandExchange');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandRegistry = require('../models/tajResidencia/LandRegistry');
const LandParty = require('../models/tajResidencia/LandParty');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
const {
  parseAreaInput, addAreas, toSarsais, normalizeArea, subtractAreas
} = require('../utils/landAreaUnits');

const router = express.Router();

const exchangeUploadDir = path.join(__dirname, '../uploads/land-acquisition-exchange');
const exchangeUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(exchangeUploadDir)) {
      fs.mkdirSync(exchangeUploadDir, { recursive: true });
    }
    cb(null, exchangeUploadDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `exchange-${unique}${path.extname(file.originalname)}`);
  }
});

const exchangeUpload = multer({
  storage: exchangeUploadStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Attachments must be a PDF or image file'), false);
    }
  }
});

const handleExchangeUpload = (req, res, next) => {
  exchangeUpload.fields([
    { name: 'attachments', maxCount: 20 }
  ])(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Each attachment must be 10 MB or less' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Maximum 20 attachments allowed' });
    }
    return res.status(400).json({ success: false, message: err.message || 'File upload error' });
  });
};

const parseExchangeRequestBody = (req) => {
  if (!req.body?.data) return req.body;
  try {
    return typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
  } catch {
    const err = new Error('Invalid exchange payload format');
    err.status = 400;
    throw err;
  }
};

const mapUploadedAttachments = (files = []) => files.map((file) => ({
  filename: file.filename,
  originalName: file.originalname,
  path: `/uploads/land-acquisition-exchange/${file.filename}`,
  mimetype: file.mimetype,
  size: file.size,
  uploadedAt: new Date()
}));

const generateExchangeRef = async () => {
  const lastExchange = await LandExchange.findOne({
    exchangeRef: { $regex: /^EXC-\d+$/ }
  }).sort({ createdAt: -1 }).select('exchangeRef').lean();

  let maxNum = 0;
  if (lastExchange?.exchangeRef) {
    const match = lastExchange.exchangeRef.match(/^EXC-(\d+)$/);
    if (match) {
      maxNum = parseInt(match[1], 10) || 0;
    }
  }

  // Also check total count as a fallback to avoid collisions
  const count = await LandExchange.countDocuments({});
  const nextNum = Math.max(maxNum + 1, count + 1);
  return `EXC-${String(nextNum).padStart(4, '0')}`;
};

const calculateNetDifference = (totalOutArea, totalInArea) => {
  const outSarsai = toSarsais(totalOutArea);
  const inSarsai = toSarsais(totalInArea);

  if (inSarsai > outSarsai) {
    const diff = subtractAreas(totalInArea, totalOutArea);
    return { ...diff, type: 'IN_SURPLUS' };
  } else if (outSarsai > inSarsai) {
    const diff = subtractAreas(totalOutArea, totalInArea);
    return { ...diff, type: 'OUT_SURPLUS' };
  } else {
    return { kanal: 0, marla: 0, sarsai: 0, type: 'EQUAL' };
  }
};

// GET /api/taj-residencia/land-acquisition/exchanges/next-ref
router.get('/exchanges/next-ref', authMiddleware, asyncHandler(async (req, res) => {
  const nextRef = await generateExchangeRef();
  res.json({ success: true, data: { nextRef } });
}));

// GET /api/taj-residencia/land-acquisition/exchanges
router.get('/exchanges', authMiddleware, asyncHandler(async (req, res) => {
  const { search, moza, party, page = 1, limit = 50 } = req.query;
  const filter = { isActive: true };

  if (moza && mongoose.Types.ObjectId.isValid(moza)) {
    filter.$or = [
      { moza: new mongoose.Types.ObjectId(moza) },
      { 'outLandLines.moza': new mongoose.Types.ObjectId(moza) },
      { 'inLandLines.moza': new mongoose.Types.ObjectId(moza) }
    ];
  }

  if (party && mongoose.Types.ObjectId.isValid(party)) {
    filter.party = new mongoose.Types.ObjectId(party);
  }

  if (search && search.trim()) {
    const clean = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(clean, 'i');

    const matchingParties = await LandParty.find({
      $or: [{ name: re }, { cnic: re }, { phone: re }]
    }).select('_id').lean();
    const partyIds = matchingParties.map((p) => p._id);

    const matchingRegistries = await LandRegistry.find({
      $or: [{ registryNo: re }, { inteqalNo: re }],
      isActive: true
    }).select('_id').lean();
    const registryIds = matchingRegistries.map((r) => r._id);

    const searchConditions = [
      { exchangeRef: re },
      { remarks: re },
      { 'outLandLines.khewatNo': re },
      { 'outLandLines.khasraNo': re },
      { 'outLandLines.registryNo': re },
      { 'outLandLines.inteqalNo': re },
      { 'inLandLines.khewatNo': re },
      { 'inLandLines.khasraNo': re },
      { 'inLandLines.registryNo': re },
      { 'inLandLines.inteqalNo': re }
    ];

    if (partyIds.length) searchConditions.push({ party: { $in: partyIds } });
    if (registryIds.length) searchConditions.push({ 'outLandLines.registry': { $in: registryIds } });

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const skip = (pageNum - 1) * limitNum;

  const [rows, total] = await Promise.all([
    LandExchange.find(filter)
      .populate('party', 'name cnic phone partyType address')
      .populate('moza', 'name slug')
      .populate('outLandLines.moza', 'name')
      .populate('outLandLines.registry', 'registryNo inteqalNo registryDate totalArea')
      .populate('outLandLines.sourceExchange', 'exchangeRef exchangeDate dealNo')
      .populate('inLandLines.moza', 'name')
      .populate('createdBy', 'firstName lastName name email')
      .sort({ exchangeDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    LandExchange.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      rows,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    }
  });
}));

// GET /api/taj-residencia/land-acquisition/exchanges/:id
router.get('/exchanges/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid exchange ID' });
  }

  const exchange = await LandExchange.findOne({ _id: id, isActive: true })
    .populate('party', 'name cnic phone partyType address')
    .populate('moza', 'name slug')
    .populate('outLandLines.moza', 'name')
    .populate('outLandLines.registry', 'registryNo inteqalNo registryDate totalArea')
    .populate('outLandLines.sourceExchange', 'exchangeRef exchangeDate dealNo')
    .populate('inLandLines.moza', 'name')
    .populate('createdBy', 'firstName lastName name email')
    .lean();

  if (!exchange) {
    return res.status(404).json({ success: false, message: 'Land exchange record not found' });
  }

  res.json({ success: true, data: exchange });
}));

// POST /api/taj-residencia/land-acquisition/exchanges
router.post('/exchanges', authMiddleware, handleExchangeUpload, asyncHandler(async (req, res) => {
  const body = parseExchangeRequestBody(req);

  if (!body.party) {
    return res.status(400).json({ success: false, message: 'Counterparty is required' });
  }

  let exchangeRef = String(body.exchangeRef || '').trim();
  if (!exchangeRef) {
    exchangeRef = await generateExchangeRef();
  } else {
    const existing = await LandExchange.findOne({ exchangeRef, isActive: true });
    if (existing) {
      return res.status(400).json({ success: false, message: `Exchange reference ${exchangeRef} already exists` });
    }
  }

  const outLandLines = (body.outLandLines || []).map((line) => {
    let registryId = undefined;
    let exchangeId = undefined;
    let exchangeInId = '';

    const rawReg = line.registry || line.registryId;
    if (typeof rawReg === 'string' && rawReg.startsWith('exchange-in-')) {
      exchangeInId = rawReg;
      const parts = rawReg.split('-');
      if (parts.length >= 3 && mongoose.Types.ObjectId.isValid(parts[2])) {
        exchangeId = parts[2];
      }
    } else if (rawReg && mongoose.Types.ObjectId.isValid(rawReg)) {
      registryId = rawReg;
    }

    const khasraEntryId = line.khasraEntry && mongoose.Types.ObjectId.isValid(line.khasraEntry)
      ? line.khasraEntry
      : undefined;

    return {
      registry: registryId,
      sourceExchange: exchangeId || (line.sourceExchange && mongoose.Types.ObjectId.isValid(line.sourceExchange) ? line.sourceExchange : undefined),
      exchangeInId: exchangeInId || String(line.exchangeInId || '').trim(),
      registryNo: String(line.registryNo || '').trim(),
      inteqalNo: String(line.inteqalNo || '').trim(),
      moza: line.moza,
      khasraEntry: khasraEntryId,
      khewatNo: String(line.khewatNo || '').trim(),
      khasraNo: String(line.khasraNo || '').trim(),
      khasraArea: parseAreaInput(line.khasraArea),
      surrenderedArea: parseAreaInput(line.surrenderedArea || line.area),
      remarks: String(line.remarks || '').trim()
    };
  });

  const inLandLines = (body.inLandLines || []).map((line) => {
    const khasraEntryId = line.khasraEntry && mongoose.Types.ObjectId.isValid(line.khasraEntry)
      ? line.khasraEntry
      : undefined;
    return {
      moza: line.moza,
      khasraEntry: khasraEntryId,
      khewatNo: String(line.khewatNo || '').trim(),
      khasraNo: String(line.khasraNo || '').trim(),
      khasraArea: parseAreaInput(line.khasraArea),
      acquiredArea: parseAreaInput(line.acquiredArea || line.area),
      registryNo: String(line.registryNo || '').trim(),
      inteqalNo: String(line.inteqalNo || '').trim(),
      remarks: String(line.remarks || '').trim()
    };
  });

  if (!outLandLines.length && !inLandLines.length) {
    return res.status(400).json({ success: false, message: 'At least one Out Land line or In Land line is required' });
  }

  const totalOutArea = addAreas(...outLandLines.map((l) => l.surrenderedArea));
  const totalInArea = addAreas(...inLandLines.map((l) => l.acquiredArea));
  const netAreaDiff = calculateNetDifference(totalOutArea, totalInArea);

  const uploadedAttachments = mapUploadedAttachments(req.files?.attachments || []);
  const retainedAttachments = Array.isArray(body.existingAttachments) ? body.existingAttachments : [];
  const attachments = [...retainedAttachments, ...uploadedAttachments];

  const financialAdjustment = {
    hasAdjustment: Boolean(body.financialAdjustment?.hasAdjustment),
    amount: Number(body.financialAdjustment?.amount) || 0,
    paidBy: body.financialAdjustment?.paidBy || 'NONE',
    paymentMode: String(body.financialAdjustment?.paymentMode || 'Cheque').trim(),
    status: body.financialAdjustment?.status || 'Pending',
    remarks: String(body.financialAdjustment?.remarks || '').trim()
  };

  const exchangeDoc = new LandExchange({
    exchangeRef,
    exchangeDate: body.exchangeDate ? new Date(body.exchangeDate) : new Date(),
    party: body.party,
    dealNo: body.dealNo ? Number(body.dealNo) : undefined,
    registryNo: String(body.registryNo || '').trim(),
    inteqalNo: String(body.inteqalNo || '').trim(),
    moza: body.moza || (outLandLines[0]?.moza || inLandLines[0]?.moza),
    outLandLines,
    inLandLines,
    totalOutArea,
    totalInArea,
    netAreaDiff,
    financialAdjustment,
    attachments,
    remarks: String(body.remarks || '').trim(),
    createdBy: req.user?._id
  });

  await exchangeDoc.save();

  const saved = await LandExchange.findById(exchangeDoc._id)
    .populate('party', 'name cnic phone partyType address')
    .populate('moza', 'name slug')
    .populate('outLandLines.moza', 'name')
    .populate('outLandLines.registry', 'registryNo inteqalNo registryDate totalArea')
    .populate('outLandLines.sourceExchange', 'exchangeRef exchangeDate dealNo')
    .populate('inLandLines.moza', 'name')
    .populate('createdBy', 'firstName lastName name email')
    .lean();

  res.status(201).json({
    success: true,
    message: 'Land exchange record created successfully',
    data: saved
  });
}));

// PUT /api/taj-residencia/land-acquisition/exchanges/:id
router.put('/exchanges/:id', authMiddleware, handleExchangeUpload, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid exchange ID' });
  }

  const existingDoc = await LandExchange.findOne({ _id: id, isActive: true });
  if (!existingDoc) {
    return res.status(404).json({ success: false, message: 'Land exchange record not found' });
  }

  const body = parseExchangeRequestBody(req);

  if (body.exchangeRef && body.exchangeRef !== existingDoc.exchangeRef) {
    const dup = await LandExchange.findOne({
      _id: { $ne: id },
      exchangeRef: body.exchangeRef,
      isActive: true
    });
    if (dup) {
      return res.status(400).json({ success: false, message: `Exchange reference ${body.exchangeRef} is already used` });
    }
    existingDoc.exchangeRef = body.exchangeRef;
  }

  if (body.party) existingDoc.party = body.party;
  if (body.exchangeDate) existingDoc.exchangeDate = new Date(body.exchangeDate);
  if (body.dealNo !== undefined) existingDoc.dealNo = body.dealNo ? Number(body.dealNo) : undefined;
  if (body.registryNo !== undefined) existingDoc.registryNo = String(body.registryNo).trim();
  if (body.inteqalNo !== undefined) existingDoc.inteqalNo = String(body.inteqalNo).trim();
  if (body.moza) existingDoc.moza = body.moza;
  if (body.remarks !== undefined) existingDoc.remarks = String(body.remarks).trim();

  if (body.outLandLines) {
    existingDoc.outLandLines = body.outLandLines.map((line) => {
      let registryId = undefined;
      let exchangeId = undefined;
      let exchangeInId = '';

      const rawReg = line.registry || line.registryId;
      if (typeof rawReg === 'string' && rawReg.startsWith('exchange-in-')) {
        exchangeInId = rawReg;
        const parts = rawReg.split('-');
        if (parts.length >= 3 && mongoose.Types.ObjectId.isValid(parts[2])) {
          exchangeId = parts[2];
        }
      } else if (rawReg && mongoose.Types.ObjectId.isValid(rawReg)) {
        registryId = rawReg;
      }

      const khasraEntryId = line.khasraEntry && mongoose.Types.ObjectId.isValid(line.khasraEntry)
        ? line.khasraEntry
        : undefined;

      return {
        registry: registryId,
        sourceExchange: exchangeId || (line.sourceExchange && mongoose.Types.ObjectId.isValid(line.sourceExchange) ? line.sourceExchange : undefined),
        exchangeInId: exchangeInId || String(line.exchangeInId || '').trim(),
        registryNo: String(line.registryNo || '').trim(),
        inteqalNo: String(line.inteqalNo || '').trim(),
        moza: line.moza,
        khasraEntry: khasraEntryId,
        khewatNo: String(line.khewatNo || '').trim(),
        khasraNo: String(line.khasraNo || '').trim(),
        khasraArea: parseAreaInput(line.khasraArea),
        surrenderedArea: parseAreaInput(line.surrenderedArea || line.area),
        remarks: String(line.remarks || '').trim()
      };
    });
  }

  if (body.inLandLines) {
    existingDoc.inLandLines = body.inLandLines.map((line) => {
      const khasraEntryId = line.khasraEntry && mongoose.Types.ObjectId.isValid(line.khasraEntry)
        ? line.khasraEntry
        : undefined;
      return {
        moza: line.moza,
        khasraEntry: khasraEntryId,
        khewatNo: String(line.khewatNo || '').trim(),
        khasraNo: String(line.khasraNo || '').trim(),
        khasraArea: parseAreaInput(line.khasraArea),
        acquiredArea: parseAreaInput(line.acquiredArea || line.area),
        registryNo: String(line.registryNo || '').trim(),
        inteqalNo: String(line.inteqalNo || '').trim(),
        remarks: String(line.remarks || '').trim()
      };
    });
  }

  existingDoc.totalOutArea = addAreas(...existingDoc.outLandLines.map((l) => l.surrenderedArea));
  existingDoc.totalInArea = addAreas(...existingDoc.inLandLines.map((l) => l.acquiredArea));
  existingDoc.netAreaDiff = calculateNetDifference(existingDoc.totalOutArea, existingDoc.totalInArea);

  if (body.financialAdjustment) {
    existingDoc.financialAdjustment = {
      hasAdjustment: Boolean(body.financialAdjustment.hasAdjustment),
      amount: Number(body.financialAdjustment.amount) || 0,
      paidBy: body.financialAdjustment.paidBy || 'NONE',
      paymentMode: String(body.financialAdjustment.paymentMode || 'Cheque').trim(),
      status: body.financialAdjustment.status || 'Pending',
      remarks: String(body.financialAdjustment.remarks || '').trim()
    };
  }

  const uploadedAttachments = mapUploadedAttachments(req.files?.attachments || []);
  const retainedAttachments = Array.isArray(body.existingAttachments) ? body.existingAttachments : existingDoc.attachments;
  existingDoc.attachments = [...retainedAttachments, ...uploadedAttachments];

  existingDoc.updatedBy = req.user?._id;

  await existingDoc.save();

  const updated = await LandExchange.findById(id)
    .populate('party', 'name cnic phone partyType address')
    .populate('moza', 'name slug')
    .populate('outLandLines.moza', 'name')
    .populate('outLandLines.registry', 'registryNo inteqalNo registryDate totalArea')
    .populate('outLandLines.sourceExchange', 'exchangeRef exchangeDate dealNo')
    .populate('inLandLines.moza', 'name')
    .populate('createdBy', 'firstName lastName name email')
    .lean();

  res.json({
    success: true,
    message: 'Land exchange record updated successfully',
    data: updated
  });
}));

// DELETE /api/taj-residencia/land-acquisition/exchanges/:id
router.delete('/exchanges/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid exchange ID' });
  }

  const exchange = await LandExchange.findOneAndUpdate(
    { _id: id, isActive: true },
    { $set: { isActive: false, updatedBy: req.user?._id } },
    { new: true }
  );

  if (!exchange) {
    return res.status(404).json({ success: false, message: 'Land exchange record not found' });
  }

  res.json({ success: true, message: 'Land exchange record deleted successfully' });
}));

module.exports = router;
