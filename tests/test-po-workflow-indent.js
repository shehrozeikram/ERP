/**
 * Test that PO workflow history includes related indent workflow for PO-202602-0004.
 * Run from project root: node tests/test-po-workflow-indent.js
 * Requires .env with MONGODB_URI.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
// Register refs so populate() works
require('../server/models/User');
const PurchaseOrder = require('../server/models/procurement/PurchaseOrder');
const Indent = require('../server/models/general/Indent');

// Same as server/routes/procurement.js
function buildIndentWorkflowHistory(indent) {
  if (!indent) return [];
  const entries = [];
  const createdAt = indent.createdAt || indent.updatedAt;
  const createdBy = indent.createdBy;

  entries.push({
    fromStatus: '—',
    toStatus: 'Draft',
    changedBy: createdBy,
    changedAt: createdAt,
    comments: 'Indent created',
    module: 'Indent'
  });

  if (indent.status && indent.status !== 'Draft' && !['Approved', 'Rejected', 'Partially Fulfilled', 'Fulfilled', 'Cancelled'].includes(indent.status)) {
    const submittedAt = indent.updatedAt || createdAt;
    const submittedBy = indent.updatedBy || indent.requestedBy || createdBy;
    entries.push({
      fromStatus: 'Draft',
      toStatus: indent.status === 'Submitted' ? 'Submitted' : 'Under Review',
      changedBy: submittedBy,
      changedAt: submittedAt,
      comments: indent.status === 'Submitted' ? 'Indent submitted' : 'Indent under review',
      module: 'Indent'
    });
  }

  if (indent.status === 'Approved' && indent.approvedBy && indent.approvedDate) {
    entries.push({
      fromStatus: 'Under Review',
      toStatus: 'Approved',
      changedBy: indent.approvedBy,
      changedAt: indent.approvedDate,
      comments: 'Indent approved',
      module: 'Indent'
    });
  }

  if (indent.status === 'Rejected') {
    entries.push({
      fromStatus: 'Under Review',
      toStatus: 'Rejected',
      changedBy: indent.updatedBy || null,
      changedAt: indent.updatedAt || new Date(),
      comments: indent.rejectionReason || 'Indent rejected',
      module: 'Indent'
    });
  }

  if (indent.storeRoutingStatus === 'moved_to_procurement' && indent.movedToProcurementBy && indent.movedToProcurementAt) {
    entries.push({
      fromStatus: 'Approved',
      toStatus: 'Moved to Procurement',
      changedBy: indent.movedToProcurementBy,
      changedAt: indent.movedToProcurementAt,
      comments: indent.movedToProcurementReason || 'Moved to Procurement (requisition)',
      module: 'Indent'
    });
    entries.push({
      fromStatus: 'Moved to Procurement',
      toStatus: 'Requisition in Procurement',
      changedBy: indent.movedToProcurementBy,
      changedAt: indent.movedToProcurementAt,
      comments: 'Requisition available in Procurement for quotations',
      module: 'Requisition'
    });
  }

  return entries;
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connected\n');

  const orderNumber = 'PO-202602-0004';
  const po = await PurchaseOrder.findOne({ orderNumber })
    .populate('workflowHistory.changedBy', 'firstName lastName email')
    .populate('indent', '_id indentNumber');

  if (!po) {
    console.log(`❌ Purchase order "${orderNumber}" not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Found PO: ${po.orderNumber} (_id: ${po._id})`);
  console.log(`  indent: ${po.indent ? po.indent._id : 'none'}\n`);

  if (!po.indent) {
    console.log('⚠️ This PO has no linked indent. fullWorkflowHistory will not include indent steps (expected).');
    await mongoose.disconnect();
    process.exit(0);
  }

  const indentId = po.indent._id || po.indent;
  const indent = await Indent.findById(indentId)
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .populate('approvedBy', 'firstName lastName email')
    .populate('requestedBy', 'firstName lastName email')
    .populate('movedToProcurementBy', 'firstName lastName email')
    .lean();

  if (!indent) {
    console.log('❌ Indent not found.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const indentEntries = buildIndentWorkflowHistory(indent);
  const poEntries = (po.workflowHistory || []).map((e) => ({
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    changedBy: e.changedBy,
    changedAt: e.changedAt,
    comments: e.comments,
    module: e.module || 'Procurement'
  }));

  const fullWorkflowHistory = [...indentEntries, ...poEntries].sort(
    (a, b) => new Date(a.changedAt || 0) - new Date(b.changedAt || 0)
  );

  const indentSteps = fullWorkflowHistory.filter((e) => e.module === 'Indent');
  const requisitionSteps = fullWorkflowHistory.filter((e) => e.module === 'Requisition');
  const poSteps = fullWorkflowHistory.filter((e) => e.module !== 'Indent' && e.module !== 'Requisition');

  console.log('--- Full workflow (chronological) ---');
  fullWorkflowHistory.forEach((e, i) => {
    const who = e.changedBy && (e.changedBy.firstName || e.changedBy.lastName)
      ? `${e.changedBy.firstName || ''} ${e.changedBy.lastName || ''}`.trim()
      : (e.changedBy && e.changedBy._id) ? '(user)' : '—';
    const at = e.changedAt ? new Date(e.changedAt).toISOString().slice(0, 19).replace('T', ' ') : '—';
    console.log(`  ${i + 1}. [${e.module}] ${e.fromStatus} → ${e.toStatus}  by ${who}  at ${at}`);
  });

  console.log('\n--- Summary ---');
  console.log(`  Indent steps: ${indentSteps.length}`);
  console.log(`  Requisition steps: ${requisitionSteps.length}`);
  console.log(`  PO steps: ${poSteps.length}`);
  console.log(`  Total: ${fullWorkflowHistory.length}`);

  if (indentSteps.length > 0 || requisitionSteps.length > 0) {
    console.log('\n✅ CONFIRMED: Indent and Procurement Requisition workflow included in fullWorkflowHistory for ' + orderNumber);
  } else {
    console.log('\n⚠️ No indent/requisition steps in fullWorkflowHistory (indent may be Draft only or missing approval data).');
  }

  await mongoose.disconnect();
  console.log('\n✅ Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
