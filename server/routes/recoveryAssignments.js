const express = require('express');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const multer = require('multer');
const axios = require('axios');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const RecoveryAssignment = require('../models/finance/RecoveryAssignment');
const RecoveryTaskAssignmentRule = require('../models/finance/RecoveryTaskAssignmentRule');
const RecoveryMember = require('../models/finance/RecoveryMember');
const RecoveryTask = require('../models/finance/RecoveryTask');
const Employee = require('../models/hr/Employee');
const WhatsAppIncomingMessage = require('../models/finance/WhatsAppIncomingMessage');
const WhatsAppOutgoingMessage = require('../models/finance/WhatsAppOutgoingMessage');
const ConversationRead = require('../models/finance/ConversationRead');

const router = express.Router();

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

function resolveAssignedMember(record, sectorRules, slabRules) {
  const sector = (record.sector || '').trim();
  const due = Number(record.currentlyDue) || 0;
  const actionFromRule = (rule) => rule.action && ['whatsapp', 'call', 'both'].includes(rule.action) ? rule.action : 'both';

  const sectorRule = sectorRules.find((r) => (r.sector || '').trim() === sector);
  if (sectorRule && sectorRule.assignedTo) {
    const emp = sectorRule.assignedTo.employee;
    const name = emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() || emp.employeeId : '';
    const createdBy = sectorRule.createdBy
      ? {
          _id: sectorRule.createdBy._id,
          name: [sectorRule.createdBy.firstName, sectorRule.createdBy.lastName].filter(Boolean).join(' ').trim() || sectorRule.createdBy.email
        }
      : null;
    return { _id: sectorRule.assignedTo._id, name: name || '—', action: actionFromRule(sectorRule), assignedBy: createdBy };
  }

  const slabRule = slabRules.find((r) => {
    const min = Number(r.minAmount) || 0;
    const max = r.maxAmount != null && r.maxAmount !== '' ? Number(r.maxAmount) : null;
    const sectorMatch = !(r.sector && r.sector.trim()) || (r.sector || '').trim() === sector;
    const inRange = due >= min && (max === null || due < max);
    return sectorMatch && inRange;
  });
  if (slabRule && slabRule.assignedTo) {
    const emp = slabRule.assignedTo.employee;
    const name = emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() || emp.employeeId : '';
    const createdBy = slabRule.createdBy
      ? {
          _id: slabRule.createdBy._id,
          name: [slabRule.createdBy.firstName, slabRule.createdBy.lastName].filter(Boolean).join(' ').trim() || slabRule.createdBy.email
        }
      : null;
    return { _id: slabRule.assignedTo._id, name: name || '—', action: actionFromRule(slabRule), assignedBy: createdBy };
  }

  return null;
}

const EXCEL_TO_DB_FIELD_MAP = {
  'Order Code': 'orderCode',
  'Customer Name': 'customerName',
  'Booking Date': 'bookingDate',
  'Sector': 'sector',
  'Size': 'size',
  'CNIC': 'cnic',
  'MobileNumber': 'mobileNumber',
  'Mobile Number': 'mobileNumber',
  'CustomerAddress': 'customerAddress',
  'Customer Address': 'customerAddress',
  'Len': 'length',
  'Length': 'length',
  'Plot No.': 'plotNo',
  'Status': 'status',
  'Sale Price': 'salePrice',
  'Received': 'received',
  'Currently Due': 'currentlyDue'
};

const parseDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + val * 86400000);
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const parseNumber = (val) => {
  if (val === '' || val === null || val === undefined) return 0;
  const cleaned = String(val).replace(/,/g, '').trim();
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
};

const mapExcelRowToDoc = (row) => {
  const doc = {};
  Object.entries(EXCEL_TO_DB_FIELD_MAP).forEach(([excelKey, dbKey]) => {
    const val = row[excelKey];
    if (val === undefined) return;
    if (doc[dbKey] !== undefined) return; // already set by another alias
    if (dbKey === 'bookingDate') doc[dbKey] = parseDate(val);
    else if (['salePrice', 'received', 'currentlyDue'].includes(dbKey)) doc[dbKey] = parseNumber(val);
    else doc[dbKey] = val != null ? String(val).trim() : '';
  });
  return doc;
};

const LATEST_RECOVERY_PATH = path.join(__dirname, '../scripts/latest-recovery.xlsx');

const recoveryImportDir = path.join(__dirname, '../uploads/recovery-import');
const whatsappMediaDir = path.join(__dirname, '../uploads/whatsapp-media');
if (!fs.existsSync(whatsappMediaDir)) fs.mkdirSync(whatsappMediaDir, { recursive: true });
const whatsappMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, whatsappMediaDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.bin';
    cb(null, `wa_${Date.now()}_${Math.random().toString(36).slice(2, 9)}${ext}`);
  }
});
const whatsappMediaUpload = multer({
  storage: whatsappMediaStorage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const ok = mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('audio/') || mime.startsWith('video/');
    if (ok) cb(null, true);
    else cb(new Error('Only images, PDF, audio, and video are allowed'));
  }
}).single('file');
if (!fs.existsSync(recoveryImportDir)) fs.mkdirSync(recoveryImportDir, { recursive: true });
const recoveryImportUpload = multer({
  dest: recoveryImportDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname || '').toLowerCase();
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) cb(null, true);
    else cb(new Error('Only .xlsx or .xls files are allowed'));
  }
});

