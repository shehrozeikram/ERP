/**
 * Comprehensive procurement-finance E2E suite:
 * 1) Clean transactional data
 * 2) Run standard full flow (after-delivery payment path)
 * 3) Clean transactional data again
 * 4) Run advance-payment full flow
 *
 * Each child test creates fresh inventory items (timestamp-based codes)
 * and validates journals, GL, TB, BS, and P&L behavior.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

function runCmd(label, cmd, args) {
  // eslint-disable-next-line no-console
  console.log(`\n========== ${label} ==========\n`);
  const res = spawnSync(cmd, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8'
  });
  process.stdout.write(res.stdout || '');
  process.stderr.write(res.stderr || '');
  if (res.status !== 0) {
    // eslint-disable-next-line no-console
    console.error(`\n✗ ${label} failed with exit code ${res.status}\n`);
    process.exit(res.status || 1);
  }
  // eslint-disable-next-line no-console
  console.log(`\n✓ ${label} passed\n`);
}

function main() {
  runCmd('CLEAN (BEFORE FULL FLOW)', 'npm', ['run', 'clean:test-data']);
  runCmd('FULL FLOW TEST (AFTER DELIVERY)', 'node', ['tests/full-indent-inventory-grn-sin-finance-e2e.test.js']);
  runCmd('CLEAN (BEFORE ADVANCE FLOW)', 'npm', ['run', 'clean:test-data']);
  runCmd('ADVANCE FLOW TEST (PAYMENT IN ADVANCE)', 'node', ['tests/advance-payment-indent-grn-sin-finance-e2e.test.js']);

  // eslint-disable-next-line no-console
  console.log('\n✅ COMPLETE PROCUREMENT-FINANCE E2E SUITE: PASS\n');
}

main();
