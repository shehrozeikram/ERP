/**
 * Full Cash Approval Flow — End-to-End (data kept after run)
 *
 * Phase 1 : Create Indent
 * Phase 2 : Approve Indent → move to Procurement
 * Phase 3 : Create Quotation (vendor quote)  → Finalize
 * Phase 4 : Create Cash Approval from that quotation
 * Phase 4a: Send to Audit
 * Phase 4b: Pre-Audit initial approval
 * Phase 4c: Forward to Audit Director
 * Phase 4d: Audit Director final approval → Send to CEO Office
 * Phase 5a: CEO Secretariat → Forward to CEO
 * Phase 5b: CEO Approve → Pending Finance
 * Phase 6 : Finance Issues Advance
 * Phase 8 : Finance Settles Payment
 * Phase 8b: Finance Sends to Procurement
 * Phase 9 : Procurement Completes
 *
 * DATA IS KEPT – run: node tests/cash-approval-full-flow.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

// Register all required models
require('../server/models/User');
require('../server/models/hr/Department');
require('../server/models/hr/Supplier');
require('../server/models/general/Indent');
require('../server/models/procurement/Quotation');
require('../server/models/procurement/CashApproval');

const User       = require('../server/models/User');
const Indent     = require('../server/models/general/Indent');
const Quotation  = require('../server/models/procurement/Quotation');
const CashApproval = require('../server/models/procurement/CashApproval');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const log = (...args) => console.log(...args);
const ok  = (msg) => console.log(`  ✅  ${msg}`);
const fail = (msg) => { console.error(`  ❌  ${msg}`); process.exitCode = 1; };
const sep  = (title) => log(`\n${'─'.repeat(72)}\n  ${title}\n${'─'.repeat(72)}`);

const push = (doc, from, to, userId, comments, module) =>
  doc.workflowHistory.push({ fromStatus: from, toStatus: to,
    changedBy: userId, changedAt: new Date(), comments: comments || '', module: module || 'Test' });

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main () {
  const URI = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
  await mongoose.connect(URI);
  log('\n✅  Connected to MongoDB\n');

  // ── Resolve fixed IDs ──────────────────────────────────────────────────────
  const user = await User.findOne({ email: 'fahadfarid@tovus.net' }).select('_id firstName lastName role');
  if (!user) { fail('User fahadfarid@tovus.net not found'); await mongoose.disconnect(); return; }
  const uid = user._id;
  log(`👤  User  : ${user.firstName} ${user.lastName} (${user.role})`);

  const Department = mongoose.model('Department');
  const dept = await Department.findOne().select('_id name');
  if (!dept) { fail('No department found'); await mongoose.disconnect(); return; }
  log(`🏢  Dept  : ${dept.name}`);

  const Supplier = require('../server/models/hr/Supplier');
  const vendor = await Supplier.findOne({ status: 'Active' }).select('_id name email');
  if (!vendor) { fail('No active vendor found'); await mongoose.disconnect(); return; }
  log(`🏭  Vendor: ${vendor.name} (${vendor.email})`);

  // ── Phase 1: Create Indent ─────────────────────────────────────────────────
  sep('Phase 1 — Create Indent');
  const indent = await Indent.create({
    title: '[CA-TEST] Office Printer Cartridges — Urgent',
    description: 'Urgent replacement cartridges for office HP printer, needed immediately.',
    department: dept._id,
    requestedBy: uid,
    requiredDate: new Date(Date.now() + 3 * 86400000),
    status: 'Draft',
    priority: 'Urgent',
    category: 'Office Supplies',
    justification: 'Printer is non-functional. Urgent replacement cartridges required to continue daily operations.',
    items: [
      {
        itemName: 'HP 64XL Black Ink Cartridge',
        description: 'HP 64XL high-yield black ink cartridge for HP ENVY printers',
        brand: 'HP',
        quantity: 5,
        unit: 'pcs',
        purpose: 'Monthly printing operations — replacement urgently needed',
        estimatedCost: 2500,
        priority: 'Urgent'
      },
      {
        itemName: 'HP 64XL Tri-Color Ink Cartridge',
        description: 'HP 64XL high-yield tri-color ink cartridge for HP ENVY printers',
        brand: 'HP',
        quantity: 3,
        unit: 'pcs',
        purpose: 'Monthly printing operations — replacement urgently needed',
        estimatedCost: 3000,
        priority: 'Urgent'
      }
    ],
    approvalChain: [],
    createdBy: uid
  });
  ok(`Indent created: ${indent.indentNumber}`);

  // ── Phase 2: Approve Indent → move to Procurement ─────────────────────────
  sep('Phase 2 — Approve Indent & move to Procurement');
  indent.status = 'Approved';
  indent.approvedDate = new Date();
  indent.approvedBy = uid;
  indent.storeRoutingStatus = 'moved_to_procurement';
  indent.movedToProcurementBy = uid;
  indent.movedToProcurementAt = new Date();
  indent.movedToProcurementReason = 'No stock available — direct procurement required';
  await indent.save();
  ok(`Indent ${indent.indentNumber} approved and moved to Procurement`);

  // ── Phase 3: Create Quotation → Finalize ─────────────────────────────────
  sep('Phase 3 — Create Quotation from Vendor & Finalize');
  const quotation = await Quotation.create({
    indent: indent._id,
    vendor: vendor._id,
    quotationDate: new Date(),
    expiryDate: new Date(Date.now() + 14 * 86400000),
    status: 'Finalized',
    items: [
      {
        description: 'HP 64XL Black Ink Cartridge',
        specification: 'High-yield, compatible with HP ENVY 6055',
        brand: 'HP',
        quantity: 5,
        unit: 'pcs',
        unitPrice: 2800,
        taxRate: 17,
        discount: 0,
        amount: 14000
      },
      {
        description: 'HP 64XL Tri-Color Ink Cartridge',
        specification: 'High-yield tri-color, HP ENVY compatible',
        brand: 'HP',
        quantity: 3,
        unit: 'pcs',
        unitPrice: 3200,
        taxRate: 17,
        discount: 0,
        amount: 9600
      }
    ],
    totalAmount: 23600,
    paymentTerms: 'Cash on Delivery',
    notes: 'Urgent delivery within 24 hours',
    createdBy: uid
  });
  ok(`Quotation created & finalized: ${quotation.quotationNumber}`);
  ok(`Total: PKR ${quotation.totalAmount?.toLocaleString()}`);

  // Also link indent to comparative statement approvals
  indent.comparativeStatementApprovals = {
    preparedBy: `${user.firstName} ${user.lastName}`,
    verifiedBy: 'Procurement Committee',
    authorisedRep: 'GM Operations',
    financeRep: 'CFO',
    managerProcurement: 'Manager Procurement'
  };
  await indent.save();
  ok('Comparative statement approvals set on indent');

  // ── Phase 4: Create Cash Approval ─────────────────────────────────────────
  sep('Phase 4 — Create Cash Approval from Quotation');
  const ca = await CashApproval.create({
    vendor: vendor._id,
    indent: indent._id,
    quotation: quotation._id,
    approvalDate: new Date(),
    expectedPurchaseDate: new Date(Date.now() + 2 * 86400000),
    deliveryAddress: 'SGC Head Office, Islamabad',
    priority: 'Urgent',
    items: quotation.items.map(i => ({
      description: i.description,
      specification: i.specification,
      brand: i.brand,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
      discount: i.discount || 0,
      amount: i.amount
    })),
    shippingCost: 500,
    notes: 'URGENT — Printer non-functional. Cash purchase required immediately.',
    approvalAuthorities: {
      preparedBy: `${user.firstName} ${user.lastName}`,
      verifiedBy: 'Procurement Committee',
      authorisedRep: 'GM Operations',
      financeRep: 'CFO',
      managerProcurement: 'Manager Procurement'
    },
    createdBy: uid
  });
  ok(`Cash Approval created: ${ca.caNumber}`);
  ok(`Status: ${ca.status}`);
  ok(`Total: PKR ${ca.totalAmount?.toLocaleString()}`);

  // ── Phase 4a: Send to Audit ────────────────────────────────────────────────
  sep('Phase 4a — Send to Audit');
  push(ca, 'Draft', 'Pending Audit', uid, 'Sent to Pre-Audit for review', 'Procurement');
  ca.status = 'Pending Audit';
  ca.updatedBy = uid;
  await ca.save();
  ok(`Status → ${ca.status}`);

  // ── Phase 4b: Pre-Audit Initial Approval ─────────────────────────────────
  sep('Phase 4b — Pre-Audit Initial Approval (Audit Assistant)');
  ca.preAuditInitialApprovedBy = uid;
  ca.preAuditInitialApprovedAt = new Date();
  ca.preAuditInitialComments = 'Documents reviewed. Items justified. Forwarding to Audit Director.';
  push(ca, 'Pending Audit', 'Pending Audit', uid, 'Initial pre-audit approval recorded', 'Pre-Audit');
  ca.updatedBy = uid;
  await ca.save();
  ok('Pre-audit initial approval recorded');

  // ── Phase 4c: Forward to Audit Director ──────────────────────────────────
  sep('Phase 4c — Forward to Audit Director');
  push(ca, 'Pending Audit', 'Forwarded to Audit Director', uid, 'Forwarded to Audit Director for final review', 'Pre-Audit');
  ca.status = 'Forwarded to Audit Director';
  ca.updatedBy = uid;
  await ca.save();
  ok(`Status → ${ca.status}`);

  // ── Phase 4d: Audit Director Final Approval ───────────────────────────────
  sep('Phase 4d — Audit Director Final Approval → Send to CEO Office');
  push(ca, 'Forwarded to Audit Director', 'Send to CEO Office', uid, 'Audit complete — no observations. Approved.', 'Pre-Audit');
  ca.status = 'Send to CEO Office';
  ca.auditApprovedBy = uid;
  ca.auditApprovedAt = new Date();
  ca.auditRemarks = 'Audit approved — no observations raised. Items are justified.';
  ca.updatedBy = uid;
  await ca.save();
  ok(`Status → ${ca.status}`);

  // ── Phase 5a: CEO Secretariat Forward to CEO ─────────────────────────────
  sep('Phase 5a — CEO Secretariat Forwards to CEO');
  push(ca, 'Send to CEO Office', 'Forwarded to CEO', uid, 'Forwarded to CEO for approval', 'CEO Secretariat');
  ca.status = 'Forwarded to CEO';
  ca.ceoForwardedBy = uid;
  ca.ceoForwardedAt = new Date();
  ca.updatedBy = uid;
  await ca.save();
  ok(`Status → ${ca.status}`);

  // ── Phase 5b: CEO Approval → Pending Finance ─────────────────────────────
  sep('Phase 5b — CEO Approves → Pending Finance');
  push(ca, 'Forwarded to CEO', 'Pending Finance', uid, 'CEO Approved — urgent cash purchase authorized', 'CEO');
  ca.status = 'Pending Finance';
  ca.ceoApprovedBy = uid;
  ca.ceoApprovedAt = new Date();
  ca.ceoApprovalComments = 'Approved for urgent purchase. Finance to issue advance immediately.';
  ca.ceoDigitalSignature = `Fahad Farid — ${new Date().toLocaleDateString()}`;
  ca.updatedBy = uid;
  await ca.save();
  ok(`Status → ${ca.status}`);
  ok(`CEO Signature: ${ca.ceoDigitalSignature}`);

  // ── Phase 6: Finance Issues Advance ──────────────────────────────────────
  sep('Phase 6 — Finance Issues Advance to Procurement Officer');
  const advanceAmount = ca.totalAmount;
  push(ca, 'Pending Finance', 'Advance Issued',
    uid,
    `Advance of PKR ${advanceAmount.toLocaleString()} issued via Cash. Voucher: VCH-CA-${ca.caNumber}`,
    'Finance');
  ca.status = 'Advance Issued';
  ca.advanceTo = uid;
  ca.advanceToName = `${user.firstName} ${user.lastName} (Procurement Officer)`;
  ca.advanceAmount = advanceAmount;
  ca.advancePaymentMethod = 'Cash';
  ca.advanceVoucherNo = `VCH-CA-${ca.caNumber}`;
  ca.advanceRemarks = 'Cash issued from petty cash fund. Officer to purchase and return receipts.';
  ca.advanceIssuedBy = uid;
  ca.advanceIssuedAt = new Date();
  ca.updatedBy = uid;
  await ca.save();
  ok(`Status → ${ca.status}`);
  ok(`Advance Issued: PKR ${ca.advanceAmount.toLocaleString()} via ${ca.advancePaymentMethod}`);
  ok(`Voucher No: ${ca.advanceVoucherNo}`);

  // ── Phase 8: Finance Settles Payment (Officer Purchased & Returned Receipts)
  sep('Phase 8 — Payment Settlement (Actual Spend Recorded)');
  // Simulated: officer spent slightly less (saved PKR 800 on bargaining)
  const actualSpent = advanceAmount - 800;
  const excess = advanceAmount - actualSpent;
  push(ca, 'Advance Issued', 'Payment Settled',
    uid,
    `Actual spent: PKR ${actualSpent.toLocaleString()}. Excess PKR ${excess.toLocaleString()} returned. Receipts submitted.`,
    'Finance');
  ca.status = 'Payment Settled';
  ca.actualAmountSpent = actualSpent;
  ca.excessReturned = excess;
  ca.additionalPaid = 0;
  ca.settlementRemarks = `Procurement officer purchased items at negotiated price. PKR ${excess.toLocaleString()} returned to petty cash.`;
  ca.settlementDate = new Date();
  ca.settledBy = uid;
  ca.updatedBy = uid;
  await ca.save();
  ok(`Status → ${ca.status}`);
  ok(`Actual Spent    : PKR ${actualSpent.toLocaleString()}`);
  ok(`Advance Was     : PKR ${advanceAmount.toLocaleString()}`);
  ok(`Excess Returned : PKR ${excess.toLocaleString()}`);

  // ── Phase 8b: Finance Sends Back to Procurement ───────────────────────────
  sep('Phase 8b — Finance Sends to Procurement for Closure');
  push(ca, 'Payment Settled', 'Sent to Procurement',
    uid,
    'Payment settled. Receipts filed. Sent back to Procurement to confirm goods received.',
    'Finance');
  ca.status = 'Sent to Procurement';
  ca.sentToProcurementBy = uid;
  ca.sentToProcurementAt = new Date();
  ca.sentToProcurementRemarks = 'Finance settled. Please confirm items received and close the Cash Approval.';
  ca.updatedBy = uid;
  await ca.save();
  ok(`Status → ${ca.status}`);

  // ── Phase 9: Procurement Completes ───────────────────────────────────────
  sep('Phase 9 — Procurement Confirms & Marks as Completed');
  push(ca, 'Sent to Procurement', 'Completed',
    uid,
    'Items received and verified by Procurement Officer. Cash Approval closed.',
    'Procurement');
  ca.status = 'Completed';
  ca.completedBy = uid;
  ca.completedAt = new Date();
  ca.completionRemarks = 'All printer cartridges received in good condition. Distributed to users. Cash Approval closed.';
  ca.updatedBy = uid;
  await ca.save();
  ok(`Status → ${ca.status}`);
  ok('Cash Approval COMPLETED ✓');

  // ── Final Summary ─────────────────────────────────────────────────────────
  sep('FINAL SUMMARY — All Data Retained in Database');
  const final = await CashApproval.findById(ca._id)
    .populate('vendor', 'name email')
    .populate('createdBy', 'firstName lastName')
    .populate('ceoApprovedBy', 'firstName lastName')
    .populate('advanceIssuedBy', 'firstName lastName')
    .populate('completedBy', 'firstName lastName');

  log(`
  ┌──────────────────────────────────────────────────────────────────┐
  │  CASH APPROVAL DOCUMENT                                          │
  ├──────────────────────────────────────────────────────────────────┤
  │  CA Number         : ${final.caNumber.padEnd(42)}│
  │  Status            : ${final.status.padEnd(42)}│
  │  Vendor            : ${(final.vendor?.name || '').padEnd(42)}│
  │  Total Amount      : PKR ${String(final.totalAmount?.toLocaleString()).padEnd(39)}│
  │  Advance Amount    : PKR ${String(final.advanceAmount?.toLocaleString()).padEnd(39)}│
  │  Actual Spent      : PKR ${String(final.actualAmountSpent?.toLocaleString()).padEnd(39)}│
  │  Excess Returned   : PKR ${String(final.excessReturned?.toLocaleString()).padEnd(39)}│
  │  CEO Approved By   : ${(final.ceoApprovedBy?.firstName || '').padEnd(42)}│
  │  Advance Issued By : ${(final.advanceIssuedBy?.firstName || '').padEnd(42)}│
  │  Completed By      : ${(final.completedBy?.firstName || '').padEnd(42)}│
  ├──────────────────────────────────────────────────────────────────┤
  │  INDENT            : ${(indent.indentNumber || '').padEnd(42)}│
  │  QUOTATION         : ${(quotation.quotationNumber || '').padEnd(42)}│
  └──────────────────────────────────────────────────────────────────┘`);

  log('\n  WORKFLOW HISTORY:');
  for (const h of final.workflowHistory) {
    log(`    ${(h.fromStatus || '').padEnd(32)} → ${(h.toStatus || '').padEnd(30)} [${h.module}]`);
  }

  log('\n  ITEMS:');
  for (const [i, item] of final.items.entries()) {
    log(`    ${i + 1}. ${item.description}  × ${item.quantity} ${item.unit}  @ PKR ${item.unitPrice?.toLocaleString()}  = PKR ${item.amount?.toLocaleString()}`);
  }

  log(`
  📌  To view in the system:
      → Procurement  : http://localhost:3000/procurement/cash-approvals
      → Print View   : http://localhost:3000/procurement/cash-approvals/${ca._id}/print
      → Finance View : http://localhost:3000/finance/cash-approvals
  `);

  log('🎉  Full Cash Approval flow complete — all data kept in DB.\n');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('\n❌  Fatal:', err.message || err);
  mongoose.disconnect();
  process.exit(1);
});
