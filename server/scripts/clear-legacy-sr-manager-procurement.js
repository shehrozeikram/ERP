/**
 * Clear Sr Manager Procurement on POs created before the slot existed (2026-10-02),
 * and advance Pending Approval POs whose remaining authority slots are already done.
 *
 * Usage:
 *   node server/scripts/clear-legacy-sr-manager-procurement.js
 *   node server/scripts/clear-legacy-sr-manager-procurement.js --apply
 */
const path = require('path');
const fsSync = require('fs');

const repoRoot = path.join(__dirname, '..', '..');
const envPath = path.join(repoRoot, '.env');
const localPath = path.join(repoRoot, '.env.local');
if (fsSync.existsSync(envPath)) require('dotenv').config({ path: envPath });
if (fsSync.existsSync(localPath)) require('dotenv').config({ path: localPath, override: true });

const { connectDB, disconnectDB } = require('../config/database');
const PurchaseOrder = require('../models/procurement/PurchaseOrder');
const {
  SR_MANAGER_PROCUREMENT_EFFECTIVE_AT,
  reconcileLegacySrManagerProcurement
} = require('../utils/purchaseOrderAuthority');

const APPLY = process.argv.includes('--apply');

async function main() {
  await connectDB();
  const filter = {
    createdAt: { $lt: SR_MANAGER_PROCUREMENT_EFFECTIVE_AT },
    'approvalAuthorities.srManagerProcurement': { $exists: true, $nin: [null, ''] }
  };

  const withName = await PurchaseOrder.find(filter).select('_id orderNumber status createdAt approvalAuthorities').lean();
  console.log(`Legacy POs with Sr Manager name: ${withName.length} (cutoff ${SR_MANAGER_PROCUREMENT_EFFECTIVE_AT.toISOString()})`);
  withName.slice(0, 20).forEach((po) => {
    console.log(`  - ${po.orderNumber || po._id} | ${po.status} | ${po.approvalAuthorities?.srManagerProcurement}`);
  });
  if (withName.length > 20) console.log(`  ... and ${withName.length - 20} more`);

  const pendingLegacy = await PurchaseOrder.find({
    createdAt: { $lt: SR_MANAGER_PROCUREMENT_EFFECTIVE_AT },
    status: 'Pending Approval'
  }).limit(500);

  let advanced = 0;
  let cleared = 0;

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to clear names and advance stuck POs.');
    // Estimate advances without saving
    for (const po of pendingLegacy) {
      const beforeStatus = po.status;
      const beforeName = po.approvalAuthorities?.srManagerProcurement;
      const result = await reconcileLegacySrManagerProcurement(po);
      if (result.cleared || beforeName) cleared += 1;
      if (result.advanced || (beforeStatus === 'Pending Approval' && po.status === 'Pending Audit')) advanced += 1;
      // revert in-memory mutations for dry-run
      po.status = beforeStatus;
      if (po.approvalAuthorities) po.approvalAuthorities.srManagerProcurement = beforeName || '';
    }
    console.log(`Would clear Sr Manager on ~${withName.length} docs; would advance ~${advanced} Pending Approval POs.`);
    return;
  }

  const clearResult = await PurchaseOrder.updateMany(filter, {
    $set: { 'approvalAuthorities.srManagerProcurement': '' }
  });
  console.log(`Cleared Sr Manager text on ${clearResult.modifiedCount || 0} POs.`);

  for (const po of pendingLegacy) {
    const result = await reconcileLegacySrManagerProcurement(po, {
      pushHistory: (doc, from, to, userId, comments, module) => {
        doc.workflowHistory = doc.workflowHistory || [];
        doc.workflowHistory.push({
          fromStatus: from,
          toStatus: to,
          changedBy: userId,
          changedAt: new Date(),
          comments: comments || '',
          module: module || 'System'
        });
      }
    });
    if (result.cleared) cleared += 1;
    if (result.advanced) {
      advanced += 1;
      await po.save();
    } else if (result.cleared) {
      await po.save();
    }
  }

  console.log(`Cleared in reconcile pass: ${cleared}; advanced to Pending Audit: ${advanced}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await disconnectDB(); } catch (_) { /* ignore */ }
  });