// @route   GET /api/finance/recovery-assignments/my-tasks
// @desc    List recovery assignments: super_admin/admin see all; others see only their assigned tasks
//          Supports optional unread messages filter (unread=true) and excludes completed tasks by default.
// @access  Private (same roles as recovery)
router.get(
  '/my-tasks',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search, sector, status, unread } = req.query;
    const unreadOnly = unread === 'true' || unread === '1';
    const hasSearch = search && String(search).trim();
    const maxLimit = hasSearch ? 10000 : 100;
    const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * limitNum;

    // Super admin and admin: only assignments that are assigned to some recovery member (any rule)
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      const allRules = await RecoveryTaskAssignmentRule.find({ isActive: true })
        .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
        .lean();
      const sectorRulesAll = allRules.filter((r) => r.type === 'sector');
      const slabRulesAll = allRules.filter((r) => r.type === 'slab');

      const orConditions = [];
      const allSectors = [...new Set(sectorRulesAll.map((r) => (r.sector || '').trim()).filter(Boolean))];
      if (allSectors.length) orConditions.push({ sector: { $in: allSectors } });
      slabRulesAll.forEach((s) => {
        const min = Number(s.minAmount) || 0;
        const max = s.maxAmount != null && s.maxAmount !== '' ? Number(s.maxAmount) : null;
        const dueCondition = max != null ? { $gte: min, $lt: max } : { $gte: min };
        const sectorVal = (s.sector || '').trim();
        if (sectorVal) {
          orConditions.push({ sector: sectorVal, currentlyDue: dueCondition });
        } else {
          orConditions.push({ currentlyDue: dueCondition });
        }
      });

      if (orConditions.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { page: parseInt(page, 10) || 1, limit: limitNum, total: 0 }
        });
      }

      const query = { $or: orConditions, taskStatus: { $ne: 'completed' } };
      if (search && search.trim()) {
        const searchRegex = { $regex: search.trim(), $options: 'i' };
        query.$and = (query.$and || []).concat([
          { $or: [
            { orderCode: searchRegex },
            { customerName: searchRegex },
            { cnic: searchRegex },
            { plotNo: searchRegex },
            { customerAddress: searchRegex },
            { mobileNumber: searchRegex }
          ] }
        ]);
      }
      if (sector && sector.trim()) query.sector = new RegExp(sector.trim(), 'i');
      if (status && status.trim()) query.status = new RegExp(status.trim(), 'i');

      let records;
      let total;

      if (unreadOnly) {
        // Build set of phone numbers that have unread incoming WhatsApp messages for this user
        const userId = req.user?._id;
        const rawNumbers = await WhatsAppIncomingMessage.distinct('from');
        const normalizedNumbers = [...new Set(rawNumbers.map(normalizePhoneForLookup).filter(Boolean))];

        if (normalizedNumbers.length === 0) {
          return res.json({
            success: true,
            data: [],
            pagination: { page: parseInt(page, 10) || 1, limit: limitNum, total: 0 }
          });
        }

        const readDocs = await ConversationRead.find({ userId, phone: { $in: normalizedNumbers } }).lean();
        const readMap = Object.fromEntries(readDocs.map((r) => [r.phone, r.readAt]));

        const unreadSet = new Set();
        for (const phone of normalizedNumbers) {
          const readAt = readMap[phone] ? new Date(readMap[phone]) : null;
          const count = await WhatsAppIncomingMessage.countDocuments({
            from: { $in: [phone, '0' + phone.slice(2), phone.replace(/^92/, '')] },
            receivedAt: readAt ? { $gt: readAt } : { $exists: true }
          });
          if (count > 0) unreadSet.add(phone);
        }

        if (unreadSet.size === 0) {
          return res.json({
            success: true,
            data: [],
            pagination: { page: parseInt(page, 10) || 1, limit: limitNum, total: 0 }
          });
        }

        const allAssignments = await RecoveryAssignment.find(query)
          .sort({ sortOrder: 1, orderCode: 1 })
          .lean();

        const filtered = allAssignments.filter((r) =>
          unreadSet.has(normalizePhoneForLookup(r.mobileNumber))
        );

        total = filtered.length;
        records = filtered.slice(skip, skip + limitNum);
      } else {
        [records, total] = await Promise.all([
          RecoveryAssignment.find(query).sort({ sortOrder: 1, orderCode: 1 }).skip(skip).limit(limitNum).lean(),
          RecoveryAssignment.countDocuments(query)
        ]);
      }

      const data = records.map((r) => ({
        ...r,
        assignedToMember: resolveAssignedMember(r, sectorRulesAll, slabRulesAll)
      }));

      return res.json({
        success: true,
        data,
        pagination: { page: parseInt(page, 10) || 1, limit: limitNum, total }
      });
    }

    const employee = await Employee.findOne({ employeeId: req.user.employeeId }).lean();
    if (!employee) {
      return res.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 50)), total: 0 },
        notRecoveryMember: true
      });
    }

    const recoveryMember = await RecoveryMember.findOne({ employee: employee._id, isActive: true }).lean();
    if (!recoveryMember) {
      return res.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 50)), total: 0 },
        notRecoveryMember: true
      });
    }

    const rules = await RecoveryTaskAssignmentRule.find({ isActive: true, assignedTo: recoveryMember._id })
      .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
      .lean();
    const sectorRulesAll = await RecoveryTaskAssignmentRule.find({ isActive: true, type: 'sector' })
      .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
      .lean();
    const slabRulesAll = await RecoveryTaskAssignmentRule.find({ isActive: true, type: 'slab' })
      .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
      .lean();

    const mySectors = rules.filter((r) => r.type === 'sector').map((r) => (r.sector || '').trim()).filter(Boolean);
    const mySlabs = rules.filter((r) => r.type === 'slab');

    const orConditions = [];
    if (mySectors.length) orConditions.push({ sector: { $in: mySectors } });
    mySlabs.forEach((s) => {
      const min = Number(s.minAmount) || 0;
      const max = s.maxAmount != null && s.maxAmount !== '' ? Number(s.maxAmount) : null;
      const dueCondition = max != null ? { $gte: min, $lt: max } : { $gte: min };
      const sectorVal = (s.sector || '').trim();
      if (sectorVal) {
        orConditions.push({ sector: sectorVal, currentlyDue: dueCondition });
      } else {
        orConditions.push({ currentlyDue: dueCondition });
      }
    });

    if (orConditions.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { page: parseInt(page, 10) || 1, limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 50)), total: 0 }
      });
    }

    const query = { $or: orConditions, taskStatus: { $ne: 'completed' } };
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$and = (query.$and || []).concat([
        { $or: [
          { orderCode: searchRegex },
          { customerName: searchRegex },
          { cnic: searchRegex },
          { plotNo: searchRegex },
          { customerAddress: searchRegex },
          { mobileNumber: searchRegex }
        ] }
      ]);
    }
    if (sector && sector.trim()) query.sector = new RegExp(sector.trim(), 'i');
    if (status && status.trim()) query.status = new RegExp(status.trim(), 'i');

    let records;
    let total;

    if (unreadOnly) {
      // Build set of phone numbers that have unread incoming WhatsApp messages for this user
      const userId = req.user?._id;
      const rawNumbers = await WhatsAppIncomingMessage.distinct('from');
      const normalizedNumbers = [...new Set(rawNumbers.map(normalizePhoneForLookup).filter(Boolean))];

      if (normalizedNumbers.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { page: parseInt(page, 10) || 1, limit: limitNum, total: 0 }
        });
      }

      const readDocs = await ConversationRead.find({ userId, phone: { $in: normalizedNumbers } }).lean();
      const readMap = Object.fromEntries(readDocs.map((r) => [r.phone, r.readAt]));

      const unreadSet = new Set();
      for (const phone of normalizedNumbers) {
        const readAt = readMap[phone] ? new Date(readMap[phone]) : null;
        const count = await WhatsAppIncomingMessage.countDocuments({
          from: { $in: [phone, '0' + phone.slice(2), phone.replace(/^92/, '')] },
          receivedAt: readAt ? { $gt: readAt } : { $exists: true }
        });
        if (count > 0) unreadSet.add(phone);
      }

      if (unreadSet.size === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { page: parseInt(page, 10) || 1, limit: limitNum, total: 0 }
        });
      }

      const allAssignments = await RecoveryAssignment.find(query)
        .sort({ sortOrder: 1, orderCode: 1 })
        .lean();

      const filtered = allAssignments.filter((r) =>
        unreadSet.has(normalizePhoneForLookup(r.mobileNumber))
      );

      total = filtered.length;
      records = filtered.slice(skip, skip + limitNum);
    } else {
      [records, total] = await Promise.all([
        RecoveryAssignment.find(query).sort({ sortOrder: 1, orderCode: 1 }).skip(skip).limit(limitNum).lean(),
        RecoveryAssignment.countDocuments(query)
      ]);
    }

    const sectorRules = sectorRulesAll;
    const slabRules = slabRulesAll;
    const data = records.map((r) => ({
      ...r,
      assignedToMember: resolveAssignedMember(r, sectorRules, slabRules)
    }));

    res.json({
      success: true,
      data,
      pagination: { page: parseInt(page, 10) || 1, limit: limitNum, total }
    });
  })
);

