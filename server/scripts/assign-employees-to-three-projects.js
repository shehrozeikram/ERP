/**
 * Assign all employees evenly across three sectors/projects:
 *   SGHQ, Usman Solar, Hamza Paper
 *
 * Usage:
 *   node server/scripts/assign-employees-to-three-projects.js --dry-run
 *   node server/scripts/assign-employees-to-three-projects.js --yes
 *   NODE_ENV=production node server/scripts/assign-employees-to-three-projects.js --yes
 */

const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '..', '..');
for (const f of ['.env', '.env.local']) {
  const p = path.join(repoRoot, f);
  if (fs.existsSync(p)) require('dotenv').config({ path: p, override: f === '.env.local' });
}
if (process.env.SGC_ENV_FILE) {
  const extra = path.isAbsolute(process.env.SGC_ENV_FILE)
    ? process.env.SGC_ENV_FILE
    : path.join(repoRoot, process.env.SGC_ENV_FILE);
  if (fs.existsSync(extra)) require('dotenv').config({ path: extra, override: true });
}

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const Employee = require('../models/hr/Employee');
const Project = require('../models/hr/Project');
const Sector = require('../models/hr/Sector');
const User = require('../models/User');

const GROUPS = [
  {
    label: 'SGHQ',
    projectNames: ['SGHQ', 'SGCHQ'],
    sectorNames: ['SGHQ', 'SGCHQ']
  },
  {
    label: 'Usman Solar',
    projectNames: ['Usman Solar', 'Usman Sollar', 'Usman Sollar '],
    sectorNames: ['Usman Solar', 'Usman Sollar']
  },
  {
    label: 'Hamza Paper',
    projectNames: ['Hamza Paper', '46 Hamza Paper', 'Hamza paper'],
    sectorNames: ['Hamza Paper', '46 Hamza Paper', 'Hamza paper']
  }
];

const splitIntoThree = (items) => {
  const total = items.length;
  const base = Math.floor(total / 3);
  const remainder = total % 3;
  const sizes = [base, base, base];
  for (let i = 0; i < remainder; i += 1) sizes[i] += 1;

  const groups = [];
  let index = 0;
  sizes.forEach((size) => {
    groups.push(items.slice(index, index + size));
    index += size;
  });
  return groups;
};

const findByNames = async (Model, names) => {
  for (const name of names) {
    const doc = await Model.findOne({
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (doc) return doc;
  }
  return null;
};

const ensureProject = async (group, actorId, { dryRun = false } = {}) => {
  let project = await findByNames(Project, group.projectNames);
  if (project) return project;
  if (dryRun) {
    return { _id: null, name: group.label, __dryRunMissing: true };
  }

  project = new Project({
    name: group.label,
    status: 'Active',
    client: 'Internal',
    description: `Auto-created for employee placement (${group.label})`,
    createdBy: actorId || undefined,
    projectManager: actorId || undefined
  });
  await project.save();
  return project;
};

const ensureSector = async (group, actorId, { dryRun = false } = {}) => {
  let sector = await findByNames(Sector, group.sectorNames);
  if (sector) return sector;
  if (dryRun) {
    return { _id: null, name: group.label, __dryRunMissing: true };
  }

  if (!actorId) {
    throw new Error('An admin user is required to create missing sectors.');
  }

  sector = new Sector({
    name: group.label,
    industry: 'General',
    description: `Auto-created for employee placement (${group.label})`,
    isActive: true,
    createdBy: actorId
  });
  await sector.save();
  return sector;
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const confirmed = process.argv.includes('--yes');

  if (!dryRun && !confirmed) {
    console.error('Refusing to run without --dry-run or --yes');
    process.exit(1);
  }

  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('No MongoDB URI. Set MONGODB_URI or MONGODB_URI_LOCAL.');
    process.exit(1);
  }

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));

  const actor =
    (await User.findOne({ role: 'super_admin' }).select('_id')) ||
    (await User.findOne({ role: 'admin' }).select('_id')) ||
    (await User.findOne().select('_id'));

  const employees = await Employee.find({ isDeleted: { $ne: true } })
    .select('_id employeeId firstName lastName placementProject placementSector')
    .sort({ employeeId: 1 })
    .lean();

  console.log(`Database: ${isLocal ? 'local' : 'production (MONGODB_URI)'}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);
  console.log(`Employees found: ${employees.length}`);

  if (!employees.length) {
    console.log('No employees to update.');
    await mongoose.disconnect();
    return;
  }

  const employeeGroups = splitIntoThree(employees);
  const assignments = [];

  for (let i = 0; i < GROUPS.length; i += 1) {
    const group = GROUPS[i];
    const project = await ensureProject(group, actor?._id, { dryRun });
    const sector = await ensureSector(group, actor?._id, { dryRun });
    const groupEmployees = employeeGroups[i] || [];

    assignments.push({
      group: group.label,
      projectId: project._id,
      projectName: project.name,
      sectorId: sector._id,
      sectorName: sector.name,
      employees: groupEmployees
    });

    console.log(`\n${group.label}`);
    console.log(`  Project: ${project.name} (${project._id})`);
    console.log(`  Sector:  ${sector.name} (${sector._id})`);
    console.log(`  Employees: ${groupEmployees.length}`);
    if (groupEmployees.length) {
      const first = groupEmployees[0];
      const last = groupEmployees[groupEmployees.length - 1];
      console.log(
        `  Range: ${first.employeeId || '—'} ${[first.firstName, first.lastName].filter(Boolean).join(' ')}`
        + ` → ${last.employeeId || '—'} ${[last.firstName, last.lastName].filter(Boolean).join(' ')}`
      );
    }
  }

  if (dryRun) {
    console.log('\nDry run complete. Re-run with --yes to apply changes.');
    await mongoose.disconnect();
    return;
  }

  const missingMasters = assignments.some((a) => !a.projectId || !a.sectorId);
  if (missingMasters) {
    throw new Error('Missing project/sector records. Run with --yes (not --dry-run) to create them.');
  }

  const bulkOps = [];
  assignments.forEach((assignment) => {
    assignment.employees.forEach((emp) => {
      bulkOps.push({
        updateOne: {
          filter: { _id: emp._id },
          update: {
            $set: {
              placementProject: assignment.projectId,
              placementSector: assignment.sectorId
            }
          }
        }
      });
    });
  });

  const result = await Employee.bulkWrite(bulkOps, { ordered: false });
  console.log('\nUpdated employees:', result.modifiedCount || 0);
  console.log('Matched employees:', result.matchedCount || 0);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
