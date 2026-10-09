/**
 * Import reporting lines + blue-collar category from:
 *   docs/SGC_ Emp_Reporting Line List.xlsx
 *
 * Also seeds designation KPI templates and backfills empty KPI sheets.
 *
 * Usage:
 *   node server/scripts/import-blue-collar-reporting-lines.js
 *   node server/scripts/import-blue-collar-reporting-lines.js --apply
 */
const path = require('path');
const fsSync = require('fs');

const repoRoot = path.join(__dirname, '..', '..');
let XLSX;
try {
  XLSX = require('xlsx');
} catch (_) {
  XLSX = require(path.join(repoRoot, 'node_modules', 'xlsx'));
}

const envPath = path.join(repoRoot, '.env');
const localPath = path.join(repoRoot, '.env.local');
if (fsSync.existsSync(envPath)) require('dotenv').config({ path: envPath });
if (fsSync.existsSync(localPath)) require('dotenv').config({ path: localPath, override: true });

const { connectDB, disconnectDB } = require('../config/database');
const Employee = require('../models/hr/Employee');
const Designation = require('../models/hr/Designation');
const User = require('../models/User');
const KPITemplate = require('../models/hr/KPITemplate');
const {
  getCatalogEntries,
  findCatalogEntryForTitle,
  catalogItemsToTemplateItems,
  normalizeTitle
} = require('../utils/blueCollarKpiCatalog');
const { backfillEmptyBlueCollarWorksheets } = require('../utils/kpiWorksheetService');

const APPLY = process.argv.includes('--apply');
const XLSX_PATH = path.join(repoRoot, 'docs', 'SGC_ Emp_Reporting Line List.xlsx');

const DESIGNATION_ALIASES = {
  masson: 'Mason',
  'saverage worker': 'Saverage Worker',
  'complaint attentdent': 'Complaint Attendant',
  'complaint attendant': null, // no pack — leave unmatched
  qari: null,
  technician: null,
  'ac technician': null,
  'web developer': null,
  'administrator it': null,
  intern: null,
  manager: null,
  supervisor: null,
  engineer: null,
  nursing: null
};

function normalizeEmpId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  if (!digits) return s;
  return digits.replace(/^0+/, '') || '0';
}

function padEmpIdVariants(raw) {
  const core = normalizeEmpId(raw);
  if (!core) return [];
  const variants = new Set([core, core.padStart(4, '0'), core.padStart(5, '0'), String(raw).trim()]);
  return [...variants].filter(Boolean);
}

function readExcelRows() {
  if (!fsSync.existsSync(XLSX_PATH)) {
    throw new Error(`File not found: ${XLSX_PATH}`);
  }
  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  // Row 0 title, row 1 headers, row 2 sub-headers, data from row 3
  const byNorm = new Map();
  for (let i = 3; i < aoa.length; i += 1) {
    const r = aoa[i] || [];
    const empId = String(r[1] || '').trim();
    if (!empId) continue;
    const row = {
      empId,
      name: String(r[2] || '').trim(),
      supervisorId: String(r[3] || '').trim(),
      supervisorName: String(r[4] || '').trim(),
      project: String(r[6] || '').trim(),
      department: String(r[7] || '').trim(),
      designation: String(r[8] || '').trim()
    };
    // Prefer zero-padded IDs when duplicates exist (file lists each person twice)
    const key = normalizeEmpId(empId);
    const prev = byNorm.get(key);
    if (!prev || String(empId).length >= String(prev.empId).length) {
      byNorm.set(key, row);
    }
  }
  return [...byNorm.values()];
}

function resolveCatalogDesignation(excelDesig) {
  const aliasKey = normalizeTitle(excelDesig);
  if (Object.prototype.hasOwnProperty.call(DESIGNATION_ALIASES, aliasKey)) {
    const mapped = DESIGNATION_ALIASES[aliasKey];
    if (!mapped) return null;
    return findCatalogEntryForTitle(mapped);
  }
  return findCatalogEntryForTitle(excelDesig);
}

async function buildEmployeeIndex() {
  const all = await Employee.find({ isDeleted: { $ne: true } })
    .select('_id employeeId firstName lastName reportingLine employeeCategory placementDesignation position')
    .lean();
  const byNormId = new Map();
  for (const e of all) {
    for (const v of padEmpIdVariants(e.employeeId)) {
      const n = normalizeEmpId(v);
      if (n && !byNormId.has(n)) byNormId.set(n, e);
    }
  }
  return { all, byNormId };
}