// @route   GET /api/finance/recovery-assignments
// @desc    List recovery assignments with pagination, search, and optional unread-messages filter
// @access  Private (Finance and Admin)
router.get(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search, sector, status, unread, memberId } = req.query;
    const unreadOnly = unread === 'true' || unread === '1';
    const query = {};

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$and = (query.$and || []).concat([
        {
          $or: [
            { orderCode: searchRegex },
            { customerName: searchRegex },
            { cnic: searchRegex },
            { plotNo: searchRegex },
            { customerAddress: searchRegex },
            { mobileNumber: searchRegex }
          ]
        }
      ]);
    }
    if (sector && sector.trim()) query.sector = new RegExp(sector.trim(), 'i');
    if (status && status.trim()) query.status = new RegExp(status.trim(), 'i');

    // Optional: filter assignments by a specific recovery member's current assignment rules
    if (memberId && String(memberId).trim()) {
      const rules = await RecoveryTaskAssignmentRule.find({
        isActive: true,
        assignedTo: String(memberId).trim()
      }).lean();
      const sectorRules = rules.filter((r) => r.type === 'sector');
      const slabRules = rules.filter((r) => r.type === 'slab');

      const memberOrConditions = [];
      const sectors = [...new Set(sectorRules.map((r) => (r.sector || '').trim()).filter(Boolean))];
      if (sectors.length) memberOrConditions.push({ sector: { $in: sectors } });
      slabRules.forEach((s) => {
        const min = Number(s.minAmount) || 0;
        const max = s.maxAmount != null && s.maxAmount !== '' ? Number(s.maxAmount) : null;
        const dueCondition = max != null ? { $gte: min, $lt: max } : { $gte: min };
        const sectorVal = (s.sector || '').trim();
        if (sectorVal) {
          memberOrConditions.push({ sector: sectorVal, currentlyDue: dueCondition });
        } else {
          memberOrConditions.push({ currentlyDue: dueCondition });
        }
      });

      // If selected member has no active rules, return empty quickly
      if (memberOrConditions.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { page: Math.max(1, parseInt(page, 10) || 1), limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 50)), total: 0 }
        });
      }

      query.$and = (query.$and || []).concat([{ $or: memberOrConditions }]);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const hasSearch = search && String(search).trim();
    const maxLimit = hasSearch ? 10000 : 100;
    const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    let records;
    let total;

    if (unreadOnly) {
      // Build set of phone numbers that have unread incoming WhatsApp messages for this user
      const userId = req.user?._id;
      const rawNumbers = await WhatsAppIncomingMessage.distinct('from');
      const normalizedNumbers = [...new Set(rawNumbers.map(normalizePhoneForLookup).filter(Boolean))];

      if (normalizedNumbers.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { page: pageNum, limit: limitNum, total: 0 }
        });
      }

      const readDocs = await ConversationRead.find({ userId, phone: { $in: normalizedNumbers } }).lean();
      const readMap = Object.fromEntries(readDocs.map((r) => [r.phone, r.readAt]));

      const unreadSet = new Set();
      for (const phone of normalizedNumbers) {
        const readAt = readMap[phone] ? new Date(readMap[phone]) : null;
        const count = await WhatsAppIncomingMessage.countDocuments({
          from: { $in: [phone, '0' + phone.slice(2), phone.replace(/^92/, '')] },
          receivedAt: readAt ? { $gt: readAt } : { $exists: true }
        });
        if (count > 0) unreadSet.add(phone);
      }

      if (unreadSet.size === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { page: pageNum, limit: limitNum, total: 0 }
        });
      }

      // Load all assignments matching filters, then filter by unreadSet using normalized mobile numbers
      const allAssignments = await RecoveryAssignment.find(query)
        .sort({ sortOrder: 1, orderCode: 1 })
        .lean();

      const filtered = allAssignments.filter((r) =>
        unreadSet.has(normalizePhoneForLookup(r.mobileNumber))
      );

      total = filtered.length;
      records = filtered.slice(skip, skip + limitNum);
    } else {
      [records, total] = await Promise.all([
        RecoveryAssignment.find(query).sort({ sortOrder: 1, orderCode: 1 }).skip(skip).limit(limitNum).lean(),
        RecoveryAssignment.countDocuments(query)
      ]);
    }

    const rules = await RecoveryTaskAssignmentRule.find({ isActive: true })
      .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
      .populate('createdBy', 'firstName lastName email')
      .lean();
    const sectorRules = rules.filter((r) => r.type === 'sector');
    const slabRules = rules.filter((r) => r.type === 'slab');

    const data = records.map((r) => ({
      ...r,
      assignedToMember: resolveAssignedMember(r, sectorRules, slabRules)
    }));

    res.json({
      success: true,
      data,
      pagination: { page: pageNum, limit: limitNum, total }
    });
  })
);

