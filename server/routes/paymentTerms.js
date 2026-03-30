const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');
const { authorize } = require('../middleware/auth');
const PaymentTerm = require('../models/finance/PaymentTerm');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

// GET /api/finance/payment-terms
router.get('/', asyncHandler(async (req, res) => {
  const terms = await PaymentTerm.find({ isActive: true }).sort({ name: 1 });
  res.json({ success: true, data: terms, count: terms.length });
}));

// GET /api/finance/payment-terms/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const term = await PaymentTerm.findById(req.params.id);
  if (!term) return res.status(404).json({ success: false, message: 'Payment term not found' });
  res.json({ success: true, data: term });
}));

// POST /api/finance/payment-terms
router.post('/', authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('code').trim().notEmpty().withMessage('Code is required'),
    body('lines').optional().isArray()
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, code, note, lines } = req.body;
    const term = await PaymentTerm.create({ name, code, note, lines: lines || [{ type: 'balance', daysAfterInvoice: 0 }], createdBy: req.user.id });
    res.status(201).json({ success: true, data: term });
  })
);

// PUT /api/finance/payment-terms/:id
router.put('/:id', authorize('super_admin', 'admin', 'finance_manager'), asyncHandler(async (req, res) => {
  const term = await PaymentTerm.findById(req.params.id);
  if (!term) return res.status(404).json({ success: false, message: 'Payment term not found' });

  ['name', 'code', 'note', 'lines', 'isActive'].forEach(f => { if (req.body[f] !== undefined) term[f] = req.body[f]; });
  await term.save();
  res.json({ success: true, data: term });
}));

// DELETE /api/finance/payment-terms/:id
router.delete('/:id', authorize('super_admin', 'admin'), asyncHandler(async (req, res) => {
  const term = await PaymentTerm.findByIdAndDelete(req.params.id);
  if (!term) return res.status(404).json({ success: false, message: 'Payment term not found' });
  res.json({ success: true, message: 'Deleted' });
}));

// POST /api/finance/payment-terms/compute — compute due dates from invoice
router.post('/compute', asyncHandler(async (req, res) => {
  const { termId, invoiceDate, invoiceTotal } = req.body;
  const term = await PaymentTerm.findById(termId);
  if (!term) return res.status(404).json({ success: false, message: 'Payment term not found' });
  const schedule = term.computeDueDates(invoiceDate, invoiceTotal);
  res.json({ success: true, data: schedule });
}));

// POST /api/finance/payment-terms/seed — seed common payment terms
router.post('/seed', authorize('super_admin', 'admin'), asyncHandler(async (req, res) => {
  const defaults = [
    { name: 'Immediate', code: 'IMM', note: 'Payment due immediately', lines: [{ type: 'balance', daysAfterInvoice: 0, description: 'Full payment immediately' }] },
    { name: 'Net 15', code: 'NET15', note: 'Payment due in 15 days', lines: [{ type: 'balance', daysAfterInvoice: 15, description: 'Full payment in 15 days' }] },
    { name: 'Net 30', code: 'NET30', note: 'Payment due in 30 days', lines: [{ type: 'balance', daysAfterInvoice: 30, description: 'Full payment in 30 days' }] },
    { name: 'Net 45', code: 'NET45', note: 'Payment due in 45 days', lines: [{ type: 'balance', daysAfterInvoice: 45, description: 'Full payment in 45 days' }] },
    { name: 'Net 60', code: 'NET60', note: 'Payment due in 60 days', lines: [{ type: 'balance', daysAfterInvoice: 60, description: 'Full payment in 60 days' }] },
    {
      name: '50/50 (30/60)', code: '5050', note: '50% in 30 days, 50% in 60 days',
      lines: [
        { type: 'percent', value: 50, daysAfterInvoice: 30, description: '50% in 30 days' },
        { type: 'balance', daysAfterInvoice: 60, description: '50% in 60 days' }
      ]
    }
  ];

  const results = [];
  for (const t of defaults) {
    const existing = await PaymentTerm.findOne({ code: t.code });
    if (!existing) {
      const created = await PaymentTerm.create({ ...t, createdBy: req.user.id });
      results.push({ action: 'created', code: t.code, id: created._id });
    } else {
      results.push({ action: 'skipped', code: t.code });
    }
  }
  res.json({ success: true, data: results });
}));

module.exports = router;
