const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
const { parseLandMozaExcel, slugify } = require('../utils/landMozaExcelParser');
const { parseAreaInput, normalizeArea } = require('../utils/landAreaUnits');
const { collectKhewatsFromEntries, khewatMongoFilter } = require('../utils/landKhewatUtils');

const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads/land-acquisition');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname || '').toLowerCase();
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) cb(null, true);
    else cb(new Error('Only .xlsx or .xls files are allowed'));
  }
});

const importEntriesForMoza = async (mozaDoc, entries, userId, sourceLabel) => {
  await LandMozaKhasraEntry.deleteMany({ moza: mozaDoc._id });

  if (entries.length) {
    await LandMozaKhasraEntry.insertMany(
      entries.map((e) => ({ ...e, moza: mozaDoc._id }))
    );
  }

  mozaDoc.entryCount = entries.length;
  if (sourceLabel) mozaDoc.sourceLabel = sourceLabel;
  if (userId) mozaDoc.createdBy = userId;
  await mozaDoc.save();

  return entries.length;
};

const parseArea = (obj) => parseAreaInput(obj);

const AREA_KEYS = ['landInKhasra'];

const buildEntryPayload = (body) => {
  const payload = {
    srNo: Number(body.srNo),
    khasraNo: String(body.khasraNo || '').trim(),
    khewatNo: String(body.khewatNo || '').trim(),
    mozaRef: String(body.mozaRef || '').trim()
  };
  AREA_KEYS.forEach((key) => {
    payload[key] = parseArea(body[key]);
  });
  return payload;
};

const syncMozaEntryCount = async (mozaId) => {
  const count = await LandMozaKhasraEntry.countDocuments({ moza: mozaId });
  await LandMoza.updateOne({ _id: mozaId }, { $set: { entryCount: count } });
  return count;
};

const getMozaOr404 = async (res, mozaId) => {
  const moza = await LandMoza.findOne({ _id: mozaId, isActive: true });
  if (!moza) {
    res.status(404).json({ success: false, message: 'Moza not found' });
    return null;
  }
  return moza;
};

const mapEntryAreas = (entry) => {
  const mapped = { ...entry };
  AREA_KEYS.forEach((key) => {
    mapped[key] = normalizeArea(entry[key]);
  });
  return mapped;
};

// GET /api/taj-residencia/land-acquisition/mozas
router.get('/mozas', authMiddleware, asyncHandler(async (req, res) => {
  const mozas = await LandMoza.find({ isActive: true })
    .sort({ name: 1 })
    .select('name slug sourceLabel entryCount createdAt updatedAt')
    .lean();

  res.json({ success: true, data: mozas });
}));

// GET /api/taj-residencia/land-acquisition/mozas/:id/khewats
router.get('/mozas/:id/khewats', authMiddleware, asyncHandler(async (req, res) => {
  const moza = await getMozaOr404(res, req.params.id);
  if (!moza) return;

  const entries = await LandMozaKhasraEntry.find({ moza: moza._id }).select('khewatNo').lean();
  const sorted = collectKhewatsFromEntries(entries);

  res.json({ success: true, data: sorted });
}));

