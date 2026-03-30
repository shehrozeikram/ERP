const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');
const { authorize } = require('../middleware/auth');
const Tax = require('../models/finance/Tax');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

const taxValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('code').trim().notEmpty().withMessage('Code is required'),
  body('taxType').isIn(['gst', 'wht', 'income_tax', 'custom_duty', 'other']).withMessage('Invalid tax type'),
  body('rate').isFloat({ min: 0, max: 100 }).withMessage('Rate must be 0–100')
];

// GET /api/finance/taxes
router.get('/', asyncHandler(async (req, res) => {
  const { scope, taxType, active } = req.query;
  const filter = {};
  if (scope) filter.scope = { $in: [scope, 'both'] };
  if (taxType) filter.taxType = taxType;
  if (active !== undefined) filter.isActive = active === 'true';

  const taxes = await Tax.find(filter)
    .populate('taxPayableAccount', 'name accountNumber')
    .populate('taxReceivableAccount', 'name accountNumber')
    .populate('whtPayableAccount', 'name accountNumber')
    .sort({ code: 1 });

  res.json({ success: true, data: taxes, count: taxes.length });
}));

// GET /api/finance/taxes/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const tax = await Tax.findById(req.params.id)
    .populate('taxPayableAccount', 'name accountNumber')
    .populate('taxReceivableAccount', 'name accountNumber')
    .populate('whtPayableAccount', 'name accountNumber');
  if (!tax) return res.status(404).json({ success: false, message: 'Tax not found' });
  res.json({ success: true, data: tax });
}));

// POST /api/finance/taxes
router.post('/', authorize('super_admin', 'admin', 'finance_manager'), taxValidation, validate, asyncHandler(async (req, res) => {
  const {
    name, code, taxType, scope, rate, computeMethod, priceIncludesTax,
    taxPayableAccount, taxReceivableAccount, whtPayableAccount, description, isDefault
  } = req.body;

  const tax = await Tax.create({
    name, code, taxType, scope, rate, computeMethod, priceIncludesTax,
    taxPayableAccount, taxReceivableAccount, whtPayableAccount,
    description, isDefault,
    createdBy: req.user.id
  });

  res.status(201).json({ success: true, data: tax });
}));

// PUT /api/finance/taxes/:id
router.put('/:id', authorize('super_admin', 'admin', 'finance_manager'), asyncHandler(async (req, res) => {
  const tax = await Tax.findById(req.params.id);
  if (!tax) return res.status(404).json({ success: false, message: 'Tax not found' });

  const fields = ['name', 'code', 'taxType', 'scope', 'rate', 'computeMethod', 'priceIncludesTax',
    'taxPayableAccount', 'taxReceivableAccount', 'whtPayableAccount', 'description', 'isActive', 'isDefault'];
  fields.forEach(f => { if (req.body[f] !== undefined) tax[f] = req.body[f]; });
  tax.updatedBy = req.user.id;
  await tax.save();

  res.json({ success: true, data: tax });
}));

// DELETE /api/finance/taxes/:id
router.delete('/:id', authorize('super_admin', 'admin'), asyncHandler(async (req, res) => {
  const tax = await Tax.findByIdAndDelete(req.params.id);
  if (!tax) return res.status(404).json({ success: false, message: 'Tax not found' });
  res.json({ success: true, message: 'Tax deleted' });
}));

// POST /api/finance/taxes/calculate — calculate tax for a given amount
router.post('/calculate', asyncHandler(async (req, res) => {
  const { taxId, amount } = req.body;
  const tax = await Tax.findById(taxId);
  if (!tax) return res.status(404).json({ success: false, message: 'Tax not found' });
  const result = tax.calculate(amount);
  res.json({ success: true, data: { ...result, taxName: tax.name, taxCode: tax.code, rate: tax.rate } });
}));

// POST /api/finance/taxes/seed — seed default Pakistan taxes
router.post('/seed', authorize('super_admin', 'admin'), asyncHandler(async (req, res) => {
  const defaults = [
    { name: 'GST 17%', code: 'GST17', taxType: 'gst', scope: 'both', rate: 17, computeMethod: 'percentage', description: 'Standard GST 17% Pakistan' },
    { name: 'GST 18%', code: 'GST18', taxType: 'gst', scope: 'both', rate: 18, computeMethod: 'percentage', description: 'GST 18% (SRB – Sindh)' },
    { name: 'WHT 5%', code: 'WHT5', taxType: 'wht', scope: 'purchase', rate: 5, computeMethod: 'percentage', description: 'Withholding Tax 5% on services' },
    { name: 'WHT 10%', code: 'WHT10', taxType: 'wht', scope: 'purchase', rate: 10, computeMethod: 'percentage', description: 'Withholding Tax 10% on imports' },
    { name: 'Income Tax 1%', code: 'IT1', taxType: 'income_tax', scope: 'purchase', rate: 1, computeMethod: 'percentage', description: 'Advance Income Tax 1%' },
    { name: 'Custom Duty', code: 'DUTY', taxType: 'custom_duty', scope: 'purchase', rate: 0, computeMethod: 'percentage', description: 'Custom Duty (rate varies)' }
  ];

  const results = [];
  for (const t of defaults) {
    const existing = await Tax.findOne({ code: t.code });
    if (!existing) {
      const created = await Tax.create({ ...t, createdBy: req.user.id });
      results.push({ action: 'created', code: t.code, id: created._id });
    } else {
      results.push({ action: 'skipped', code: t.code });
    }
  }

  res.json({ success: true, data: results });
}));

module.exports = router;
