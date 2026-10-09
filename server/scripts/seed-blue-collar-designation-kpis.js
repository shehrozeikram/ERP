/**
 * Upsert KPI templates for all blue-collar designations from
 * docs/All_Designation_KPI.docx (server/data/blueCollarDesignationKpis.json).
 *
 * Usage:
 *   node server/scripts/seed-blue-collar-designation-kpis.js
 */
const path = require('path');
const fsSync = require('fs');

const repoRoot = path.join(__dirname, '..', '..');
const envPath = path.join(repoRoot, '.env');
const localPath = path.join(repoRoot, '.env.local');
if (fsSync.existsSync(envPath)) require('dotenv').config({ path: envPath });
if (fsSync.existsSync(localPath)) require('dotenv').config({ path: localPath, override: true });

const { connectDB, disconnectDB } = require('../config/database');
const User = require('../models/User');
const Designation = require('../models/hr/Designation');
const KPITemplate = require('../models/hr/KPITemplate');
const {
  getCatalogEntries,
  catalogItemsToTemplateItems,
  normalizeTitle
} = require('../utils/blueCollarKpiCatalog');

async function resolveCreatedBy() {
  const admin = await User.findOne({
    $or: [
      { role: 'admin' },
      { role: 'super_admin' },
      { role: 'developer' },
      { email: /admin|developer/i }
    ]
  }).select('_id firstName lastName email');
  if (admin) return admin;
  return User.findOne({ isActive: true }).select('_id firstName lastName email');
}

async function findDesignationRef(designationTitle) {
  const needle = normalizeTitle(designationTitle);
  if (!needle) return null;
  const all = await Designation.find({ isActive: { $ne: false } }).select('_id title').lean();
  const exact = all.find((d) => normalizeTitle(d.title) === needle);
  if (exact) return exact._id;
  const partial = all.find((d) => {
    const t = normalizeTitle(d.title);
    return t.includes(needle) || needle.includes(t);
  });
  return partial?._id || null;
}

async function main() {
  await connectDB();
  const createdByUser = await resolveCreatedBy();
  if (!createdByUser) {
    throw new Error('No user found to set as createdBy for KPI templates');
  }
  console.log(`Using createdBy: ${createdByUser.email || createdByUser._id}`);

  const entries = getCatalogEntries();
  let upserted = 0;
  let linked = 0;

  for (const entry of entries) {
    const sourceKey = `blue_collar_desig_${entry.num}`;
    const items = catalogItemsToTemplateItems(entry);
    const designationRef = await findDesignationRef(entry.designation);
    if (designationRef) linked += 1;

    await KPITemplate.findOneAndUpdate(
      { sourceKey },
      {
        $set: {
          title: `Blue Collar – ${entry.designation}`,
          designation: entry.designation,
          designationRef: designationRef || null,
          employeeCategory: 'blue_collar',
          scoredBy: 'manager_only',
          description: `Default KPIs for ${entry.designation} (manager enters Actual; employee does not self-score).`,
          items,
          totalWeight: items.reduce((s, i) => s + (Number(i.weight) || 0), 0),
          isActive: true,
          sourceKey,
          createdBy: createdByUser._id
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    upserted += 1;
    console.log(`✓ ${entry.num}. ${entry.designation} (${items.length} KPIs)${designationRef ? ' [linked Designation]' : ''}`);
  }

  console.log(`\nDone. Upserted ${upserted} templates. Linked to Designation master: ${linked}/${upserted}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await disconnectDB(); } catch (_) { /* ignore */ }
  });
