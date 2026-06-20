/**
 * DESTRUCTIVE (development / local only): Remove Monthly Payroll Summary data.
 *
 * Deletes:
 *   - Payroll records (employee monthly payroll rows shown in HR → Payroll → Monthly Summary)
 *   - PayrollMonthlyApproval (authority approvals)
 *   - PayrollMonthlyComparisonReport (saved comparison reports)
 *   - Payslip records (if any were saved)
 *
 * By default removes ALL months/years. Pass --month and --year together to limit to one period.
 *
 * Does NOT delete: employees, salary master, tax settings, loans, or other HR modules.
 * Does NOT revert employee arrears marked "Paid" when payroll was generated — fix those manually if needed.
 *
 * Refuses when:
 *   - NODE_ENV is production
 *   - MONGODB_URI_LOCAL is missing or does not point at localhost / 127.0.0.1 / ::1
 *
 * Usage (repo root):
 *   npm run clean:monthly-payroll-dev -- --dry-run
 *   npm run clean:monthly-payroll-dev -- --yes
 *   npm run clean:monthly-payroll-dev -- --month 6 --year 2026 --dry-run
 *   npm run clean:monthly-payroll-dev -- --month 6 --year 2026 --yes
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

  const hasMonth = process.argv.includes('--month');
  const hasYear = process.argv.includes('--year');
  const monthRaw = get('--month');
  const yearRaw = get('--year');
  const dryRun = process.argv.includes('--dry-run');
  const confirmed = process.argv.includes('--yes');

  if (hasMonth !== hasYear) {
    console.error('Pass both --month and --year together, or omit both to clean all periods.');
    process.exit(1);
  }

  let month = null;
  let year = null;
  let allPeriods = true;

  if (hasMonth && hasYear) {
    month = Number(monthRaw);
    year = Number(yearRaw);
    allPeriods = false;

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      console.error('Invalid --month (1–12). Example: --month 6');
      process.exit(1);
    }

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      console.error('Invalid --year. Example: --year 2026');
      process.exit(1);
    }
  }

  if (!dryRun && !confirmed) {
    console.error(
      'Refusing to run without --yes (or use --dry-run to preview counts).\n' +
        'Example: npm run clean:monthly-payroll-dev -- --yes'
    );
    process.exit(1);
  }

  return { month, year, allPeriods, dryRun, confirmed };
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
  const { month, year, allPeriods, dryRun } = parseArgs();
  const uri = assertDevelopmentEnvironment();

  const scopeLabel = allPeriods
    ? 'all months'
    : `${MONTH_NAMES[month]} ${year}`;

  console.log(
    dryRun
      ? `DRY RUN — no data will be deleted for ${scopeLabel}`
      : `LIVE DELETE — Monthly Payroll Summary for ${scopeLabel}`
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
  const PayrollMonthlyComparisonReport = require(path.join(root, 'server/models/hr/PayrollMonthlyComparisonReport'));
  const Payslip = require(path.join(root, 'server/models/hr/Payslip'));

  const periodFilter = allPeriods ? {} : { month, year };
  const summary = [];

  for (const [Model, label] of [
    [Payroll, 'Payroll'],
    [PayrollMonthlyApproval, 'PayrollMonthlyApproval'],
    [PayrollMonthlyComparisonReport, 'PayrollMonthlyComparisonReport'],
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