// GET /api/taj-residencia/land-acquisition/mozas/:id/khasras
router.get('/mozas/:id/khasras', authMiddleware, asyncHandler(async (req, res) => {
  const moza = await getMozaOr404(res, req.params.id);
  if (!moza) return;

  const filter = { moza: moza._id };
  const khewatList = String(req.query.khewatNos || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (khewatList.length) {
    const orFilters = khewatList.flatMap((k) => khewatMongoFilter(k)?.$or || []);
    if (orFilters.length) filter.$or = orFilters;
  } else if (req.query.khewatNo) {
    const khewatFilter = khewatMongoFilter(req.query.khewatNo);
    if (khewatFilter) Object.assign(filter, khewatFilter);
  }

  const rows = await LandMozaKhasraEntry.find(filter)
    .sort({ srNo: 1 })
    .select('srNo khasraNo khewatNo landInKhasra')
    .lean();

  res.json({
    success: true,
    data: rows.map((row) => ({
      ...row,
      landInKhasra: normalizeArea(row.landInKhasra)
    }))
  });
}));

// GET /api/taj-residencia/land-acquisition/mozas/:id/entries
router.get('/mozas/:id/entries', authMiddleware, asyncHandler(async (req, res) => {
  const moza = await LandMoza.findById(req.params.id).lean();
  if (!moza) {
    return res.status(404).json({ success: false, message: 'Moza not found' });
  }

  const { search = '', page = 1, limit = 200 } = req.query;
  const filter = { moza: moza._id };

  if (search) {
    const re = new RegExp(search, 'i');
    filter.$or = [
      { khasraNo: re },
      { khewatNo: re },
      { mozaRef: re }
    ];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const skip = (pageNum - 1) * limitNum;

  const [entries, total] = await Promise.all([
    LandMozaKhasraEntry.find(filter).sort({ srNo: 1 }).skip(skip).limit(limitNum).lean(),
    LandMozaKhasraEntry.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      moza,
      entries: entries.map(mapEntryAreas),
      pagination: { page: pageNum, limit: limitNum, total }
    }
  });
}));

// GET /api/taj-residencia/land-acquisition/mozas/:id/entries/meta
router.get('/mozas/:id/entries/meta', authMiddleware, asyncHandler(async (req, res) => {
  const moza = await getMozaOr404(res, req.params.id);
  if (!moza) return;

  const last = await LandMozaKhasraEntry.findOne({ moza: moza._id })
    .sort({ srNo: -1 })
    .select('srNo')
    .lean();

  const total = await LandMozaKhasraEntry.countDocuments({ moza: moza._id });

  res.json({
    success: true,
    data: {
      nextSrNo: (last?.srNo || 0) + 1,
      total
    }
  });
}));

// POST /api/taj-residencia/land-acquisition/mozas/:id/entries
router.post('/mozas/:id/entries', authMiddleware, asyncHandler(async (req, res) => {
  const moza = await getMozaOr404(res, req.params.id);
  if (!moza) return;

  const payload = buildEntryPayload(req.body);

  if (!payload.khasraNo || !payload.khewatNo) {
    return res.status(400).json({ success: false, message: 'Khasra No. and Khewat No. are required' });
  }

  if (!payload.srNo || payload.srNo < 1) {
    const last = await LandMozaKhasraEntry.findOne({ moza: moza._id }).sort({ srNo: -1 }).select('srNo').lean();
    payload.srNo = (last?.srNo || 0) + 1;
  }

  const duplicate = await LandMozaKhasraEntry.findOne({ moza: moza._id, srNo: payload.srNo });
  if (duplicate) {
    return res.status(409).json({ success: false, message: `Sr No ${payload.srNo} already exists in this mouza` });
  }

  const entry = await LandMozaKhasraEntry.create({ ...payload, moza: moza._id });
  const entryCount = await syncMozaEntryCount(moza._id);

  res.status(201).json({
    success: true,
    message: 'Khasra record added',
    data: { entry, entryCount }
  });
}));

// PUT /api/taj-residencia/land-acquisition/mozas/:id/entries/:entryId
router.put('/mozas/:id/entries/:entryId', authMiddleware, asyncHandler(async (req, res) => {
  const moza = await getMozaOr404(res, req.params.id);
  if (!moza) return;

  const payload = buildEntryPayload(req.body);
  if (!payload.khasraNo || !payload.khewatNo) {
    return res.status(400).json({ success: false, message: 'Khasra No. and Khewat No. are required' });
  }
  if (!payload.srNo || payload.srNo < 1) {
    return res.status(400).json({ success: false, message: 'Valid Sr No is required' });
  }

  const existing = await LandMozaKhasraEntry.findOne({ _id: req.params.entryId, moza: moza._id });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Khasra record not found' });
  }

  const duplicate = await LandMozaKhasraEntry.findOne({
    moza: moza._id,
    srNo: payload.srNo,
    _id: { $ne: existing._id }
  });
  if (duplicate) {
    return res.status(409).json({ success: false, message: `Sr No ${payload.srNo} already exists in this mouza` });
  }

  Object.assign(existing, payload);
  await existing.save();

  res.json({
    success: true,
    message: 'Khasra record updated',
    data: { entry: existing }
  });
}));

