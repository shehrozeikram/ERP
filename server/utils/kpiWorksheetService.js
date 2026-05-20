const KPIWorksheet = require('../models/hr/KPIWorksheet');
const Employee = require('../models/hr/Employee');

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

async function getOrCreateWorksheet(employeeId, year, month) {
  let doc = await KPIWorksheet.findOne({ employee: employeeId, year, month });
  if (doc) return doc;

  const { year: py, month: pm } = prevYearMonth(year, month);
  const prev = await KPIWorksheet.findOne({ employee: employeeId, year: py, month: pm }).lean();

  const rows = prev ? cloneRowsFromWorksheet(prev) : [];

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

module.exports = {
  getOrCreateWorksheet,
  ensureWorksheetsForMonth,
  prevYearMonth,
  cloneRowsFromWorksheet
};
