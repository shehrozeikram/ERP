/**
 * Unit tests for admin workflow → Pre-Audit tab mapping.
 * Run: node tests/pre-audit-workflow-status.test.js
 */
const assert = require('assert');
const {
  hasWorkflowInitialAuditApproval,
  mapWorkflowDocumentToPreAuditStatus
} = require('../server/utils/preAuditWorkflowStatus');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('pre-audit-workflow-status');

test('Send to Audit without initial approval → pending', () => {
  const doc = {
    auditStatus: 'Send to Audit',
    workflowHistory: [{ fromStatus: 'Not Sent', toStatus: 'Send to Audit', comments: 'Sent' }]
  };
  assert.strictEqual(mapWorkflowDocumentToPreAuditStatus(doc, 'auditStatus'), 'pending');
});

test('Send to Audit with initial approval → under_review', () => {
  const doc = {
    auditStatus: 'Send to Audit',
    workflowHistory: [
      { fromStatus: 'Not Sent', toStatus: 'Send to Audit' },
      { fromStatus: 'Send to Audit', toStatus: 'Initial Audit Approval', comments: 'OK' }
    ]
  };
  assert.strictEqual(mapWorkflowDocumentToPreAuditStatus(doc, 'auditStatus'), 'under_review');
  assert.strictEqual(hasWorkflowInitialAuditApproval(doc), true);
});

test('resubmit after return clears initial approval for tab until re-approved', () => {
  const doc = {
    auditStatus: 'Send to Audit',
    workflowHistory: [
      { toStatus: 'Send to Audit' },
      { toStatus: 'Initial Audit Approval' },
      { toStatus: 'Returned from Audit' },
      { fromStatus: 'Returned from Audit', toStatus: 'Send to Audit' }
    ]
  };
  assert.strictEqual(hasWorkflowInitialAuditApproval(doc), false);
  assert.strictEqual(mapWorkflowDocumentToPreAuditStatus(doc, 'auditStatus'), 'pending');
});

test('Forwarded to Audit Director → forwarded_to_director', () => {
  const doc = { auditStatus: 'Forwarded to Audit Director', workflowHistory: [] };
  assert.strictEqual(mapWorkflowDocumentToPreAuditStatus(doc, 'auditStatus'), 'forwarded_to_director');
});

test('Approved (from Forwarded to Audit Director) → approved', () => {
  const doc = {
    auditStatus: 'Approved (from Forwarded to Audit Director)',
    workflowHistory: []
  };
  assert.strictEqual(mapWorkflowDocumentToPreAuditStatus(doc, 'auditStatus'), 'approved');
});

console.log('\nAll pre-audit-workflow-status tests passed.\n');
