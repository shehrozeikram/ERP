const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandRegistry = require('../models/tajResidencia/LandRegistry');
const LandParty = require('../models/tajResidencia/LandParty');
const {
  parseAreaInput, addAreas, toSarsais, normalizeArea, subtractAreas
} = require('../utils/landAreaUnits');
const { enrichRegistryLines } = require('../utils/syncKhasraFromMozaEntry');

const router = express.Router();

const registryUploadDir = path.join(__dirname, '../uploads/land-acquisition-registry');
const registryUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(registryUploadDir)) {
      fs.mkdirSync(registryUploadDir, { recursive: true });
    }
    cb(null, registryUploadDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `registry-${unique}${path.extname(file.originalname)}`);
  }
});

const registryUpload = multer({
  storage: registryUploadStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 30 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Attachments must be a PDF or image file'), false);
    }
  }
});

const handleRegistryUpload = (req, res, next) => {
  registryUpload.fields([
    { name: 'attachments', maxCount: 10 },
    { name: 'registryDocAttachments', maxCount: 10 },
    { name: 'inteqalDocAttachments', maxCount: 10 }
  ])(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Each attachment must be 10 MB or less' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Maximum 10 attachments per document type' });
    }
    return res.status(400).json({ success: false, message: err.message || 'File upload error' });
  });
};

const parseRegistryRequestBody = (req) => {
  if (!req.body?.data) return req.body;
  try {
    return typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
  } catch {
    const err = new Error('Invalid registry data');
    err.status = 400;
    throw err;
  }
};

const mapUploadedAttachments = (files = []) => files.map((file) => ({
  filename: file.filename,
  originalName: file.originalname,
  path: `/uploads/land-acquisition-registry/${file.filename}`,
  mimetype: file.mimetype,
  size: file.size,
  uploadedAt: new Date()
}));

const deleteAttachmentFile = (attachment) => {
  if (!attachment?.path) return;
  const filename = path.basename(attachment.path);
  const filePath = path.join(registryUploadDir, filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
};

const parseRemovedAttachmentIds = (body, key = 'removedAttachmentIds') => {
  const raw = body[key];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  }
};

const applyAttachmentChanges = (registry, body, filesMap = {}, keyName = 'attachments', removedKey = 'removedAttachmentIds') => {
  const removedIds = new Set(parseRemovedAttachmentIds(body, removedKey));
  const kept = (registry[keyName] || []).filter((att) => {
    if (removedIds.has(String(att._id))) {
      deleteAttachmentFile(att);
      return false;
    }
    return true;
  });
  const newFiles = filesMap[keyName] || [];
  registry[keyName] = [...kept, ...mapUploadedAttachments(newFiles)];
};

const fetchRegisteredTotalsByKhasra = async (moza, excludeRegistryId) => {
  const filter = { moza, isActive: true };
  if (excludeRegistryId) {
    filter._id = { $ne: excludeRegistryId };
  }

  const registries = await LandRegistry.find(filter).select('lines').lean();
  const totals = {};

  registries.forEach((doc) => {
    (doc.lines || []).forEach((line) => {
      const id = String(line.khasraEntry || '');
      if (!id) return;
      totals[id] = addAreas(totals[id] || { kanal: 0, marla: 0, sarsai: 0 }, normalizeArea(line.acquiredArea));
    });
  });

  return totals;
};

const assertKhasraOwnershipLimits = async (moza, lines, excludeRegistryId) => {
  // Disabled assertion to allow area in registry to exceed khasra area
  return;
};

const parseLine = (line) => ({
  khasraEntry: line.khasraEntry || undefined,
  khewatNo: String(line.khewatNo || '').trim(),
  khasraNo: String(line.khasraNo || '').trim(),
  khasraArea: parseAreaInput(line.khasraArea),
  landOfKhasra: parseAreaInput(line.landOfKhasra),
  acquiredArea: parseAreaInput(line.acquiredArea),
  landWithMalkiyat: parseAreaInput(line.landWithMalkiyat),
  transferPercent: Math.max(0, Number(line.transferPercent) || 0),
  remarks: String(line.remarks || '').trim()
});

