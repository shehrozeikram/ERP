const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');
const { authorize } = require('../middleware/auth');
const FixedAsset = require('../models/finance/FixedAsset');
const FinanceHelper = require('../utils/financeHelper');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

// GET /api/finance/fixed-assets
router.get('/', asyncHandler(async (req, res) => {
  const { status, category } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;

  const assets = await FixedAsset.find(filter)
    .populate('assetAccount', 'name accountNumber')
    .populate('accumulatedDeprecAccount', 'name accountNumber')
    .populate('depreciationExpenseAccount', 'name accountNumber')
    .populate('costCenter', 'name code')
    .sort({ assetNumber: 1 });

  res.json({ success: true, data: assets, count: assets.length });
}));

// GET /api/finance/fixed-assets/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const asset = await FixedAsset.findById(req.params.id)
    .populate('assetAccount', 'name accountNumber')
    .populate('accumulatedDeprecAccount', 'name accountNumber')
    .populate('depreciationExpenseAccount', 'name accountNumber')
    .populate('costCenter', 'name code')
    .populate('depreciationSchedule.journalEntry', 'entryNumber date');
  if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
  res.json({ success: true, data: asset });
}));

// POST /api/finance/fixed-assets
router.post('/', authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('name').trim().notEmpty().withMessage('Asset name is required'),
    body('purchaseDate').isISO8601().withMessage('Purchase date is required'),
    body('purchaseCost').isFloat({ min: 0 }).withMessage('Purchase cost must be >= 0')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const asset = await FixedAsset.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json({ success: true, data: asset });
  })
);

// PUT /api/finance/fixed-assets/:id
router.put('/:id', authorize('super_admin', 'admin', 'finance_manager'), asyncHandler(async (req, res) => {
  const asset = await FixedAsset.findById(req.params.id);
  if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });

  const allowed = ['name', 'description', 'category', 'residualValue', 'depreciationMethod',
    'usefulLifeYears', 'depreciationRate', 'assetAccount', 'accumulatedDeprecAccount',
    'depreciationExpenseAccount', 'location', 'assignedTo', 'costCenter', 'serialNumber'];
  allowed.forEach(f => { if (req.body[f] !== undefined) asset[f] = req.body[f]; });
  asset.updatedBy = req.user.id;
  await asset.save();

  res.json({ success: true, data: asset });
}));

// POST /api/finance/fixed-assets/:id/depreciate — run monthly depreciation for asset
router.post('/:id/depreciate', authorize('super_admin', 'admin', 'finance_manager'), asyncHandler(async (req, res) => {
  const asset = await FixedAsset.findById(req.params.id);
  if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
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
      journalEntry = await FinanceHelper.createAndPostJournalEntry({
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
      });
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
  const asset = await FixedAsset.findById(req.params.id);
  if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });

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
  const summary = await FixedAsset.aggregate([
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
