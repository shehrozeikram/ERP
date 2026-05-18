/**
 * DESTRUCTIVE (local only): Deletes Admin workflow records and Audit module data from MONGODB_URI_LOCAL.
 *
 * Admin: utility bills, payment settlements, rental management, rental agreements, petty cash.
 * Audit: pre-audit queue, audits, findings, schedules, checklists, trail, corrective actions.
 * Also removes related in-app notifications and activity logs for those modules.
 *
 * Does NOT delete: users, roles, procurement, finance, HR, or other modules.
 *
 * Refuses when:
 *   - NODE_ENV is production
 *   - MONGODB_URI_LOCAL is missing or does not point at localhost / 127.0.0.1 / ::1
 *
 * Usage (repo root):
 *   node scripts/clean-admin-audit-local-only.js --yes
 *   node scripts/clean-admin-audit-local-only.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const path = require('path');

const root = path.join(__dirname, '..');

function loadModels() {
  return {
    // Admin workflow / admin submodules (delete dependents first)
    PettyCashExpense: require(path.join(root, 'server/models/hr/PettyCashExpense')),
    PettyCashFund: require(path.join(root, 'server/models/hr/PettyCashFund')),
    UtilityBill: require(path.join(root, 'server/models/hr/UtilityBill')),
    PaymentSettlement: require(path.join(root, 'server/models/hr/PaymentSettlement')),
    RentalManagement: require(path.join(root, 'server/models/hr/RentalManagement')),
    RentalAgreement: require(path.join(root, 'server/models/hr/RentalAgreement')),
    // Audit (delete dependents first)
    CorrectiveAction: require(path.join(root, 'server/models/audit/CorrectiveAction')),
    AuditFinding: require(path.join(root, 'server/models/audit/AuditFinding')),
    AuditSchedule: require(path.join(root, 'server/models/audit/AuditSchedule')),
    Audit: require(path.join(root, 'server/models/audit/Audit')),
    AuditChecklist: require(path.join(root, 'server/models/audit/AuditChecklist')),
    AuditTrail: require(path.join(root, 'server/models/audit/AuditTrail')),
    PreAudit: require(path.join(root, 'server/models/audit/PreAudit')),
    Notification: require(path.join(root, 'server/models/hr/Notification')),
    UserActivityLog: require(path.join(root, 'server/models/general/UserActivityLog'))
  };
}

/** Collections wiped in order (respects typical FK / dependency chains). */
const DELETE_ORDER = [
  'PettyCashExpense',
  'PettyCashFund',
  'UtilityBill',
  'PaymentSettlement',
  'RentalManagement',
  'RentalAgreement',
  'CorrectiveAction',
  'AuditFinding',
  'AuditSchedule',
  'Audit',
  'AuditChecklist',
  'AuditTrail',
  'PreAudit'
];

const ADMIN_ACTIVITY_MODULES = [
  'Admin',
  'Utility Bills',
  'Rental Agreements',
  'Rental Management',
  'Payment Settlements',
  'Petty Cash'
];

const activityLogFilter = {
  $or: [
    { module: { $regex: /^Admin/i } },
    { module: { $regex: /^Audit/i } },
    { module: { $in: ADMIN_ACTIVITY_MODULES } },
    { endpoint: /utility-bills|payment-settlements|rental-management|rental-agreements|petty-cash|pre-audit|\/audit\//i }
  ]
};

const notificationFilter = {
  $or: [
    { 'metadata.module': 'audit' },
    { actionUrl: /\/audit\//i },
    { actionUrl: /pre-audit/i },
    { actionUrl: /utility-bills|payment-settlement|rental-management|rental-agreement|petty-cash/i }
  ]
};

async function deleteAll(Model, label, dryRun) {
  if (!Model || typeof Model.deleteMany !== 'function') {
    return { key: label, deleted: 0, error: 'model missing' };
  }
  if (dryRun) {
    const count = await Model.countDocuments({});
    return { key: label, deleted: count, dryRun: true };
  }
  const res = await Model.deleteMany({});
  return { key: label, deleted: res.deletedCount };
}

async function deleteFiltered(Model, label, filter, dryRun) {
  if (!Model || typeof Model.deleteMany !== 'function') {
    return { key: label, deleted: 0, error: 'model missing' };
  }
  if (dryRun) {
    const count = await Model.countDocuments(filter);
    return { key: label, deleted: count, dryRun: true };
  }
  const res = await Model.deleteMany(filter);
  return { key: label, deleted: res.deletedCount };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const confirmed = process.argv.includes('--yes');

  if (!dryRun && !confirmed) {
    console.error(
      'Refusing to run without --yes (or use --dry-run to preview counts).\n' +
        'Example: node scripts/clean-admin-audit-local-only.js --yes'
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run: NODE_ENV is production.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI_LOCAL;
  if (!uri) {
    console.error('Set MONGODB_URI_LOCAL in .env (local database only).');
    process.exit(1);
  }

  const isLocalMongo =
    uri.includes('localhost') || uri.includes('127.0.0.1') || uri.includes('::1');
  if (!isLocalMongo) {
    console.error(
      'Refusing to run: MONGODB_URI_LOCAL does not look local (must contain localhost/127.0.0.1/::1).'
    );
    process.exit(1);
  }

  console.log(dryRun ? 'DRY RUN — no data will be deleted' : 'LIVE DELETE — admin + audit data');
  console.log('Connecting:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const dbName = mongoose.connection.db.databaseName;
  console.log(`Database: ${dbName} @ ${mongoose.connection.host}\n`);

  const models = loadModels();
  const summary = [];

  for (const key of DELETE_ORDER) {
    try {
      const result = await deleteAll(models[key], key, dryRun);
      summary.push(result);
      console.log(`  ${key}: ${dryRun ? 'would delete' : 'deleted'} ${result.deleted}`);
    } catch (error) {
      summary.push({ key, deleted: 0, error: error.message });
      console.error(`  ${key}: FAILED`, error.message);
    }
  }

  for (const [key, filter] of [
    ['Notification (admin/audit)', notificationFilter],
    ['UserActivityLog (admin/audit)', activityLogFilter]
  ]) {
    try {
      const Model = key.startsWith('Notification') ? models.Notification : models.UserActivityLog;
      const result = await deleteFiltered(Model, key, filter, dryRun);
      summary.push(result);
      console.log(`  ${key}: ${dryRun ? 'would delete' : 'deleted'} ${result.deleted}`);
    } catch (error) {
      summary.push({ key, deleted: 0, error: error.message });
      console.error(`  ${key}: FAILED`, error.message);
    }
  }

  await mongoose.connection.close();

  console.log('\nDone.');
  console.log(JSON.stringify(summary, null, 2));
  console.log(
    '\nPreserved: users, roles, procurement, finance, HR, and all other modules.\n' +
      'Upload files under server/uploads/pre-audit (and bill attachments) are NOT removed by this script.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
