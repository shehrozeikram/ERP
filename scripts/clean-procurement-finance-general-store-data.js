/**
 * DESTRUCTIVE: Deletes transactional data so you can re-run E2E tests on a clean slate.
 *
 * Removes (order respects references):
 *   Store/procurement: StockTransaction, GoodsIssue (SIN), GoodsReceive (GRN), PurchaseReturn,
 *                      PurchaseOrder, QuotationInvitation, Quotation, Inventory items
 *   General:           Indents
 *   Finance:           GeneralLedger, JournalEntry, AccountsPayable, AccountsReceivable,
 *                      DeferredEntry, Budget, RecurringJournal
 *   Finance (recovery): RecoveryAssignment, RecoveryTask, RecoveryTaskAssignmentRule, RecoveryCampaign,
 *                      ConversationRead, WhatsAppIncomingMessage, WhatsAppOutgoingMessage
 *
 * Preserves: Chart of accounts (Account), InventoryCategory, Store, Supplier/Vendor, Projects,
 *            Departments, Users, RecoveryMember, FinanceJournal definitions, Fiscal periods, etc.
 *
 * Usage:
 *   node scripts/clean-procurement-finance-general-store-data.js --yes
 *
 * Uses MONGODB_URI_LOCAL if set, else MONGODB_URI (same as server).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const path = require('path');

const root = path.join(__dirname, '..');

function loadModels() {
  return {
    StockTransaction: require(path.join(root, 'server/models/procurement/StockTransaction')),
    GoodsIssue: require(path.join(root, 'server/models/procurement/GoodsIssue')),
    GoodsReceive: require(path.join(root, 'server/models/procurement/GoodsReceive')),
    PurchaseReturn: require(path.join(root, 'server/models/procurement/PurchaseReturn')),
    PurchaseOrder: require(path.join(root, 'server/models/procurement/PurchaseOrder')),
    QuotationInvitation: require(path.join(root, 'server/models/procurement/QuotationInvitation')),
    Quotation: require(path.join(root, 'server/models/procurement/Quotation')),
    Inventory: require(path.join(root, 'server/models/procurement/Inventory')),
    Indent: require(path.join(root, 'server/models/general/Indent')),
    GeneralLedger: require(path.join(root, 'server/models/finance/GeneralLedger')),
    JournalEntry: require(path.join(root, 'server/models/finance/JournalEntry')),
    AccountsPayable: require(path.join(root, 'server/models/finance/AccountsPayable')),
    VendorAdvance: require(path.join(root, 'server/models/finance/VendorAdvance')),
    AccountsReceivable: require(path.join(root, 'server/models/finance/AccountsReceivable')),
    DeferredEntry: require(path.join(root, 'server/models/finance/DeferredEntry')),
    Budget: require(path.join(root, 'server/models/finance/Budget')),
    RecurringJournal: require(path.join(root, 'server/models/finance/RecurringJournal')),
    RecoveryAssignment: require(path.join(root, 'server/models/finance/RecoveryAssignment')),
    RecoveryTask: require(path.join(root, 'server/models/finance/RecoveryTask')),
    RecoveryTaskAssignmentRule: require(path.join(root, 'server/models/finance/RecoveryTaskAssignmentRule')),
    RecoveryCampaign: require(path.join(root, 'server/models/finance/RecoveryCampaign')),
    ConversationRead: require(path.join(root, 'server/models/finance/ConversationRead')),
    WhatsAppIncomingMessage: require(path.join(root, 'server/models/finance/WhatsAppIncomingMessage')),
    WhatsAppOutgoingMessage: require(path.join(root, 'server/models/finance/WhatsAppOutgoingMessage'))
  };
}

const DELETE_ORDER = [
  ['StockTransaction', 'stocktransactions'],
  ['GoodsIssue', 'goodsissues'],
  ['GoodsReceive', 'goodsreceives'],
  ['PurchaseReturn', 'purchasereturns'],
  ['PurchaseOrder', 'purchaseorders'],
  ['QuotationInvitation', 'quotationinvitations'],
  ['Quotation', 'quotations'],
  ['Indent', 'indents'],
  ['Inventory', 'inventories'],
  ['GeneralLedger', 'generalledgers'],
  ['JournalEntry', 'journalentries'],
  ['AccountsPayable', 'accountspayables'],
  ['VendorAdvance', 'vendoradvances'],
  ['AccountsReceivable', 'accountsreceivables'],
  ['DeferredEntry', 'deferredentries'],
  ['Budget', 'budgets'],
  ['RecurringJournal', 'recurringjournals'],
  ['RecoveryAssignment', 'recoveryassignments'],
  ['RecoveryTask', 'recoverytasks'],
  ['RecoveryTaskAssignmentRule', 'recoverytaskassignmentrules'],
  ['RecoveryCampaign', 'recoverycampaigns'],
  ['ConversationRead', 'conversationreads'],
  ['WhatsAppIncomingMessage', 'whatsappincomingmessages'],
  ['WhatsAppOutgoingMessage', 'whatsappoutgoingmessages']
];

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error(
      'Refusing to run without --yes. This permanently deletes data.\n' +
        'Example: node scripts/clean-procurement-finance-general-store-data.js --yes'
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Set MONGODB_URI or MONGODB_URI_LOCAL in .env');
    process.exit(1);
  }

  console.log('Connecting:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const models = loadModels();
  const summary = [];

  for (const [key, collectionHint] of DELETE_ORDER) {
    const Model = models[key];
    if (!Model || typeof Model.deleteMany !== 'function') {
      summary.push({ key, deleted: 0, error: 'model missing' });
      continue;
    }
    try {
      const res = await Model.deleteMany({});
      summary.push({ key, collection: collectionHint, deleted: res.deletedCount });
      console.log(`  ${key}: deleted ${res.deletedCount}`);
    } catch (e) {
      summary.push({ key, deleted: 0, error: e.message });
      console.error(`  ${key}: FAILED`, e.message);
    }
  }

  await mongoose.connection.close();
  console.log('\nDone. Summary:', JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
