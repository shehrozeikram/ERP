const KPIWorksheet = require('../models/hr/KPIWorksheet');
const Employee = require('../models/hr/Employee');
const {
  findCatalogEntryForTitle,
  worksheetRowsFromCatalogEntry
} = require('./blueCollarKpiCatalog');

function prevYearMonth(year, month) {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/**
 * Clone KPI names + weights only; reset counts for new month.
 */
function cloneRowsFromWorksheet(prev) {
  if (!prev?.rows?.length) return [];
  return prev.rows.map((r) => ({
    kpiArea: r.kpiArea || '',
    weight: Number(r.weight) || 0,
    employeeAchieved: 0,
    employeeTotalAssigned: 0,
    managerAchieved: 0,
    managerTotalAssigned: 0,
    achieved: 0,
    totalAssigned: 0,
    achievementPercent: 0,
    score1to5: 1,
    finalWeightage: 0
  }));
}

/**
 * Default rows for blue-collar employees from designation KPI catalog.
 */
async function rowsFromBlueCollarDesignation(employeeId) {
  const emp = await Employee.findById(employeeId)
    .select('employeeCategory position placementDesignation')
    .populate('placementDesignation', 'title')
    .lean();
  if (!emp) return [];

  const category = String(emp.employeeCategory || '').toLowerCase();
  // Prefer explicit blue_collar; also allow designation match when category unset
  const desigTitle = emp.placementDesignation?.title || emp.position || '';
  const entry = findCatalogEntryForTitle(desigTitle);
  if (!entry) return [];

  if (category && category !== 'blue_collar') {
    // White-collar should not auto-get these packs even if title loosely matches
    return [];
  }

  return worksheetRowsFromCatalogEntry(entry);
}

async function getOrCreateWorksheet(employeeId, year, month) {
  let doc = await KPIWorksheet.findOne({ employee: employeeId, year, month });
  if (doc) return doc;

  const { year: py, month: pm } = prevYearMonth(year, month);
  const prev = await KPIWorksheet.findOne({ employee: employeeId, year: py, month: pm }).lean();

  let rows = prev ? cloneRowsFromWorksheet(prev) : [];
  if (!rows.length) {
    rows = await rowsFromBlueCollarDesignation(employeeId);
  }

  doc = await KPIWorksheet.create({
    employee: employeeId,
    year,
    month,
    rows
  });
  return doc;
}

/**
 * Called by cron on 1st of month: ensure every active employee has a worksheet for (year, month).
 */
async function ensureWorksheetsForMonth(year, month) {
  const employees = await Employee.find({
    isActive: true,
    isDeleted: { $ne: true }
  })
    .select('_id')
    .lean();

  let created = 0;
  for (const e of employees) {
    const exists = await KPIWorksheet.findOne({ employee: e._id, year, month }).select('_id').lean();
    if (!exists) {
      await getOrCreateWorksheet(e._id, year, month);
      created += 1;
    }
  }
  return { employees: employees.length, created };
}

/**
 * Backfill empty current-month sheets for blue-collar employees from designation catalog.
 */
async function backfillEmptyBlueCollarWorksheets(year, month) {
  const employees = await Employee.find({
    isActive: true,
    isDeleted: { $ne: true },
    $or: [
      { employeeCategory: 'blue_collar' },
      { employeeCategory: { $exists: false } },
      { employeeCategory: null },
      { employeeCategory: '' }
    ]
  })
    .select('_id employeeCategory position placementDesignation')
    .populate('placementDesignation', 'title')
    .lean();

  let updated = 0;
  for (const emp of employees) {
    const desigTitle = emp.placementDesignation?.title || emp.position || '';
    const entry = findCatalogEntryForTitle(desigTitle);
    if (!entry) continue;

    const sheet = await KPIWorksheet.findOne({ employee: emp._id, year, month });
    if (!sheet) {
      await getOrCreateWorksheet(emp._id, year, month);
      updated += 1;
      continue;
    }
    if (Array.isArray(sheet.rows) && sheet.rows.length > 0) continue;

    sheet.rows = worksheetRowsFromCatalogEntry(entry);
    sheet.recomputeDerived?.();
    await sheet.save();
    updated += 1;
  }
  return { scanned: employees.length, updated };
}

module.exports = {
  getOrCreateWorksheet,
  ensureWorksheetsForMonth,
  prevYearMonth,
  cloneRowsFromWorksheet,
  rowsFromBlueCollarDesignation,
  backfillEmptyBlueCollarWorksheets
};
