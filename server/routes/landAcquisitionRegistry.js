const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandRegistry = require('../models/tajResidencia/LandRegistry');
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
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Attachments must be a PDF or image file'), false);
    }
  }
});

const handleRegistryUpload = (req, res, next) => {
  registryUpload.array('attachments', 10)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Each attachment must be 10 MB or less' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Maximum 10 attachments per registry' });
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

const parseRemovedAttachmentIds = (body) => {
  const raw = body.removedAttachmentIds;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  }
};

const applyAttachmentChanges = (registry, body, files) => {
  const removedIds = new Set(parseRemovedAttachmentIds(body));
  const kept = (registry.attachments || []).filter((att) => {
    if (removedIds.has(String(att._id))) {
      deleteAttachmentFile(att);
      return false;
    }
    return true;
  });
  registry.attachments = [...kept, ...mapUploadedAttachments(files)];
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
  const totals = await fetchRegisteredTotalsByKhasra(moza, excludeRegistryId);

  for (const line of lines) {
    const id = String(line.khasraEntry || '');
    if (!id || !toSarsais(line.khasraArea)) continue;

    const prior = totals[id] || { kanal: 0, marla: 0, sarsai: 0 };
    const owned = addAreas(prior, line.acquiredArea);
    const khasraArea = normalizeArea(line.khasraArea);

    if (toSarsais(owned) > toSarsais(khasraArea)) {
      const remArea = subtractAreas(khasraArea, prior);
      const err = new Error(
        `Total land owned for Khasra ${line.khasraNo} cannot exceed khasra area. Maximum area in registry: ${remArea.kanal}-${remArea.marla}-${remArea.sarsai}`
      );
      err.status = 400;
      throw err;
    }
  }
};

const parseLine = (line) => ({
  khasraEntry: line.khasraEntry || undefined,
  khewatNo: String(line.khewatNo || '').trim(),
  khasraNo: String(line.khasraNo || '').trim(),
  khasraArea: parseAreaInput(line.khasraArea),
  landOfKhasra: parseAreaInput(line.landOfKhasra),
  acquiredArea: parseAreaInput(line.acquiredArea),
  landWithMalkiyat: parseAreaInput(line.landWithMalkiyat),
  transferPercent: Math.min(100, Math.max(0, Number(line.transferPercent) || 0)),
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

  if (toSarsais(linesTotal) > toSarsais(totalArea)) {
    const err = new Error('Sum of area in registry lines cannot exceed total area');
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
    registryDate: body.registryDate ? new Date(body.registryDate) : null,
    moza: body.moza,
    khewatNo: khewatNos.join(', '),
    khewatNos,
    totalArea,
    registryNo: String(body.registryNo || '').trim(),
    inteqalNo: String(body.inteqalNo || '').trim(),
    lines,
    linesTotal
  };
};

const mapRegistry = (doc) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const khewatNos = (obj.khewatNos?.length
    ? obj.khewatNos
    : String(obj.khewatNo || '').split(',').map((s) => s.trim()).filter(Boolean));
  return {
    ...obj,
    khewatNos,
    khewatNo: khewatNos.join(', ') || obj.khewatNo,
    totalArea: normalizeArea(obj.totalArea),
    lines: (obj.lines || []).map((line) => ({
      ...line,
      khasraArea: normalizeArea(line.khasraArea),
      landOfKhasra: normalizeArea(line.landOfKhasra),
      acquiredArea: normalizeArea(line.acquiredArea),
      landWithMalkiyat: normalizeArea(line.landWithMalkiyat)
    }))
  };
};

// GET /api/taj-residencia/land-acquisition/registries
router.get('/registries', authMiddleware, asyncHandler(async (req, res) => {
  const { moza, search = '', page = 1, limit = 50 } = req.query;
  const filter = { isActive: true };

  if (moza) filter.moza = moza;
  if (search) {
    const re = new RegExp(search, 'i');
    filter.$or = [{ registryNo: re }, { inteqalNo: re }, { khewatNo: re }];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const skip = (pageNum - 1) * limitNum;

  const [rows, total] = await Promise.all([
    LandRegistry.find(filter)
      .populate('moza', 'name slug')
      .sort({ registryDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    LandRegistry.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      registries: rows.map(mapRegistry),
      pagination: { page: pageNum, limit: limitNum, total }
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
    .populate('moza', 'name slug');

  if (!registry) {
    return res.status(404).json({ success: false, message: 'Registry not found' });
  }

  res.json({ success: true, data: mapRegistry(registry) });
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
  if (!payload.registryNo) {
    return res.status(400).json({ success: false, message: 'Registry No. is required' });
  }
  if (!payload.lines.length) {
    return res.status(400).json({ success: false, message: 'At least one khasra line is required' });
  }

  const moza = await LandMoza.findOne({ _id: payload.moza, isActive: true });
  if (!moza) {
    return res.status(404).json({ success: false, message: 'Moza not found' });
  }

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

  try {
    await assertKhasraOwnershipLimits(payload.moza, payload.lines);
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  const registry = await LandRegistry.create({
    registryDate: payload.registryDate,
    moza: payload.moza,
    khewatNo: payload.khewatNo,
    khewatNos: payload.khewatNos,
    totalArea: payload.totalArea,
    registryNo: payload.registryNo,
    inteqalNo: payload.inteqalNo,
    lines: payload.lines,
    attachments: mapUploadedAttachments(req.files),
    createdBy: req.user?._id
  });

  await registry.populate('moza', 'name slug');

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

  if (!payload.registryDate || Number.isNaN(payload.registryDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Registry date is required' });
  }
  if (!payload.khewatNos?.length || !payload.registryNo || !payload.lines.length) {
    return res.status(400).json({ success: false, message: 'Registry No., at least one Khewat, and one line are required' });
  }

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
  registry.lines = payload.lines;
  applyAttachmentChanges(registry, body, req.files);
  await registry.save();
  await registry.populate('moza', 'name slug');

  res.json({
    success: true,
    message: 'Registry updated',
    data: mapRegistry(registry)
  });
}));

// DELETE /api/taj-residencia/land-acquisition/registries/:id
router.delete('/registries/:id', authMiddleware, asyncHandler(async (req, res) => {
  const registry = await LandRegistry.findOne({ _id: req.params.id, isActive: true });
  if (!registry) {
    return res.status(404).json({ success: false, message: 'Registry not found' });
  }

  registry.isActive = false;
  await registry.save();

  res.json({ success: true, message: 'Registry deleted' });
}));

module.exports = router;