const buildRegistryPayload = (body) => {
  const lines = Array.isArray(body.lines) ? body.lines.map(parseLine) : [];
  const invalidLine = lines.find((l) => !l.khewatNo || !l.khasraNo);
  if (invalidLine) {
    const err = new Error('Each line must have Khewat No. and Khasra No.');
    err.status = 400;
    throw err;
  }

  const totalArea = parseAreaInput(body.totalArea);
  const linesTotal = addAreas(...lines.map((l) => l.acquiredArea));

  let khewatNos = Array.isArray(body.khewatNos)
    ? body.khewatNos.map((k) => String(k).trim()).filter(Boolean)
    : String(body.khewatNo || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  if (!khewatNos.length) {
    khewatNos = [...new Set(lines.map((l) => l.khewatNo).filter(Boolean))];
  }

  if (!khewatNos.length) {
    const err = new Error('At least one Khewat is required on a line');
    err.status = 400;
    throw err;
  }

  if (!toSarsais(totalArea)) {
    const err = new Error('Total area is required');
    err.status = 400;
    throw err;
  }

  const finalTotal = toSarsais(totalArea) ? totalArea : linesTotal;
  if (toSarsais(totalArea) && toSarsais(linesTotal) !== toSarsais(totalArea)) {
    const err = new Error('Sum of area in registry lines must exactly match the total area');
    err.status = 400;
    throw err;
  }

  const lineOverTotal = lines.find((l) => toSarsais(l.acquiredArea) > toSarsais(totalArea));
  if (lineOverTotal) {
    const err = new Error('Area in registry on a line cannot exceed total area');
    err.status = 400;
    throw err;
  }

  return {
    dealNo: body.dealNo ? Number(body.dealNo) : undefined,
    registryDate: body.registryDate ? new Date(body.registryDate) : null,
    moza: body.moza,
    khewatNo: khewatNos.join(', '),
    khewatNos,
    totalArea: finalTotal,
    registryNo: (body.registryNo === 'null' || body.registryNo === 'undefined') ? '' : String(body.registryNo || '').trim(),
    inteqalNo: (body.inteqalNo === 'null' || body.inteqalNo === 'undefined') ? '' : String(body.inteqalNo || '').trim(),
    seller: body.seller || undefined,
    purchaser: body.purchaser || undefined,
    dealer: body.dealer || undefined,
    lines,
    linesTotal
  };
};

const mapRegistry = (doc) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const khewatNos = (obj.khewatNos?.length
    ? obj.khewatNos
    : String(obj.khewatNo || '').split(',').map((s) => s.trim()).filter(Boolean));

  const lines = (obj.lines || []).map((line) => ({
    ...line,
    khasraArea: normalizeArea(line.khasraArea),
    landOfKhasra: normalizeArea(line.landOfKhasra),
    acquiredArea: normalizeArea(line.acquiredArea),
    landWithMalkiyat: normalizeArea(line.landWithMalkiyat)
  }));

  return {
    ...obj,
    khewatNos,
    khewatNo: khewatNos.join(', ') || obj.khewatNo,
    lines,
    registryDocAttachments: obj.registryDocAttachments || [],
    inteqalDocAttachments: obj.inteqalDocAttachments || []
  };
};

const LandTransfer = require('../models/tajResidencia/LandTransfer');

