/**
 * LOCAL ONLY: Create a UtilityBill document for admin workflow testing.
 *
 * Safety:
 * - Requires --yes (or use --dry-run to preview)
 * - Refuses NODE_ENV=production
 * - Requires MONGODB_URI_LOCAL pointing to localhost/127.0.0.1/::1
 *
 * Usage examples:
 *   node scripts/seed-admin-utility-bill-local-only.js --dry-run
 *   node scripts/seed-admin-utility-bill-local-only.js --yes
 *     (default: admin_approved = submitted + Manager + HOD approved → Send to Audit)
 *   node scripts/seed-admin-utility-bill-local-only.js --yes --stage draft
 *   node scripts/seed-admin-utility-bill-local-only.js --yes --stage send_to_audit_with_initial_audit_approval --billId UB123456
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

function loadLocalEnvOverride() {
  // If .env.local exists and we're not in production, allow it to override.
  const localPath = path.join(repoRoot, '.env.local');
  if (process.env.NODE_ENV !== 'production' && require('fs').existsSync(localPath)) {
    require('dotenv').config({ path: localPath, override: true });
  }
}

loadLocalEnvOverride();

const { getMongoUri, getMongooseClientOptions } = require('../server/config/database');
const UtilityBill = require('../server/models/hr/UtilityBill');
const User = require('../server/models/User');
const Department = require('../server/models/hr/Department');
const {
  getEligibleUtilityBillApproverUserIds
} = require('../server/utils/utilityBillApproverEligibility');

function parseArgValue(flagName, fallback) {
  const idx = process.argv.indexOf(flagName);
  if (idx === -1) return fallback;
  const v = process.argv[idx + 1];
  return v === undefined ? fallback : v;
}

function parseFlag(flagName) {
  return process.argv.includes(flagName);
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function pickFirst(arr, fallback) {
  return Array.isArray(arr) && arr.length ? arr[0] : fallback;
}

async function pickApprovers() {
  const eligibleSet = await getEligibleUtilityBillApproverUserIds();
  const eligibleIds = [...eligibleSet];

  const activeUsers = await User.find({ isActive: true })
    .select('_id')
    .lean();
  const activeIds = activeUsers.map((u) => String(u._id));

  const pool = eligibleIds.length >= 2 ? eligibleIds : activeIds;
  const uniquePool = [...new Set(pool.map(String).filter(Boolean))];

  const managerId = uniquePool[0];
  const hodId = uniquePool[1];

  if (!managerId || !hodId) {
    throw new Error(
      'Need at least 2 active users to seed a utility bill (manager + HOD). Populate Users first.'
    );
  }

  return { managerId, hodId, eligibleUsed: eligibleIds.length >= 2 };
}

async function pickCreatedBy(managerId, hodId) {
  const exclude = new Set([managerId, hodId].filter(Boolean));
  const other = await User.find({ isActive: true, _id: { $nin: [...exclude] } })
    .select('_id')
    .lean();
  return other?.[0]?._id ? String(other[0]._id) : managerId;
}

function buildWorkflowHistoryForStage({ stage, now, actorId, managerId, hodId }) {
  const history = [];

  const push = (fromStatus, toStatus, comments) => {
    history.push({
      fromStatus,
      toStatus,
      changedBy: actorId,
      changedAt: now,
      comments
    });
  };

  if (stage === 'draft') return history;

  if (stage === 'submitted') {
    push('Draft', 'Submitted', 'Submitted for approval');
    return history;
  }

  // approved / send_to_audit / forwarded / approved_from_forwarded always share the internal approval timeline
  if (
    stage === 'approved' ||
    stage === 'send_to_audit' ||
    stage === 'send_to_audit_with_initial_audit_approval' ||
    stage === 'forwarded_to_director' ||
    stage === 'approved_from_forwarded'
  ) {
    push('Draft', 'Submitted', 'Submitted for approval');
    push('Submitted', 'Approved', 'Approved');
    history.push({
      fromStatus: 'Not Sent',
      toStatus: 'Send to Audit',
      changedBy: hodId || actorId,
      changedAt: now,
      comments: 'Sent to Pre-Audit after approval authority completed'
    });

    if (stage === 'approved') return history;

    if (stage === 'send_to_audit') return history;

    if (
      stage === 'send_to_audit_with_initial_audit_approval' ||
      stage === 'forwarded_to_director' ||
      stage === 'approved_from_forwarded'
    ) {
      history.push({
        fromStatus: 'Send to Audit',
        toStatus: 'Initial Audit Approval',
        changedBy: managerId || actorId,
        changedAt: new Date(now.getTime() + 1000),
        comments: 'Seeded initial audit approval'
      });
    }

    if (stage === 'send_to_audit_with_initial_audit_approval') return history;

    if (stage === 'forwarded_to_director') {
      history.push({
        fromStatus: 'Send to Audit',
        toStatus: 'Forwarded to Audit Director',
        changedBy: managerId || actorId,
        changedAt: new Date(now.getTime() + 2000),
        comments: 'Seeded forwarded to Audit Director'
      });
      return history;
    }

    if (stage === 'approved_from_forwarded') {
      history.push({
        fromStatus: 'Send to Audit',
        toStatus: 'Forwarded to Audit Director',
        changedBy: managerId || actorId,
        changedAt: new Date(now.getTime() + 1000),
        comments: 'Seeded forwarded to Audit Director'
      });
      history.push({
        fromStatus: 'Forwarded to Audit Director',
        toStatus: 'Approved (from Forwarded to Audit Director)',
        changedBy: hodId || actorId,
        changedAt: new Date(now.getTime() + 2000),
        comments: 'Seeded final director approval'
      });
      return history;
    }
  }

  return history;
}

async function main() {
  const dryRun = parseFlag('--dry-run');
  const confirmed = parseFlag('--yes');
  const stage = parseArgValue('--stage', 'draft');
  const billId = parseArgValue('--billId', null);
  const utilityType = parseArgValue('--utilityType', 'Electricity');
  const provider = parseArgValue('--provider', 'WAPDA');
  const amount = Number(parseArgValue('--amount', '5000'));
  const dueInDays = Number(parseArgValue('--dueInDays', '30'));
  const site = parseArgValue('--site', 'Main Office');
  const departmentName = parseArgValue('--department', 'Administration');
  const custodian = parseArgValue('--custodian', 'Admin Custodian');

  if (!dryRun && !confirmed) {
    console.error('Refusing to run without --yes (or use --dry-run to preview).');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run: NODE_ENV is production.');
    process.exit(1);
  }

  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('Set MONGODB_URI_LOCAL in .env (local database only).');
    process.exit(1);
  }
  const isLocalMongo =
    uri.includes('localhost') || uri.includes('127.0.0.1') || uri.includes('::1');
  if (!isLocal || !isLocalMongo) {
    console.error('Refusing: MONGODB_URI_LOCAL must point to localhost for local-only scripts.');
    process.exit(1);
  }

  const replace = parseFlag('--replace');
  const billIdFinal = billId || `UB${Date.now().toString().slice(-6)}`;

  console.log(dryRun ? 'DRY RUN — no write will happen' : `LIVE CREATE — billId=${billIdFinal}`);
  // Mask credentials if the URI contains user:pass@... (avoid logging secrets).
  let maskedUri = uri;
  try {
    const schemeIdx = uri.indexOf('://');
    const atIdx = uri.lastIndexOf('@');
    if (schemeIdx !== -1 && atIdx !== -1 && atIdx > schemeIdx + 3) {
      const authStart = schemeIdx + 3;
      const auth = uri.slice(authStart, atIdx); // user:pass (or just user)
      const colonIdx = auth.indexOf(':');
      if (colonIdx !== -1) {
        const user = auth.slice(0, colonIdx);
        maskedUri = `${uri.slice(0, authStart)}${user}:***${uri.slice(atIdx)}`;
      }
    }
  } catch {
    // ignore masking failures
  }
  console.log(`Connecting: ${maskedUri}`);

  const opts = getMongooseClientOptions(uri, true);
  await mongoose.connect(uri, opts);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`Database: ${dbName} @ ${mongoose.connection.host}`);

  const existing = await UtilityBill.findOne({ billId: billIdFinal }).select('_id').lean();
  if (existing) {
    if (!replace) {
      console.error(`UtilityBill with billId=${billIdFinal} already exists. Use --replace or pick another --billId.`);
      await mongoose.connection.close();
      process.exit(1);
    }
    if (!dryRun) {
      await UtilityBill.deleteOne({ billId: billIdFinal });
    }
  }

  const { managerId, hodId, eligibleUsed } = await pickApprovers();
  const createdBy = await pickCreatedBy(managerId, hodId);

  // Department master row is optional; the schema stores department as a plain string,
  // but this keeps it more realistic for UI filters.
  let adminDept = null;
  try {
    adminDept = await Department.findOne({ name: /^administration$/i }).select('name').lean();
  } catch {
    // ignore
  }
  const departmentForBill = adminDept?.name || departmentName;

  const now = new Date();
  const billDate = now;
  const dueDate = daysFromNow(dueInDays);

  const workflowHistory = buildWorkflowHistoryForStage({
    stage,
    now,
    actorId: createdBy,
    managerId,
    hodId
  });

  const data = {
    billId: billIdFinal,
    accountHead: '',
    site,
    utilityType,
    provider,
    accountNumber: '',
    billDate,
    dueDate,
    amount: Number.isFinite(amount) ? amount : 0,
    lastMonthAmount: 0,
    grandTotal: Number.isFinite(amount) ? amount : 0,
    balanceAmount: Number.isFinite(amount) ? amount : 0,
    paidAmount: 0,
    status: 'Pending',
    approvalStatus: 'Draft',
    auditStatus: 'Not Sent',
    workflowHistory,
    observations: [],
    updatedBy: createdBy,
    department: departmentForBill,
    custodian,
    createdBy,
    approvalChain: [],
    draftApproverIds: []
  };

  if (stage === 'draft') {
    data.draftApproverIds = [managerId, hodId];
  }

  if (stage === 'submitted') {
    data.approvalStatus = 'Submitted';
    data.draftApproverIds = [];
    data.approvalChain = [
      { approver: managerId, status: 'pending' },
      { approver: hodId, status: 'pending' }
    ];
  }

  if (
    stage === 'approved' ||
    stage === 'send_to_audit' ||
    stage === 'send_to_audit_with_initial_audit_approval' ||
    stage === 'forwarded_to_director' ||
    stage === 'approved_from_forwarded'
  ) {
    data.approvalStatus = 'Approved';
    data.approvalChain = [
      { approver: managerId, status: 'approved', actedAt: now },
      { approver: hodId, status: 'approved', actedAt: now }
    ];
    data.draftApproverIds = [];
    data.approvedBy = hodId;
    data.approvedAt = now;
    data.auditStatus = 'Send to Audit';
  }

  if (stage === 'send_to_audit') {
    data.auditStatus = 'Send to Audit';
  }

  if (stage === 'send_to_audit_with_initial_audit_approval') {
    data.auditStatus = 'Send to Audit';
  }

  if (stage === 'forwarded_to_director') {
    data.auditStatus = 'Forwarded to Audit Director';
  }

  if (stage === 'approved_from_forwarded') {
    data.auditStatus = 'Approved (from Forwarded to Audit Director)';
  }

  if (dryRun) {
    console.log('--- would create UtilityBill ---');
    console.log({
      billId: data.billId,
      utilityType: data.utilityType,
      provider: data.provider,
      approvalStatus: data.approvalStatus,
      auditStatus: data.auditStatus,
      dueDate: data.dueDate,
      amount: data.amount,
      createdBy,
      draftApproverIds: data.draftApproverIds,
      approvalChain: data.approvalChain.map((s) => ({ approver: String(s.approver), status: s.status })),
      workflowHistoryCount: data.workflowHistory.length,
      eligibleUsed
    });
    await mongoose.connection.close();
    return;
  }

  const doc = await new UtilityBill(data).save();
  await doc.populate([
    { path: 'createdBy', select: 'firstName lastName email' },
    { path: 'approvalChain.approver', select: 'firstName lastName email' },
    { path: 'draftApproverIds', select: 'firstName lastName email' }
  ]);

  console.log(`Created UtilityBill: _id=${doc._id} billId=${doc.billId}`);
  console.log(`approvalStatus=${doc.approvalStatus} auditStatus=${doc.auditStatus}`);

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error('FAILED:', err?.message || err);
  process.exit(1);
});

