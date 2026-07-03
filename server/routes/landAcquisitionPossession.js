const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
const LandPossession = require('../models/tajResidencia/LandPossession');
const { buildMozaAcquisitionStatus } = require('../utils/landAcquisitionStatus');
const {
  parseAreaInput, addAreas, toSarsais, normalizeArea, subtractAreas
} = require('../utils/landAreaUnits');
const { enrichPossessionLines } = require('../utils/syncKhasraFromMozaEntry');

const router = express.Router();

const fetchPossessedTotalsByKhasra = async (moza, excludePossessionId) => {
  const filter = { moza, isActive: true };
  if (excludePossessionId) {
    filter._id = { $ne: excludePossessionId };
  }

  const possessions = await LandPossession.find(filter).select('lines').lean();
  const totals = {};

  possessions.forEach((doc) => {
    (doc.lines || []).forEach((line) => {
      const id = String(line.khasraEntry || '');
      if (!id) return;
      totals[id] = addAreas(totals[id] || { kanal: 0, marla: 0, sarsai: 0 }, normalizeArea(line.possessedArea));
    });
  });

  return totals;
};

const assertPossessionKhasraLimits = async (moza, lines, excludePossessionId) => {
  const totals = await fetchPossessedTotalsByKhasra(moza, excludePossessionId);
  const ids = [...new Set(lines.map((l) => String(l.khasraEntry || '')).filter(Boolean))];
  const entries = await LandMozaKhasraEntry.find({ _id: { $in: ids } }).select('landInKhasra').lean();
  const plotById = Object.fromEntries(
    entries.map((e) => [String(e._id), normalizeArea(e.landInKhasra)])
  );

  for (const line of lines) {
    const id = String(line.khasraEntry || '');
    const plotArea = plotById[id];
    if (!id || !toSarsais(plotArea)) continue;

    const prior = totals[id] || { kanal: 0, marla: 0, sarsai: 0 };
    const owned = addAreas(prior, line.possessedArea);

    if (toSarsais(owned) > toSarsais(plotArea)) {
      const remArea = subtractAreas(plotArea, prior);
      const err = new Error(
        `Total land possessed for Khasra ${line.khasraNo} cannot exceed khasra plot area. Maximum possessed area: ${remArea.kanal}-${remArea.marla}-${remArea.sarsai}`
      );
      err.status = 400;
      throw err;
    }
  }
};

const generatePossessionRef = async (mozaId) => {
  const docs = await LandPossession.find({
    moza: mozaId,
    isActive: true,
    possessionRef: { $ne: '' }
  }).select('possessionRef').lean();

  let max = 0;
  docs.forEach((doc) => {
    const match = String(doc.possessionRef || '').match(/(\d+)\s*$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });

  return `POS-${String(max + 1).padStart(4, '0')}`;
};

const parseLine = (line) => ({
  registryKhasraEntry: line.registryKhasraEntry || undefined,
  registryKhewatNo: String(line.registryKhewatNo || '').trim(),
  registryKhasraNo: String(line.registryKhasraNo || '').trim(),
  registeredArea: parseAreaInput(line.registeredArea),
  khasraEntry: line.khasraEntry || undefined,
  registry: line.registry || undefined,
  khewatNo: String(line.khewatNo || '').trim(),
  khasraNo: String(line.khasraNo || '').trim(),
  khasraArea: parseAreaInput(line.khasraArea),
  possessedArea: parseAreaInput(line.possessedArea),
  totalLandPossessed: parseAreaInput(line.totalLandPossessed),
  transferPercent: Math.min(100, Math.max(0, Number(line.transferPercent) || 0)),
  remarks: String(line.remarks || '').trim()
});

const buildPossessionPayload = (body) => {
  const lines = Array.isArray(body.lines) ? body.lines.map(parseLine) : [];
  const invalidLine = lines.find((l) => !l.khasraEntry || !l.khewatNo || !l.khasraNo);
  if (invalidLine) {
    const err = new Error('Each line must have an allocated khasra (where possession applies).');
    err.status = 400;
    throw err;
  }

  const totalArea = parseAreaInput(body.totalArea);
  const linesTotal = addAreas(...lines.map((l) => l.possessedArea));

  let khewatNo = String(body.khewatNo || '').trim();
  if (!khewatNo) {
    khewatNo = [...new Set(lines.map((l) => l.khewatNo).filter(Boolean))].join(', ');
  }

  if (!khewatNo) {
    const err = new Error('At least one Khewat is required on a line');
    err.status = 400;
    throw err;
  }

  return {
    possessionDate: body.possessionDate ? new Date(body.possessionDate) : null,
    moza: body.moza,
    khewatNo,
    totalArea,
    possessionRef: String(body.possessionRef || '').trim(),
    registry: body.registry || undefined,
    lines,
    linesTotal
  };
};

const mapPossession = (doc) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    totalArea: normalizeArea(obj.totalArea),
    lines: (obj.lines || []).map((line) => ({
      ...line,
      registeredArea: normalizeArea(line.registeredArea),
      khasraArea: normalizeArea(line.khasraArea),
      possessedArea: normalizeArea(line.possessedArea),
      totalLandPossessed: normalizeArea(line.totalLandPossessed),
      transferPercent: line.transferPercent != null ? line.transferPercent : 0,
      khasraEntry: line.khasraEntry ? { ...line.khasraEntry, landInKhasra: normalizeArea(line.khasraEntry.landInKhasra) } : undefined
    }))
  };
};

