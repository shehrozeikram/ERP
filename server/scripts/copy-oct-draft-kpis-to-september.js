/**
 * Copy October DRAFT KPI worksheets into September (same year).
 *
 * Draft = worksheet has KPI rows, but no employee marks and no manager marks
 * (same rules as KPI Submissions Overview for white-collar; blue-collar without
 * manager marks is also treated as draft for this migration).
 *
 * For each October draft:
 *   - If September sheet missing → create with same rows
 *   - If September sheet empty (no rows) → fill with October rows
 *   - If September already has rows → skip (do not overwrite)
 *
 * Usage (on droplet / with production MONGODB_URI):
 *   NODE_ENV=production node server/scripts/copy-oct-draft-kpis-to-september.js
 *   NODE_ENV=production node server/scripts/copy-oct-draft-kpis-to-september.js --apply
 *   NODE_ENV=production YEAR=2026 node server/scripts/copy-oct-draft-kpis-to-september.js --apply
 */

const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '../..');
const envPath = path.join(repoRoot, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const KPIWorksheet = require('../models/hr/KPIWorksheet');
const Employee = require('../models/hr/Employee');

const APPLY = process.argv.includes('--apply');
const YEAR = Number(process.env.YEAR || 2026);
const SOURCE_MONTH = 10; // October
const TARGET_MONTH = 9; // September

function hasManagerMarks(rows) {
  return (rows || []).some((row) => {
    const mT = Number(row?.managerTotalAssigned) || 0;
    const mA = Number(row?.managerAchieved) || 0;
    return mT > 0 || mA > 0;
  });
}

function hasEmployeeMarks(rows) {
  return (rows || []).some((row) => {
    const eT = Number(row?.employeeTotalAssigned) || 0;
    if (eT > 0) return true;
    const legacyT = Number(row?.totalAssigned) || 0;
    return legacyT > 0;
  });
}

/** Draft for migration: has KPI rows, no employee or manager marks. */
function isDraftWorksheet(doc) {
  const rows = doc?.rows || [];
  if (!rows.length) return false;
  if (hasManagerMarks(rows)) return false;
  if (hasEmployeeMarks(rows)) return false;
  return true;
}

function cloneRows(rows) {
  return (rows || []).map((r) => ({
    kpiArea: r.kpiArea || '',
    weight: Number(r.weight) || 0,
    employeeAchieved: Number(r.employeeAchieved) || 0,
    employeeTotalAssigned: Number(r.employeeTotalAssigned) || 0,
    managerAchieved: Number(r.managerAchieved) || 0,
    managerTotalAssigned: Number(r.managerTotalAssigned) || 0,
    achieved: Number(r.achieved) || 0,
    totalAssigned: Number(r.totalAssigned) || 0,
    achievementPercent: Number(r.achievementPercent) || 0,
    score1to5: Number(r.score1to5) || 1,
    finalWeightage: Number(r.finalWeightage) || 0
  }));
}

async function main() {
  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('No MONGODB_URI resolved');
    process.exit(1);
  }

  console.log('');
  console.log('=== Copy October draft KPIs → September ===');
  console.log(`Year: ${YEAR} | source month: ${SOURCE_MONTH} | target month: ${TARGET_MONTH}`);
  console.log(`Mode: ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'}`);
  console.log(`URI host: ${uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@').split('?')[0]}`);
  console.log('');

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));

  const octoberSheets = await KPIWorksheet.find({ year: YEAR, month: SOURCE_MONTH }).lean();
  const drafts = octoberSheets.filter(isDraftWorksheet);

  console.log(`October worksheets total: ${octoberSheets.length}`);
  console.log(`October drafts (rows, no marks): ${drafts.length}`);

  const stats = {
    created: 0,
    filledEmpty: 0,
    skippedExisting: 0,
    errors: 0
  };
  const details = [];

  for (const oct of drafts) {
    const empId = oct.employee;
    const emp = await Employee.findById(empId).select('firstName lastName employeeId').lean();
    const label = emp
      ? `${emp.employeeId || ''} ${emp.firstName || ''} ${emp.lastName || ''}`.trim()
      : String(empId);

    try {
      const sep = await KPIWorksheet.findOne({ employee: empId, year: YEAR, month: TARGET_MONTH });
      const rows = cloneRows(oct.rows);

      if (!sep) {
        details.push({ action: 'create', employee: label, rows: rows.length });
        if (APPLY) {
          const doc = new KPIWorksheet({
            employee: empId,
            year: YEAR,
            month: TARGET_MONTH,
            rows,
            lastSavedBy: oct.lastSavedBy || undefined,
            lastSavedAt: oct.lastSavedAt || undefined
          });
          await doc.save();
        }
        stats.created += 1;
        continue;
      }

      if (!(sep.rows || []).length) {
        details.push({ action: 'fill_empty', employee: label, rows: rows.length, sepId: String(sep._id) });
        if (APPLY) {
          sep.rows = rows;
          if (oct.lastSavedBy) sep.lastSavedBy = oct.lastSavedBy;
          if (oct.lastSavedAt) sep.lastSavedAt = oct.lastSavedAt;
          await sep.save();
        }
        stats.filledEmpty += 1;
        continue;
      }

      details.push({
        action: 'skip_existing',
        employee: label,
        sepRows: (sep.rows || []).length
      });
      stats.skippedExisting += 1;
    } catch (err) {
      stats.errors += 1;
      details.push({ action: 'error', employee: label, message: err.message });
      console.error(`Error for ${label}:`, err.message);
    }
  }

  console.log('');
  console.log('--- Summary ---');
  console.log(JSON.stringify(stats, null, 2));
  console.log('');
  console.log(`Sample actions (up to 25 of ${details.length}):`);
  console.log(JSON.stringify(details.slice(0, 25), null, 2));

  if (!APPLY) {
    console.log('');
    console.log('Dry-run only. Re-run with --apply to write September worksheets.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
