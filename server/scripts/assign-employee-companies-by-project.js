/**
 * Set placementCompany on employees from their placementProject — ONLY placementCompany is updated.
 *
 * Usage:
 *   node server/scripts/assign-employee-companies-by-project.js --dry-run
 *   node server/scripts/assign-employee-companies-by-project.js --yes
 *   NODE_ENV=production node server/scripts/assign-employee-companies-by-project.js --dry-run
 *   NODE_ENV=production node server/scripts/assign-employee-companies-by-project.js --yes
 *   node server/scripts/assign-employee-companies-by-project.js --list-projects
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
const Company = require('../models/hr/Company');

/** Add more blocks here as you define other company ↔ project rules. */
const COMPANY_PROJECT_MAPPINGS = [
  {
    companyNames: ['SARDAR GROUP OF COMPANIES'],
    projectNames: [
      'SGC-Head Office',
      'SGC Head Office',
      'Commcraft',
      '22 Commcraft',
      'P . Personal',
      'P. Personal',
      'P Personal',
      'Sardar Prime Builders Pvt Ltd',
      'Sardar Prime Builders Pvt. Ltd',
      'Sardar Prime Builders',
      'SARDAR PRIME BUILDERS',
      'SGC-Remote Sites',
      'SGC Remote Sites',
      'political staff',
      'Political Staff'
    ]
  },
  {
    companyNames: ['HAMZA PAPER BRAIN (PVT)LTD'],
    projectNames: [
      'Hamza Paper Pvt Ltd',
      'Hamza Paper Pvt. Ltd',
      'Hamza Paper'
    ]
  },
  {
    companyNames: ['USMAN SOLAR (PVT)LTD'],
    projectNames: [
      'Usman Solar Pvt Ltd',
      'Usman Solar Pvt. Ltd',
      'Usman Solar'
    ]
  },
  {
    companyNames: ['CICON'],
    projectNames: [
      'CHIC - CICON',
      'CHIC-CICON',
      'CHIC CICON'
    ]
  },
  {
    companyNames: ['TIGES'],
    projectNames: ['TIGES']
  },
  {
    companyNames: ['ROYAL CRETE SOLUTIONS'],
    projectNames: [
      'Royal Creat Services',
      'Royal Crete Services',
      'Royal Crete Solutions'
    ]
  },
  {
    companyNames: ['TENACIOUS'],
    projectNames: [
      'Educational Secretariat',
      'The Tenacious Education System',
      'Tenacious Education System'
    ]
  },
  {
    companyNames: ['TAJ RESIDENCIA'],
    projectNames: [
      'TAJ RESIDENCIA I-14',
      'Taj Residencia I-14',
      'Taj Facilty Management',
      'Taj Facility Management',
      'Project Management Company'
    ]
  }
];

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findByExactName = async (Model, names) => {
  for (const name of names) {
    const trimmed = String(name || '').trim();
    if (!trimmed) continue;
    const doc = await Model.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') }
    });
    if (doc) return doc;
  }
  return null;
};

const resolveProjects = async (projectNames) => {
  const resolved = [];
  const missing = [];
  const seen = new Set();

  for (const name of projectNames) {
    const project = await findByExactName(Project, [name]);
    if (!project) {
      missing.push(name);
      continue;
    }
    const id = String(project._id);
    if (seen.has(id)) continue;
    seen.add(id);
    resolved.push(project);
  }

  return { resolved, missing };
};

const listAllProjects = async () => {
  const projects = await Project.find({}).sort({ name: 1 }).select('name projectId status');
  console.log(`\nAll projects (${projects.length}):\n`);
  projects.forEach((p, i) => {
    console.log(`${String(i + 1).padStart(3, ' ')}. ${p.name}  [${p.projectId || p._id}]  (${p.status || '—'})`);
  });
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const confirmed = process.argv.includes('--yes');
  const listProjects = process.argv.includes('--list-projects');

  if (!listProjects && !dryRun && !confirmed) {
    console.error('Pass --dry-run to preview, --yes to apply, or --list-projects to see project names.');
    process.exit(1);
  }

  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('Set MONGODB_URI (production) or MONGODB_URI_LOCAL (local dev).');
    process.exit(1);
  }

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));
  console.log(`Connected${isLocal ? ' [local]' : ' [production]'}`);

  if (listProjects) {
    await listAllProjects();
    await mongoose.disconnect();
    return;
  }

  const bulkOps = [];
  let totalWouldUpdate = 0;
  let totalAlreadyCorrect = 0;

  for (const mapping of COMPANY_PROJECT_MAPPINGS) {
    const company = await findByExactName(Company, mapping.companyNames);
    if (!company) {
      throw new Error(`Company not found: ${mapping.companyNames.join(' / ')}`);
    }

    const { resolved: projects, missing } = await resolveProjects(mapping.projectNames);
    const projectIds = projects.map((p) => p._id);

    console.log(`\n=== ${company.name} ===`);
    console.log(`Company ID: ${company._id}`);
    if (projects.length) {
      console.log('Matched projects:');
      projects.forEach((p) => console.log(`  • ${p.name} (${p._id})`));
    } else {
      console.log('Matched projects: (none)');
    }
    if (missing.length) {
      console.log('Project names not found in DB (skipped):');
      missing.forEach((n) => console.log(`  • ${n}`));
    }

    if (!projectIds.length) {
      console.log('No projects resolved — skipping this mapping.');
      continue;
    }

    const employees = await Employee.find({
      placementProject: { $in: projectIds }
    }).select('_id employeeId firstName lastName placementProject placementCompany');

    console.log(`Employees on these projects: ${employees.length}`);

    for (const emp of employees) {
      const currentCompanyId = emp.placementCompany ? String(emp.placementCompany) : '';
      const targetCompanyId = String(company._id);

      if (currentCompanyId === targetCompanyId) {
        totalAlreadyCorrect += 1;
        continue;
      }

      totalWouldUpdate += 1;
      bulkOps.push({
        updateOne: {
          filter: { _id: emp._id },
          update: { $set: { placementCompany: company._id } }
        }
      });
    }
  }

  // Employees with unmapped projects are left unchanged (informational only).
  console.log('\n--- Summary ---');
  console.log(`To update (placementCompany only): ${totalWouldUpdate}`);
  console.log(`Already correct company:          ${totalAlreadyCorrect}`);
  console.log(`Bulk operations queued:           ${bulkOps.length}`);

  if (dryRun) {
    console.log('\nDry run complete. Re-run with --yes to apply.');
    await mongoose.disconnect();
    return;
  }

  if (!bulkOps.length) {
    console.log('\nNothing to update.');
    await mongoose.disconnect();
    return;
  }

  const result = await Employee.bulkWrite(bulkOps, { ordered: false });
  console.log('\nApplied.');
  console.log(`Modified: ${result.modifiedCount || 0}`);
  console.log(`Matched:  ${result.matchedCount || 0}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
