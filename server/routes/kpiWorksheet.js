const express = require('express');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');
const KPIWorksheet = require('../models/hr/KPIWorksheet');
const Employee = require('../models/hr/Employee');
const { getOrCreateWorksheet, ensureWorksheetsForMonth } = require('../utils/kpiWorksheetService');
const { findEmployeeForAuthUser } = require('../utils/employeeUserLink');
const { checkSubRoleAccess } = require('../config/permissions');
const Project = require('../models/hr/Project');
const Department = require('../models/hr/Department');

const router = express.Router();

const EMPLOYEE_SELECT = '_id reportingLine manager hod firstName lastName employeeId';

async function employeeFromUser(userCtx) {
  if (!userCtx || typeof userCtx !== 'object') return null;
  const doc = await findEmployeeForAuthUser(userCtx, { select: EMPLOYEE_SELECT, autoLink: false });
  return doc ? doc.toObject() : null;
}

function isHrAdmin(role) {
  return ['super_admin', 'admin', 'developer', 'hr_manager', 'higher_management'].includes(role);
}

async function canAccessKpiManagement(user, action = 'read') {
  if (!user) return false;
  const userId = user.id || user._id;
  if (!userId) return false;
  return checkSubRoleAccess(userId, 'hr', 'kpi_management', action);
}

/** Employee has committed their row once total assigned is set (> 0). Achieved may be 0. */
function employeeHasEnteredMarks(row) {
  const eT = Number(row?.employeeTotalAssigned);
  if (Number.isFinite(eT) && eT > 0) return true;
  const legacyT = Number(row?.totalAssigned);
  return Number.isFinite(legacyT) && legacyT > 0;
}

function rowIdentityKey(row) {
  return [
    String(row?.kpiArea || '').trim(),
    Number(row?.weight) || 0,
    Number(row?.employeeAchieved) || 0,
    Number(row?.employeeTotalAssigned) || 0,
    Number(row?.managerAchieved) || 0,
    Number(row?.managerTotalAssigned) || 0
  ].join('|');
}

function rowStillPresent(prevRow, newRows) {
  const key = rowIdentityKey(prevRow);
  return newRows.some((r) => rowIdentityKey(r) === key);
}

async function worksheetEditFlags(req, subjectEmployeeId) {
  const me = await employeeFromUser(req.user);
  const hr = isHrAdmin(req.user?.role);
  const kpiElevated = hr || await canAccessKpiManagement(req.user, 'update');
  const subId = String(subjectEmployeeId);
  const subject = await Employee.findById(subId).select('reportingLine manager hod').lean();
  const owner = me && String(me._id) === subId;
  const lineId = subject?.reportingLine ? String(subject.reportingLine) : null;
  const mgrId = subject?.manager ? String(subject.manager) : null;
  const hodId = subject?.hod ? String(subject.hod) : null;
  const managerOf = me && ((lineId && String(me._id) === lineId) || (mgrId && String(me._id) === mgrId) || (hodId && String(me._id) === hodId));

  return {
    canEditStructure: owner || kpiElevated,
    canEditEmployeeCols: owner || kpiElevated,
    canEditManagerCols: (managerOf && !owner) || kpiElevated,
    canDeleteRowsAsReportingLine: (managerOf && !owner) || kpiElevated
  };
}