async function attachTransferDocsToRegistries(mappedRegistries = []) {
  if (!mappedRegistries.length) return mappedRegistries;

  // Fetch ALL active transfers to resolve dealNo by registryNo / intiqalNo
  const transfers = await LandTransfer.find({
    isActive: true
  }).lean();

  if (!transfers.length) return mappedRegistries;

  // Build lookup maps for matching
  const transferByDealNo = new Map();
  const transferByRegNo = new Map();
  const transferByIntNo = new Map();

  for (const t of transfers) {
    if (t.dealNo !== undefined && t.dealNo !== null) {
      transferByDealNo.set(Number(t.dealNo), t);
    }
    if (t.registryNo && String(t.registryNo).trim()) {
      transferByRegNo.set(String(t.registryNo).trim().toLowerCase(), t);
    }
    if (t.intiqalNo && String(t.intiqalNo).trim()) {
      transferByIntNo.set(String(t.intiqalNo).trim().toLowerCase(), t);
    }
  }

  return mappedRegistries.map((reg) => {
    const regDealNo = reg.dealNo !== undefined && reg.dealNo !== null && reg.dealNo !== '' ? Number(reg.dealNo) : null;
    const regNo = String(reg.registryNo || '').trim().toLowerCase();
    const intNo = String(reg.inteqalNo || '').trim().toLowerCase();

    // Priority order: 1) Direct dealNo, 2) Registry No match, 3) Inteqal No match
    let matched = null;
    if (regNo && transferByRegNo.has(regNo)) {
      matched = transferByRegNo.get(regNo);
    } else if (intNo && transferByIntNo.has(intNo)) {
      matched = transferByIntNo.get(intNo);
    } else if (regDealNo !== null && transferByDealNo.has(regDealNo)) {
      matched = transferByDealNo.get(regDealNo);
    }

    if (!matched) return reg;

    const registryDocs = [...(reg.registryDocAttachments || [])];
    const inteqalDocs = [...(reg.inteqalDocAttachments || [])];

    if (matched.registryAttachment && !registryDocs.some(d => d.path === matched.registryAttachment)) {
      registryDocs.unshift({
        _id: `transfer-reg-${matched._id}`,
        originalName: 'Registry Doc (Land Transfer)',
        filename: path.basename(matched.registryAttachment),
        path: matched.registryAttachment,
        uploadedAt: matched.updatedAt || matched.createdAt
      });
    }

    if (matched.inteqalAttachment && !inteqalDocs.some(d => d.path === matched.inteqalAttachment)) {
      inteqalDocs.unshift({
        _id: `transfer-int-${matched._id}`,
        originalName: 'Inteqal Doc (Land Transfer)',
        filename: path.basename(matched.inteqalAttachment),
        path: matched.inteqalAttachment,
        uploadedAt: matched.updatedAt || matched.createdAt
      });
    }

    return {
      ...reg,
      // If reg has no dealNo set explicitly, inherit matched transfer's dealNo
      dealNo: reg.dealNo || matched.dealNo,
      registryDocAttachments: registryDocs,
      inteqalDocAttachments: inteqalDocs
    };
  });
}

