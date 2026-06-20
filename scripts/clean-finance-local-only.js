/**
 * DESTRUCTIVE (local only): Deletes Finance module transactional data from MONGODB_URI_LOCAL.
 *
 * Refuses when:
 *   - NODE_ENV is production
 *   - MONGODB_URI_LOCAL is missing or does not point at localhost / 127.0.0.1 / ::1
 *
 * Also clears Payroll — Finance data (payment applications, bank letters) and
 * resets HR payroll rows marked Paid back to AVP-approved (pending finance payment).
 *
 * By default keeps Chart of Accounts (Account collection). To remove accounts too:
 *   node scripts/clean-finance-local-only.js --yes --include-accounts
 *
 * Usage:
 *   node scripts/clean-finance-local-only.js --yes
 *   npm run clean:finance-local
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const path = require('path');

const root = path.join(__dirname, '..');

function loadModels() {
  return {
    Account: require(path.join(root, 'server/models/finance/Account')),
    AccountsPayable: require(path.join(root, 'server/models/finance/AccountsPayable')),
    AccountsReceivable: require(path.join(root, 'server/models/finance/AccountsReceivable')),
    Banking: require(path.join(root, 'server/models/finance/Banking')),
    Budget: require(path.join(root, 'server/models/finance/Budget')),
    ConversationRead: require(path.join(root, 'server/models/finance/ConversationRead')),
    DeferredEntry: require(path.join(root, 'server/models/finance/DeferredEntry')),
    FinanceJournal: require(path.join(root, 'server/models/finance/FinanceJournal')),
    FiscalPeriod: require(path.join(root, 'server/models/finance/FiscalPeriod')),
    FixedAsset: require(path.join(root, 'server/models/finance/FixedAsset')),
    GeneralLedger: require(path.join(root, 'server/models/finance/GeneralLedger')),
    JournalEntry: require(path.join(root, 'server/models/finance/JournalEntry')),
    PaymentTerm: require(path.join(root, 'server/models/finance/PaymentTerm')),
    PayrollBankLetter: require(path.join(root, 'server/models/finance/PayrollBankLetter')),
    PayrollPeriodPaymentApplication: require(path.join(root, 'server/models/finance/PayrollPeriodPaymentApplication')),
    RecurringJournal: require(path.join(root, 'server/models/finance/RecurringJournal')),
    RecoveryAssignment: require(path.join(root, 'server/models/finance/RecoveryAssignment')),
    RecoveryCampaign: require(path.join(root, 'server/models/finance/RecoveryCampaign')),
    RecoveryMember: require(path.join(root, 'server/models/finance/RecoveryMember')),
    RecoveryTask: require(path.join(root, 'server/models/finance/RecoveryTask')),
    RecoveryTaskAssignmentRule: require(path.join(root, 'server/models/finance/RecoveryTaskAssignmentRule')),
    Tax: require(path.join(root, 'server/models/finance/Tax')),
    VendorAdvance: require(path.join(root, 'server/models/finance/VendorAdvance')),
    WhatsAppIncomingMessage: require(path.join(root, 'server/models/finance/WhatsAppIncomingMessage')),
    WhatsAppOutgoingMessage: require(path.join(root, 'server/models/finance/WhatsAppOutgoingMessage'))
  };
}

/** Same ordering as clean-finance-procurement-keep-masters.js (finance slice). */
const DELETE_ORDER = [
  'PayrollBankLetter',
  'PayrollPeriodPaymentApplication',
  'GeneralLedger',
  'JournalEntry',
  'AccountsPayable',
  'AccountsReceivable',
  'VendorAdvance',
  'Banking',
  'DeferredEntry',
  'Budget',
  'RecurringJournal',
  'FinanceJournal',
  'FiscalPeriod',
  'PaymentTerm',
  'Tax',
  'FixedAsset',
  'RecoveryAssignment',
  'RecoveryTask',
  'RecoveryTaskAssignmentRule',
  'RecoveryCampaign',
  'RecoveryMember',
  'ConversationRead',
  'WhatsAppIncomingMessage',
  'WhatsAppOutgoingMessage'
];

async function resetFinancePayrollStatuses() {
  const Payroll = require(path.join(root, 'server/models/hr/Payroll'));
  try {
    const res = await Payroll.updateMany(
      { status: 'Paid' },
      {
        $set: { status: 'Approved by AVP' },
        $unset: { paymentMethod: '', paymentDate: '' }
      }
    );
    const modified = res.modifiedCount ?? res.nModified ?? 0;
    summaryLine('Payroll (reset Paid → Approved by AVP)', modified);
    return { key: 'PayrollPaidReset', modified };
  } catch (error) {
    summaryLine('Payroll (reset Paid → Approved by AVP)', 0, error.message);
    return { key: 'PayrollPaidReset', modified: 0, error: error.message };
  }
}

function summaryLine(label, count, error) {
  if (error) {
    console.error(`  ${label}: FAILED`, error);
  } else {
    console.log(`  ${label}: ${count}`);
  }
}

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error(
      'Refusing to run without --yes. This permanently deletes data.\n' +
        'Example: node scripts/clean-finance-local-only.js --yes'
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

  const includeAccounts = process.argv.includes('--include-accounts');

  console.log('Connecting:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const models = loadModels();
  const summary = [];

  summary.push(await resetFinancePayrollStatuses());

  for (const key of DELETE_ORDER) {
    const Model = models[key];
    if (!Model || typeof Model.deleteMany !== 'function') {
      summary.push({ key, deleted: 0, error: 'model missing' });
      continue;
    }
    try {
      const res = await Model.deleteMany({});
      summary.push({ key, deleted: res.deletedCount });
      console.log(`  ${key}: deleted ${res.deletedCount}`);
    } catch (error) {
      summary.push({ key, deleted: 0, error: error.message });
      console.error(`  ${key}: FAILED`, error.message);
    }
  }

  if (includeAccounts) {
    try {
      const res = await models.Account.deleteMany({});
      summary.push({ key: 'Account', deleted: res.deletedCount });
      console.log(`  Account: deleted ${res.deletedCount}`);
    } catch (error) {
      summary.push({ key: 'Account', deleted: 0, error: error.message });
      console.error('  Account: FAILED', error.message);
    }
  } else {
    console.log('  Account: preserved (pass --include-accounts to delete Chart of Accounts)');
  }

  await mongoose.connection.close();
  console.log('\nDone. Summary:', JSON.stringify(summary, null, 2));
  if (!includeAccounts) {
    console.log(
      '\nPreserved: Account (Chart of Accounts), CompanyBank. ' +
        'Procurement and other modules untouched.'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
