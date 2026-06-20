const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const PlacementCompany = require('../models/hr/Company');
const CompanyBank = require('../models/finance/CompanyBank');
const Account = require('../models/finance/Account');
const { deriveCompanyCode, ensureCompanyCodes } = require('../utils/financeCompanyContext');
const { seedChartOfAccountsForCompany } = require('../utils/companyChartOfAccounts');

const router = express.Router();

const FINANCE_ROLES = ['super_admin', 'admin', 'finance_manager'];

const sanitizeBankPayload = (body = {}) => ({
  bankName: String(body.bankName || '').trim(),
  accountTitle: String(body.accountTitle || '').trim() || undefined,
  accountNumber: String(body.accountNumber || '').trim(),
  branch: String(body.branch || '').trim() || undefined,
  iban: String(body.iban || '').trim() || undefined,
  isPrimary: body.isPrimary === true || body.isPrimary === 'true',
  isActive: body.isActive !== false && body.isActive !== 'false',
  notes: String(body.notes || '').trim() || undefined
});

const clearOtherPrimaryBanks = async (companyId, exceptId = null) => {
  const filter = { company: companyId, isPrimary: true };
  if (exceptId) filter._id = { $ne: exceptId };
  await CompanyBank.updateMany(filter, { $set: { isPrimary: false } });
};

// GET /api/finance/companies
router.get('/',
  authorize(...FINANCE_ROLES),
  asyncHandler(async (req, res) => {
    const { search, status = 'active' } = req.query;
    const query = {};
    const normalizedStatus = String(status || 'active').toLowerCase();
    if (normalizedStatus === 'active') query.isActive = true;
    else if (normalizedStatus === 'inactive') query.isActive = false;
    if (search) query.name = { $regex: String(search).trim(), $options: 'i' };

    const companies = await PlacementCompany.find(query).sort({ name: 1 }).lean();
    const companyIds = companies.map((c) => c._id);
    const [bankCounts, accountCounts] = await Promise.all([
      CompanyBank.aggregate([
        { $match: { company: { $in: companyIds }, isActive: true } },
        { $group: { _id: '$company', count: { $sum: 1 } } }
      ]),
      Account.aggregate([
        { $match: { companyId: { $in: companyIds }, isActive: true } },
        { $group: { _id: '$companyId', count: { $sum: 1 } } }
      ])
    ]);
    const bankCountMap = new Map(bankCounts.map((row) => [String(row._id), row.count]));
    const accountCountMap = new Map(accountCounts.map((row) => [String(row._id), row.count]));

    res.json({
      success: true,
      data: companies.map((company) => ({
        ...company,
        bankCount: bankCountMap.get(String(company._id)) || 0,
        accountCount: accountCountMap.get(String(company._id)) || 0
      }))
    });
  })
);

// POST /api/finance/companies/sync-codes
router.post('/sync-codes',
  authorize(...FINANCE_ROLES),
  asyncHandler(async (_req, res) => {
    const updated = await ensureCompanyCodes();
    res.json({
      success: true,
      message: `${updated} company code(s) assigned`,
      data: { updated }
    });
  })
);

// POST /api/finance/companies/:companyId/seed-chart-of-accounts
router.post('/:companyId/seed-chart-of-accounts',
  authorize(...FINANCE_ROLES),
  asyncHandler(async (req, res) => {
    const company = await PlacementCompany.findById(req.params.companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const result = await seedChartOfAccountsForCompany(company._id, {
      createdBy: req.user._id || req.user.id,
      skipExisting: true
    });

    res.json({
      success: true,
      message: `Chart of accounts seeded for ${company.name}: ${result.created} created, ${result.existing} already existed`,
      data: { company, ...result }
    });
  })
);

// PUT /api/finance/companies/:companyId/code
router.put('/:companyId/code', [
  authorize(...FINANCE_ROLES),
  body('companyCode').trim().notEmpty().withMessage('Company code is required')
],
asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const company = await PlacementCompany.findById(req.params.companyId);
  if (!company) {
    return res.status(404).json({ success: false, message: 'Company not found' });
  }

  const companyCode = String(req.body.companyCode || deriveCompanyCode(company.name)).trim().toUpperCase();
  const duplicate = await PlacementCompany.findOne({
    companyCode,
    _id: { $ne: company._id }
  }).select('_id name').lean();
  if (duplicate) {
    return res.status(400).json({
      success: false,
      message: `Company code ${companyCode} is already used by ${duplicate.name}`
    });
  }

  company.companyCode = companyCode;
  await company.save();

  res.json({
    success: true,
    message: 'Company code updated',
    data: company
  });
}));

// GET /api/finance/companies/:companyId/banks
router.get('/:companyId/banks',
  authorize(...FINANCE_ROLES),
  asyncHandler(async (req, res) => {
    const company = await PlacementCompany.findById(req.params.companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const banks = await CompanyBank.find({ company: company._id })
      .sort({ isPrimary: -1, bankName: 1, accountNumber: 1 });

    res.json({
      success: true,
      data: {
        company,
        banks
      }
    });
  })
);

// POST /api/finance/companies/:companyId/banks
router.post('/:companyId/banks', [
  authorize(...FINANCE_ROLES),
  body('bankName').trim().notEmpty().withMessage('Bank name is required'),
  body('accountNumber').trim().notEmpty().withMessage('Account number is required')
],
asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const company = await PlacementCompany.findById(req.params.companyId);
  if (!company) {
    return res.status(404).json({ success: false, message: 'Company not found' });
  }

  const payload = sanitizeBankPayload(req.body);
  const bank = new CompanyBank({ ...payload, company: company._id });

  if (payload.isPrimary) {
    await clearOtherPrimaryBanks(company._id);
  }

  await bank.save();

  res.status(201).json({
    success: true,
    message: 'Bank account added',
    data: bank
  });
}));

// PUT /api/finance/companies/:companyId/banks/:bankId
router.put('/:companyId/banks/:bankId', [
  authorize(...FINANCE_ROLES),
  body('bankName').optional().trim().notEmpty().withMessage('Bank name cannot be empty'),
  body('accountNumber').optional().trim().notEmpty().withMessage('Account number cannot be empty')
],
asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const bank = await CompanyBank.findOne({
    _id: req.params.bankId,
    company: req.params.companyId
  });

  if (!bank) {
    return res.status(404).json({ success: false, message: 'Bank account not found' });
  }

  const payload = sanitizeBankPayload({ ...bank.toObject(), ...req.body });
  Object.assign(bank, payload);

  if (payload.isPrimary) {
    await clearOtherPrimaryBanks(bank.company, bank._id);
  }

  await bank.save();

  res.json({
    success: true,
    message: 'Bank account updated',
    data: bank
  });
}));

// DELETE /api/finance/companies/:companyId/banks/:bankId
router.delete('/:companyId/banks/:bankId',
  authorize(...FINANCE_ROLES),
  asyncHandler(async (req, res) => {
    const bank = await CompanyBank.findOneAndDelete({
      _id: req.params.bankId,
      company: req.params.companyId
    });

    if (!bank) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    res.json({
      success: true,
      message: 'Bank account removed'
    });
  })
);

module.exports = router;