async function seedTemplates(createdBy) {
  const entries = getCatalogEntries();
  let upserted = 0;
  for (const entry of entries) {
    const sourceKey = `blue_collar_desig_${entry.num}`;
    const items = catalogItemsToTemplateItems(entry);
    const desig = await Designation.findOne({
      title: { $regex: new RegExp(`^${entry.designation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    }).select('_id').lean();
    await KPITemplate.findOneAndUpdate(
      { sourceKey },
      {
        $set: {
          title: `Blue Collar – ${entry.designation}`,
          designation: entry.designation,
          designationRef: desig?._id || null,
          employeeCategory: 'blue_collar',
          scoredBy: 'manager_only',
          description: `Default KPIs for ${entry.designation} (supervisor marks only).`,
          items,
          totalWeight: items.reduce((s, i) => s + (Number(i.weight) || 0), 0),
          isActive: true,
          sourceKey,
          createdBy
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    upserted += 1;
  }
  return upserted;
}

async function main() {
  await connectDB();
  const excelRows = readExcelRows();
  console.log(`Excel employees: ${excelRows.length}`);

  const { byNormId } = await buildEmployeeIndex();
  const stats = {
    matched: 0,
    missingEmployee: 0,
    missingSupervisor: 0,
    reportingUpdated: 0,
    categoryBlue: 0,
    categoryWhiteOrSkip: 0,
    noKpiPack: 0
  };
  const missingEmployees = [];
  const missingSupervisors = [];
  const noPack = [];

  const updates = [];

  for (const row of excelRows) {
    const emp = byNormId.get(normalizeEmpId(row.empId));
    if (!emp) {
      stats.missingEmployee += 1;
      missingEmployees.push(`${row.empId} ${row.name}`);
      continue;
    }
    stats.matched += 1;

    let supervisor = null;
    if (row.supervisorId) {
      supervisor = byNormId.get(normalizeEmpId(row.supervisorId));
      if (!supervisor) {
        stats.missingSupervisor += 1;
        missingSupervisors.push(`${row.supervisorId} ${row.supervisorName} (for ${row.empId})`);
      }
    }

    const pack = resolveCatalogDesignation(row.designation);
    const set = {};
    if (supervisor && String(emp.reportingLine || '') !== String(supervisor._id)) {
      set.reportingLine = supervisor._id;
      stats.reportingUpdated += 1;
    }
    if (pack) {
      if (emp.employeeCategory !== 'blue_collar') {
        set.employeeCategory = 'blue_collar';
      }
      stats.categoryBlue += 1;
    } else {
      stats.noKpiPack += 1;
      noPack.push(`${row.empId} ${row.name} [${row.designation}]`);
      // Do not force white_collar — leave as-is unless already set
      stats.categoryWhiteOrSkip += 1;
    }

    if (Object.keys(set).length) {
      updates.push({ _id: emp._id, set, empId: row.empId, name: row.name });
    }
  }

  console.log('\n--- Dry-run summary ---');
  console.log(JSON.stringify(stats, null, 2));
  if (missingEmployees.length) {
    console.log(`\nMissing employees (${missingEmployees.length}):`);
    missingEmployees.slice(0, 20).forEach((x) => console.log('  ', x));
  }
  if (missingSupervisors.length) {
    console.log(`\nMissing supervisors (${[...new Set(missingSupervisors)].length} unique mentions):`);
    [...new Set(missingSupervisors)].slice(0, 20).forEach((x) => console.log('  ', x));
  }
  if (noPack.length) {
    console.log(`\nNo blue-collar KPI pack (${noPack.length}):`);
    noPack.slice(0, 25).forEach((x) => console.log('  ', x));
  }
  console.log(`\nPending employee updates: ${updates.length}`);

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write reporting lines + categories, seed templates, backfill sheets.');
    return;
  }

  const admin = await User.findOne({
    $or: [{ role: 'admin' }, { role: 'super_admin' }, { role: 'developer' }]
  }).select('_id');
  if (!admin) throw new Error('No admin user for template createdBy');

  const seeded = await seedTemplates(admin._id);
  console.log(`Seeded/upserted KPI templates: ${seeded}`);

  let written = 0;
  for (const u of updates) {
    await Employee.updateOne({ _id: u._id }, { $set: u.set });
    written += 1;
  }
  console.log(`Employee updates written: ${written}`);

  const now = new Date();
  const backfill = await backfillEmptyBlueCollarWorksheets(now.getFullYear(), now.getMonth() + 1);
  console.log('Backfill empty blue-collar sheets:', backfill);
  console.log('\nApply complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await disconnectDB(); } catch (_) { /* ignore */ }
  });
