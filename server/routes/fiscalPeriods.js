const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const FiscalPeriod = require('../models/finance/FiscalPeriod');
const JournalEntry = require('../models/finance/JournalEntry');
const Account = require('../models/finance/Account');
const FinanceHelper = require('../utils/financeHelper');

const router = express.Router();

// ─── GET all fiscal periods ──────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { year, status } = req.query;
  const query = {};
  if (year) query.year = parseInt(year);
  if (status) query.status = status;

  const periods = await FiscalPeriod.find(query)
    .populate('closedBy', 'firstName lastName')
    .populate('lockedBy', 'firstName lastName')
    .sort({ year: -1, month: -1 });

  res.json({ success: true, data: periods });
}));

// ─── GET single period ───────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const period = await FiscalPeriod.findById(req.params.id)
    .populate('closedBy', 'firstName lastName')
    .populate('lockedBy', 'firstName lastName');
  if (!period) return res.status(404).json({ success: false, message: 'Fiscal period not found' });
  res.json({ success: true, data: period });
}));

// ─── GENERATE periods for a year ────────────────────────────────────────────
router.post('/generate',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { year } = req.body;
    if (!year || isNaN(year)) {
      return res.status(400).json({ success: false, message: 'Valid year is required' });
    }
    const created = await FiscalPeriod.generateYear(parseInt(year), req.user._id);
    res.status(201).json({
      success: true,
      message: `Generated ${created.length} new fiscal periods for ${year}`,
      data: created
    });
  })
);

// ─── CLOSE a period ──────────────────────────────────────────────────────────
router.put('/:id/close',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const period = await FiscalPeriod.findById(req.params.id);
    if (!period) return res.status(404).json({ success: false, message: 'Fiscal period not found' });
    if (period.status !== 'open') {
      return res.status(400).json({ success: false, message: `Period is already ${period.status}` });
    }
    period.status = 'closed';
    period.closedBy = req.user._id;
    period.closedAt = new Date();
    if (req.body.notes) period.notes = req.body.notes;
    await period.save();
    res.json({ success: true, data: period, message: `Period "${period.name}" closed successfully` });
  })
);

// ─── REOPEN a closed period ──────────────────────────────────────────────────
router.put('/:id/reopen',
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const period = await FiscalPeriod.findById(req.params.id);
    if (!period) return res.status(404).json({ success: false, message: 'Fiscal period not found' });
    if (period.status === 'locked') {
      return res.status(400).json({ success: false, message: 'Locked periods cannot be reopened' });
    }
    period.status = 'open';
    period.closedBy = undefined;
    period.closedAt = undefined;
    await period.save();
    res.json({ success: true, data: period, message: `Period "${period.name}" reopened` });
  })
);

// ─── LOCK a period (irreversible by normal users) ────────────────────────────
router.put('/:id/lock',
  authorize('super_admin'),
  asyncHandler(async (req, res) => {
    const period = await FiscalPeriod.findById(req.params.id);
    if (!period) return res.status(404).json({ success: false, message: 'Fiscal period not found' });
    if (period.status === 'open') {
      return res.status(400).json({ success: false, message: 'Close the period before locking it' });
    }
    period.status = 'locked';
    period.lockedBy = req.user._id;
    period.lockedAt = new Date();
    await period.save();
    res.json({ success: true, data: period, message: `Period "${period.name}" locked permanently` });
  })
);

// ─── Summary: JE count and total amounts for a period ───────────────────────
router.get('/:id/summary', asyncHandler(async (req, res) => {
  const period = await FiscalPeriod.findById(req.params.id);
  if (!period) return res.status(404).json({ success: false, message: 'Fiscal period not found' });

  const entries = await JournalEntry.find({
    date: { $gte: period.startDate, $lte: period.endDate },
    status: 'posted'
  }).select('totalDebits totalCredits referenceType');

  const summary = {
    period: period.name,
    status: period.status,
    journalEntryCount: entries.length,
    totalDebits: entries.reduce((s, e) => s + e.totalDebits, 0),
    totalCredits: entries.reduce((s, e) => s + e.totalCredits, 0),
    byReferenceType: {}
  };
  for (const e of entries) {
    const rt = e.referenceType || 'manual';
    summary.byReferenceType[rt] = (summary.byReferenceType[rt] || 0) + 1;
  }

  res.json({ success: true, data: summary });
}));

module.exports = router;
