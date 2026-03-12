const express = require('express');
const path = require('path');
const XLSX = require('xlsx');
const axios = require('axios');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const RecoveryAssignment = require('../models/finance/RecoveryAssignment');
const RecoveryTaskAssignmentRule = require('../models/finance/RecoveryTaskAssignmentRule');
const RecoveryMember = require('../models/finance/RecoveryMember');
const Employee = require('../models/hr/Employee');
const WhatsAppIncomingMessage = require('../models/finance/WhatsAppIncomingMessage');

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
    return { _id: sectorRule.assignedTo._id, name: name || '—', action: actionFromRule(sectorRule) };
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
    return { _id: slabRule.assignedTo._id, name: name || '—', action: actionFromRule(slabRule) };
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

// @route   GET /api/finance/recovery-assignments/my-tasks
// @desc    List recovery assignments: super_admin/admin see all; others see only their assigned tasks
// @access  Private (same roles as recovery)
router.get(
  '/my-tasks',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search, sector, status } = req.query;
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * (Math.min(100, Math.max(1, parseInt(limit, 10) || 50)));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

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

      const query = { $or: orConditions };
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

      const [records, total] = await Promise.all([
        RecoveryAssignment.find(query).sort({ sortOrder: 1, orderCode: 1 }).skip(skip).limit(limitNum).lean(),
        RecoveryAssignment.countDocuments(query)
      ]);

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

    const query = { $or: orConditions };
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

    const [records, total] = await Promise.all([
      RecoveryAssignment.find(query).sort({ sortOrder: 1, orderCode: 1 }).skip(skip).limit(limitNum).lean(),
      RecoveryAssignment.countDocuments(query)
    ]);

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
// @desc    List recovery assignments with pagination and search
// @access  Private (Finance and Admin)
router.get(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search, sector, status } = req.query;
    const query = {};

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

    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * (Math.min(100, Math.max(1, parseInt(limit, 10) || 50)));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const [records, total] = await Promise.all([
      RecoveryAssignment.find(query).sort({ sortOrder: 1, orderCode: 1 }).skip(skip).limit(limitNum).lean(),
      RecoveryAssignment.countDocuments(query)
    ]);

    const rules = await RecoveryTaskAssignmentRule.find({ isActive: true })
      .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
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
      pagination: { page: parseInt(page, 10) || 1, limit: limitNum, total }
    });
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

// @route   GET /api/finance/recovery-assignments/whatsapp-incoming/numbers-with-messages
// @desc    Return phone numbers that have at least one incoming message (for badge/indicator)
// @access  Private
router.get(
  '/whatsapp-incoming/numbers-with-messages',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const docs = await WhatsAppIncomingMessage.distinct('from');
    res.json({ success: true, data: docs || [] });
  })
);

// @route   GET /api/finance/recovery-assignments/whatsapp-incoming?from=923214554035
// @desc    Fetch incoming WhatsApp messages for a phone number
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
    const messages = await WhatsAppIncomingMessage.find({ from: phone })
      .sort({ receivedAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, data: messages });
  })
);

// @route   POST /api/finance/recovery-assignments/send-whatsapp
// @desc    Send WhatsApp via Graph API. Supports: (1) template: 'taj_discount_on_installments' with header image, (2) body as plain text, (3) else hello_world template.
// @access  Private
router.post(
  '/send-whatsapp',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { to, body, template } = req.body;
    const phone = (to && String(to).replace(/\D/g, '')) || '923214554035';
    const toNumber = phone.startsWith('0') ? phone.slice(1) : phone;
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

      if (template === 'taj_discount_on_installments') {
        payload = tajDiscountPayload;
        sentAs = 'taj_discount_on_installments';
      } else if (messageBody) {
        payload = textPayload;
        sentAs = 'text';
      } else {
        payload = helloWorldPayload;
      }

      const apiRes = await sendPayload(payload);
      const data = apiRes.data;
      const messageId = data?.messages?.[0]?.id || null;
      console.log('[WhatsApp] Sent to', toNumber, 'messageId:', messageId, 'sentAs:', sentAs);

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

module.exports = router;