// GET /api/taj-residencia/land-acquisition/possession-status
router.get('/possession-status', authMiddleware, asyncHandler(async (req, res) => {
  const { moza, khewatNo, search } = req.query;
  if (!moza) {
    return res.status(400).json({ success: false, message: 'Moza is required' });
  }

  const mozaDoc = await LandMoza.findOne({ _id: moza, isActive: true });
  if (!mozaDoc) {
    return res.status(404).json({ success: false, message: 'Moza not found' });
  }

  const rows = await buildMozaAcquisitionStatus(moza, { khewatNo, search });

  res.json({
    success: true,
    data: {
      moza: { _id: mozaDoc._id, name: mozaDoc.name },
      rows
    }
  });
}));

// GET /api/taj-residencia/land-acquisition/possessions
router.get('/possessions', authMiddleware, asyncHandler(async (req, res) => {
  const { moza, search = '', page = 1, limit = 50 } = req.query;
  const filter = { isActive: true };

  if (moza) {
    const mongoose = require('mongoose');
    filter.moza = new mongoose.Types.ObjectId(moza);
  }
  if (search) {
    const re = new RegExp(search, 'i');
    filter.$or = [{ possessionRef: re }, { khewatNo: re }];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const skip = (pageNum - 1) * limitNum;

  const SARSAIS_PER_KANAL = 180;
  const SARSAI_PER_MARLA = 9;

  const [rows, total, grandTotalAgg] = await Promise.all([
    LandPossession.find(filter)
      .populate('moza', 'name slug')
      .populate('registry', 'registryNo inteqalNo registryDate')
      .sort({ possessionDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    LandPossession.countDocuments(filter),
    LandPossession.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSarsais: {
            $sum: {
              $add: [
                { $multiply: [{ $ifNull: ['$totalArea.kanal', 0] }, SARSAIS_PER_KANAL] },
                { $multiply: [{ $ifNull: ['$totalArea.marla', 0] }, SARSAI_PER_MARLA] },
                { $ifNull: ['$totalArea.sarsai', 0] }
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

  res.json({
    success: true,
    data: {
      possessions: rows.map(mapPossession),
      pagination: { page: pageNum, limit: limitNum, total },
      grandTotal: { kanal: grandKanal, marla: grandMarla, sarsai: grandSarsai }
    }
  });
}));

// GET /api/taj-residencia/land-acquisition/possessions/possessed-totals?moza=&excludePossessionId=
router.get('/possessions/possessed-totals', authMiddleware, asyncHandler(async (req, res) => {
  const { moza, excludePossessionId } = req.query;
  if (!moza) {
    return res.status(400).json({ success: false, message: 'moza is required' });
  }

  const totals = await fetchPossessedTotalsByKhasra(moza, excludePossessionId);
  res.json({ success: true, data: totals });
}));

// GET /api/taj-residencia/land-acquisition/possessions/next-ref?moza=
router.get('/possessions/next-ref', authMiddleware, asyncHandler(async (req, res) => {
  const { moza } = req.query;
  if (!moza) {
    return res.status(400).json({ success: false, message: 'moza is required' });
  }

  const mozaDoc = await LandMoza.findOne({ _id: moza, isActive: true });
  if (!mozaDoc) {
    return res.status(404).json({ success: false, message: 'Moza not found' });
  }

  const possessionRef = await generatePossessionRef(moza);
  res.json({ success: true, data: { possessionRef } });
}));

// GET /api/taj-residencia/land-acquisition/possessions/:id
router.get('/possessions/:id', authMiddleware, asyncHandler(async (req, res) => {
  const doc = await LandPossession.findOne({ _id: req.params.id, isActive: true })
    .populate('moza', 'name slug')
    .populate('registry', 'registryNo inteqalNo registryDate')
    .populate('lines.khasraEntry', 'landInKhasra');

  if (!doc) {
    return res.status(404).json({ success: false, message: 'Possession record not found' });
  }

  res.json({ success: true, data: mapPossession(doc) });
}));

// POST /api/taj-residencia/land-acquisition/possessions
router.post('/possessions', authMiddleware, asyncHandler(async (req, res) => {
  let payload;
  try {
    payload = buildPossessionPayload(req.body);
    payload.lines = await enrichPossessionLines(payload.lines);
    payload.khewatNo = [...new Set(payload.lines.map((l) => l.khewatNo).filter(Boolean))].join(', ');
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  if (!payload.possessionDate || Number.isNaN(payload.possessionDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Possession date is required' });
  }
  if (!payload.moza || !payload.lines.length) {
    return res.status(400).json({ success: false, message: 'Moza and at least one line are required' });
  }

  const moza = await LandMoza.findOne({ _id: payload.moza, isActive: true });
  if (!moza) {
    return res.status(404).json({ success: false, message: 'Moza not found' });
  }

  const possessionRef = payload.possessionRef || await generatePossessionRef(payload.moza);

  const duplicate = await LandPossession.findOne({
    moza: payload.moza,
    possessionRef,
    isActive: true
  });
  if (duplicate) {
    return res.status(409).json({
      success: false,
      message: `Possession ref "${possessionRef}" already exists for this mouza`
    });
  }

  const finalTotal = toSarsais(payload.totalArea) ? payload.totalArea : payload.linesTotal;
  if (toSarsais(payload.totalArea) && toSarsais(payload.linesTotal) !== toSarsais(payload.totalArea)) {
    return res.status(400).json({
      success: false,
      message: 'Total area must match sum of possessed areas on all lines'
    });
  }

  try {
    await assertPossessionKhasraLimits(payload.moza, payload.lines);
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  const doc = await LandPossession.create({
    possessionDate: payload.possessionDate,
    moza: payload.moza,
    khewatNo: payload.khewatNo,
    totalArea: finalTotal,
    possessionRef,
    registry: payload.registry,
    lines: payload.lines,
    createdBy: req.user?._id
  });

  await doc.populate([
    { path: 'moza', select: 'name slug' },
    { path: 'registry', select: 'registryNo inteqalNo registryDate' },
    { path: 'lines.khasraEntry', select: 'landInKhasra' }
  ]);

  res.status(201).json({
    success: true,
    message: 'Possession record created',
    data: mapPossession(doc)
  });
}));

// PUT /api/taj-residencia/land-acquisition/possessions/:id
router.put('/possessions/:id', authMiddleware, asyncHandler(async (req, res) => {
  const doc = await LandPossession.findOne({ _id: req.params.id, isActive: true });
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Possession record not found' });
  }

  let payload;
  try {
    payload = buildPossessionPayload(req.body);
    payload.lines = await enrichPossessionLines(payload.lines);
    payload.khewatNo = [...new Set(payload.lines.map((l) => l.khewatNo).filter(Boolean))].join(', ');
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  if (!payload.possessionDate || Number.isNaN(payload.possessionDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Possession date is required' });
  }
  if (!payload.khewatNo || !payload.lines.length) {
    return res.status(400).json({ success: false, message: 'At least one khasra line with khewat is required' });
  }

  if (payload.possessionRef) {
    const duplicate = await LandPossession.findOne({
      _id: { $ne: doc._id },
      moza: doc.moza,
      possessionRef: payload.possessionRef,
      isActive: true
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `Possession ref "${payload.possessionRef}" already exists for this mouza`
      });
    }
  }

  const finalTotal = toSarsais(payload.totalArea) ? payload.totalArea : payload.linesTotal;
  if (toSarsais(payload.totalArea) && toSarsais(payload.linesTotal) !== toSarsais(payload.totalArea)) {
    return res.status(400).json({
      success: false,
      message: 'Total area must match sum of possessed areas on all lines'
    });
  }

  try {
    await assertPossessionKhasraLimits(doc.moza, payload.lines, doc._id);
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  doc.possessionDate = payload.possessionDate;
  doc.khewatNo = payload.khewatNo;
  doc.totalArea = finalTotal;
  doc.possessionRef = payload.possessionRef;
  doc.registry = payload.registry;
  doc.lines = payload.lines;
  await doc.save();

  await doc.populate([
    { path: 'moza', select: 'name slug' },
    { path: 'registry', select: 'registryNo inteqalNo registryDate' },
    { path: 'lines.khasraEntry', select: 'landInKhasra' }
  ]);

  res.json({
    success: true,
    message: 'Possession record updated',
    data: mapPossession(doc)
  });
}));

// DELETE /api/taj-residencia/land-acquisition/possessions/:id
router.delete('/possessions/:id', authMiddleware, asyncHandler(async (req, res) => {
  const doc = await LandPossession.findOne({ _id: req.params.id, isActive: true });
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Possession record not found' });
  }

  doc.isActive = false;
  await doc.save();

  res.json({ success: true, message: 'Possession record deleted' });
}));

module.exports = router;