const EDITABLE_FIELDS = [
  'orderCode', 'customerName', 'bookingDate', 'sector', 'size', 'cnic', 'mobileNumber',
  'customerAddress', 'length', 'plotNo', 'status', 'salePrice', 'received', 'currentlyDue'
];

// @route   POST /api/finance/recovery-assignments
// @desc    Create a single recovery assignment
// @access  Private (Finance and Admin)
router.post(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const doc = {};
    EDITABLE_FIELDS.forEach((key) => {
      const val = req.body[key];
      if (val === undefined) return;
      if (key === 'bookingDate') doc[key] = parseDate(val);
      else if (['salePrice', 'received', 'currentlyDue'].includes(key)) doc[key] = parseNumber(val);
      else doc[key] = val != null ? String(val).trim() : '';
    });
    if (!doc.orderCode && !doc.customerName) {
      return res.status(400).json({ success: false, message: 'Order Code or Customer Name is required' });
    }
    const maxOrder = await RecoveryAssignment.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    doc.sortOrder = (maxOrder?.sortOrder || 0) + 1;
    const assignment = await RecoveryAssignment.create(doc);
    const rules = await RecoveryTaskAssignmentRule.find({ isActive: true })
      .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
      .lean();
    const sectorRules = rules.filter((r) => r.type === 'sector');
    const slabRules = rules.filter((r) => r.type === 'slab');
    const data = { ...assignment.toObject(), assignedToMember: resolveAssignedMember(assignment, sectorRules, slabRules) };
    res.status(201).json({ success: true, data });
  })
);

// @route   PUT /api/finance/recovery-assignments/:id
// @desc    Update a single recovery assignment (main fields)
// @access  Private (Finance and Admin)
router.put(
  '/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const assignment = await RecoveryAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    EDITABLE_FIELDS.forEach((key) => {
      const val = req.body[key];
      if (val === undefined) return;
      if (key === 'bookingDate') assignment[key] = parseDate(val);
      else if (['salePrice', 'received', 'currentlyDue'].includes(key)) assignment[key] = parseNumber(val);
      else assignment[key] = val != null ? String(val).trim() : '';
    });
    if (!assignment.orderCode && !assignment.customerName) {
      return res.status(400).json({ success: false, message: 'Order Code or Customer Name is required' });
    }
    await assignment.save();
    const rules = await RecoveryTaskAssignmentRule.find({ isActive: true })
      .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
      .lean();
    const sectorRules = rules.filter((r) => r.type === 'sector');
    const slabRules = rules.filter((r) => r.type === 'slab');
    const data = { ...assignment.toObject(), assignedToMember: resolveAssignedMember(assignment, sectorRules, slabRules) };
    res.json({ success: true, data });
  })
);