// GET /api/taj-residencia/land-acquisition/registries
router.get('/registries', authMiddleware, asyncHandler(async (req, res) => {
  const { moza, search = '', page = 1, limit = 50 } = req.query;
  const filter = { isActive: true };

  if (moza) {
    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(moza)) {
      filter.moza = new mongoose.Types.ObjectId(moza);
    }
  }
  if (search && search.trim()) {
    const cleanSearch = search.trim();
    const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    filter.$or = [
      { registryNo: re },
      { inteqalNo: re },
      { khewatNo: re },
      { 'lines.khewatNo': re },
      { 'lines.khasraNo': re }
    ];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 5000);
  const skip = (pageNum - 1) * limitNum;

  const SARSAIS_PER_KANAL = 180;
  const SARSAI_PER_MARLA = 9;

  const [rows, total, grandTotalAgg] = await Promise.all([
    LandRegistry.find(filter)
      .populate('moza', 'name slug')
      .populate('seller', 'name cnic phoneNumber')
      .populate('purchaser', 'name cnic phoneNumber')
      .populate('dealer', 'name cnic phoneNumber')
      .sort({ registryDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    LandRegistry.countDocuments(filter),
    LandRegistry.aggregate([
      { $match: filter },
      { $unwind: "$lines" },
      {
        $group: {
          _id: null,
          totalSarsais: {
            $sum: {
              $add: [
                { $multiply: [{ $ifNull: ['$lines.acquiredArea.kanal', 0] }, SARSAIS_PER_KANAL] },
                { $multiply: [{ $ifNull: ['$lines.acquiredArea.marla', 0] }, SARSAI_PER_MARLA] },
                { $ifNull: ['$lines.acquiredArea.sarsai', 0] }
              ]
            }
          }
        }
      }
    ])
  ]);

  const totalSarsais = grandTotalAgg[0]?.totalSarsais || 0;
  const grandKanal = Math.floor(totalSarsais / SARSAIS_PER_KANAL);
  const rem1 = totalSarsais % SARSAIS_PER_KANAL;
  const grandMarla = Math.floor(rem1 / SARSAI_PER_MARLA);
  const grandSarsai = rem1 % SARSAI_PER_MARLA;

  const mapped = await attachTransferDocsToRegistries(rows.map(mapRegistry));

  res.json({
    success: true,
    data: {
      registries: mapped,
      pagination: { page: pageNum, limit: limitNum, total },
      grandTotal: { kanal: grandKanal, marla: grandMarla, sarsai: grandSarsai }
    }
  });
}));

// GET /api/taj-residencia/land-acquisition/registries/registered-totals?moza=&excludeRegistryId=
router.get('/registries/registered-totals', authMiddleware, asyncHandler(async (req, res) => {
  const { moza, excludeRegistryId } = req.query;
  if (!moza) {
    return res.status(400).json({ success: false, message: 'moza is required' });
  }

  const filter = { moza, isActive: true };
  if (excludeRegistryId) {
    filter._id = { $ne: excludeRegistryId };
  }

  const totals = await fetchRegisteredTotalsByKhasra(moza, excludeRegistryId);
  res.json({ success: true, data: totals });
}));

// GET /api/taj-residencia/land-acquisition/registries/:id
router.get('/registries/:id', authMiddleware, asyncHandler(async (req, res) => {
  const registry = await LandRegistry.findOne({ _id: req.params.id, isActive: true })
    .populate('moza', 'name slug')
    .populate('seller', 'name cnic phoneNumber partyDate')
    .populate('purchaser', 'name cnic phoneNumber partyDate')
    .populate('dealer', 'name cnic phoneNumber partyDate');

  if (!registry) {
    return res.status(404).json({ success: false, message: 'Registry not found' });
  }

  const mapped = await attachTransferDocsToRegistries([mapRegistry(registry)]);
  res.json({ success: true, data: mapped[0] });
}));

// POST /api/taj-residencia/land-acquisition/registries
router.post('/registries', authMiddleware, handleRegistryUpload, asyncHandler(async (req, res) => {
  let body;
  try {
    body = parseRegistryRequestBody(req);
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  let payload;
  try {
    payload = buildRegistryPayload(body);
    payload.lines = await enrichRegistryLines(payload.lines);
    const khewatNos = [...new Set(payload.lines.map((l) => l.khewatNo).filter(Boolean))];
    payload.khewatNos = khewatNos;
    payload.khewatNo = khewatNos.join(', ');
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  if (!payload.registryDate || Number.isNaN(payload.registryDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Registry date is required' });
  }
  if (!payload.moza) {
    return res.status(400).json({ success: false, message: 'Moza is required' });
  }
  if (!payload.khewatNos?.length) {
    return res.status(400).json({ success: false, message: 'At least one Khewat is required' });
  }
  if (!payload.lines.length) {
    return res.status(400).json({ success: false, message: 'At least one khasra line is required' });
  }

  const moza = await LandMoza.findOne({ _id: payload.moza, isActive: true });
  if (!moza) {
    return res.status(404).json({ success: false, message: 'Moza not found' });
  }

  if (payload.dealer) {
    const dealer = await LandParty.findOne({ _id: payload.dealer, partyType: 'dealer', isActive: true });
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }
  }

  if (payload.registryNo) {
    const duplicate = await LandRegistry.findOne({
      moza: payload.moza,
      registryNo: payload.registryNo,
      isActive: true
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `Registry No. ${payload.registryNo} already exists for this mouza`
      });
    }
  }

  if (payload.inteqalNo) {
    const duplicate = await LandRegistry.findOne({
      moza: payload.moza,
      inteqalNo: payload.inteqalNo,
      isActive: true
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `Inteqal No. ${payload.inteqalNo} already exists for this mouza`
      });
    }
  }

  try {
    await assertKhasraOwnershipLimits(payload.moza, payload.lines);
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  const filesMap = req.files || {};
  const registry = await LandRegistry.create({
    registryDate: payload.registryDate,
    moza: payload.moza,
    khewatNo: payload.khewatNo,
    khewatNos: payload.khewatNos,
    totalArea: payload.totalArea,
    registryNo: payload.registryNo,
    inteqalNo: payload.inteqalNo,
    seller: payload.seller,
    purchaser: payload.purchaser,
    dealer: payload.dealer,
    lines: payload.lines,
    attachments: mapUploadedAttachments(filesMap.attachments || []),
    registryDocAttachments: mapUploadedAttachments(filesMap.registryDocAttachments || []),
    inteqalDocAttachments: mapUploadedAttachments(filesMap.inteqalDocAttachments || []),
    createdBy: req.user?._id
  });

  await registry.populate('moza', 'name slug');
  await registry.populate('seller', 'name cnic phoneNumber partyDate');
  await registry.populate('purchaser', 'name cnic phoneNumber partyDate');
  await registry.populate('dealer', 'name cnic phoneNumber partyDate');

  res.status(201).json({
    success: true,
    message: 'Registry created',
    data: mapRegistry(registry)
  });
}));

// PUT /api/taj-residencia/land-acquisition/registries/:id
router.put('/registries/:id', authMiddleware, handleRegistryUpload, asyncHandler(async (req, res) => {
  const registry = await LandRegistry.findOne({ _id: req.params.id, isActive: true });
  if (!registry) {
    return res.status(404).json({ success: false, message: 'Registry not found' });
  }

  let body;
  try {
    body = parseRegistryRequestBody(req);
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  let payload;
  try {
    payload = buildRegistryPayload(body);
    payload.lines = await enrichRegistryLines(payload.lines);
    const khewatNos = [...new Set(payload.lines.map((l) => l.khewatNo).filter(Boolean))];
    payload.khewatNos = khewatNos;
    payload.khewatNo = khewatNos.join(', ');
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  if (payload.dealer) {
    const dealer = await LandParty.findOne({ _id: payload.dealer, partyType: 'dealer', isActive: true });
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }
  }

  if (!payload.registryDate || Number.isNaN(payload.registryDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Registry date is required' });
  }
  if (!payload.khewatNos?.length || !payload.lines.length) {
    return res.status(400).json({ success: false, message: 'At least one Khewat and one line are required' });
  }

  if (payload.registryNo) {
    const duplicate = await LandRegistry.findOne({
      _id: { $ne: registry._id },
      moza: registry.moza,
      registryNo: payload.registryNo,
      isActive: true
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `Registry No. ${payload.registryNo} already exists for this mouza`
      });
    }
  }

  if (payload.inteqalNo) {
    const duplicate = await LandRegistry.findOne({
      _id: { $ne: registry._id },
      moza: registry.moza,
      inteqalNo: payload.inteqalNo,
      isActive: true
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `Inteqal No. ${payload.inteqalNo} already exists for this mouza`
      });
    }
  }

  try {
    await assertKhasraOwnershipLimits(registry.moza, payload.lines, registry._id);
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  registry.registryDate = payload.registryDate;
  registry.khewatNo = payload.khewatNo;
  registry.khewatNos = payload.khewatNos;
  registry.totalArea = payload.totalArea;
  registry.registryNo = payload.registryNo;
  registry.inteqalNo = payload.inteqalNo;
  registry.seller = payload.seller;
  registry.purchaser = payload.purchaser;
  registry.dealer = payload.dealer;
  registry.lines = payload.lines;

  const filesMap = req.files || {};
  applyAttachmentChanges(registry, body, filesMap, 'attachments', 'removedAttachmentIds');
  applyAttachmentChanges(registry, body, filesMap, 'registryDocAttachments', 'removedRegistryDocAttachmentIds');
  applyAttachmentChanges(registry, body, filesMap, 'inteqalDocAttachments', 'removedInteqalDocAttachmentIds');

  await registry.save();
  await registry.populate('moza', 'name slug');
  await registry.populate('seller', 'name cnic phoneNumber partyDate');
  await registry.populate('purchaser', 'name cnic phoneNumber partyDate');
  await registry.populate('dealer', 'name cnic phoneNumber partyDate');

  res.json({
    success: true,
    message: 'Registry updated',
    data: mapRegistry(registry)
  });
}));

// GET /api/taj-residencia/land-acquisition/khasra-summary
router.get('/khasra-summary', authMiddleware, asyncHandler(async (req, res) => {
  const { moza, search = '', page = 1, limit = 25 } = req.query;
  const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
  const LandPossession = require('../models/tajResidencia/LandPossession');

  const khasraFilter = {};
  if (moza) {
    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(moza)) {
      khasraFilter.moza = new mongoose.Types.ObjectId(moza);
    }
  }

  // If search query is provided
  if (search && search.trim()) {
    const cleanSearch = search.trim();
    const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');

    const matchingRegistries = await LandRegistry.find({
      isActive: true,
      ...(moza && { moza }),
      $or: [
        { registryNo: re },
        { inteqalNo: re },
        { 'lines.khasraNo': re },
        { 'lines.khewatNo': re }
      ]
    }).select('lines.khasraEntry').lean();

    const searchKhasraEntryIds = [];
    matchingRegistries.forEach((r) => {
      (r.lines || []).forEach((l) => {
        if (l.khasraEntry) searchKhasraEntryIds.push(l.khasraEntry);
      });
    });

    khasraFilter.$or = [
      { khasraNo: re },
      { khewatNo: re },
      ...(searchKhasraEntryIds.length ? [{ _id: { $in: searchKhasraEntryIds } }] : [])
    ];
  }

  const allKhasras = await LandMozaKhasraEntry.find(khasraFilter)
    .populate('moza', 'name slug')
    .sort({ moza: 1, srNo: 1, khasraNo: 1 })
    .lean();

  if (!allKhasras.length) {
    return res.json({
      success: true,
      data: {
        khasras: [],
        pagination: { page: Number(page) || 1, limit: Number(limit) || 25, total: 0 },
        grandTotal: {
          baseline: { kanal: 0, marla: 0, sarsai: 0 },
          registered: { kanal: 0, marla: 0, sarsai: 0 },
          remainingToRegister: { kanal: 0, marla: 0, sarsai: 0 },
          possessed: { kanal: 0, marla: 0, sarsai: 0 },
          remainingToPossess: { kanal: 0, marla: 0, sarsai: 0 }
        }
      }
    });
  }

  const mozaIds = [...new Set(allKhasras.map((k) => String(k.moza?._id || k.moza)))];

  const [registries, possessions] = await Promise.all([
    LandRegistry.find({ moza: { $in: mozaIds }, isActive: true })
      .populate('seller', 'name cnic phoneNumber partyDate')
      .populate('purchaser', 'name cnic phoneNumber partyDate')
      .populate('dealer', 'name cnic phoneNumber partyDate')
      .lean(),
    LandPossession.find({ moza: { $in: mozaIds }, isActive: true }).lean()
  ]);

  const registriesByKhasra = new Map();
  registries.forEach((reg) => {
    (reg.lines || []).forEach((line) => {
      const kId = String(line.khasraEntry || '');
      const kKey = `${String(reg.moza)}_${String(line.khewatNo || '').trim()}_${String(line.khasraNo || '').trim()}`;
      const item = {
        _id: reg._id,
        registryNo: reg.registryNo,
        inteqalNo: reg.inteqalNo,
        dealNo: reg.dealNo,
        registryDate: reg.registryDate,
        seller: reg.seller,
        purchaser: reg.purchaser,
        dealer: reg.dealer,
        acquiredArea: normalizeArea(line.acquiredArea),
        registryDocAttachments: reg.registryDocAttachments || [],
        inteqalDocAttachments: reg.inteqalDocAttachments || [],
        attachments: reg.attachments || [],
        transferPercent: line.transferPercent,
        remarks: line.remarks
      };

      if (kId) {
        if (!registriesByKhasra.has(kId)) registriesByKhasra.set(kId, []);
        registriesByKhasra.get(kId).push(item);
      }
      if (!registriesByKhasra.has(kKey)) registriesByKhasra.set(kKey, []);
      registriesByKhasra.get(kKey).push(item);
    });
  });

  const possessionsByKhasra = new Map();
  possessions.forEach((pos) => {
    (pos.lines || []).forEach((line) => {
      const kId = String(line.khasraEntry || '');
      const kKey = `${String(pos.moza)}_${String(line.khewatNo || '').trim()}_${String(line.khasraNo || '').trim()}`;
      const item = {
        _id: pos._id,
        possessionRef: pos.possessionRef,
        possessionDate: pos.possessionDate,
        possessedArea: normalizeArea(line.possessedArea),
        transferPercent: line.transferPercent,
        remarks: line.remarks
      };

      if (kId) {
        if (!possessionsByKhasra.has(kId)) possessionsByKhasra.set(kId, []);
        possessionsByKhasra.get(kId).push(item);
      }
      if (!possessionsByKhasra.has(kKey)) possessionsByKhasra.set(kKey, []);
      possessionsByKhasra.get(kKey).push(item);
    });
  });

  let grandBaseline = { kanal: 0, marla: 0, sarsai: 0 };
  let grandRegistered = { kanal: 0, marla: 0, sarsai: 0 };
  let grandRemainingToRegister = { kanal: 0, marla: 0, sarsai: 0 };
  let grandPossessed = { kanal: 0, marla: 0, sarsai: 0 };
  let grandRemainingToPossess = { kanal: 0, marla: 0, sarsai: 0 };

  const enrichedKhasras = allKhasras.map((entry) => {
    const id = String(entry._id);
    const mozaIdStr = String(entry.moza?._id || entry.moza);
    const fallbackKey = `${mozaIdStr}_${String(entry.khewatNo || '').trim()}_${String(entry.khasraNo || '').trim()}`;

    const regList = registriesByKhasra.get(id) || registriesByKhasra.get(fallbackKey) || [];
    const uniqueRegistries = Array.from(new Map(regList.map(r => [String(r._id) + JSON.stringify(r.acquiredArea), r])).values());

    const posList = possessionsByKhasra.get(id) || possessionsByKhasra.get(fallbackKey) || [];
    const uniquePossessions = Array.from(new Map(posList.map(p => [String(p._id) + JSON.stringify(p.possessedArea), p])).values());

    const baseline = normalizeArea(entry.landInKhasra);
    const registered = addAreas(...uniqueRegistries.map(r => r.acquiredArea));
    const possessed = addAreas(...uniquePossessions.map(p => p.possessedArea));
    const remainingToRegister = subtractAreas(baseline, registered);
    const remainingToPossess = subtractAreas(registered, possessed);

    grandBaseline = addAreas(grandBaseline, baseline);
    grandRegistered = addAreas(grandRegistered, registered);
    grandRemainingToRegister = addAreas(grandRemainingToRegister, remainingToRegister);
    grandPossessed = addAreas(grandPossessed, possessed);
    grandRemainingToPossess = addAreas(grandRemainingToPossess, remainingToPossess);

    return {
      _id: entry._id,
      srNo: entry.srNo,
      moza: entry.moza,
      khewatNo: entry.khewatNo,
      khasraNo: entry.khasraNo,
      landInKhasra: baseline,
      totalAcquired: registered,
      remainingToRegister,
      totalPossessed: possessed,
      remainingToPossess,
      registries: uniqueRegistries,
      possessions: uniquePossessions,
      registriesCount: uniqueRegistries.length,
      possessionsCount: uniquePossessions.length,
      remarks: entry.remarks
    };
  });

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const skip = (pageNum - 1) * limitNum;
  const pagedKhasras = enrichedKhasras.slice(skip, skip + limitNum);

  res.json({
    success: true,
    data: {
      khasras: pagedKhasras,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: enrichedKhasras.length
      },
      grandTotal: {
        baseline: grandBaseline,
        registered: grandRegistered,
        remainingToRegister: grandRemainingToRegister,
        possessed: grandPossessed,
        remainingToPossess: grandRemainingToPossess
      }
    }
  });
}));

module.exports = router;