function validateRowDeletions(prevRows, newRows, flags) {
  const hr = flags.canEditStructure && flags.canDeleteRowsAsReportingLine && flags.canEditManagerCols;
  if (newRows.length >= prevRows.length) return null;

  const removed = prevRows.filter((pr) => !rowStillPresent(pr, newRows));
  if (!removed.length) return null;

  for (const pr of removed) {
    const hadEmployeeMarks = employeeHasEnteredMarks(pr);
    if (flags.canEditStructure && !flags.canDeleteRowsAsReportingLine) {
      if (hadEmployeeMarks) {
        return 'Cannot delete a KPI row after you have entered achieved and total assigned. Your reporting line can remove it.';
      }
    } else if (flags.canDeleteRowsAsReportingLine && !flags.canEditStructure) {
      if (!hadEmployeeMarks) {
        return 'Reporting line can only remove KPI rows after the employee has entered achieved and total assigned.';
      }
    }
  }
  return null;
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
  if (await canAccessKpiManagement(req.user, 'read')) return true;

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

function worksheetEmployeeSubmitted(rows) {
  if (!Array.isArray(rows) || !rows.length) return false;
  return rows.some((row) => {
    const eT = Number(row?.employeeTotalAssigned) || 0;
    if (eT > 0) return true;
    const legacyT = Number(row?.totalAssigned) || 0;
    return legacyT > 0;
  });
}

function worksheetManagerReviewed(rows) {
  if (!Array.isArray(rows) || !rows.length) return false;
  return rows.some((row) => {
    const mT = Number(row?.managerTotalAssigned) || 0;
    const mA = Number(row?.managerAchieved) || 0;
    return mT > 0 || mA > 0;
  });
}

function worksheetSubmissionStatus(rows) {
  if (!Array.isArray(rows) || !rows.length) return 'not_started';
  if (worksheetManagerReviewed(rows)) return 'manager_reviewed';
  if (worksheetEmployeeSubmitted(rows)) return 'submitted';
  return 'draft';
}

function groupSubmissionRecords(records) {
  const projectMap = new Map();
  for (const record of records) {
    const projectId = record?.project?._id ? String(record.project._id) : 'unassigned';
    const projectName = record?.project?.name || 'Unassigned project';
    if (!projectMap.has(projectId)) {
      projectMap.set(projectId, {
        project: { _id: record?.project?._id || null, name: projectName },
        departments: new Map()
      });
    }
    const projectGroup = projectMap.get(projectId);
    const departmentId = record?.department?._id ? String(record.department._id) : 'unassigned';
    const departmentName = record?.department?.name || 'Unassigned department';
    if (!projectGroup.departments.has(departmentId)) {
      projectGroup.departments.set(departmentId, {
        department: { _id: record?.department?._id || null, name: departmentName },
        employees: []
      });
    }
    projectGroup.departments.get(departmentId).employees.push(record);
  }

  return [...projectMap.values()]
    .map((group) => ({
      project: group.project,
      departments: [...group.departments.values()]
        .map((dept) => ({
          ...dept,
          employees: dept.employees.sort((a, b) => {
            const an = `${a.employee?.firstName || ''} ${a.employee?.lastName || ''}`.trim();
            const bn = `${b.employee?.firstName || ''} ${b.employee?.lastName || ''}`.trim();
            return an.localeCompare(bn);
          })
        }))
        .sort((a, b) => a.department.name.localeCompare(b.department.name))
    }))
    .sort((a, b) => a.project.name.localeCompare(b.project.name));
}

/** GET /api/kpi/worksheets/me?year=2026&month=3 */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const emp = await employeeFromUser(req.user);
    if (!emp) {
      return res.status(404).json({
        success: false,
        message:
          'No HR employee matches your login. Ask HR to link your user to your employee record (same email or employee ID).'
      });
    }

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
    if (!emp) {
      return res.status(404).json({
        success: false,
        message:
          'No HR employee matches your login. Ask HR to link your user to your employee record (same email or employee ID).'
      });
    }

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

/** GET /api/kpi/worksheets/submissions?year=&month=&projectId=&departmentId=&submittedOnly= */
router.get(
  '/submissions',
  asyncHandler(async (req, res) => {
    if (!(await canAccessKpiManagement(req.user, 'read'))) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view KPI submissions'
      });
    }

    const now = new Date();
    const year = Math.max(2000, parseInt(req.query.year, 10) || now.getFullYear());
    const month = Math.min(12, Math.max(1, parseInt(req.query.month, 10) || now.getMonth() + 1));
    const projectId = String(req.query.projectId || '').trim();
    const departmentId = String(req.query.departmentId || '').trim();
    const submittedOnly = String(req.query.submittedOnly || 'true').toLowerCase() !== 'false';
    const search = String(req.query.search || '').trim().toLowerCase();

    const empQuery = { isActive: true, isDeleted: { $ne: true } };
    if (projectId) empQuery.placementProject = projectId;
    if (departmentId) {
      empQuery.$or = [{ placementDepartment: departmentId }, { department: departmentId }];
    }

    const employees = await Employee.find(empQuery)
      .select('firstName lastName employeeId placementProject placementDepartment department')
      .populate('placementProject', 'name code')
      .populate('placementDepartment', 'name code')
      .populate('department', 'name code')
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    const worksheets = await KPIWorksheet.find({ year, month })
      .select('employee rows totalKPIScore totalWeight lastSavedAt updatedAt')
      .lean();
    const worksheetByEmployee = new Map(worksheets.map((ws) => [String(ws.employee), ws]));

    let records = employees.map((emp) => {
      const ws = worksheetByEmployee.get(String(emp._id));
      const rows = ws?.rows || [];
      const status = ws ? worksheetSubmissionStatus(rows) : 'not_started';
      const project = emp.placementProject || { _id: null, name: 'Unassigned project' };
      const department = emp.placementDepartment || emp.department || { _id: null, name: 'Unassigned department' };
      return {
        employee: {
          _id: emp._id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          employeeId: emp.employeeId
        },
        project: {
          _id: project?._id || null,
          name: project?.name || 'Unassigned project',
          code: project?.code || ''
        },
        department: {
          _id: department?._id || null,
          name: department?.name || 'Unassigned department',
          code: department?.code || ''
        },
        worksheetId: ws?._id || null,
        totalKPIScore: ws?.totalKPIScore ?? null,
        totalWeight: ws?.totalWeight ?? null,
        lastSavedAt: ws?.lastSavedAt || ws?.updatedAt || null,
        status
      };
    });

    const allRecords = records;

    if (submittedOnly) {
      records = records.filter((row) => row.status === 'submitted' || row.status === 'manager_reviewed');
    }

    if (search) {
      records = records.filter((row) => {
        const name = `${row.employee?.firstName || ''} ${row.employee?.lastName || ''}`.trim().toLowerCase();
        const employeeId = String(row.employee?.employeeId || '').toLowerCase();
        const projectName = String(row.project?.name || '').toLowerCase();
        const departmentName = String(row.department?.name || '').toLowerCase();
        return (
          name.includes(search) ||
          employeeId.includes(search) ||
          projectName.includes(search) ||
          departmentName.includes(search)
        );
      });
    }

    const summary = {
      totalEmployees: employees.length,
      shown: records.length,
      submitted: allRecords.filter((row) => row.status === 'submitted').length,
      managerReviewed: allRecords.filter((row) => row.status === 'manager_reviewed').length,
      draft: allRecords.filter((row) => row.status === 'draft').length,
      notStarted: allRecords.filter((row) => row.status === 'not_started').length
    };

    const [projects, departments] = await Promise.all([
      Project.find({}).select('name code').sort({ name: 1 }).lean(),
      Department.find({ isActive: true }).select('name code').sort({ name: 1 }).lean()
    ]);

    res.json({
      success: true,
      data: {
        year,
        month,
        summary,
        groups: groupSubmissionRecords(records),
        records,
        filterOptions: {
          projects,
          departments
        }
      }
    });
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
    const elevatedEditor = isHrAdmin(req.user?.role) || await canAccessKpiManagement(req.user, 'update');

    if (rows.length !== prevRows.length) {
      const canChangeStructure = flags.canEditStructure;
      const canDeleteAsReportingLine = flags.canDeleteRowsAsReportingLine;

      if (!elevatedEditor && !canChangeStructure && !canDeleteAsReportingLine) {
        return res.status(400).json({
          success: false,
          message: 'Only the employee (or HR) can add/remove KPI rows or change weights.'
        });
      }
      if (!elevatedEditor && canDeleteAsReportingLine && !canChangeStructure && rows.length > prevRows.length) {
        return res.status(400).json({
          success: false,
          message: 'Reporting line cannot add KPI rows or change weights.'
        });
      }
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

    const deleteErr = validateRowDeletions(prevRows, merged, flags);
    if (deleteErr && !elevatedEditor) {
      return res.status(400).json({ success: false, message: deleteErr });
    }

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
