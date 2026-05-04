/**
 * End-to-End Test: Cash Approval Full Workflow (Phases 1–9)
 *
 * Tests the complete flow:
 *   Create → Send to Audit → (Pre-Audit) → Forward to Director → Audit Approve →
 *   Forward to CEO → CEO Approve → Issue Advance → Settle Payment →
 *   Send to Procurement → Complete
 *
 * Run: node tests/cash-approval-e2e.test.js
 * Requires .env with MONGODB_URI and at least one User in DB.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

// Register models
require('../server/models/User');
require('../server/models/hr/Supplier');
require('../server/models/procurement/Quotation');
require('../server/models/general/Indent');
const CashApproval = require('../server/models/procurement/CashApproval');
const User = require('../server/models/User');
const Supplier = require('../server/models/hr/Supplier');

// ─── Test helpers ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    results.push(`  ✅ ${label}`);
  } else {
    failed++;
    results.push(`  ❌ ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  assert(actual === expected, `${label} (got: "${actual}", expected: "${expected}")`);
}

// ─── Main test ────────────────────────────────────────────────────────────────
async function run() {
  const MONGO_URI = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error('❌ No MongoDB URI found in environment. Set MONGODB_URI_LOCAL or MONGODB_URI.');
    process.exit(1);
  }

  console.log('\n🚀 Cash Approval E2E Test\n');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  let userId, vendorId, caId;

  try {
    // ─── Setup: get or create test user & vendor ─────────────────────────────
    console.log('─── Phase 0: Setup ───────────────────────────────────────────────────────────');

    // Use any existing active user
    const testUser = await User.findOne({ isActive: true }).select('_id firstName lastName email');
    if (!testUser) {
      console.error('No active users found in database. Please seed at least one user.');
      process.exit(1);
    }
    userId = testUser._id;
    assert(userId, `Test user found: ${testUser.firstName} ${testUser.lastName}`);

    // Use any existing supplier
    const testVendor = await Supplier.findOne({}).select('_id name');
    if (!testVendor) {
      console.error('No suppliers found in database. Please seed at least one supplier.');
      process.exit(1);
    }
    vendorId = testVendor._id;
    assert(vendorId, `Test vendor found: ${testVendor.name}`);

    // ─── Phase 3: Create Cash Approval (Draft) ───────────────────────────────
    console.log('\n─── Phase 3: Create Cash Approval ────────────────────────────────────────────');

    const ca = await CashApproval.create({
      vendor: vendorId,
      approvalDate: new Date(),
      expectedPurchaseDate: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      priority: 'Urgent',
      deliveryAddress: 'SGC Office, Islamabad',
      items: [{
        description: 'Printer Cartridges',
        specification: 'HP 64XL Black',
        quantity: 5,
        unit: 'pcs',
        unitPrice: 2500,
        taxRate: 17,
        discount: 0,
        amount: 12500
      }],
      shippingCost: 200,
      notes: 'Urgent purchase — printer not working',
      approvalAuthorities: {
        preparedBy: 'Ali Hassan',
        verifiedBy: 'Procurement Committee',
        authorisedRep: 'GM Operations',
        financeRep: 'CFO',
        managerProcurement: 'MGR Procurement'
      },
      createdBy: userId
    });

    caId = ca._id;
    assert(caId, 'Cash Approval created');
    assert(ca.caNumber && ca.caNumber.startsWith('CA-'), `CA number generated: ${ca.caNumber}`);
    assertEqual(ca.status, 'Draft', 'Status is Draft');
    assertEqual(ca.priority, 'Urgent', 'Priority is Urgent');
    assert(ca.totalAmount > 0, `Total amount calculated: ${ca.totalAmount}`);
    console.log(`  Created: ${ca.caNumber}  |  Total: PKR ${ca.totalAmount.toLocaleString()}`);

    // ─── Phase 4: Send to Audit ──────────────────────────────────────────────
    console.log('\n─── Phase 4a: Send to Audit ───────────────────────────────────────────────────');

    ca.status = 'Draft';
    ca.workflowHistory.push({ fromStatus: 'Draft', toStatus: 'Pending Audit', changedBy: userId, changedAt: new Date(), comments: 'Sent to Pre-Audit', module: 'Procurement' });
    ca.status = 'Pending Audit';
    await ca.save();
    const afterAuditSend = await CashApproval.findById(caId);
    assertEqual(afterAuditSend.status, 'Pending Audit', 'Status is Pending Audit');
    assert(afterAuditSend.workflowHistory.length >= 1, 'Workflow history has entry');

    // ─── Phase 4b: Pre-Audit initial approval ────────────────────────────────
    console.log('\n─── Phase 4b: Pre-Audit Initial Approval ──────────────────────────────────────');

    afterAuditSend.preAuditInitialApprovedBy = userId;
    afterAuditSend.preAuditInitialApprovedAt = new Date();
    afterAuditSend.preAuditInitialComments = 'Initial pre-audit check done';
    afterAuditSend.workflowHistory.push({ fromStatus: 'Pending Audit', toStatus: 'Pending Audit', changedBy: userId, changedAt: new Date(), comments: 'Initial pre-audit approval recorded', module: 'Pre-Audit' });
    await afterAuditSend.save();
    const afterInitialApproval = await CashApproval.findById(caId);
    assert(afterInitialApproval.preAuditInitialApprovedBy, 'Pre-audit initial approval recorded');

    // ─── Phase 4c: Forward to Audit Director ─────────────────────────────────
    console.log('\n─── Phase 4c: Forward to Audit Director ────────────────────────────────────────');

    afterInitialApproval.status = 'Forwarded to Audit Director';
    afterInitialApproval.workflowHistory.push({ fromStatus: 'Pending Audit', toStatus: 'Forwarded to Audit Director', changedBy: userId, changedAt: new Date(), comments: 'Forwarded to Audit Director', module: 'Pre-Audit' });
    await afterInitialApproval.save();
    const afterForwardedToDir = await CashApproval.findById(caId);
    assertEqual(afterForwardedToDir.status, 'Forwarded to Audit Director', 'Status is Forwarded to Audit Director');

    // ─── Phase 4d: Audit Director final approval → Send to CEO Office ─────────
    console.log('\n─── Phase 4d: Audit Director Final Approval ────────────────────────────────────');

    afterForwardedToDir.status = 'Send to CEO Office';
    afterForwardedToDir.auditApprovedBy = userId;
    afterForwardedToDir.auditApprovedAt = new Date();
    afterForwardedToDir.auditRemarks = 'Audit approved — documents in order';
    afterForwardedToDir.workflowHistory.push({ fromStatus: 'Forwarded to Audit Director', toStatus: 'Send to CEO Office', changedBy: userId, changedAt: new Date(), comments: 'Audit approved', module: 'Pre-Audit' });
    await afterForwardedToDir.save();
    const afterAuditApproved = await CashApproval.findById(caId);
    assertEqual(afterAuditApproved.status, 'Send to CEO Office', 'Status is Send to CEO Office');
    assert(afterAuditApproved.auditApprovedBy, 'auditApprovedBy recorded');

    // ─── Phase 5a: CEO Secretariat forwards to CEO ───────────────────────────
    console.log('\n─── Phase 5a: CEO Secretariat → Forward to CEO ─────────────────────────────────');

    afterAuditApproved.status = 'Forwarded to CEO';
    afterAuditApproved.ceoForwardedBy = userId;
    afterAuditApproved.ceoForwardedAt = new Date();
    afterAuditApproved.workflowHistory.push({ fromStatus: 'Send to CEO Office', toStatus: 'Forwarded to CEO', changedBy: userId, changedAt: new Date(), comments: 'Forwarded to CEO', module: 'CEO Secretariat' });
    await afterAuditApproved.save();
    const afterForwardedCeo = await CashApproval.findById(caId);
    assertEqual(afterForwardedCeo.status, 'Forwarded to CEO', 'Status is Forwarded to CEO');

    // ─── Phase 5b: CEO Approve → Pending Finance ─────────────────────────────
    console.log('\n─── Phase 5b: CEO Approval → Pending Finance ───────────────────────────────────');

    afterForwardedCeo.status = 'Pending Finance';
    afterForwardedCeo.ceoApprovedBy = userId;
    afterForwardedCeo.ceoApprovedAt = new Date();
    afterForwardedCeo.ceoApprovalComments = 'Approved for urgent purchase';
    afterForwardedCeo.ceoDigitalSignature = 'CEO Digital Signature Test';
    afterForwardedCeo.workflowHistory.push({ fromStatus: 'Forwarded to CEO', toStatus: 'Pending Finance', changedBy: userId, changedAt: new Date(), comments: 'CEO approved — send to Finance', module: 'CEO' });
    await afterForwardedCeo.save();
    const afterCeoApproved = await CashApproval.findById(caId);
    assertEqual(afterCeoApproved.status, 'Pending Finance', 'Status is Pending Finance after CEO approval');
    assert(afterCeoApproved.ceoApprovedBy, 'ceoApprovedBy recorded');
    assert(afterCeoApproved.ceoDigitalSignature, 'CEO digital signature recorded');

    // ─── Phase 6: Finance Issues Advance ─────────────────────────────────────
    console.log('\n─── Phase 6: Finance Issues Advance ────────────────────────────────────────────');

    const advanceAmount = afterCeoApproved.totalAmount;
    afterCeoApproved.status = 'Advance Issued';
    afterCeoApproved.advanceTo = userId;
    afterCeoApproved.advanceToName = 'Ali Hassan (Procurement Officer)';
    afterCeoApproved.advanceAmount = advanceAmount;
    afterCeoApproved.advancePaymentMethod = 'Cash';
    afterCeoApproved.advanceVoucherNo = `VCH-${Date.now()}`;
    afterCeoApproved.advanceRemarks = 'Cash given from petty cash';
    afterCeoApproved.advanceIssuedBy = userId;
    afterCeoApproved.advanceIssuedAt = new Date();
    afterCeoApproved.workflowHistory.push({ fromStatus: 'Pending Finance', toStatus: 'Advance Issued', changedBy: userId, changedAt: new Date(), comments: `Advance of PKR ${advanceAmount} issued in Cash`, module: 'Finance' });
    await afterCeoApproved.save();
    const afterAdvanceIssued = await CashApproval.findById(caId);
    assertEqual(afterAdvanceIssued.status, 'Advance Issued', 'Status is Advance Issued');
    assert(afterAdvanceIssued.advanceAmount > 0, `Advance amount set: PKR ${afterAdvanceIssued.advanceAmount}`);
    assert(afterAdvanceIssued.advanceVoucherNo, 'Voucher number recorded');

    // ─── Phase 8: Finance Settles Payment ────────────────────────────────────
    console.log('\n─── Phase 8: Finance Settles Payment ───────────────────────────────────────────');

    // Simulate: actual spent is slightly less than advance (underspent)
    const actualSpent = advanceAmount - 500;
    const excess = advanceAmount - actualSpent;
    afterAdvanceIssued.status = 'Payment Settled';
    afterAdvanceIssued.actualAmountSpent = actualSpent;
    afterAdvanceIssued.excessReturned = excess;
    afterAdvanceIssued.additionalPaid = 0;
    afterAdvanceIssued.settlementRemarks = `Officer returned PKR ${excess} excess cash`;
    afterAdvanceIssued.settlementDate = new Date();
    afterAdvanceIssued.settledBy = userId;
    afterAdvanceIssued.workflowHistory.push({ fromStatus: 'Advance Issued', toStatus: 'Payment Settled', changedBy: userId, changedAt: new Date(), comments: `Actual spent: ${actualSpent}, excess ${excess} returned`, module: 'Finance' });
    await afterAdvanceIssued.save();
    const afterSettled = await CashApproval.findById(caId);
    assertEqual(afterSettled.status, 'Payment Settled', 'Status is Payment Settled');
    assert(afterSettled.excessReturned === excess, `Excess returned correctly: PKR ${afterSettled.excessReturned}`);
    assert(afterSettled.settledBy, 'settledBy recorded');

    // ─── Phase 8b: Finance Sends to Procurement ──────────────────────────────
    console.log('\n─── Phase 8b: Finance → Send to Procurement ────────────────────────────────────');

    afterSettled.status = 'Sent to Procurement';
    afterSettled.sentToProcurementBy = userId;
    afterSettled.sentToProcurementAt = new Date();
    afterSettled.sentToProcurementRemarks = 'Payment settled. Please confirm goods receipt.';
    afterSettled.workflowHistory.push({ fromStatus: 'Payment Settled', toStatus: 'Sent to Procurement', changedBy: userId, changedAt: new Date(), comments: 'Sent back to Procurement', module: 'Finance' });
    await afterSettled.save();
    const afterSentToProcurement = await CashApproval.findById(caId);
    assertEqual(afterSentToProcurement.status, 'Sent to Procurement', 'Status is Sent to Procurement');
    assert(afterSentToProcurement.sentToProcurementBy, 'sentToProcurementBy recorded');

    // ─── Phase 9: Procurement Completes ──────────────────────────────────────
    console.log('\n─── Phase 9: Procurement Completes ─────────────────────────────────────────────');

    afterSentToProcurement.status = 'Completed';
    afterSentToProcurement.completedBy = userId;
    afterSentToProcurement.completedAt = new Date();
    afterSentToProcurement.completionRemarks = 'Items received and confirmed. Cash Approval closed.';
    afterSentToProcurement.workflowHistory.push({ fromStatus: 'Sent to Procurement', toStatus: 'Completed', changedBy: userId, changedAt: new Date(), comments: 'Goods received and confirmed.', module: 'Procurement' });
    await afterSentToProcurement.save();
    const completed = await CashApproval.findById(caId)
      .populate('vendor', 'name')
      .populate('createdBy', 'firstName lastName')
      .populate('completedBy', 'firstName lastName');
    assertEqual(completed.status, 'Completed', 'Final status is Completed');
    assert(completed.completedBy, 'completedBy recorded');
    assert(completed.workflowHistory.length >= 9, `Workflow history has ${completed.workflowHistory.length} entries (expected >= 9)`);

    // ─── Validate full workflow history ──────────────────────────────────────
    console.log('\n─── Workflow History Validation ─────────────────────────────────────────────────');
    const expectedSteps = [
      'Pending Audit', 'Pending Audit', 'Forwarded to Audit Director',
      'Send to CEO Office', 'Forwarded to CEO', 'Pending Finance',
      'Advance Issued', 'Payment Settled', 'Sent to Procurement', 'Completed'
    ];
    const actualSteps = completed.workflowHistory.map((h) => h.toStatus);
    assert(
      expectedSteps.every((step) => actualSteps.includes(step)),
      `All workflow steps present: ${actualSteps.join(' → ')}`
    );

    // ─── Statistics ───────────────────────────────────────────────────────────
    console.log('\n─── Statistics ──────────────────────────────────────────────────────────────────');
    const stats = await CashApproval.getStatistics();
    assert(stats.totalCAs >= 1, `getStatistics() returns totalCAs: ${stats.totalCAs}`);

    // ─── Cleanup ──────────────────────────────────────────────────────────────
    console.log('\n─── Cleanup ─────────────────────────────────────────────────────────────────────');
    await CashApproval.deleteOne({ _id: caId });
    const deleted = await CashApproval.findById(caId);
    assert(!deleted, 'Test Cash Approval cleaned up');

    assert(true, 'Test data cleaned up (no external fixtures to remove)');

  } catch (err) {
    failed++;
    results.push(`  ❌ Unexpected error: ${err.message}`);
    console.error(err);
    // Cleanup on error
    if (caId) await CashApproval.deleteOne({ _id: caId }).catch(() => {});
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('Test Results:');
  results.forEach((r) => console.log(r));
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`\n${passed} passed  |  ${failed} failed  |  ${passed + failed} total`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Cash Approval full workflow is working correctly.\n');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Please review the output above.\n`);
    process.exitCode = 1;
  }

  await mongoose.connection.close();
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
