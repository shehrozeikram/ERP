const express = require('express');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandParty = require('../models/tajResidencia/LandParty');
const JournalEntry = require('../models/finance/JournalEntry');
const Account = require('../models/finance/Account');
const {
  parseAreaInput,
  normalizeArea,
  toSarsais,
  MARLA_PER_KANAL,
  SARSAIS_PER_KANAL
} = require('../utils/landAreaUnits');

const router = express.Router();

const areaToDecimalKanal = (area) => {
  const a = normalizeArea(area);
  return a.kanal + (a.marla / MARLA_PER_KANAL) + (a.sarsai / SARSAIS_PER_KANAL);
};

const parseLines = (lines = []) => {
  if (!Array.isArray(lines)) return [];
  return lines.map((line) => ({
    khasraEntry: line.khasraEntry || undefined,
    khewatNo: String(line.khewatNo || '').trim(),
    khasraNo: String(line.khasraNo || '').trim(),
    khasraArea: parseAreaInput(line.khasraArea)
  })).filter((line) => line.khasraEntry || line.khasraNo);
};

const mapPurchase = (doc) => {
  const row = doc?.toObject ? doc.toObject() : doc;
  if (Array.isArray(row.installments)) {
    row.installments = row.installments.map((inst) => ({
      ...inst,
      balance: roundMoney(inst.amount - (inst.paidAmount || 0))
    }));
  }
  return row;
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const resolveInstallmentStatus = (installment) => {
  const amount = roundMoney(installment.amount);
  const paid = roundMoney(installment.paidAmount);
  if (paid >= amount && amount > 0) return 'Paid';
  if (paid > 0) return 'Partial';
  if (installment.dueDate && startOfDay(installment.dueDate) < startOfDay(new Date())) return 'Overdue';
  return 'Pending';
};

const syncInstallment = (installment) => {
  installment.paidAmount = roundMoney(installment.paidAmount);
  installment.amount = roundMoney(installment.amount);
  installment.status = resolveInstallmentStatus(installment);
  if (installment.status === 'Paid' && !installment.paymentDate) {
    installment.paymentDate = new Date();
  }
  return installment;
};

const sumInstallmentPaid = (installments = []) =>
  installments.reduce((sum, inst) => sum + roundMoney(inst.paidAmount), 0);

const sumInstallmentAmount = (installments = []) =>
  installments.reduce((sum, inst) => sum + roundMoney(inst.amount), 0);

const syncPurchasePaymentBalances = (purchase) => {
  (purchase.installments || []).forEach(syncInstallment);
  const tokenAmount = roundMoney(purchase.tokenAmount);
  const installmentPaid = sumInstallmentPaid(purchase.installments);
  purchase.balanceAmount = Math.max(
    0,
    roundMoney((purchase.agreedAmount || 0) - tokenAmount - installmentPaid)
  );
};

const getRemainingInstallmentCapacity = (purchase, excludeInstallmentId = null) => {
  const agreed = roundMoney(purchase.agreedAmount);
  const token = roundMoney(purchase.tokenAmount);
  const scheduled = (purchase.installments || [])
    .filter((inst) => String(inst._id) !== String(excludeInstallmentId))
    .reduce((sum, inst) => sum + roundMoney(inst.amount), 0);
  return Math.max(0, roundMoney(agreed - token - scheduled));
};

async function nextPurchaseNumbers() {
  const purchases = await LandPurchase.find({ isActive: true })
    .select('purchaseNo dealNo')
    .lean();

  let maxDeal = 0;
  let maxLp = 0;
  for (const row of purchases) {
    const deal = Number(row.dealNo);
    // Ignore deals > 100000 in case an anomaly was entered manually
    if (!Number.isNaN(deal) && deal < 100000 && deal > maxDeal) {
      maxDeal = deal;
    }
    const match = String(row.purchaseNo || '').match(/LP-(\d+)/i);
    if (match) {
      const n = Number(match[1]);
      if (!Number.isNaN(n) && n > maxLp) maxLp = n;
    }
  }

  return {
    dealNo: maxDeal + 1,
    purchaseNo: `LP-${String(maxLp + 1).padStart(3, '0')}`
  };
}

const buildDealPayload = (body) => {
  const totalArea = parseAreaInput(body.totalArea);
  const ratePerKanal = Math.max(0, Number(body.ratePerKanal) || 0);
  const totalSizeInKanal = areaToDecimalKanal(totalArea);
  const agreedAmount = Math.round(totalSizeInKanal * ratePerKanal * 100) / 100;

  return {
    purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
    project: String(body.project || 'Taj Residencia').trim() || 'Taj Residencia',
    seller: body.seller || undefined,
    purchaser: body.purchaser || undefined,
    dealer: body.dealer || undefined,
    moza: body.moza || undefined,
    lines: parseLines(body.lines),
    totalArea,
    totalSizeInKanal: Math.round(totalSizeInKanal * 10000) / 10000,
    ratePerKanal,
    ratePerKanalInWords: String(body.ratePerKanalInWords || '').trim(),
    agreedAmount,
    agreedAmountInWords: String(body.agreedAmountInWords || '').trim(),
    govtLandValue: Math.max(0, Number(body.govtLandValue) || 0),
    govtLandValueInWords: String(body.govtLandValueInWords || '').trim()
  };
};

const buildPaymentPayload = (body, purchase) => {
  const agreedAmount = roundMoney(purchase?.agreedAmount || 0);
  const tokenAmount = Math.max(0, Number(body.tokenAmount) || 0);
  const payload = {
    tokenAmount,
    tokenAmountInWords: String(body.tokenAmountInWords || '').trim(),
    paymentMode: String(body.paymentMode || '').trim(),
    paymentRemarks: String(body.paymentRemarks || '').trim(),
    bankAccountId: body.bankAccountId || undefined,
    whtRate: Number(body.whtRate) || 0,
    drawnOn: String(body.drawnOn || '').trim(),
    refNo: String(body.refNo || '').trim(),
    narration: String(body.narration || '').trim(),
    tokenPaymentDate: body.tokenPaymentDate ? new Date(body.tokenPaymentDate) : undefined
  };
  if (purchase) {
    purchase.tokenAmount = payload.tokenAmount;
    purchase.paymentMode = payload.paymentMode;
    purchase.paymentRemarks = payload.paymentRemarks;
    purchase.bankAccountId = payload.bankAccountId;
    purchase.whtRate = payload.whtRate;
    purchase.drawnOn = payload.drawnOn;
    purchase.refNo = payload.refNo;
    purchase.narration = payload.narration;
    purchase.tokenPaymentDate = payload.tokenPaymentDate;
    syncPurchasePaymentBalances(purchase);
    payload.balanceAmount = purchase.balanceAmount;
  } else {
    payload.balanceAmount = Math.max(0, roundMoney(agreedAmount - tokenAmount));
  }
  return payload;
};

const buildPurchasePayload = (body) => ({
  ...buildDealPayload(body),
  ...buildPaymentPayload(body, buildDealPayload(body).agreedAmount)
});

const validatePurchasePayload = async (payload, { isCreate = false } = {}) => {
  if (!payload.purchaseDate || Number.isNaN(payload.purchaseDate.getTime())) {
    const err = new Error('Purchase date is required');
    err.status = 400;
    throw err;
  }
  if (!payload.seller) {
    const err = new Error('Seller is required');
    err.status = 400;
    throw err;
  }
  if (!payload.moza) {
    const err = new Error('Moza is required');
    err.status = 400;
    throw err;
  }
  if (!payload.lines.length) {
    const err = new Error('At least one khasra is required');
    err.status = 400;
    throw err;
  }
  if (!toSarsais(payload.totalArea)) {
    const err = new Error('Total land size is required');
    err.status = 400;
    throw err;
  }

  const moza = await LandMoza.findOne({ _id: payload.moza, isActive: true });
  if (!moza) {
    const err = new Error('Moza not found');
    err.status = 404;
    throw err;
  }

  const seller = await LandParty.findOne({ _id: payload.seller, partyType: 'seller', isActive: true });
  if (!seller) {
    const err = new Error('Seller not found');
    err.status = 404;
    throw err;
  }

  if (payload.purchaser) {
    const purchaser = await LandParty.findOne({ _id: payload.purchaser, partyType: 'buyer', isActive: true });
    if (!purchaser) {
      const err = new Error('Purchaser not found');
      err.status = 404;
      throw err;
    }
  }

  if (payload.dealer) {
    const dealer = await LandParty.findOne({ _id: payload.dealer, partyType: 'dealer', isActive: true });
    if (!dealer) {
      const err = new Error('Dealer not found');
      err.status = 404;
      throw err;
    }
  }
};

async function createPaymentVoucher(purchase, amount, bankAccountId, narration, whtRate, req) {
  if (!amount || !bankAccountId) return null;
  
  try {
    const bankAcc = await Account.findById(bankAccountId);
    if (!bankAcc) return null;
    
    let debitAcc = await Account.findOne({ name: /Land Acquisition/i, isActive: true });
    if (!debitAcc) debitAcc = await Account.findOne({ type: 'Asset', isActive: true });
    if (!debitAcc) return null;
    
    const lines = [
      { account: debitAcc._id, debit: amount, credit: 0, description: 'Land Purchase Payment' },
      { account: bankAccountId, debit: 0, credit: amount, description: 'Bank Payment' }
    ];

    const entry = new JournalEntry({
      companyId: bankAcc.companyId,
      date: new Date(),
      referenceType: 'payment',
      reference: `LP-${purchase.purchaseNo}`,
      referenceId: purchase._id,
      department: 'general',
      module: 'general',
      description: narration || `Payment for ${purchase.purchaseNo}`,
      lines,
      status: 'draft',
      createdBy: req.user?._id || req.user?.id
    });
    
    await entry.save();
    return entry._id;
  } catch (error) {
    console.error('Error creating voucher for Land Purchase payment:', error);
    return null;
  }
}

async function createBulkPaymentVoucher(purchase, payments, globalNarration, req, debitAccountId) {
  if (!payments || !payments.length) return null;
  
  try {
    let debitAcc = null;
    if (debitAccountId) {
      debitAcc = await Account.findById(debitAccountId);
    }
    
    if (!debitAcc) {
      debitAcc = await Account.findOne({ name: /Land Acquisition/i, isActive: true });
      if (!debitAcc) debitAcc = await Account.findOne({ type: 'Asset', isActive: true });
    }
    
    if (!debitAcc) return null;

    let companyId = null;
    let totalAmount = 0;
    const lines = [];

    for (const p of payments) {
      if (!p.amount || !p.bankAccountId) continue;
      const bankAcc = await Account.findById(p.bankAccountId);
      if (!bankAcc) continue;
      if (!companyId) companyId = bankAcc.companyId;

      totalAmount += p.amount;
      lines.push({
        account: p.bankAccountId,
        debit: 0,
        credit: p.amount,
        description: p.narration || `Bank Payment for Installment`
      });
    }

    if (totalAmount === 0 || lines.length === 0) return null;

    lines.unshift({
      account: debitAcc._id,
      debit: totalAmount,
      credit: 0,
      description: 'Bulk Land Purchase Payment'
    });

    const entry = new JournalEntry({
      companyId: companyId,
      date: new Date(),
      referenceType: 'payment',
      reference: `LP-${purchase.purchaseNo}`,
      referenceId: purchase._id,
      department: 'general',
      module: 'general',
      description: globalNarration || `Bulk Payment for ${purchase.purchaseNo}`,
      lines,
      status: 'draft',
      createdBy: req.user?._id || req.user?.id
    });
    
    await entry.save();
    return entry._id;
  } catch (error) {
    console.error('Error creating bulk voucher for Land Purchase payment:', error);
    return null;
  }
}

// GET /purchases/deals — lightweight list of all deals for dropdowns
router.get('/purchases/deals', asyncHandler(async (req, res) => {
  const deals = await LandPurchase.find({ isActive: true })
    .select('dealNo purchaseNo moza')
    .populate('moza', 'name')
    .sort({ dealNo: 1 })
    .lean();

  res.json({
    success: true,
    data: deals.map((d) => ({
      _id: d._id,
      dealNo: d.dealNo,
      purchaseNo: d.purchaseNo,
      mozaName: d.moza?.name || ''
    }))
  });
}));

// GET /purchases/next-numbers
router.get('/purchases/next-numbers', asyncHandler(async (req, res) => {
  const data = await nextPurchaseNumbers();
  res.json({ success: true, data });
}));

// GET /purchases
router.get('/purchases', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const moza = String(req.query.moza || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = req.query.limit === 'all' ? 999999 : Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const skip = (page - 1) * limit;

  const filter = { isActive: true };
  if (moza) {
    if (mongoose.Types.ObjectId.isValid(moza)) {
      filter.moza = new mongoose.Types.ObjectId(moza);
    } else {
      filter.moza = moza;
    }
  }

  let purchases = await LandPurchase.find(filter)
    .populate('seller', 'name cnic phoneNumber')
    .populate('purchaser', 'name cnic phoneNumber')
    .populate('dealer', 'name cnic phoneNumber')
    .populate('moza', 'name slug')
    .sort({ dealNo: -1 })
    .lean();

  if (search) {
    const q = search.toLowerCase();
    purchases = purchases.filter((row) =>
      String(row.purchaseNo || '').toLowerCase().includes(q)
      || String(row.dealNo || '').includes(q)
      || String(row.project || '').toLowerCase().includes(q)
      || String(row.seller?.name || '').toLowerCase().includes(q)
      || String(row.seller?.cnic || '').toLowerCase().includes(q)
      || String(row.dealer?.name || '').toLowerCase().includes(q)
      || String(row.moza?.name || '').toLowerCase().includes(q)
    );
  }

  const total = purchases.length;
  const pageRows = purchases.slice(skip, skip + limit);

  res.json({
    success: true,
    data: {
      purchases: pageRows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
    }
  });
}));

