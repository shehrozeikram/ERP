/**
 * Unit tests for utility bill → Finance posting helpers (no DB).
 */
const assert = require('assert');
const {
  buildUtilityBillLineItems,
  getUtilityBillPostAmount,
  isUtilityBillAuditFinalApproved,
  UTILITY_EXPENSE_ACCOUNT
} = require('../server/utils/utilityBillFinance');

const run = () => {
  assert.strictEqual(UTILITY_EXPENSE_ACCOUNT, '6200');

  assert.strictEqual(isUtilityBillAuditFinalApproved('Approved (from Forwarded to Audit Director)'), true);
  assert.strictEqual(isUtilityBillAuditFinalApproved('Send to Audit'), false);

  const single = {
    utilityType: 'Electricity',
    provider: 'K-Electric',
    site: 'SGCHQ',
    amount: 12500.5
  };
  const singleLines = buildUtilityBillLineItems(single);
  assert.strictEqual(singleLines.length, 1);
  assert.strictEqual(singleLines[0].unitPrice, 12500.5);
  assert.strictEqual(getUtilityBillPostAmount(single), 12500.5);

  const consolidated = {
    isConsolidated: true,
    utilityType: 'Electricity',
    provider: 'K-Electric',
    amount: 30000,
    consolidatedFrom: [
      { utilityType: 'Electricity', provider: 'K-Electric', site: 'Site A', amount: 10000 },
      { utilityType: 'Gas', provider: 'SSGC', site: 'Site B', amount: 20000 }
    ]
  };
  const consLines = buildUtilityBillLineItems(consolidated);
  assert.strictEqual(consLines.length, 2);
  assert.strictEqual(getUtilityBillPostAmount(consolidated), 30000);

  console.log('utility-bill-finance.test.js: all passed');
};

run();