// @route   POST /api/finance/recovery-assignments/import
// @desc    Import records from Excel (bulk insert)
// @access  Private (Finance and Admin)
router.post(
  '/import',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No records to import'
      });
    }

    const docs = records.map((row) => mapExcelRowToDoc(row)).filter((d) => d.orderCode || d.customerName);
    if (docs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid records to import'
      });
    }

    const BATCH_SIZE = 1000;
    let inserted = 0;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      await RecoveryAssignment.insertMany(batch);
      inserted += batch.length;
    }

    res.json({
      success: true,
      message: `Imported ${inserted} recovery assignments successfully`,
      data: { inserted }
    });
  })
);

// @route   POST /api/finance/recovery-assignments/import-latest
// @desc    Import from server/scripts/latest-recovery.xlsx
// @access  Private (Finance and Admin)
router.post(
  '/import-latest',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    let wb;
    try {
      wb = XLSX.readFile(LATEST_RECOVERY_PATH, { cellDates: true });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'File server/scripts/latest-recovery.xlsx not found or unreadable. Place the file there and try again.'
      });
    }
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
    const docs = rows
      .map((r, idx) => {
        const d = mapExcelRowToDoc(r);
        if (d.orderCode || d.customerName) {
          d.sortOrder = idx + 1;
          return d;
        }
        return null;
      })
      .filter(Boolean);
    if (docs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid records in the file. Check column headers (Order Code, Customer Name, etc.).'
      });
    }
    const BATCH_SIZE = 1000;
    let inserted = 0;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      await RecoveryAssignment.insertMany(batch);
      inserted += batch.length;
    }
    res.json({
      success: true,
      message: `Imported ${inserted} recovery assignments from latest-recovery.xlsx`,
      data: { inserted }
    });
  })
);

// @route   POST /api/finance/recovery-assignments/import-file
// @desc    Import from uploaded Excel file
// @access  Private (Finance and Admin)
router.post(
  '/import-file',
  authorize('super_admin', 'admin', 'finance_manager'),
  recoveryImportUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    let wb;
    try {
      wb = XLSX.readFile(req.file.path, { cellDates: true });
    } catch (err) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ success: false, message: 'Failed to read Excel file' });
    }
    try {
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
      const docs = rows
        .map((r, idx) => {
          const d = mapExcelRowToDoc(r);
          if (d.orderCode || d.customerName) {
            d.sortOrder = idx + 1;
            return d;
          }
          return null;
        })
        .filter(Boolean);
      fs.unlinkSync(req.file.path);
      if (docs.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid records in the file. Use the column headers from the Import Format guide.'
        });
      }
      const BATCH_SIZE = 1000;
      let inserted = 0;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = docs.slice(i, i + BATCH_SIZE);
        await RecoveryAssignment.insertMany(batch);
        inserted += batch.length;
      }
      res.json({
        success: true,
        message: `Imported ${inserted} recovery assignments`,
        data: { inserted }
      });
    } catch (err) {
      try { fs.unlinkSync(req.file.path); } catch {}
      throw err;
    }
  })
);

// @route   GET /api/finance/recovery-assignments/import-format
// @desc    Return column mapping and sample row for Excel import; ?download=1 returns sample .xlsx
// @access  Private (Finance and Admin)
router.get(
  '/import-format',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const format = {
      columns: [
        { excelHeader: 'Order Code', dbField: 'orderCode', type: 'text', sample: 'ORD-001', required: false },
        { excelHeader: 'Customer Name', dbField: 'customerName', type: 'text', sample: 'John Doe', required: false },
        { excelHeader: 'Booking Date', dbField: 'bookingDate', type: 'date', sample: '2024-01-15', required: false },
        { excelHeader: 'Sector', dbField: 'sector', type: 'text', sample: 'A', required: false },
        { excelHeader: 'Size', dbField: 'size', type: 'text', sample: '5 Marla', required: false },
        { excelHeader: 'CNIC', dbField: 'cnic', type: 'text', sample: '35201-1234567-8', required: false },
        { excelHeader: 'Mobile Number', dbField: 'mobileNumber', type: 'text', sample: '03001234567', required: false },
        { excelHeader: 'Customer Address', dbField: 'customerAddress', type: 'text', sample: 'House 123, Block B', required: false },
        { excelHeader: 'Length', dbField: 'length', type: 'text', sample: '100', required: false },
        { excelHeader: 'Plot No.', dbField: 'plotNo', type: 'text', sample: '45', required: false },
        { excelHeader: 'Status', dbField: 'status', type: 'text', sample: 'Active', required: false },
        { excelHeader: 'Sale Price', dbField: 'salePrice', type: 'number', sample: 5000000, required: false },
        { excelHeader: 'Received', dbField: 'received', type: 'number', sample: 1000000, required: false },
        { excelHeader: 'Currently Due', dbField: 'currentlyDue', type: 'number', sample: 4000000, required: false }
      ],
      note: 'At least Order Code or Customer Name is required per row. Alternative headers: MobileNumber, Customer Address, Len, Plot No.'
    };

    if (req.query.download === '1' || req.query.download === 'true') {
      const headers = format.columns.map((c) => c.excelHeader);
      const sampleRow = format.columns.map((c) => c.sample);
      const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Recovery Assignments');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=recovery-assignments-sample.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }
    res.json({ success: true, data: format });
  })
);

function normalizePhoneForLookup(phone) {
  if (!phone) return '';
  let p = String(phone).replace(/\D/g, '').trim();
  if (p.startsWith('0')) p = p.slice(1);
  if (p.length === 10 && p.startsWith('3')) p = '92' + p;
  else if (p.length === 10) p = '92' + p;
  return p || '';
}