// GET /purchases/:id
router.get('/purchases/:id', asyncHandler(async (req, res) => {
  const purchase = await LandPurchase.findOne({ _id: req.params.id, isActive: true })
    .populate('seller', 'name cnic phoneNumber partyDate')
    .populate('purchaser', 'name cnic phoneNumber partyDate')
    .populate('dealer', 'name cnic phoneNumber partyDate')
    .populate('moza', 'name slug')
    .populate('installments.paidBy', 'firstName lastName');

  if (!purchase) {
    return res.status(404).json({ success: false, message: 'Land purchase not found' });
  }

  res.json({ success: true, data: mapPurchase(purchase) });
}));

// GET /purchases/migrate-lakhu (TEMPORARY SCRIPT ROUTE)
router.get('/purchases/migrate-lakhu', async (req, res) => {
  try {
    const LandMoza = require('../models/tajResidencia/LandMoza');
    const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
    const LandTransfer = require('../models/tajResidencia/LandTransfer');

    const lakhuMozas = await LandMoza.find({ name: /Lakhu/i });
    if (lakhuMozas.length <= 1) {
      return res.json({ success: true, message: `Found ${lakhuMozas.length} Lakhu Moza(s). No duplicates to merge.` });
    }
    
    let primaryMoza = null;
    let maxKhasras = -1;
    
    for (const moza of lakhuMozas) {
      const khasraCount = await LandMozaKhasraEntry.countDocuments({ moza: moza._id });
      if (khasraCount > maxKhasras) {
        maxKhasras = khasraCount;
        primaryMoza = moza;
      }
    }
    
    const duplicateIds = lakhuMozas
      .filter(m => m._id.toString() !== primaryMoza._id.toString())
      .map(m => m._id);
      
    const purchaseUpdate = await LandPurchase.updateMany(
      { moza: { $in: duplicateIds } },
      { $set: { moza: primaryMoza._id } }
    );
    
    const transferUpdate = await LandTransfer.updateMany(
      { moza: { $in: duplicateIds } },
      { $set: { moza: primaryMoza._id } }
    );
    
    const entryUpdate = await LandMozaKhasraEntry.updateMany(
      { moza: { $in: duplicateIds } },
      { $set: { moza: primaryMoza._id } }
    );
    
    const deleteRes = await LandMoza.deleteMany({ _id: { $in: duplicateIds } });
    
    res.json({
      success: true,
      message: 'Merge complete!',
      primaryMoza: primaryMoza._id,
      duplicatesRemoved: deleteRes.deletedCount,
      purchasesMigrated: purchaseUpdate.modifiedCount,
      transfersMigrated: transferUpdate.modifiedCount,
      khasrasMigrated: entryUpdate.modifiedCount
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// POST /purchases
router.post('/purchases', asyncHandler(async (req, res) => {
  const payload = buildDealPayload(req.body);
  await validatePurchasePayload(payload, { isCreate: true });

  const numbers = await nextPurchaseNumbers();
  const purchase = await LandPurchase.create({
    ...payload,
    purchaseNo: numbers.purchaseNo,
    dealNo: numbers.dealNo,
    createdBy: req.user?._id || req.user?.id
  });

  const populated = await LandPurchase.findById(purchase._id)
    .populate('seller', 'name cnic phoneNumber')
    .populate('purchaser', 'name cnic phoneNumber')
    .populate('dealer', 'name cnic phoneNumber')
    .populate('moza', 'name slug').populate('installments.paidBy', 'firstName lastName');

  res.status(201).json({ success: true, message: 'Land purchase created', data: mapPurchase(populated) });
}));

// PUT /purchases/:id
router.put('/purchases/:id', asyncHandler(async (req, res) => {
  const existing = await LandPurchase.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land purchase not found' });
  }

  const payload = buildDealPayload(req.body);
  await validatePurchasePayload(payload);

  Object.assign(existing, payload);
  syncPurchasePaymentBalances(existing);
  existing.updatedBy = req.user?._id || req.user?.id;
  await existing.save();

  const populated = await LandPurchase.findById(existing._id)
    .populate('seller', 'name cnic phoneNumber')
    .populate('purchaser', 'name cnic phoneNumber')
    .populate('dealer', 'name cnic phoneNumber')
    .populate('moza', 'name slug').populate('installments.paidBy', 'firstName lastName');

  res.json({ success: true, message: 'Land purchase updated', data: mapPurchase(populated) });
}));

// PATCH /purchases/:id/payment
router.patch('/purchases/:id/payment', asyncHandler(async (req, res) => {
  const existing = await LandPurchase.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land purchase not found' });
  }

  const payment = buildPaymentPayload(req.body, existing);
  Object.assign(existing, payment);
  existing.updatedBy = req.user?._id || req.user?.id;

  if (existing.bankAccountId && existing.tokenAmount > 0 && !existing.tokenVoucherEntryId) {
    const voucherId = await createPaymentVoucher(
      existing, 
      existing.tokenAmount, 
      existing.bankAccountId, 
      existing.narration, 
      existing.whtRate, 
      req
    );
    if (voucherId) existing.tokenVoucherEntryId = voucherId;
  }

  await existing.save();

  const populated = await LandPurchase.findById(existing._id)
    .populate('seller', 'name cnic phoneNumber')
    .populate('purchaser', 'name cnic phoneNumber')
    .populate('dealer', 'name cnic phoneNumber')
    .populate('moza', 'name slug').populate('installments.paidBy', 'firstName lastName');

  res.json({ success: true, message: 'Payment information updated', data: mapPurchase(populated) });
}));

// POST /purchases/:id/installments
router.post('/purchases/:id/installments', asyncHandler(async (req, res) => {
  const existing = await LandPurchase.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land purchase not found' });
  }

  const description = String(req.body.description || '').trim();
  const amount = roundMoney(req.body.amount);
  const dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;

  if (!description) {
    return res.status(400).json({ success: false, message: 'Installment description is required' });
  }
  if (!amount) {
    return res.status(400).json({ success: false, message: 'Installment amount is required' });
  }
  if (!dueDate || Number.isNaN(dueDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Due date is required' });
  }

  const capacity = getRemainingInstallmentCapacity(existing);
  if (amount > capacity) {
    return res.status(400).json({
      success: false,
      message: `Installment amount exceeds remaining schedulable balance (${capacity.toFixed(2)})`
    });
  }

  existing.installments.push({
    description,
    amount,
    paidAmount: 0,
    dueDate,
    status: 'Pending'
  });
  syncPurchasePaymentBalances(existing);
  existing.updatedBy = req.user?._id || req.user?.id;
  await existing.save();

  const populated = await LandPurchase.findById(existing._id)
    .populate('seller', 'name cnic phoneNumber')
    .populate('purchaser', 'name cnic phoneNumber')
    .populate('dealer', 'name cnic phoneNumber')
    .populate('moza', 'name slug').populate('installments.paidBy', 'firstName lastName');

  res.status(201).json({ success: true, message: 'Installment added', data: mapPurchase(populated) });
}));

// PUT /purchases/:id/installments/:installmentId
router.put('/purchases/:id/installments/:installmentId', asyncHandler(async (req, res) => {
  const existing = await LandPurchase.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land purchase not found' });
  }

  const installment = existing.installments.id(req.params.installmentId);
  if (!installment) {
    return res.status(404).json({ success: false, message: 'Installment not found' });
  }
  if (roundMoney(installment.paidAmount) > 0) {
    return res.status(400).json({ success: false, message: 'Paid installments cannot be edited' });
  }

  const description = String(req.body.description || '').trim();
  const amount = roundMoney(req.body.amount);
  const dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;

  if (!description) {
    return res.status(400).json({ success: false, message: 'Installment description is required' });
  }
  if (!amount) {
    return res.status(400).json({ success: false, message: 'Installment amount is required' });
  }
  if (!dueDate || Number.isNaN(dueDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Due date is required' });
  }

  const capacity = getRemainingInstallmentCapacity(existing, installment._id);
  if (amount > capacity) {
    return res.status(400).json({
      success: false,
      message: `Installment amount exceeds remaining schedulable balance (${capacity.toFixed(2)})`
    });
  }

  installment.description = description;
  installment.amount = amount;
  installment.dueDate = dueDate;
  syncInstallment(installment);
  syncPurchasePaymentBalances(existing);
  existing.updatedBy = req.user?._id || req.user?.id;
  await existing.save();

  const populated = await LandPurchase.findById(existing._id)
    .populate('seller', 'name cnic phoneNumber')
    .populate('purchaser', 'name cnic phoneNumber')
    .populate('dealer', 'name cnic phoneNumber')
    .populate('moza', 'name slug').populate('installments.paidBy', 'firstName lastName');

  res.json({ success: true, message: 'Installment updated', data: mapPurchase(populated) });
}));

// PATCH /purchases/:id/installments/:installmentId/pay
router.patch('/purchases/:id/installments/:installmentId/pay', asyncHandler(async (req, res) => {
  const existing = await LandPurchase.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land purchase not found' });
  }

  const installment = existing.installments.id(req.params.installmentId);
  if (!installment) {
    return res.status(404).json({ success: false, message: 'Installment not found' });
  }
  if (installment.status === 'Paid') {
    return res.status(400).json({ success: false, message: 'Installment is already fully paid' });
  }

  const remaining = Math.max(0, roundMoney(installment.amount - installment.paidAmount));
  const payAmount = req.body.payFull
    ? remaining
    : roundMoney(req.body.amount);

  if (!payAmount) {
    return res.status(400).json({ success: false, message: 'Payment amount is required' });
  }
  if (payAmount > remaining) {
    return res.status(400).json({
      success: false,
      message: `Payment cannot exceed installment balance (${remaining.toFixed(2)})`
    });
  }

  installment.paidAmount = roundMoney(installment.paidAmount + payAmount);
  installment.paymentMode = String(req.body.paymentMode || installment.paymentMode || '').trim();
  installment.paymentRemarks = String(req.body.paymentRemarks || installment.paymentRemarks || '').trim();
  installment.bankAccountId = req.body.bankAccountId || undefined;
  installment.whtRate = Number(req.body.whtRate) || 0;
  installment.drawnOn = req.body.drawnOn || '';
  installment.refNo = req.body.refNo || '';
  installment.narration = req.body.narration || '';
  if (req.body.paymentDate) installment.paymentDate = new Date(req.body.paymentDate);
  installment.paidBy = req.user?._id || req.user?.id;

  if (installment.bankAccountId && payAmount > 0 && !installment.voucherEntryId) {
    const voucherId = await createPaymentVoucher(
      existing,
      payAmount,
      installment.bankAccountId,
      installment.narration || `Installment: ${installment.description}`,
      installment.whtRate,
      req
    );
    if (voucherId) installment.voucherEntryId = voucherId;
  }

  syncInstallment(installment);
  syncPurchasePaymentBalances(existing);
  existing.updatedBy = req.user?._id || req.user?.id;
  await existing.save();

  const populated = await LandPurchase.findById(existing._id)
    .populate('seller', 'name cnic phoneNumber')
    .populate('purchaser', 'name cnic phoneNumber')
    .populate('dealer', 'name cnic phoneNumber')
    .populate('moza', 'name slug').populate('installments.paidBy', 'firstName lastName');

  res.json({ success: true, message: 'Installment payment recorded', data: mapPurchase(populated) });
}));

// POST /purchases/:id/installments/pay-bulk
router.post('/purchases/:id/installments/pay-bulk', asyncHandler(async (req, res) => {
  const existing = await LandPurchase.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land purchase not found' });
  }

  const payments = req.body.payments || [];
  if (!payments.length) {
    return res.status(400).json({ success: false, message: 'No payments provided' });
  }

  const debitAccountId = req.body.debitAccountId || null;

  const validPayments = [];
  
  // 1. Validate all payments
  for (const p of payments) {
    const installment = existing.installments.id(p.installmentId);
    if (!installment) {
      return res.status(404).json({ success: false, message: `Installment ${p.installmentId} not found` });
    }
    if (installment.status === 'Paid') {
      return res.status(400).json({ success: false, message: `Installment ${installment.description} is already fully paid` });
    }

    const remaining = Math.max(0, roundMoney(installment.amount - installment.paidAmount));
    const payAmount = p.payFull ? remaining : roundMoney(p.amount);

    if (!payAmount) {
      return res.status(400).json({ success: false, message: `Payment amount is required for ${installment.description}` });
    }
    if (payAmount > remaining) {
      return res.status(400).json({
        success: false,
        message: `Payment cannot exceed installment balance (${remaining.toFixed(2)}) for ${installment.description}`
      });
    }

    validPayments.push({
      installment,
      payAmount,
      bankAccountId: p.bankAccountId,
      paymentMode: String(p.paymentMode || installment.paymentMode || '').trim(),
      paymentRemarks: String(p.paymentRemarks || installment.paymentRemarks || '').trim(),
      whtRate: Number(p.whtRate) || 0,
      drawnOn: p.drawnOn || '',
      refNo: p.refNo || '',
      narration: p.narration || '',
      paymentDate: p.paymentDate ? new Date(p.paymentDate) : new Date()
    });
  }

  // 2. Create Consolidated BPV if applicable
  const bulkVoucherPayload = validPayments.map(vp => ({
    amount: vp.payAmount,
    bankAccountId: vp.bankAccountId,
    narration: vp.narration || `Installment: ${vp.installment.description}`
  })).filter(vp => vp.bankAccountId && vp.amount > 0);

  let sharedVoucherId = null;
  if (bulkVoucherPayload.length > 0) {
    sharedVoucherId = await createBulkPaymentVoucher(
      existing,
      bulkVoucherPayload,
      `Bulk Payment for ${existing.purchaseNo}`,
      req,
      debitAccountId
    );
  }

  // 3. Apply payments
  for (const vp of validPayments) {
    vp.installment.paidAmount = roundMoney(vp.installment.paidAmount + vp.payAmount);
    vp.installment.paymentMode = vp.paymentMode;
    vp.installment.paymentRemarks = vp.paymentRemarks;
    vp.installment.bankAccountId = vp.bankAccountId;
    vp.installment.whtRate = vp.whtRate;
    vp.installment.drawnOn = vp.drawnOn;
    vp.installment.refNo = vp.refNo;
    vp.installment.narration = vp.narration;
    vp.installment.paymentDate = vp.paymentDate;
    vp.installment.paidBy = req.user?._id || req.user?.id;
    
    if (sharedVoucherId && vp.bankAccountId && vp.payAmount > 0) {
      vp.installment.voucherEntryId = sharedVoucherId;
    }

    syncInstallment(vp.installment);
  }

  syncPurchasePaymentBalances(existing);
  existing.updatedBy = req.user?._id || req.user?.id;
  await existing.save();

  const populated = await LandPurchase.findById(existing._id)
    .populate('seller', 'name cnic phoneNumber')
    .populate('purchaser', 'name cnic phoneNumber')
    .populate('dealer', 'name cnic phoneNumber')
    .populate('moza', 'name slug').populate('installments.paidBy', 'firstName lastName');

  res.json({ success: true, message: 'Bulk installment payments recorded', data: mapPurchase(populated) });
}));

// DELETE /purchases/:id/installments/:installmentId
router.delete('/purchases/:id/installments/:installmentId', asyncHandler(async (req, res) => {
  const existing = await LandPurchase.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land purchase not found' });
  }

  const installment = existing.installments.id(req.params.installmentId);
  if (!installment) {
    return res.status(404).json({ success: false, message: 'Installment not found' });
  }
  if (roundMoney(installment.paidAmount) > 0) {
    return res.status(400).json({ success: false, message: 'Paid installments cannot be deleted' });
  }

  installment.deleteOne();
  syncPurchasePaymentBalances(existing);
  existing.updatedBy = req.user?._id || req.user?.id;
  await existing.save();

  const populated = await LandPurchase.findById(existing._id)
    .populate('seller', 'name cnic phoneNumber')
    .populate('purchaser', 'name cnic phoneNumber')
    .populate('dealer', 'name cnic phoneNumber')
    .populate('moza', 'name slug').populate('installments.paidBy', 'firstName lastName');

  res.json({ success: true, message: 'Installment deleted', data: mapPurchase(populated) });
}));

// DELETE /purchases/:id
router.delete('/purchases/:id', asyncHandler(async (req, res) => {
  const existing = await LandPurchase.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Land purchase not found' });
  }

  existing.isActive = false;
  existing.updatedBy = req.user?._id || req.user?.id;
  await existing.save();

  // Cascade delete linked transfers
  await LandTransfer.updateMany(
    { landPurchase: existing._id, isActive: true },
    { $set: { isActive: false, updatedBy: req.user?._id || req.user?.id } }
  );

  res.json({ success: true, message: 'Land purchase and linked transfers deleted' });
}));

module.exports = router;
