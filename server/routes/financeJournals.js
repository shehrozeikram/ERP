const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const FinanceJournal = require('../models/finance/FinanceJournal');
const JournalEntry = require('../models/finance/JournalEntry');
const Account = require('../models/finance/Account');
const Department = require('../models/hr/Department');
const PlacementCompany = require('../models/hr/Company');

const upload = multer({ storage: multer.memoryStorage() });
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

// ─── IMPORT from Excel ───────────────────────────────────────────────────────
router.post('/import',
  authorize('super_admin', 'admin', 'finance_manager'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const companyId = req.body.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID is required' });
    }

    const company = await PlacementCompany.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // Fetch system journals
    let bankJournal = await FinanceJournal.findOne({ code: 'BANK' });
    let genlJournal = await FinanceJournal.findOne({ code: 'GENL' });
    if (!bankJournal || !genlJournal) {
      return res.status(400).json({ success: false, message: 'System journals (BANK, GENL) missing. Please seed them first.' });
    }

    // Determine default department
    let departmentId = req.body.departmentId;
    if (!departmentId) {
      const defaultDept = await Department.findOne({ name: /Finance/i }) || await Department.findOne();
      if (!defaultDept) {
        return res.status(400).json({ success: false, message: 'No department found in the system. Please create one first.' });
      }
      departmentId = defaultDept._id;
    }

    // Parse Excel
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);

    // Helper: Excel serial to Date
    const excelSerialToDate = (serial) => {
      if (!serial) return new Date();
      if (typeof serial === 'string') return new Date(serial); // If it's already a string date
      const utc_days = Math.floor(serial - 25569);
      const utc_value = utc_days * 86400;
      return new Date(utc_value * 1000);
    };

    // Group by Voucher No
    const groupedData = {};
    for (const row of data) {
      const voucherNo = row['Voucher No'];
      if (!voucherNo) continue;
      if (!groupedData[voucherNo]) groupedData[voucherNo] = [];
      groupedData[voucherNo].push(row);
    }

    let successCount = 0;
    let errorCount = 0;
    let errors = [];

    // Process each voucher
    for (const [voucherNo, rows] of Object.entries(groupedData)) {
      try {
        const existing = await JournalEntry.findOne({ entryNumber: voucherNo, companyId });
        if (existing) {
          throw new Error('Voucher already exists');
        }

        const firstRow = rows[0];
        const date = excelSerialToDate(firstRow['Date']);
        const description = firstRow['Description'] || `Imported voucher ${voucherNo}`;
        
        let journal = genlJournal._id;
        const vUpper = voucherNo.toUpperCase();
        if (vUpper.includes('BRV') || vUpper.includes('BPV') || vUpper.includes('BR') || vUpper.includes('BP')) {
          journal = bankJournal._id;
        }

        const lines = [];
        let totalDebit = 0;
        let totalCredit = 0;

        for (const row of rows) {
          const accountCode = String(row['Account Code'] || '').trim();
          let account = null;
          
          // Look for account in company or globally
          if (accountCode && accountCode !== 'undefined' && accountCode !== 'null') {
            account = await Account.findOne({ accountNumber: accountCode, companyId });
            if (!account) account = await Account.findOne({ accountNumber: accountCode });
          }
          
          if (!account) {
            const title = String(row['Account Title (per chart of accounts)'] || '').trim();
            if (title) {
              account = await Account.findOne({ name: title, companyId });
              if (!account) account = await Account.findOne({ name: title });
            }
          }

          if (!account) {
             throw new Error(`Account not found for code ${accountCode}`);
          }

          const debit = parseFloat(row['Debit']) || 0;
          const credit = parseFloat(row['Credit']) || 0;
          
          if (debit === 0 && credit === 0) {
             throw new Error(`Lines must have either debit or credit`);
          }

          totalDebit += debit;
          totalCredit += credit;

          lines.push({
            account: account._id,
            description: row['Description'] || '',
            debit,
            credit,
            department: departmentId
          });
        }

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
           throw new Error(`Unbalanced entry: Debits ${totalDebit}, Credits ${totalCredit}`);
        }

        const je = new JournalEntry({
          companyId,
          entryNumber: voucherNo,
          voucherSeries: voucherNo.replace(/[0-9-]/g, ''),
          journal,
          date,
          reference: 'Excel Import',
          description,
          department: departmentId,
          lines,
          status: 'posted', // Instantly visible in bank rec
          postedBy: req.user._id,
          postedDate: new Date(),
          createdBy: req.user._id,
          isAutoGenerated: false
        });

        await je.save();
        
        // Update account balances
        for (let line of je.lines) {
           await Account.findByIdAndUpdate(line.account, {
             $inc: { balance: line.debit - line.credit }
           });
        }
        
        successCount++;
      } catch (err) {
        errorCount++;
        errors.push(`${voucherNo}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: `Import complete. Success: ${successCount}. Failed: ${errorCount}.`,
      successCount,
      errorCount,
      errors
    });
  })
);

module.exports = router;
