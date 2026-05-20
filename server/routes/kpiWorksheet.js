const express = require('express');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');
const KPIWorksheet = require('../models/hr/KPIWorksheet');
const Employee = require('../models/hr/Employee');
const { getOrCreateWorksheet, ensureWorksheetsForMonth } = require('../utils/kpiWorksheetService');

const router = express.Router();

async function employeeFromUser(userCtx) {
  const userId = typeof userCtx === 'object' ? userCtx?._id : userCtx;
  const employeeId = typeof userCtx === 'object' ? userCtx?.employeeId : null;
  const or = [{ user: userId }];
  if (employeeId) or.push({ employeeId });
  return Employee.findOne({ $or: or })
    .select('_id reportingLine manager hod firstName lastName employeeId')
    .lean();
}

function isHrAdmin(role) {
  return ['super_admin', 'admin', 'developer', 'hr_manager', 'higher_management'].includes(role);
}

async function worksheetEditFlags(req, subjectEmployeeId) {
  const me = await employeeFromUser(req.user);
  const hr = isHrAdmin(req.user?.role);
  const subId = String(subjectEmployeeId);
  const subject = await Employee.findById(subId).select('reportingLine manager hod').lean();
  const owner = me && String(me._id) === subId;
  const lineId = subject?.reportingLine ? String(subject.reportingLine) : null;
  const mgrId = subject?.manager ? String(subject.manager) : null;
  const hodId = subject?.hod ? String(subject.hod) : null;
  const managerOf = me && ((lineId && String(me._id) === lineId) || (mgrId && String(me._id) === mgrId) || (hodId && String(me._id) === hodId));

  return {
    canEditStructure: owner || hr,
    canEditEmployeeCols: owner || hr,
    canEditManagerCols: (managerOf && !owner) || hr
  };
}

async function populateWorksheetEmployee(doc) {
  await doc.populate({
    path: 'employee',
    select: 'firstName lastName employeeId reportingLine manager hod',
    populate: [
      { path: 'reportingLine', select: '_id firstName lastName employeeId' },
      { path: 'manager', select: '_id firstName lastName employeeId' },
      { path: 'hod', select: '_id firstName lastName employeeId' }
    ]
  });
}

async function canAccessWorksheet(req, worksheetEmployeeId) {
  const role = req.user?.role;
  if (isHrAdmin(role)) return true;

  const me = await employeeFromUser(req.user);
  if (!me) return false;

  if (String(me._id) === String(worksheetEmployeeId)) return true;

  const sub = await Employee.findById(worksheetEmployeeId).select('reportingLine manager hod').lean();
  if (
    sub &&
    (
      (sub.reportingLine && String(sub.reportingLine) === String(me._id)) ||
      (sub.manager && String(sub.manager) === String(me._id)) ||
      (sub.hod && String(sub.hod) === String(me._id))
    )
  ) return true;

  return false;
}

function rowToPlain(r) {
  if (!r) return {};
  return r.toObject ? r.toObject() : { ...r };
}

/** GET /api/kpi/worksheets/me?year=2026&month=3 */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const emp = await employeeFromUser(req.user);
    if (!emp) return res.status(404).json({ success: false, message: 'Employee profile not found' });

    const now = new Date();
    const year = Math.max(2000, parseInt(req.query.year, 10) || now.getFullYear());
    const month = Math.min(12, Math.max(1, parseInt(req.query.month, 10) || now.getMonth() + 1));

    const doc = await getOrCreateWorksheet(emp._id, year, month);
    await populateWorksheetEmployee(doc);
    const editFlags = await worksheetEditFlags(req, doc.employee._id || doc.employee);
    res.json({ success: true, data: doc, editFlags });
  })
);

/** GET /api/kpi/worksheets/history/me */
router.get(
  '/history/me',
  asyncHandler(async (req, res) => {
    const emp = await employeeFromUser(req.user);
    if (!emp) return res.status(404).json({ success: false, message: 'Employee profile not found' });

    const list = await KPIWorksheet.find({ employee: emp._id })
      .select('year month totalKPIScore totalWeight updatedAt')
      .sort({ year: -1, month: -1 })
      .limit(36)
      .lean();

    res.json({ success: true, data: list });
  })
);

/** GET /api/kpi/worksheets/for-employee/:employeeId?year=&month= */
router.get(
  '/for-employee/:employeeId',
  asyncHandler(async (req, res) => {
    const targetId = req.params.employeeId;
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ success: false, message: 'Invalid employee id' });
    }

    if (!(await canAccessWorksheet(req, targetId))) {
      return res.status(403).json({ success: false, message: 'Not allowed to view this worksheet' });
    }

    const now = new Date();
    const year = Math.max(2000, parseInt(req.query.year, 10) || now.getFullYear());
    const month = Math.min(12, Math.max(1, parseInt(req.query.month, 10) || now.getMonth() + 1));

    const doc = await getOrCreateWorksheet(targetId, year, month);
    await populateWorksheetEmployee(doc);
    const editFlags = await worksheetEditFlags(req, targetId);
    res.json({ success: true, data: doc, editFlags });
  })
);

