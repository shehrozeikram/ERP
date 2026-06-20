const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');
const { authorize } = require('../middleware/auth');
const FixedAsset = require('../models/finance/FixedAsset');
const FinanceHelper = require('../utils/financeHelper');
const { financeScope, assertDocCompany } = require('../utils/financeRouteScope');
const { withCompany } = require('../utils/financePosting');
const Employee = require('../models/hr/Employee');
const Project = require('../models/hr/Project');

const fixedAssetUploadDir = path.join(__dirname, '../uploads/fixed-assets');
const fixedAssetUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(fixedAssetUploadDir)) {
      fs.mkdirSync(fixedAssetUploadDir, { recursive: true });
    }
    cb(null, fixedAssetUploadDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `fixed-asset-${unique}${path.extname(file.originalname)}`);
  }
});

const fixedAssetUpload = multer({
  storage: fixedAssetUploadStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Attachments must be a PDF or image file'), false);
    }
  }
});

const handleFixedAssetUpload = (req, res, next) => {
  fixedAssetUpload.array('attachments', 5)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Each attachment must be 10 MB or less' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Maximum 5 attachments per asset' });
    }
    return res.status(400).json({ success: false, message: err.message || 'File upload error' });
  });
};

const parseFixedAssetRequestBody = (req) => {
  if (!req.body?.data) return req.body;
  try {
    return typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
  } catch {
    const err = new Error('Invalid asset data');
    err.status = 400;
    throw err;
  }
};

const mapUploadedAttachments = (files = []) => files.map((file) => ({
  filename: file.filename,
  originalName: file.originalname,
  path: `/uploads/fixed-assets/${file.filename}`,
  mimetype: file.mimetype,
  size: file.size,
  uploadedAt: new Date()
}));