// DELETE /api/taj-residencia/land-acquisition/mozas/:id/entries/:entryId
router.delete('/mozas/:id/entries/:entryId', authMiddleware, asyncHandler(async (req, res) => {
  const moza = await getMozaOr404(res, req.params.id);
  if (!moza) return;

  const deleted = await LandMozaKhasraEntry.findOneAndDelete({ _id: req.params.entryId, moza: moza._id });
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Khasra record not found' });
  }

  const entryCount = await syncMozaEntryCount(moza._id);

  res.json({
    success: true,
    message: 'Khasra record deleted',
    data: { entryCount }
  });
}));

// POST /api/taj-residencia/land-acquisition/mozas
router.post('/mozas', authMiddleware, asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) {
    return res.status(400).json({ success: false, message: 'Mouza name is required' });
  }

  const slug = slugify(name);
  const existing = await LandMoza.findOne({ slug, isActive: true });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: `Mouza "${existing.name}" already exists`
    });
  }

  const moza = await LandMoza.create({
    name,
    slug,
    sourceLabel: String(req.body?.sourceLabel || '').trim() || 'Manual entry',
    entryCount: 0,
    createdBy: req.user?._id
  });

  res.status(201).json({
    success: true,
    message: `Mouza "${name}" created`,
    data: moza
  });
}));

// DELETE /api/taj-residencia/land-acquisition/mozas/:id
router.delete('/mozas/:id', authMiddleware, asyncHandler(async (req, res) => {
  const moza = await getMozaOr404(res, req.params.id);
  if (!moza) return;

  await LandMozaKhasraEntry.deleteMany({ moza: moza._id });
  moza.isActive = false;
  moza.entryCount = 0;
  await moza.save();

  res.json({
    success: true,
    message: `Mouza "${moza.name}" deleted`,
    data: { mozaId: moza._id }
  });
}));

// POST /api/taj-residencia/land-acquisition/mozas/import
router.post(
  '/mozas/import',
  authMiddleware,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Excel file is required' });
    }

    try {
      const targetMozaId = String(req.body?.mozaId || '').trim();
      let targetMoza = null;
      if (targetMozaId) {
        targetMoza = await LandMoza.findOne({ _id: targetMozaId, isActive: true });
        if (!targetMoza) {
          return res.status(404).json({ success: false, message: 'Target mouza not found' });
        }
      }

      let parsed;
      try {
        parsed = parseLandMozaExcel(req.file.path, {
          fallbackMozaName: targetMoza?.name || String(req.body?.mozaName || '').trim()
        });
      } catch (parseErr) {
        return res.status(parseErr.statusCode || 400).json({
          success: false,
          message: parseErr.message || 'Failed to parse Excel file'
        });
      }

      let moza = targetMoza;
      if (!moza) {
        const slug = parsed.slug || slugify(parsed.mozaName);
        moza = await LandMoza.findOne({ slug, isActive: true });
        if (!moza) {
          moza = await LandMoza.create({
            name: parsed.mozaName,
            slug,
            sourceLabel: req.file.originalname,
            createdBy: req.user?._id
          });
        }
      }

      const count = await importEntriesForMoza(
        moza,
        parsed.entries,
        req.user?._id,
        req.file.originalname
      );

      res.json({
        success: true,
        message: `Imported ${count} khasra entries for ${moza.name}`,
        data: {
          mozaId: moza._id,
          name: moza.name,
          slug: moza.slug,
          entryCount: count
        }
      });
    } finally {
      fs.unlink(req.file.path, () => {});
    }
  })
);

module.exports = router;
