const express = require('express');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const XLSX = require('xlsx');
const multer = require('multer');
const axios = require('axios');
const mongoose = require('mongoose');
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
const {
  normalizePhoneForLookup,
  variantsForRecoveryPhone
} = require('../utils/recoveryWhatsAppPhone');

const router = express.Router();

function resolveAuthUserObjectId(req) {
  const raw = req.user?._id ?? req.user?.id;
  if (raw == null) return null;
  const s = String(raw);
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

function normalizeSectorValue(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectorExactRegex(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  return new RegExp(`^${escapeRegex(trimmed)}$`, 'i');
}

function resolveAssignedMember(record, sectorRules, slabRules) {
  const sector = normalizeSectorValue(record.sector);
  const due = Number(record.currentlyDue) || 0;
  const actionFromRule = (rule) => rule.action && ['whatsapp', 'call', 'both'].includes(rule.action) ? rule.action : 'both';

  const sectorRule = sectorRules.find((r) => normalizeSectorValue(r.sector) === sector);
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
    const sectorMatch = !normalizeSectorValue(r.sector) || normalizeSectorValue(r.sector) === sector;
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

/** True when the logged-in user is linked to an active RecoveryMember (field agent). */
async function userIsActiveRecoveryMember(req) {
  if (!req.user?.employeeId) return false;
  const employee = await Employee.findOne({ employeeId: req.user.employeeId }).lean();
  if (!employee) return false;
  const rm = await RecoveryMember.findOne({ employee: employee._id, isActive: true }).lean();
  return !!rm;
}

const normRole = (val) =>
  val != null ? String(val).toLowerCase().replace(/\s+/g, '_').trim() : '';

/** Same full Completed Tasks list as super_admin: platform admins + Recovery Manager role. */
function userHasCompletedTasksFullAccess(req) {
  const fullAccessRoles = new Set(['super_admin', 'admin', 'recovery_manager']);
  const candidates = [
    req.user?.role,
    req.user?.roleRef?.name,
    req.user?.roleRef?.displayName
  ];
  for (const c of candidates) {
    if (fullAccessRoles.has(normRole(c))) return true;
  }
  const multi = req.user?.roles;
  if (Array.isArray(multi)) {
    for (const r of multi) {
      if (fullAccessRoles.has(normRole(r?.name)) || fullAccessRoles.has(normRole(r?.displayName))) {
        return true;
      }
    }
  }
  return false;
}

/** Upper bound for page size on recovery list APIs (matches client rows-per-page max, usually 200). */
const RECOVERY_LIST_MAX_LIMIT = 200;

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
    const { page = 1, limit = 50, search, sector, status, unread, dueSort } = req.query;
    const unreadOnly = unread === 'true' || unread === '1';
    const requestedLimit = Math.max(1, parseInt(limit, 10) || 50);
    const limitNum = Math.min(RECOVERY_LIST_MAX_LIMIT, requestedLimit);
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * limitNum;

    const sortByDue = dueSort === 'asc' || dueSort === 'desc';
    const dueDir = dueSort === 'asc' ? 1 : -1;
    const dueSortObj = sortByDue ? { currentlyDue: dueDir, sortOrder: 1, orderCode: 1 } : { sortOrder: 1, orderCode: 1 };

    // Super admin and admin: only assignments that are assigned to some recovery member (any rule)
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      const allRules = await RecoveryTaskAssignmentRule.find({ isActive: true })
        .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
        .lean();
      const sectorRulesAll = allRules.filter((r) => r.type === 'sector');
      const slabRulesAll = allRules.filter((r) => r.type === 'slab');

      const orConditions = [];
      const allSectors = [...new Set(sectorRulesAll.map((r) => String(r.sector || '').trim()).filter(Boolean))];
      if (allSectors.length) {
        orConditions.push({ $or: allSectors.map((s) => ({ sector: sectorExactRegex(s) })) });
      }
      slabRulesAll.forEach((s) => {
        const min = Number(s.minAmount) || 0;
        const max = s.maxAmount != null && s.maxAmount !== '' ? Number(s.maxAmount) : null;
        const dueCondition = max != null ? { $gte: min, $lt: max } : { $gte: min };
        const sectorVal = (s.sector || '').trim();
        if (sectorVal) {
          orConditions.push({ sector: sectorExactRegex(sectorVal), currentlyDue: dueCondition });
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
        const userId = resolveAuthUserObjectId(req);
        const paginated = await queryRecoveryAssignmentsUnreadPaginated({
          query,
          userId,
          dueSortObj,
          skip,
          limitNum
        });
        records = paginated.records;
        total = paginated.total;
      } else {
        [records, total] = await Promise.all([
          RecoveryAssignment.find(query).sort(dueSortObj).skip(skip).limit(limitNum).lean(),
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
        pagination: { page: 1, limit: Math.min(RECOVERY_LIST_MAX_LIMIT, Math.max(1, parseInt(limit, 10) || 50)), total: 0 },
        notRecoveryMember: true
      });
    }

    const recoveryMember = await RecoveryMember.findOne({ employee: employee._id, isActive: true }).lean();
    if (!recoveryMember) {
      return res.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: Math.min(RECOVERY_LIST_MAX_LIMIT, Math.max(1, parseInt(limit, 10) || 50)), total: 0 },
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

    const mySectors = rules.filter((r) => r.type === 'sector').map((r) => String(r.sector || '').trim()).filter(Boolean);
    const mySlabs = rules.filter((r) => r.type === 'slab');

    const orConditions = [];
    if (mySectors.length) {
      orConditions.push({ $or: mySectors.map((s) => ({ sector: sectorExactRegex(s) })) });
    }
    mySlabs.forEach((s) => {
      const min = Number(s.minAmount) || 0;
      const max = s.maxAmount != null && s.maxAmount !== '' ? Number(s.maxAmount) : null;
      const dueCondition = max != null ? { $gte: min, $lt: max } : { $gte: min };
      const sectorVal = (s.sector || '').trim();
      if (sectorVal) {
        orConditions.push({ sector: sectorExactRegex(sectorVal), currentlyDue: dueCondition });
      } else {
        orConditions.push({ currentlyDue: dueCondition });
      }
    });

    if (orConditions.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { page: parseInt(page, 10) || 1, limit: Math.min(RECOVERY_LIST_MAX_LIMIT, Math.max(1, parseInt(limit, 10) || 50)), total: 0 }
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
      const userId = resolveAuthUserObjectId(req);
      const paginated = await queryRecoveryAssignmentsUnreadPaginated({
        query,
        userId,
        dueSortObj,
        skip,
        limitNum
      });
      records = paginated.records;
      total = paginated.total;
    } else {
      [records, total] = await Promise.all([
        RecoveryAssignment.find(query).sort(dueSortObj).skip(skip).limit(limitNum).lean(),
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
    const { page = 1, limit = 50, search, sector, status, unread, memberId, dueSort } = req.query;
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
      const sectors = [...new Set(sectorRules.map((r) => String(r.sector || '').trim()).filter(Boolean))];
      if (sectors.length) {
        memberOrConditions.push({ $or: sectors.map((s) => ({ sector: sectorExactRegex(s) })) });
      }
      slabRules.forEach((s) => {
        const min = Number(s.minAmount) || 0;
        const max = s.maxAmount != null && s.maxAmount !== '' ? Number(s.maxAmount) : null;
        const dueCondition = max != null ? { $gte: min, $lt: max } : { $gte: min };
        const sectorVal = (s.sector || '').trim();
        if (sectorVal) {
          memberOrConditions.push({ sector: sectorExactRegex(sectorVal), currentlyDue: dueCondition });
        } else {
          memberOrConditions.push({ currentlyDue: dueCondition });
        }
      });

      // If selected member has no active rules, return empty quickly
      if (memberOrConditions.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { page: Math.max(1, parseInt(page, 10) || 1), limit: Math.min(RECOVERY_LIST_MAX_LIMIT, Math.max(1, parseInt(limit, 10) || 50)), total: 0 }
        });
      }

      query.$and = (query.$and || []).concat([{ $or: memberOrConditions }]);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const requestedLimitMain = Math.max(1, parseInt(limit, 10) || 50);
    const limitNum = Math.min(RECOVERY_LIST_MAX_LIMIT, requestedLimitMain);
    const skip = (pageNum - 1) * limitNum;

    let records;
    let total;

    const sortByDue = dueSort === 'asc' || dueSort === 'desc';
    const dueDir = dueSort === 'asc' ? 1 : -1;
    const dueSortObj = sortByDue ? { currentlyDue: dueDir, sortOrder: 1, orderCode: 1 } : { sortOrder: 1, orderCode: 1 };

    if (unreadOnly) {
      const userId = resolveAuthUserObjectId(req);
      const paginated = await queryRecoveryAssignmentsUnreadPaginated({
        query,
        userId,
        dueSortObj,
        skip,
        limitNum
      });
      records = paginated.records;
      total = paginated.total;
    } else {
      [records, total] = await Promise.all([
        RecoveryAssignment.find(query).sort(dueSortObj).skip(skip).limit(limitNum).lean(),
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

/**
 * Unread = incoming WA messages after ConversationRead.readAt for this user (or all if never read).
 *
 * Assignment lists (unread filter): `getUnreadCanonicalSetForCandidates` matches only assignment phones
 * via chunked `$match` on `from` variants — no full-table scan on WhatsApp messages.
 *
 * `getUnreadCountsFromMessagesSide` (used for numbers-with-messages sidebar) still aggregates all senders;
 * keep that endpoint in mind if it ever needs the same optimization.
 */
const UNREAD_FROM_MESSAGES_PARALLEL = 25;

/** Chunk size for matching WA senders to assignment phones only (avoids full-collection scans). */
const UNREAD_CANDIDATE_CHUNK = 350;
const UNREAD_CANDIDATE_CHUNK_PARALLEL = 4;

const unreadSparseInflight = new Map();

/**
 * Unread phones among given canonical numbers only: scans WhatsApp rows whose `from` matches
 * variants of those candidates (not the entire incoming-message collection).
 */
async function getUnreadCanonicalSetForCandidates(userId, candidateNormalizedPhones) {
  if (userId == null) return new Set();
  const uidStr = String(userId);
  if (!mongoose.Types.ObjectId.isValid(uidStr)) return new Set();
  const uid = new mongoose.Types.ObjectId(uidStr);

  const candidates = [
    ...new Set((candidateNormalizedPhones || []).map((p) => normalizePhoneForLookup(p)).filter(Boolean))
  ];
  if (candidates.length === 0) return new Set();

  const readDocs = await ConversationRead.find({ userId: uid }).select('phone readAt').lean();
  const readMap = new Map(readDocs.map((r) => [r.phone, r.readAt ? new Date(r.readAt) : null]));

  const processChunk = async (chunk) => {
    const variantSet = new Set();
    for (const c of chunk) {
      for (const v of variantsForRecoveryPhone(c)) variantSet.add(v);
    }
    const variants = [...variantSet];
    if (variants.length === 0) return new Set();

    let byFrom;
    try {
      byFrom = await WhatsAppIncomingMessage.aggregate([
        { $match: { from: { $in: variants } } },
        { $group: { _id: '$from', lastAt: { $max: '$receivedAt' } } }
      ])
        .option({ maxTimeMS: 90000 })
        .allowDiskUse(true);
    } catch (err) {
      console.error('[recovery] unread candidate-chunk aggregate failed', err.message);
      return new Set();
    }

    const lastByCanon = new Map();
    for (const row of byFrom) {
      const raw = row._id;
      if (raw == null || raw === '') continue;
      const canon = normalizePhoneForLookup(String(raw));
      if (!canon) continue;
      const t = row.lastAt ? new Date(row.lastAt) : null;
      if (!t || isNaN(t.getTime())) continue;
      const prev = lastByCanon.get(canon);
      if (!prev || t > prev) lastByCanon.set(canon, t);
    }

    const out = new Set();
    for (const c of chunk) {
      const lastAt = lastByCanon.get(c);
      if (!lastAt) continue;
      const readAt = readMap.get(c) || null;
      if (readAt && lastAt <= readAt) continue;
      out.add(c);
    }
    return out;
  };

  const chunks = [];
  for (let i = 0; i < candidates.length; i += UNREAD_CANDIDATE_CHUNK) {
    chunks.push(candidates.slice(i, i + UNREAD_CANDIDATE_CHUNK));
  }

  const unreadCanon = new Set();
  for (let i = 0; i < chunks.length; i += UNREAD_CANDIDATE_CHUNK_PARALLEL) {
    const batch = chunks.slice(i, i + UNREAD_CANDIDATE_CHUNK_PARALLEL);
    const results = await Promise.all(batch.map(processChunk));
    for (const s of results) {
      for (const c of s) unreadCanon.add(c);
    }
  }
  return unreadCanon;
}

/** AND `mobileNumber` with existing query using exact raw strings from assignments (handles mixed formats). */
function mergeQueryWithMobileRawIn(baseQuery, rawMobileList) {
  const inList = [...new Set((rawMobileList || []).map((x) => String(x)).filter((s) => s !== ''))];
  const mobileClause = { mobileNumber: { $in: inList } };
  if (inList.length === 0) return { ...baseQuery, _id: { $exists: false } };
  if (!baseQuery || Object.keys(baseQuery).length === 0) return mobileClause;
  return { ...baseQuery, ...mobileClause };
}

async function queryRecoveryAssignmentsUnreadPaginated({ query, userId, dueSortObj, skip, limitNum }) {
  const assignmentPhones = await RecoveryAssignment.distinct('mobileNumber', query);
  const canonToRaws = new Map();
  for (const raw of assignmentPhones) {
    if (raw === null || raw === undefined) continue;
    const str = typeof raw === 'number' ? String(Math.trunc(raw)) : String(raw);
    if (!str.trim()) continue;
    const c = normalizePhoneForLookup(str);
    if (!c) continue;
    if (!canonToRaws.has(c)) canonToRaws.set(c, new Set());
    canonToRaws.get(c).add(str);
  }

  const candidates = [...canonToRaws.keys()];
  const unreadSet = await getUnreadCanonicalSetForCandidates(userId, candidates);

  if (unreadSet.size === 0) {
    return { records: [], total: 0 };
  }

  const matchedRaw = [];
  for (const c of unreadSet) {
    const s = canonToRaws.get(c);
    if (s) matchedRaw.push(...s);
  }
  const narrowQuery = mergeQueryWithMobileRawIn(query, matchedRaw);

  const [records, total] = await Promise.all([
    RecoveryAssignment.find(narrowQuery).sort(dueSortObj).skip(skip).limit(limitNum).lean(),
    RecoveryAssignment.countDocuments(narrowQuery)
  ]);
  return { records, total };
}

async function getUnreadCountsFromMessagesSide(userId) {
  if (userId == null) return new Map();
  const uidStr = String(userId);
  if (!mongoose.Types.ObjectId.isValid(uidStr)) return new Map();
  const uid = new mongoose.Types.ObjectId(uidStr);
  const inflightKey = uidStr;

  if (unreadSparseInflight.has(inflightKey)) {
    return unreadSparseInflight.get(inflightKey);
  }

  const promise = (async () => {
    const map = new Map();

    const readDocs = await ConversationRead.find({ userId: uid }).select('phone readAt').lean();
    const readMap = new Map(readDocs.map((r) => [r.phone, r.readAt ? new Date(r.readAt) : null]));

    let byFrom;
    try {
      byFrom = await WhatsAppIncomingMessage.aggregate([{ $group: { _id: '$from', lastAt: { $max: '$receivedAt' } } }])
        .option({ maxTimeMS: 120000 })
        .allowDiskUse(true);
    } catch (err) {
      console.error('[recovery] unread $group by from failed', err.message);
      return map;
    }

    const lastByCanon = new Map();
    for (const row of byFrom) {
      const raw = row._id;
      if (raw == null || raw === '') continue;
      const canon = normalizePhoneForLookup(String(raw));
      if (!canon) continue;
      const t = row.lastAt ? new Date(row.lastAt) : null;
      if (!t || isNaN(t.getTime())) continue;
      const prev = lastByCanon.get(canon);
      if (!prev || t > prev) lastByCanon.set(canon, t);
    }

    const toCount = [];
    for (const [canon, lastAt] of lastByCanon) {
      const readAt = readMap.get(canon) || null;
      if (readAt && lastAt <= readAt) continue;
      toCount.push(canon);
    }

    for (let i = 0; i < toCount.length; i += UNREAD_FROM_MESSAGES_PARALLEL) {
      const slice = toCount.slice(i, i + UNREAD_FROM_MESSAGES_PARALLEL);
      await Promise.all(
        slice.map(async (canon) => {
          const readAt = readMap.get(canon) || null;
          const variants = variantsForRecoveryPhone(canon);
          const filter = readAt
            ? { from: { $in: variants }, receivedAt: { $gt: readAt } }
            : { from: { $in: variants } };
          const n = await WhatsAppIncomingMessage.countDocuments(filter);
          if (n > 0) map.set(canon, n);
        })
      );
    }
    return map;
  })();

  unreadSparseInflight.set(inflightKey, promise);
  try {
    return await promise;
  } finally {
    unreadSparseInflight.delete(inflightKey);
  }
}

async function getUnreadMessageCountsByNormalizedPhone(userId, candidateNormalizedPhones) {
  const sparse = await getUnreadCountsFromMessagesSide(userId);

  if (candidateNormalizedPhones == null) {
    return sparse;
  }

  const candidates = [...new Set(candidateNormalizedPhones.map((p) => normalizePhoneForLookup(p)).filter(Boolean))];
  const map = new Map();
  for (const c of candidates) {
    map.set(c, sparse.get(c) || 0);
  }
  return map;
}

async function getUnreadNormalizedPhoneSetForUser(userId, candidateNormalizedPhones) {
  return getUnreadCanonicalSetForCandidates(userId, candidateNormalizedPhones);
}

// @route   GET /api/finance/recovery-assignments/whatsapp-incoming/numbers-with-messages
// @desc    Return phone numbers that have messages and their unread counts per user
// @access  Private
router.get(
  '/whatsapp-incoming/numbers-with-messages',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const userId = resolveAuthUserObjectId(req);
    const countsMap = await getUnreadMessageCountsByNormalizedPhone(userId, null);
    const numbers = [...countsMap.keys()];
    const unreadCounts = {};
    for (const [phone, count] of countsMap) {
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

    const userId = resolveAuthUserObjectId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid user session' });
    }
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
      ...incoming.map((m) => ({
        ...m,
        direction: 'in',
        time: m.receivedAt,
        text: m.text,
        mediaUrl: m.mediaUrl || null,
        mediaType: m.mediaType || null,
        mediaFilename: m.mediaFilename || null
      })),
      ...outgoing.map((m) => ({ ...m, direction: 'out', time: m.sentAt, text: m.text, status: m.status || 'sent' }))
    ].sort((a, b) => new Date(a.time) - new Date(b.time));

    res.json({ success: true, data: thread });
  })
);

// @route   DELETE /api/finance/recovery-assignments/whatsapp-message/:id
// @desc    Remove one outgoing (team-sent) message from local history only — does not affect customer's WhatsApp
// @access  Private
router.delete(
  '/whatsapp-message/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid message id' });
    }
    const out = await WhatsAppOutgoingMessage.findByIdAndDelete(id);
    if (out) return res.json({ success: true, deleted: 'outgoing' });
    const inc = await WhatsAppIncomingMessage.findById(id).lean();
    if (inc) {
      return res.status(403).json({
        success: false,
        message:
          "Only your team's sent messages can be removed from this view. Customer messages are not deleted here, and this never removes anything from the customer's WhatsApp."
      });
    }
    return res.status(404).json({ success: false, message: 'Message not found' });
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

// @route   GET /api/finance/recovery-assignments/whatsapp-media/:filename
// @desc    Serve WhatsApp media files (sent + received). Routed through /api/ so nginx
//          proxy_pass for /api/ always hits Node.js — avoids the nginx nested-location
//          bug that intercepts /uploads/*.jpg and tries to serve from the React build dir.
// @access  Public (no auth — Meta and other clients need to fetch received media too)
router.get('/whatsapp-media/:filename', asyncHandler(async (req, res) => {
  const filename = path.basename(req.params.filename || '');
  if (!filename || filename.includes('..')) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }
  const filePath = path.join(whatsappMediaDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found' });
  }
  const ext = path.extname(filename).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4',
    '.3gp': 'video/3gpp', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4', '.amr': 'audio/amr', '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  const contentType = mimeMap[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.sendFile(filePath);
}));

// @route   POST /api/finance/recovery-assignments/upload-media
// @desc    Upload media for WhatsApp. Saves locally then uploads to Meta Media API.
//          Returns media_id (Meta) + local url for chat history display.
// @access  Private (all authenticated users — recovery members need this too)
router.post(
  '/upload-media',
  (req, res, next) => {
    whatsappMediaUpload(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    // Meta rejects audio/webm (Chrome's MediaRecorder format).
    // Convert webm → ogg using ffmpeg (lossless container swap, Opus codec stays the same).
    let uploadPath = req.file.path;
    let uploadMime = req.file.mimetype;
    let uploadFilename = req.file.originalname || req.file.filename;
    let convertedPath = null;

    if (uploadMime.startsWith('audio/webm')) {
      const oggPath = req.file.path + '.ogg';
      try {
        // -c:a copy = recontainerise without re-encoding (instant, lossless)
        await execFileAsync('ffmpeg', ['-y', '-i', req.file.path, '-c:a', 'copy', oggPath]);
        convertedPath = oggPath;
        uploadPath = oggPath;
        uploadMime = 'audio/ogg';
        uploadFilename = uploadFilename.replace(/\.(webm|bin)$/i, '') + '.ogg';
        console.log('[WhatsApp Media] Converted audio/webm → audio/ogg');
      } catch (convErr) {
        // ffmpeg not installed or failed — try libopus re-encode as fallback
        console.warn('[WhatsApp Media] ffmpeg -c:a copy failed, trying re-encode:', convErr.message);
        try {
          await execFileAsync('ffmpeg', ['-y', '-i', req.file.path, '-c:a', 'libopus', oggPath]);
          convertedPath = oggPath;
          uploadPath = oggPath;
          uploadMime = 'audio/ogg';
          uploadFilename = uploadFilename.replace(/\.(webm|bin)$/i, '') + '.ogg';
        } catch (e2) {
          console.error('[WhatsApp Media] ffmpeg unavailable:', e2.message);
          // Fall through with original webm — Meta will likely reject, error returned to user
        }
      }
    }

    const mediaType = getMediaTypeFromMime(uploadMime);

    // Build local URL for chat history display — routed through /api/whatsapp-media/
    // (public, no auth) to avoid the nginx nested-location bug that catches *.jpg
    // and tries to serve from client/build instead of proxying to Node.js.
    const baseUrl = getBaseUrl(req).replace(/\/$/, '');
    // Local URL uses the original saved filename (not the converted temp file)
    const localUrl = `${baseUrl}/api/whatsapp-media/${req.file.filename}`;

    // Re-upload the saved file to Meta's Media API to get a media_id.
    // Meta serves the file itself — no need for your server to be reachable by Meta.
    // Uses Node 18+ global FormData/Blob (no extra npm package required).
    let mediaId = null;
    let metaUploadError = null;
    try {
      const fileBuffer = fs.readFileSync(uploadPath);
      const blob = new Blob([fileBuffer], { type: uploadMime });
      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('type', uploadMime);
      form.append('file', blob, uploadFilename);

      const metaRes = await axios.post(
        `https://graph.facebook.com/v24.0/${WHATSAPP_PHONE_NUMBER_ID}/media`,
        form,
        {
          headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
          maxBodyLength: Infinity
        }
      );
      mediaId = metaRes.data?.id || null;
    } catch (err) {
      metaUploadError = err.response?.data?.error?.message || err.message;
      console.error('[WhatsApp Media] Meta upload failed:', metaUploadError);
    } finally {
      // Clean up the temporary converted file
      if (convertedPath && fs.existsSync(convertedPath)) {
        try { fs.unlinkSync(convertedPath); } catch (_) {}
      }
    }

    if (!mediaId) {
      return res.status(502).json({
        success: false,
        message: `Failed to upload media to WhatsApp: ${metaUploadError || 'Unknown error'}`
      });
    }

    res.json({ success: true, data: { mediaId, mediaType, url: localUrl, filename: req.file.filename } });
  })
);

/**
 * Core WhatsApp send (single recipient). Used by /send-whatsapp and /send-whatsapp-batch.
 * @returns {Promise<{ ok: true, data, sentAs, messageId, toNumber } | { ok: false, message, statusCode, toNumber }>}
 */
async function executeRecoveryWhatsAppSend(payload, user) {
  const {
    to,
    body: textBody,
    template,
    assignmentId,
    campaignName,
    campaignMessage,
    campaignId,
    mediaType,
    mediaUrl,
    mediaId,
    replyToText,
    replyToMessageId
  } = payload || {};
  let phone = (to && String(to).replace(/\D/g, '')) || '923214554035';
  if (phone.startsWith('0')) phone = phone.slice(1);
  if (phone.length === 10 && phone.startsWith('3')) phone = '92' + phone;
  else if (phone.length === 10) phone = '92' + phone;
  const toNumber = phone;
  const token = WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, message: 'WhatsApp access token not configured (WHATSAPP_ACCESS_TOKEN)', statusCode: 500, toNumber };
  }
  const graphUrl = `https://graph.facebook.com/v24.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const messageBody = textBody != null ? String(textBody).trim() : '';

  const sendPayload = (graphBody) =>
    axios.post(graphUrl, graphBody, {
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
    let graphBody;
    let sentAs = 'template';

    if (campaignId) {
      const RecoveryCampaign = require('../models/finance/RecoveryCampaign');
      const campaign = await RecoveryCampaign.findById(campaignId).lean();
      if (campaign && campaign.whatsappTemplateName) {
        const langCode = (campaign.whatsappLanguageCode || '').trim() || 'en';
        const tplName = campaign.whatsappTemplateName;
        const tpl = { name: tplName, language: { code: langCode } };
        if (tplName === 'taj_discount_on_installments') {
          tpl.components = [
            {
              type: 'header',
              parameters: [{ type: 'image', image: { link: 'https://itihaasbuilders.com/images/marketing/image.jpeg' } }]
            }
          ];
        }
        graphBody = {
          messaging_product: 'whatsapp',
          to: toNumber,
          type: 'template',
          template: tpl
        };
        sentAs = tplName;
      }
    }

    if (!graphBody && mediaType && (mediaId || mediaUrl)) {
      const mediaTypeLower = String(mediaType).toLowerCase();
      const mediaRef = mediaId ? { id: String(mediaId) } : { link: String(mediaUrl).trim() };
      const payloads = {
        image: { messaging_product: 'whatsapp', to: toNumber, type: 'image', image: { ...mediaRef, ...(messageBody && { caption: messageBody }) } },
        document: { messaging_product: 'whatsapp', to: toNumber, type: 'document', document: { ...mediaRef, ...(messageBody && { caption: messageBody }) } },
        audio: { messaging_product: 'whatsapp', to: toNumber, type: 'audio', audio: { ...mediaRef } },
        video: { messaging_product: 'whatsapp', to: toNumber, type: 'video', video: { ...mediaRef, ...(messageBody && { caption: messageBody }) } }
      };
      graphBody = payloads[mediaTypeLower] || payloads.document;
      sentAs = mediaTypeLower;
    }

    if (!graphBody) {
      if (template === 'taj_discount_on_installments') {
        graphBody = tajDiscountPayload;
        sentAs = 'taj_discount_on_installments';
      } else if (messageBody) {
        graphBody = textPayload;
        sentAs = 'text';
      } else {
        graphBody = helloWorldPayload;
      }
    }

    const apiRes = await sendPayload(graphBody);
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
        sentBy: user?._id,
        status: messageId ? 'sent' : 'sending',
        statusUpdatedAt: new Date()
      };
      if (replyToText != null && String(replyToText).trim()) {
        createPayload.replyToText = String(replyToText).trim().slice(0, 2000);
      }
      if (replyToMessageId != null && String(replyToMessageId).trim()) {
        createPayload.replyToMessageId = String(replyToMessageId).trim().slice(0, 128);
      }
      if (sentAs !== 'text') {
        if (mediaUrl) createPayload.mediaUrl = String(mediaUrl).trim();
        createPayload.mediaType = String(sentAs);
      }
      await WhatsAppOutgoingMessage.create(createPayload);
    } else {
      const RecoveryCampaign = require('../models/finance/RecoveryCampaign');
      let displayText = '';
      if (campaignId) {
        const campaign = await RecoveryCampaign.findById(campaignId).lean();
        const preview =
          (campaignMessage && String(campaignMessage).trim()) ||
          (campaign && String(campaign.messagePreview || '').trim());
        if (preview) {
          displayText = `[Campaign] ${preview}`;
        } else {
          const cname = (campaignName && String(campaignName).trim()) || 'Campaign';
          const tpl =
            (campaign && campaign.whatsappTemplateName) ||
            (typeof sentAs === 'string' && sentAs !== 'template' ? sentAs : '');
          displayText = tpl ? `[Campaign] ${cname} · ${tpl}` : `[Campaign] ${cname}`;
        }
      } else if (campaignName) {
        const preview = campaignMessage && String(campaignMessage).trim();
        displayText = preview
          ? `[Campaign] ${preview}`
          : `[Campaign] ${String(campaignName).trim()}${sentAs && sentAs !== 'template' ? ` · ${sentAs}` : ''}`;
      } else {
        displayText = `(WhatsApp template: ${sentAs})`;
      }
      await WhatsAppOutgoingMessage.create({
        to: toNumber,
        text: displayText,
        messageId,
        sentAt: new Date(),
        sentBy: user?._id,
        status: messageId ? 'sent' : 'sending',
        statusUpdatedAt: new Date()
      });
    }

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

    return { ok: true, data, sentAs, messageId, toNumber };
  } catch (err) {
    const errData = err.response?.data?.error;
    const msg = errData?.message || err.response?.data?.message || err.message;
    const code = errData?.code ? ` (code ${errData.code})` : '';
    console.error('[WhatsApp] Send failed to', toNumber, err.response?.data || err.message);
    return {
      ok: false,
      message: `${msg || 'WhatsApp API error'}${code}`,
      statusCode: err.response?.status || 500,
      toNumber
    };
  }
}

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
    const result = await executeRecoveryWhatsAppSend(req.body, req.user);
    if (!result.ok) {
      return res.status(result.statusCode || 500).json({ success: false, message: result.message });
    }
    res.json({ success: true, data: result.data, sentAs: result.sentAs, messageId: result.messageId });
  })
);

// @route   POST /api/finance/recovery-assignments/send-whatsapp-batch
// @desc    Send many campaign (or reply) messages in one HTTP request — processes sequentially with a short delay (Meta / rate limits).
// @access  Private
router.post(
  '/send-whatsapp-batch',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide a non-empty items array' });
    }
    const maxPerRequest = Math.min(
      Math.max(parseInt(process.env.RECOVERY_WHATSAPP_BATCH_MAX, 10) || 100, 1),
      200
    );
    if (items.length > maxPerRequest) {
      return res.status(400).json({
        success: false,
        message: `At most ${maxPerRequest} recipients per batch request (client sends multiple batches automatically; max cap 200, tune RECOVERY_WHATSAPP_BATCH_MAX)`
      });
    }
    const delayMs = Math.max(0, parseInt(process.env.RECOVERY_WHATSAPP_BATCH_DELAY_MS, 10) || 250);
    const results = [];
    for (let i = 0; i < items.length; i += 1) {
      const result = await executeRecoveryWhatsAppSend(items[i], req.user);
      if (result.ok) {
        results.push({ ok: true, to: result.toNumber, messageId: result.messageId, sentAs: result.sentAs });
      } else {
        results.push({ ok: false, to: result.toNumber, message: result.message });
      }
      if (i < items.length - 1 && delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    const successCount = results.filter((r) => r.ok).length;
    res.json({
      success: true,
      results,
      summary: { total: items.length, successCount, failedCount: items.length - successCount }
    });
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
    const completedTaskFilters =
      req.query.completedTaskFilters === 'true' || req.query.completedTaskFilters === '1';

    if (completedTaskFilters) {
      const seesAllCompleted = userHasCompletedTasksFullAccess(req);
      const isMember = await userIsActiveRecoveryMember(req);
      const completedBase = { taskStatus: 'completed' };
      if (!seesAllCompleted && isMember) {
        completedBase.taskCompletedBy = req.user._id;
      }
      const [total, sectors, statuses] = await Promise.all([
        RecoveryAssignment.countDocuments(completedBase),
        RecoveryAssignment.distinct('sector', completedBase).then((arr) => arr.filter(Boolean).sort()),
        RecoveryAssignment.distinct('status', completedBase).then((arr) => arr.filter(Boolean).sort())
      ]);
      return res.json({
        success: true,
        data: { total, sectors, statuses, scopedToMyCompletions: !seesAllCompleted && isMember }
      });
    }

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
// @desc    List completed assignments: super_admin/admin/recovery_manager see all; active RecoveryMember (field) users see only their completions; other finance roles see all completed (oversight).
// @access  Private (Finance and Admin)
router.get(
  '/completed-tasks',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search, sector, status, dueSort } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const requestedLimitCompleted = Math.max(1, parseInt(limit, 10) || 50);
    const limitNum = Math.min(RECOVERY_LIST_MAX_LIMIT, requestedLimitCompleted);
    const skip = (pageNum - 1) * limitNum;

    const query = { taskStatus: 'completed' };

    const sortByDue = dueSort === 'asc' || dueSort === 'desc';
    const dueDir = dueSort === 'asc' ? 1 : -1;
    const sortObj = sortByDue
      ? { currentlyDue: dueDir, taskCompletedAt: -1, orderCode: 1 }
      : { taskCompletedAt: -1, orderCode: 1 };

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

    const seesAllCompleted = userHasCompletedTasksFullAccess(req);
    const isRecoveryMember = await userIsActiveRecoveryMember(req);
    if (!seesAllCompleted && isRecoveryMember) {
      query.taskCompletedBy = req.user._id;
    }

    const [records, total] = await Promise.all([
      RecoveryAssignment.find(query)
        .sort(sortObj)
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
              q.sector = sectorExactRegex(task.sector);
            }
          } else if (task.scopeType === 'slab') {
            if (task.sector && task.sector.trim()) {
              q.sector = sectorExactRegex(task.sector);
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