// @route   GET /api/finance/recovery-assignments/whatsapp-incoming/numbers-with-messages
// @desc    Return phone numbers that have messages and their unread counts per user
// @access  Private
router.get(
  '/whatsapp-incoming/numbers-with-messages',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const rawNumbers = await WhatsAppIncomingMessage.distinct('from');
    const numbers = [...new Set(rawNumbers.map(normalizePhoneForLookup).filter(Boolean))];
    const unreadCounts = {};
    if (numbers.length === 0) {
      return res.json({ success: true, data: { numbers: [], unreadCounts: {} } });
    }
    const readDocs = await ConversationRead.find({ userId, phone: { $in: numbers } }).lean();
    const readMap = Object.fromEntries(readDocs.map((r) => [r.phone, r.readAt]));
    for (const phone of numbers) {
      const readAt = readMap[phone] ? new Date(readMap[phone]) : null;
      const count = await WhatsAppIncomingMessage.countDocuments({
        from: { $in: [phone, '0' + phone.slice(2), phone.replace(/^92/, '')] },
        receivedAt: readAt ? { $gt: readAt } : { $exists: true }
      });
      if (count > 0) unreadCounts[phone] = count;
    }
    res.json({ success: true, data: { numbers, unreadCounts } });
  })
);

// @route   POST /api/finance/recovery-assignments/whatsapp-incoming/mark-read
// @desc    Mark all incoming messages from a phone as read for the current user
// @access  Private
router.post(
  '/whatsapp-incoming/mark-read',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    let phone = (req.body.phone && String(req.body.phone).replace(/\D/g, '').trim()) || '';
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    if (phone.startsWith('0')) phone = phone.slice(1);
    if (phone.length === 10 && phone.startsWith('3')) phone = '92' + phone;
    else if (phone.length === 10) phone = '92' + phone;

    const userId = req.user._id;
    await ConversationRead.findOneAndUpdate(
      { userId, phone },
      { readAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  })
);

// @route   GET /api/finance/recovery-assignments/whatsapp-incoming?from=923214554035
// @desc    Fetch merged chat thread (incoming + outgoing) for a phone number
// @access  Private
router.get(
  '/whatsapp-incoming',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    let phone = (req.query.from && String(req.query.from).replace(/\D/g, '').trim()) || '';
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number (from) is required' });
    }
    if (phone.startsWith('0')) phone = phone.slice(1);
    if (phone.length === 10 && phone.startsWith('3')) phone = '92' + phone;
    else if (phone.length === 10) phone = '92' + phone;

    const [incoming, outgoing] = await Promise.all([
      WhatsAppIncomingMessage.find({ from: phone }).sort({ receivedAt: 1 }).limit(100).lean(),
      WhatsAppOutgoingMessage.find({ to: phone }).sort({ sentAt: 1 }).limit(100).lean()
    ]);

    const thread = [
      ...incoming.map((m) => ({ ...m, direction: 'in', time: m.receivedAt, text: m.text })),
      ...outgoing.map((m) => ({ ...m, direction: 'out', time: m.sentAt, text: m.text }))
    ].sort((a, b) => new Date(a.time) - new Date(b.time));

    res.json({ success: true, data: thread });
  })
);

function getBaseUrl(req) {
  if (req) {
    const proto = req.get('x-forwarded-proto') || req.protocol || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const host = req.get('x-forwarded-host') || req.get('host');
    if (host) return `${proto}://${host}`.replace(/\/$/, '');
  }
  return (process.env.API_BASE_URL || process.env.APP_URL || `http://localhost:${process.env.PORT || 5001}`).replace(/\/$/, '');
}

function getMediaTypeFromMime(mime) {
  if (!mime) return 'document';
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  return 'document';
}

// @route   POST /api/finance/recovery-assignments/upload-media
// @desc    Upload media for WhatsApp (image, document, audio, video). Returns public URL.
// @access  Private
router.post(
  '/upload-media',
  authorize('super_admin', 'admin', 'finance_manager'),
  (req, res, next) => {
    whatsappMediaUpload(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const baseUrl = getBaseUrl(req).replace(/\/$/, '');
    const url = `${baseUrl}/uploads/whatsapp-media/${req.file.filename}`;
    const mediaType = getMediaTypeFromMime(req.file.mimetype);
    res.json({ success: true, data: { url, mediaType, filename: req.file.filename } });
  })
);

