/**
 * Remap existing NonEmployeeRecord.employees lines to memo columns
 * (same collection — does NOT create a new table).
 *
 * Usage (from repo root):
 *   node server/scripts/migrate-non-employees.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const NonEmployeeRecord = require('../models/hr/NonEmployeeRecord');

async function main() {
  const uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sgc_erp_local';
  await mongoose.connect(uri);
  console.log('Connected:', mongoose.connection.name);

  const records = await NonEmployeeRecord.find();
  let migrated = 0;

  for (const record of records) {
    let lines = Array.isArray(record.employees) ? record.employees : [];

    // Legacy flat document → employees[]
    if (lines.length === 0 && (record.firstName || record.name || record.cnic)) {
      lines = [record];
    }

    if (lines.length === 0) continue;

    const normalized = lines.map((e) => NonEmployeeRecord.normalizeEmployeeLine(e));
    const needsSave = normalized.some((n, i) => {
      const prev = lines[i] || {};
      return (
        n.name !== (prev.name || [prev.firstName, prev.lastName].filter(Boolean).join(' ').trim())
        || n.designation !== (prev.designation || prev.role || '')
        || Number(n.currentPackageMonthly || 0) !== Number(prev.currentPackageMonthly ?? prev.expectedWages ?? 0)
        || (n.remark || '') !== (prev.remark || prev.justification || '')
        || (n.departmentSubject || '') !== (prev.departmentSubject || '')
        || (n.project || '') !== (prev.project || '')
        || (n.location || '') !== (prev.location || '')
      );
    });

    if (!needsSave && Array.isArray(record.employees) && record.employees.length > 0) continue;

    record.employees = normalized;
    await record.save();
    migrated += 1;
  }

  console.log(`Migrated ${migrated} of ${records.length} NonEmployeeRecord document(s).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
  process.exit(1);
});
