const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const FinanceJournal = require('../models/finance/FinanceJournal');
const JournalEntry = require('../models/finance/JournalEntry');

const router = express.Router();

// ─── GET all journals ────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { type, isActive = 'true', search } = req.query;
  const query = {};
  if (type) query.type = type;
  if (isActive !== 'all') query.isActive = isActive === 'true';
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { code: { $regex: search, $options: 'i' } }
  ];

  const journals = await FinanceJournal.find(query)
    .populate('defaultAccount', 'accountNumber name')
    .populate('createdBy', 'firstName lastName')
    .sort({ code: 1 });

  res.json({ success: true, data: journals });
}));

// ─── GET single journal ──────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const journal = await FinanceJournal.findById(req.params.id)
    .populate('defaultAccount', 'accountNumber name')
    .populate('createdBy', 'firstName lastName');
  if (!journal) return res.status(404).json({ success: false, message: 'Journal not found' });
  res.json({ success: true, data: journal });
}));

// ─── CREATE journal ──────────────────────────────────────────────────────────
router.post('/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { name, code, type, description, defaultAccount } = req.body;
    const journal = await FinanceJournal.create({
      name, code, type, description, defaultAccount: defaultAccount || undefined,
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, data: journal, message: 'Journal created successfully' });
  })
);

// ─── UPDATE journal ──────────────────────────────────────────────────────────
router.put('/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const journal = await FinanceJournal.findById(req.params.id);
    if (!journal) return res.status(404).json({ success: false, message: 'Journal not found' });
    if (journal.isSystem && req.body.code && req.body.code !== journal.code) {
      return res.status(400).json({ success: false, message: 'Cannot change the code of a system journal' });
    }
    const { name, description, defaultAccount, isActive } = req.body;
    if (name !== undefined) journal.name = name;
    if (description !== undefined) journal.description = description;
    if (defaultAccount !== undefined) journal.defaultAccount = defaultAccount || undefined;
    if (isActive !== undefined) journal.isActive = isActive;
    await journal.save();
    res.json({ success: true, data: journal, message: 'Journal updated successfully' });
  })
);

// ─── DELETE journal ──────────────────────────────────────────────────────────
router.delete('/:id',
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const journal = await FinanceJournal.findById(req.params.id);
    if (!journal) return res.status(404).json({ success: false, message: 'Journal not found' });
    if (journal.isSystem) {
      return res.status(400).json({ success: false, message: 'System journals cannot be deleted' });
    }
    const usedCount = await JournalEntry.countDocuments({ journal: journal._id });
    if (usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: journal has ${usedCount} journal entries. Deactivate it instead.`
      });
    }
    await journal.deleteOne();
    res.json({ success: true, message: 'Journal deleted successfully' });
  })
);

// ─── SEED system journals (idempotent) ───────────────────────────────────────
router.post('/seed/system',
  authorize('super_admin'),
  asyncHandler(async (req, res) => {
    const systemJournals = [
      { code: 'PURCH', name: 'Purchase Journal',    type: 'purchase',    description: 'All vendor bills and AP transactions' },
      { code: 'SALE',  name: 'Sales Journal',       type: 'sale',        description: 'All customer invoices and AR transactions' },
      { code: 'BANK',  name: 'Bank Journal',        type: 'bank',        description: 'Bank payments and receipts' },
      { code: 'CASH',  name: 'Cash Journal',        type: 'cash',        description: 'Cash payments and receipts' },
      { code: 'INV',   name: 'Inventory Journal',   type: 'inventory',   description: 'GRN, SIN and stock adjustments' },
      { code: 'PAY',   name: 'Payroll Journal',     type: 'payroll',     description: 'Salary accruals and payments' },
      { code: 'DEPR',  name: 'Depreciation Journal',type: 'depreciation',description: 'Fixed asset depreciation entries' },
      { code: 'GENL',  name: 'General Journal',     type: 'general',     description: 'Manual adjustments and corrections' }
    ];

    const results = [];
    for (const j of systemJournals) {
      const existing = await FinanceJournal.findOne({ code: j.code });
      if (!existing) {
        const created = await FinanceJournal.create({
          ...j,
          isSystem: true,
          createdBy: req.user._id
        });
        results.push({ action: 'created', code: j.code, name: j.name });
      } else {
        results.push({ action: 'exists', code: j.code, name: j.name });
      }
    }
    res.json({ success: true, message: 'System journals seeded', results });
  })
);

module.exports = router;