// @route   POST /api/finance/recovery-assignments/send-whatsapp
// @desc    Send WhatsApp via Graph API.
//          If campaignId is provided and that campaign has whatsappTemplateName, use that Meta template dynamically.
//          Otherwise: (1) use explicit template 'taj_discount_on_installments' with header image, (2) body as plain text, (3) else hello_world template.
//          Optionally records campaign info on RecoveryAssignment when assignmentId and campaignName are provided.
// @access  Private
router.post(
  '/send-whatsapp',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { to, body, template, assignmentId, campaignName, campaignId, mediaType, mediaUrl } = req.body;
    let phone = (to && String(to).replace(/\D/g, '')) || '923214554035';
    if (phone.startsWith('0')) phone = phone.slice(1);
    // Add Pakistan country code for 10-digit mobile numbers (e.g. 3xxxxxxxxx)
    if (phone.length === 10 && phone.startsWith('3')) phone = '92' + phone;
    else if (phone.length === 10) phone = '92' + phone;
    const toNumber = phone;
    const token = WHATSAPP_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ success: false, message: 'WhatsApp access token not configured (WHATSAPP_ACCESS_TOKEN)' });
    }
    const url = `https://graph.facebook.com/v24.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const messageBody = body != null ? String(body).trim() : '';

    const sendPayload = (payload) =>
      axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

    const tajDiscountPayload = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'template',
      template: {
        name: 'taj_discount_on_installments',
        language: { code: 'en' },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: {
                  link: 'https://itihaasbuilders.com/images/marketing/image.jpeg'
                }
              }
            ]
          }
        ]
      }
    };

    const helloWorldPayload = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'template',
      template: { name: 'hello_world', language: { code: 'en_US' } }
    };

    const textPayload = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'text',
      text: { body: messageBody }
    };

    try {
      let payload;
      let sentAs = 'template';

      // 1) If a RecoveryCampaign with whatsappTemplateName is provided, use that Meta template dynamically
      if (campaignId) {
        const RecoveryCampaign = require('../models/finance/RecoveryCampaign');
        const campaign = await RecoveryCampaign.findById(campaignId).lean();
        if (campaign && campaign.whatsappTemplateName) {
          const langCode = (campaign.whatsappLanguageCode || '').trim() || 'en';
          const tplName = campaign.whatsappTemplateName;
          const template = { name: tplName, language: { code: langCode } };
          // taj_discount_on_installments has a required header IMAGE
          if (tplName === 'taj_discount_on_installments') {
            template.components = [
              {
                type: 'header',
                parameters: [
                  { type: 'image', image: { link: 'https://itihaasbuilders.com/images/marketing/image.jpeg' } }
                ]
              }
            ];
          }
          payload = {
            messaging_product: 'whatsapp',
            to: toNumber,
            type: 'template',
            template
          };
          sentAs = tplName;
        }
      }

      // 2) Media message (image, document, audio, video)
      if (!payload && mediaType && mediaUrl) {
        const mediaTypeLower = String(mediaType).toLowerCase();
        const link = String(mediaUrl).trim();
        const payloads = {
          image: { messaging_product: 'whatsapp', to: toNumber, type: 'image', image: { link }, ...(messageBody && { caption: messageBody }) },
          document: { messaging_product: 'whatsapp', to: toNumber, type: 'document', document: { link, ...(messageBody && { caption: messageBody }) } },
          audio: { messaging_product: 'whatsapp', to: toNumber, type: 'audio', audio: { link } },
          video: { messaging_product: 'whatsapp', to: toNumber, type: 'video', video: { link }, ...(messageBody && { caption: messageBody }) }
        };
        payload = payloads[mediaTypeLower] || payloads.document;
        sentAs = mediaTypeLower;
      }

      // 3) Fallback to explicit template / text / hello_world
      if (!payload) {
        if (template === 'taj_discount_on_installments') {
          payload = tajDiscountPayload;
          sentAs = 'taj_discount_on_installments';
        } else if (messageBody) {
          payload = textPayload;
          sentAs = 'text';
        } else {
          payload = helloWorldPayload;
        }
      }

      const apiRes = await sendPayload(payload);
      const data = apiRes.data;
      const messageId = data?.messages?.[0]?.id || null;
      console.log('[WhatsApp] Sent to', toNumber, 'messageId:', messageId, 'sentAs:', sentAs);

      if (sentAs === 'text' || ['image', 'document', 'audio', 'video'].includes(sentAs)) {
        const displayText = messageBody || (sentAs === 'text' ? '' : `(${sentAs})`);
        const createPayload = {
          to: toNumber,
          text: displayText,
          messageId,
          sentAt: new Date(),
          sentBy: req.user?._id
        };
        if (mediaUrl && sentAs !== 'text') {
          createPayload.mediaUrl = String(mediaUrl).trim();
          createPayload.mediaType = String(sentAs);
        }
        await WhatsAppOutgoingMessage.create(createPayload);
      }

      // Best-effort: update assignment with campaign meta if provided
      if (assignmentId && campaignName) {
        try {
          await RecoveryAssignment.findByIdAndUpdate(
            assignmentId,
            {
              lastCampaignSentAt: new Date(),
              lastCampaignName: String(campaignName).trim()
            },
            { new: false }
          );
        } catch (e) {
          console.warn('Failed to update assignment campaign info', e.message);
        }
      }

      res.json({ success: true, data, sentAs, messageId });
    } catch (err) {
      const errData = err.response?.data?.error;
      const msg = errData?.message || err.response?.data?.message || err.message;
      const code = errData?.code ? ` (code ${errData.code})` : '';
      console.error('[WhatsApp] Send failed to', toNumber, err.response?.data || err.message);
      res.status(err.response?.status || 500).json({ success: false, message: `${msg || 'WhatsApp API error'}${code}` });
    }
  })
);

// @route   PUT /api/finance/recovery-assignments/:id/feedback
// @desc    Update WhatsApp and/or call feedback (assigned recovery member or admin)
// @access  Private
router.put(
  '/:id/feedback',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const assignment = await RecoveryAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const rules = await RecoveryTaskAssignmentRule.find({ isActive: true })
      .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
      .populate('createdBy', 'firstName lastName email')
      .lean();
    const sectorRules = rules.filter((r) => r.type === 'sector');
    const slabRules = rules.filter((r) => r.type === 'slab');
    const assignedToMember = resolveAssignedMember(assignment, sectorRules, slabRules);

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';
    if (!isAdmin && assignedToMember) {
      const employee = await Employee.findOne({ employeeId: req.user.employeeId }).lean();
      const recoveryMember = employee ? await RecoveryMember.findOne({ employee: employee._id, isActive: true }).lean() : null;
      if (!recoveryMember || assignedToMember._id.toString() !== recoveryMember._id.toString()) {
        return res.status(403).json({ success: false, message: 'You can only update feedback for your assigned tasks' });
      }
    }

    const { whatsappFeedback, callFeedback } = req.body;
    if (whatsappFeedback !== undefined) assignment.whatsappFeedback = String(whatsappFeedback || '').trim();
    if (callFeedback !== undefined) assignment.callFeedback = String(callFeedback || '').trim();
    await assignment.save();

    const updated = assignment.toObject();
    updated.assignedToMember = assignedToMember;
    res.json({ success: true, data: updated });
  })
);

// @route   GET /api/finance/recovery-assignments/stats
// @desc    Get summary stats (counts, sectors, statuses)
// @access  Private (Finance and Admin)
router.get(
  '/stats',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const [total, sectors, statuses] = await Promise.all([
      RecoveryAssignment.countDocuments(),
      RecoveryAssignment.distinct('sector').then((arr) => arr.filter(Boolean).sort()),
      RecoveryAssignment.distinct('status').then((arr) => arr.filter(Boolean).sort())
    ]);

    res.json({
      success: true,
      data: { total, sectors, statuses }
    });
  })
);

// @route   GET /api/finance/recovery-assignments/completed-tasks
// @desc    List completed recovery assignments for the current user (admin sees all)
// @access  Private (Finance and Admin)
router.get(
  '/completed-tasks',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search, sector, status } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const hasSearch = search && String(search).trim();
    const maxLimit = hasSearch ? 10000 : 100;
    const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const query = { taskStatus: 'completed' };

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { orderCode: searchRegex },
        { customerName: searchRegex },
        { cnic: searchRegex },
        { plotNo: searchRegex },
        { customerAddress: searchRegex },
        { mobileNumber: searchRegex }
      ];
    }
    if (sector && sector.trim()) query.sector = new RegExp(sector.trim(), 'i');
    if (status && status.trim()) query.status = new RegExp(status.trim(), 'i');

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';
    if (!isAdmin) {
      query.taskCompletedBy = req.user._id;
    }

    const [records, total] = await Promise.all([
      RecoveryAssignment.find(query)
        .sort({ taskCompletedAt: -1, orderCode: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('taskCompletedBy', 'firstName lastName email')
        .lean(),
      RecoveryAssignment.countDocuments(query)
    ]);

    const rules = await RecoveryTaskAssignmentRule.find({ isActive: true })
      .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
      .populate('createdBy', 'firstName lastName email')
      .lean();
    const sectorRules = rules.filter((r) => r.type === 'sector');
    const slabRules = rules.filter((r) => r.type === 'slab');

    const data = records.map((r) => ({
      ...r,
      assignedToMember: resolveAssignedMember(r, sectorRules, slabRules)
    }));

    res.json({
      success: true,
      data,
      pagination: { page: pageNum, limit: limitNum, total }
    });
  })
);

// @route   PUT /api/finance/recovery-assignments/:id/complete
// @desc    Mark a recovery assignment task as completed (assigned recovery member or admin)
// @access  Private
router.put(
  '/:id/complete',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const assignment = await RecoveryAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const rules = await RecoveryTaskAssignmentRule.find({ isActive: true })
      .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
      .lean();
    const sectorRules = rules.filter((r) => r.type === 'sector');
    const slabRules = rules.filter((r) => r.type === 'slab');
    const assignedToMember = resolveAssignedMember(assignment, sectorRules, slabRules);

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';
    if (!isAdmin && assignedToMember) {
      const employee = await Employee.findOne({ employeeId: req.user.employeeId }).lean();
      const recoveryMember = employee ? await RecoveryMember.findOne({ employee: employee._id, isActive: true }).lean() : null;
      if (!recoveryMember || assignedToMember._id.toString() !== recoveryMember._id.toString()) {
        return res.status(403).json({ success: false, message: 'You can only complete your assigned tasks' });
      }
    }

    assignment.taskStatus = 'completed';
    assignment.taskCompletedAt = new Date();
    assignment.taskCompletedBy = req.user._id;
    await assignment.save();

    // Update related RecoveryTasks progress based on completed assignments
    try {
      // Use the resolved assignment owner (assignedToMember) so this works
      // whether the action is done by admin or the recovery member
      if (assignedToMember && assignedToMember._id) {
        const tasks = await RecoveryTask.find({ assignedTo: assignedToMember._id }).lean();

        for (const task of tasks) {
          const q = {};

          if (task.scopeType === 'sector') {
            if (task.sector && task.sector.trim()) {
              q.sector = task.sector.trim();
            }
          } else if (task.scopeType === 'slab') {
            if (task.sector && task.sector.trim()) {
              q.sector = task.sector.trim();
            }
            const min = Number(task.minAmount) || 0;
            const max = task.maxAmount != null ? Number(task.maxAmount) : null;
            q.currentlyDue = max != null ? { $gte: min, $lt: max } : { $gte: min };
          }

          q.taskStatus = 'completed';

          const count = await RecoveryAssignment.countDocuments(q);

          const update = {
            completedCount: count
          };

          if (task.targetCount != null && task.targetCount > 0) {
            const pct = Math.min(100, Math.round((count / task.targetCount) * 100));
            update.progressPercent = pct;
            if (count >= task.targetCount) {
              update.status = 'completed';
            } else if (count > 0 && task.status === 'pending') {
              update.status = 'in_progress';
            }
          }

          await RecoveryTask.findByIdAndUpdate(task._id, update);
        }
      }
    } catch (e) {
      console.warn('Failed to update RecoveryTask progress from completed assignment', e.message);
    }

    const updated = assignment.toObject();
    updated.assignedToMember = assignedToMember;
    res.json({ success: true, data: updated });
  })
);

module.exports = router;
