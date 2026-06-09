/**
 * DESTRUCTIVE (development / local only): Remove Monthly Payroll Summary data for one month.
 *
 * Deletes:
 *   - Payroll records (employee monthly payroll rows shown in HR → Payroll → Monthly Summary)
 *   - PayrollMonthlyApproval (authority approvals for that month)
 *   - Payslip records for the same month/year (if any were saved)
 *
 * Does NOT delete: employees, salary master, tax settings, loans, or other HR modules.
 * Does NOT revert employee arrears marked "Paid" when payroll was generated — fix those manually if needed.
 *
 * Refuses when:
 *   - NODE_ENV is production
 *   - MONGODB_URI_LOCAL is missing or does not point at localhost / 127.0.0.1 / ::1
 *
 * Usage (repo root):
 *   node scripts/clean-monthly-payroll-dev-only.js --month 6 --year 2026 --dry-run
 *   node scripts/clean-monthly-payroll-dev-only.js --month 6 --year 2026 --yes
 *   npm run clean:monthly-payroll-dev -- --month 6 --year 2026 --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const mongoose = require('mongoose');

const root = path.join(__dirname, '..');

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function parseArgs() {
  const get = (flag) => {
    const index = process.argv.indexOf(flag);
    return index >= 0 ? process.argv[index + 1] : null;
  };

  const month = Number(get('--month'));
  const year = Number(get('--year'));
  const dryRun = process.argv.includes('--dry-run');
  const confirmed = process.argv.includes('--yes');

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    console.error('Missing or invalid --month (1–12). Example: --month 6');
    process.exit(1);
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    console.error('Missing or invalid --year. Example: --year 2026');
    process.exit(1);
  }

  if (!dryRun && !confirmed) {
    console.error(
      'Refusing to run without --yes (or use --dry-run to preview counts).\n' +
        'Example: node scripts/clean-monthly-payroll-dev-only.js --month 6 --year 2026 --yes'
    );
    process.exit(1);
  }

  return { month, year, dryRun, confirmed };
}

function assertDevelopmentEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run: NODE_ENV is production.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI_LOCAL;
  if (!uri) {
    console.error('Set MONGODB_URI_LOCAL in .env (local development database only).');
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

  return uri;
}

async function countOrDelete(Model, filter, label, dryRun) {
  const count = await Model.countDocuments(filter);
  if (dryRun) {
    return { label, deleted: count, dryRun: true };
  }
  const result = await Model.deleteMany(filter);
  return { label, deleted: result.deletedCount, dryRun: false };
}

async function main() {
  const { month, year, dryRun } = parseArgs();
  const uri = assertDevelopmentEnvironment();

  const periodLabel = `${MONTH_NAMES[month]} ${year}`;

  console.log(
    dryRun
      ? `DRY RUN — no data will be deleted for ${periodLabel}`
      : `LIVE DELETE — Monthly Payroll Summary for ${periodLabel}`
  );
  console.log('Connecting:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const dbName = mongoose.connection.db.databaseName;
  console.log(`Database: ${dbName} @ ${mongoose.connection.host}\n`);

  const Payroll = require(path.join(root, 'server/models/hr/Payroll'));
  const PayrollMonthlyApproval = require(path.join(root, 'server/models/hr/PayrollMonthlyApproval'));
  const Payslip = require(path.join(root, 'server/models/hr/Payslip'));

  const periodFilter = { month, year };
  const summary = [];

  for (const [Model, label] of [
    [Payroll, 'Payroll'],
    [PayrollMonthlyApproval, 'PayrollMonthlyApproval'],
    [Payslip, 'Payslip']
  ]) {
    try {
      const result = await countOrDelete(Model, periodFilter, label, dryRun);
      summary.push(result);
      console.log(
        `  ${label}: ${dryRun ? 'would delete' : 'deleted'} ${result.deleted} record(s)`
      );
    } catch (error) {
      summary.push({ label, deleted: 0, error: error.message });
      console.error(`  ${label}: FAILED`, error.message);
    }
  }

  await mongoose.connection.close();

  console.log('\nDone.');
  console.log(JSON.stringify(summary, null, 2));
  console.log(
    '\nPreserved: employees, salary/allowance master, payroll tax settings, loans, and all other modules.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