const deleteAttachmentFile = (attachment) => {
  if (!attachment?.path) return;
  const filename = path.basename(attachment.path);
  const filePath = path.join(fixedAssetUploadDir, filename);
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

const applyAttachmentChanges = (asset, body, files) => {
  const removedIds = new Set(parseRemovedAttachmentIds(body));
  const kept = (asset.attachments || []).filter((att) => {
    if (removedIds.has(String(att._id))) {
      deleteAttachmentFile(att);
      return false;
    }
    return true;
  });
  asset.attachments = [...kept, ...mapUploadedAttachments(files)];
};

const normalizeFixedAssetPayload = (body = {}) => {
  const normalized = { ...body };
  normalized.name = String(body.name || '').trim();
  normalized.purchaseCost = body.purchaseCost === '' || body.purchaseCost == null
    ? 0
    : Number(body.purchaseCost);
  if (Number.isNaN(normalized.purchaseCost) || normalized.purchaseCost < 0) {
    normalized.purchaseCost = 0;
  }
  if (body.purchaseDate === null || body.purchaseDate === '') {
    normalized.purchaseDate = null;
  } else if (!body.purchaseDate) {
    delete normalized.purchaseDate;
  }
  return normalized;
};

const validateFixedAssetPayload = (body) => {
  const errors = [];
  if (body.purchaseCost !== undefined && body.purchaseCost !== null && body.purchaseCost !== '') {
    const cost = Number(body.purchaseCost);
    if (Number.isNaN(cost) || cost < 0) errors.push({ msg: 'Purchase cost must be >= 0' });
  }
  return errors;
};

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

function normalizeProjectInput(input) {
  if (input === undefined) return undefined;
  if (input === null || input === '') return null;
  if (typeof input === 'string') return input;
  if (typeof input === 'object') {
    return input._id || input.id || input.value || null;
  }
  return null;
}

// GET /api/finance/fixed-assets
router.get('/', asyncHandler(async (req, res) => {
  const { status, category } = req.query;
  const { q } = await financeScope(req);
  const filter = q({});
  if (status) filter.status = status;
  if (category) filter.category = category;

  const assets = await FixedAsset.find(filter)
    .populate('assetAccount', 'name accountNumber')
    .populate('accumulatedDeprecAccount', 'name accountNumber')
    .populate('depreciationExpenseAccount', 'name accountNumber')
    .populate('project', 'name code projectId')
    .populate('costCenter', 'name code')
    .sort({ assetNumber: 1 });

  res.json({ success: true, data: assets, count: assets.length });
}));

// GET /api/finance/fixed-assets/next-serial (before /:id so path is not captured as id)
router.get('/next-serial', authorize('super_admin', 'admin', 'finance_manager'), asyncHandler(async (req, res) => {
  const assets = await FixedAsset.find({ serialNumber: { $exists: true, $ne: '' } }).select('serialNumber').lean();
  let max = 0;
  for (const asset of assets) {
    const raw = String(asset.serialNumber || '');
    const match = raw.match(/(\d+)(?!.*\d)/);
    if (!match) continue;
    const n = Number(match[1]);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  const next = max + 1;
  const serialNumber = `SN-${String(next).padStart(5, '0')}`;
  res.json({ success: true, data: { serialNumber, next } });
}));

// GET /api/finance/fixed-assets/employees — HR Employee master (not only User logins)
router.get('/employees', authorize('super_admin', 'admin', 'finance_manager', 'tcm_manager'), asyncHandler(async (req, res) => {
  const rows = await Employee.find({ isDeleted: false })
    .select('firstName lastName employeeId placementDepartment placementDesignation isActive employmentStatus')
    .populate('placementDepartment', 'name')
    .populate('placementDesignation', 'title')
    .sort({ isActive: -1, firstName: 1, lastName: 1 })
    .lean();

  const employees = rows.map((e) => ({
    _id: e._id,
    fullName: `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'Employee',
    employeeId: e.employeeId || '',
    department: e.placementDepartment?.name || '',
    position: e.placementDesignation?.title || ''
  }));

  res.json({ success: true, data: employees });
}));

// GET /api/finance/fixed-assets/projects — project master for dropdown
router.get('/projects', authorize(
  'super_admin',
  'admin',
  'finance_manager',
  'tcm_manager',
  'procurement_manager',
  'hr_manager',
  'audit_manager',
  'higher_management'
), asyncHandler(async (req, res) => {
  // Keep dropdown usable in environments where ongoing projects are marked
  // as Planning/On Hold instead of strictly Active.
  const projects = await Project.find({ status: { $nin: ['Completed', 'Cancelled'] } })
    .select('name code projectId')
    .sort({ name: 1 })
    .lean();
  res.json({ success: true, data: projects });
}));

// GET /api/finance/fixed-assets/:id
router.get('/:id([0-9a-fA-F]{24})', asyncHandler(async (req, res) => {
  const { q } = await financeScope(req);
  const asset = await FixedAsset.findOne(q({ _id: req.params.id }))
    .populate('assetAccount', 'name accountNumber')
    .populate('accumulatedDeprecAccount', 'name accountNumber')
    .populate('depreciationExpenseAccount', 'name accountNumber')
    .populate('project', 'name code projectId')
    .populate('costCenter', 'name code')
    .populate('depreciationSchedule.journalEntry', 'entryNumber date');
  if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
  res.json({ success: true, data: asset });
}));

// POST /api/finance/fixed-assets
router.post('/', authorize('super_admin', 'admin', 'finance_manager'), handleFixedAssetUpload,
  asyncHandler(async (req, res) => {
    const body = normalizeFixedAssetPayload(parseFixedAssetRequestBody(req));
    const validationErrors = validateFixedAssetPayload(body);
    if (validationErrors.length) {
      return res.status(400).json({ success: false, errors: validationErrors });
    }

    const { companyId } = await financeScope(req);
    const payload = { ...body, createdBy: req.user.id, companyId };
    payload.project = normalizeProjectInput(payload.project);
    if (!payload.serialNumber) {
      const assets = await FixedAsset.find({ serialNumber: { $exists: true, $ne: '' } }).select('serialNumber').lean();
      let max = 0;
      for (const asset of assets) {
        const raw = String(asset.serialNumber || '');
        const match = raw.match(/(\d+)(?!.*\d)/);
        if (!match) continue;
        const n = Number(match[1]);
        if (!Number.isNaN(n) && n > max) max = n;
      }
      payload.serialNumber = `SN-${String(max + 1).padStart(5, '0')}`;
    }

    if (req.files?.length) {
      payload.attachments = mapUploadedAttachments(req.files);
    }

    const asset = await FixedAsset.create(payload);
    res.status(201).json({ success: true, data: asset });
  })
);

// PUT /api/finance/fixed-assets/:id
router.put('/:id', authorize('super_admin', 'admin', 'finance_manager'), handleFixedAssetUpload,
  asyncHandler(async (req, res) => {
    const { companyId, q } = await financeScope(req);
    const asset = await FixedAsset.findOne(q({ _id: req.params.id }));
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    assertDocCompany(asset, companyId, 'Fixed asset');

    const body = normalizeFixedAssetPayload(parseFixedAssetRequestBody(req));
    const allowed = ['name', 'description', 'category', 'purchaseDate', 'purchaseCost', 'residualValue', 'depreciationMethod',
      'usefulLifeYears', 'depreciationRate', 'assetAccount', 'accumulatedDeprecAccount',
      'depreciationExpenseAccount', 'location', 'assignedTo', 'project', 'costCenter', 'serialNumber',
      'brand', 'model', 'condition', 'manufacturer', 'warrantyExpiryDate', 'characteristics'];
    allowed.forEach((f) => {
      if (body[f] === undefined) return;
      if (f === 'project') {
        asset[f] = normalizeProjectInput(body[f]);
        return;
      }
      if (f === 'purchaseDate' && body[f] === null) {
        asset[f] = undefined;
        return;
      }
      asset[f] = body[f];
    });

    if (req.files?.length || req.body?.removedAttachmentIds) {
      applyAttachmentChanges(asset, req.body, req.files || []);
    }

    asset.updatedBy = req.user.id;
    await asset.save();

    res.json({ success: true, data: asset });
  })
);

// POST /api/finance/fixed-assets/:id/depreciate — run monthly depreciation for asset
router.post('/:id/depreciate', authorize('super_admin', 'admin', 'finance_manager'), asyncHandler(async (req, res) => {
  const { companyId, q, withCo } = await financeScope(req);
  const asset = await FixedAsset.findOne(q({ _id: req.params.id }));
  if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
  assertDocCompany(asset, companyId, 'Fixed asset');
  if (asset.status !== 'active') return res.status(400).json({ success: false, message: 'Asset is not active' });

  const { year, month } = req.body;
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const existing = asset.depreciationSchedule.find(d => d.period === period);
  if (existing && existing.status === 'posted') {
    return res.status(400).json({ success: false, message: `Depreciation already posted for ${period}` });
  }

  const monthly = asset.calcMonthlyDepreciation();
  if (monthly <= 0) return res.status(400).json({ success: false, message: 'No depreciation to post' });

  const remainingDepreciable = asset.purchaseCost - asset.residualValue - asset.accumulatedDepreciation;
  const depreciationAmt = Math.min(monthly, Math.max(0, remainingDepreciable));

  if (depreciationAmt <= 0) {
    asset.status = 'fully_depreciated';
    await asset.save();
    return res.json({ success: true, message: 'Asset is fully depreciated', data: asset });
  }

  let journalEntry = null;
  if (asset.depreciationExpenseAccount && asset.accumulatedDeprecAccount) {
    try {
      journalEntry = await FinanceHelper.createAndPostJournalEntry(withCo({
        date: new Date(year, month - 1, 28),
        reference: `DEP-${asset.assetNumber}-${period}`,
        description: `Depreciation – ${asset.name} (${period})`,
        department: 'finance',
        module: 'finance',
        referenceId: asset._id,
        referenceType: 'depreciation',
        journalCode: 'DEPR',
        createdBy: req.user.id,
        lines: [
          { account: asset.depreciationExpenseAccount, description: `Depreciation expense – ${asset.name}`, debit: depreciationAmt, department: 'finance', costCenter: asset.costCenter },
          { account: asset.accumulatedDeprecAccount, description: `Accum. depreciation – ${asset.name}`, credit: depreciationAmt, department: 'finance', costCenter: asset.costCenter }
        ]
      }));
    } catch (e) {
      console.warn('[FixedAsset] Depreciation JE failed:', e.message);
    }
  }

  asset.accumulatedDepreciation = Math.round((asset.accumulatedDepreciation + depreciationAmt) * 100) / 100;
  asset.currentBookValue = Math.round((asset.purchaseCost - asset.accumulatedDepreciation) * 100) / 100;
  asset.lastDepreciationDate = new Date(year, month - 1, 28);

  if (asset.currentBookValue <= asset.residualValue) asset.status = 'fully_depreciated';

  // Update or add schedule line
  const schedIdx = asset.depreciationSchedule.findIndex(d => d.period === period);
  const scheduleLine = {
    period, year: Number(year), month: Number(month),
    amount: depreciationAmt,
    bookValue: asset.currentBookValue,
    accumulatedDepreciation: asset.accumulatedDepreciation,
    journalEntry: journalEntry?._id,
    postedAt: journalEntry ? new Date() : undefined,
    status: journalEntry ? 'posted' : 'pending'
  };
  if (schedIdx >= 0) asset.depreciationSchedule[schedIdx] = scheduleLine;
  else asset.depreciationSchedule.push(scheduleLine);

  await asset.save();
  res.json({ success: true, message: `Depreciation posted for ${period}`, data: { asset, depreciationAmt } });
}));

// POST /api/finance/fixed-assets/:id/dispose — dispose of asset
router.post('/:id/dispose', authorize('super_admin', 'admin', 'finance_manager'), asyncHandler(async (req, res) => {
  const { companyId, q } = await financeScope(req);
  const asset = await FixedAsset.findOne(q({ _id: req.params.id }));
  if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
  assertDocCompany(asset, companyId, 'Fixed asset');

  const { disposalDate, disposalValue = 0, notes } = req.body;
  asset.status = 'disposed';
  asset.disposalDate = new Date(disposalDate);
  asset.disposalValue = Number(disposalValue);
  asset.updatedBy = req.user.id;
  await asset.save();

  res.json({ success: true, message: 'Asset disposed', data: asset });
}));

// POST /api/finance/fixed-assets/depreciate-all — run depreciation for ALL active assets for a given period
router.post('/depreciate-all', authorize('super_admin', 'admin', 'finance_manager'), asyncHandler(async (req, res) => {
  const { year, month } = req.body;
  if (!year || !month) return res.status(400).json({ success: false, message: 'year and month are required' });

  const { runFixedAssetDepreciation } = require('../utils/fixedAssetDepreciationCron');
  const results = await runFixedAssetDepreciation(Number(year), Number(month));
  res.json({ success: true, message: `Bulk depreciation complete – ${results.posted} posted, ${results.skipped} skipped`, data: results });
}));

// GET /api/finance/fixed-assets/reports/summary — summary by category
router.get('/reports/summary', asyncHandler(async (req, res) => {
  const { q } = await financeScope(req);
  const companyMatch = q({});
  const summary = await FixedAsset.aggregate([
    { $match: companyMatch },
    { $group: {
      _id: '$category',
      count: { $sum: 1 },
      totalCost: { $sum: '$purchaseCost' },
      totalAccumDepreciation: { $sum: '$accumulatedDepreciation' },
      totalBookValue: { $sum: '$currentBookValue' }
    }},
    { $sort: { _id: 1 } }
  ]);
  const totals = summary.reduce((acc, s) => ({
    count: acc.count + s.count,
    totalCost: acc.totalCost + s.totalCost,
    totalBookValue: acc.totalBookValue + s.totalBookValue,
    totalAccumDepreciation: acc.totalAccumDepreciation + s.totalAccumDepreciation
  }), { count: 0, totalCost: 0, totalBookValue: 0, totalAccumDepreciation: 0 });

  res.json({ success: true, data: { categories: summary, totals } });
}));

module.exports = router;