/** GET /api/kpi/worksheets/team */
router.get(
  '/team',
  asyncHandler(async (req, res) => {
    const me = await employeeFromUser(req.user);
    if (!me) return res.json({ success: true, data: [], year: null, month: null });

    const subs = await Employee.find({
      $or: [{ reportingLine: me._id }, { manager: me._id }, { hod: me._id }],
      isActive: true,
      isDeleted: { $ne: true }
    })
      .select('firstName lastName employeeId')
      .lean();

    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;

    const out = [];
    for (const s of subs) {
      const ws = await KPIWorksheet.findOne({ employee: s._id, year, month })
        .select('totalKPIScore totalWeight updatedAt rows')
        .lean();
      const managerScored = !!(ws?.rows || []).some((r) => {
        const mt = Number(r?.managerTotalAssigned) || 0;
        const ma = Number(r?.managerAchieved) || 0;
        return mt > 0 || ma > 0;
      });
      out.push({
        employee: { _id: s._id, firstName: s.firstName, lastName: s.lastName, employeeId: s.employeeId },
        worksheet: ws ? { ...ws, managerScored } : null
      });
    }

    res.json({ success: true, data: out, year, month });
  })
);

/** PUT /api/kpi/worksheets/:id */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ success: false, message: 'rows array is required' });
    }

    const doc = await KPIWorksheet.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Worksheet not found' });

    if (!(await canAccessWorksheet(req, doc.employee))) {
      return res.status(403).json({ success: false, message: 'Not allowed to update this worksheet' });
    }

    const flags = await worksheetEditFlags(req, doc.employee);
    const prevRows = (doc.rows || []).map((x) => rowToPlain(x));

    if (!flags.canEditStructure && rows.length !== prevRows.length) {
      return res.status(400).json({
        success: false,
        message: 'Only the employee (or HR) can add/remove KPI rows or change weights.'
      });
    }

    const cleaned = rows.map((r) => ({
      kpiArea: String(r.kpiArea || '').trim(),
      weight: Math.max(0, Math.min(100, Number(r.weight) || 0)),
      employeeAchieved: Math.max(0, Number(r.employeeAchieved) || 0),
      employeeTotalAssigned: Math.max(0, Number(r.employeeTotalAssigned) || 0),
      managerAchieved: Math.max(0, Number(r.managerAchieved) || 0),
      managerTotalAssigned: Math.max(0, Number(r.managerTotalAssigned) || 0)
    }));

    const merged = cleaned.map((r, i) => {
      const p = prevRows[i] || {};
      const out = { ...r };
      if (!flags.canEditStructure) {
        out.kpiArea = p.kpiArea != null ? String(p.kpiArea) : out.kpiArea;
        out.weight = p.weight != null ? Number(p.weight) : out.weight;
      }
      if (!flags.canEditEmployeeCols) {
        out.employeeAchieved = Number(p.employeeAchieved != null ? p.employeeAchieved : p.achieved) || 0;
        out.employeeTotalAssigned = Number(p.employeeTotalAssigned != null ? p.employeeTotalAssigned : p.totalAssigned) || 0;
      }
      if (!flags.canEditManagerCols) {
        out.managerAchieved = Number(p.managerAchieved) || 0;
        out.managerTotalAssigned = Number(p.managerTotalAssigned) || 0;
      }
      return out;
    });

    const sumW = merged.reduce((s, r) => s + r.weight, 0);
    if (merged.length > 0 && Math.abs(sumW - 100) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Weights must total 100%. Current total: ${sumW}%`
      });
    }

    doc.rows = merged;
    doc.lastSavedBy = req.user._id;
    doc.lastSavedAt = new Date();
    await doc.save();

    await populateWorksheetEmployee(doc);
    const editFlags = await worksheetEditFlags(req, doc.employee._id || doc.employee);
    res.json({ success: true, data: doc, editFlags });
  })
);

/** POST /api/kpi/worksheets/run-monthly-bootstrap */
router.post(
  '/run-monthly-bootstrap',
  asyncHandler(async (req, res) => {
    const role = req.user?.role;
    if (!['super_admin', 'admin', 'developer', 'hr_manager', 'higher_management'].includes(role)) {
      return res.status(403).json({ success: false, message: 'HR or admin only' });
    }
    const now = new Date();
    const year = parseInt(req.body.year, 10) || now.getFullYear();
    const month = parseInt(req.body.month, 10) || now.getMonth() + 1;
    const result = await ensureWorksheetsForMonth(year, month);
    res.json({ success: true, data: result });
  })
);

module.exports = router;
