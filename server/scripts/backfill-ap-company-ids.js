/**
 * Re-assign Accounts Payable companyId from PO / GRN / company name.
 * Bills that still cannot be matched go to PlacementCompany "Others"
 * so nothing is lost from company filters.
 *
 * Usage:
 *   node server/scripts/backfill-ap-company-ids.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const AccountsPayable = require('../models/finance/AccountsPayable');
const PlacementCompany = require('../models/hr/Company');
const {
  resolveDocumentCompanyId,
  normalizeCompanyId,
  findOrCreateOthersCompany
} = require('../utils/financeCompanyContext');

const dryRun = process.argv.includes('--dry-run');

async function resolveFromCompanyName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const company = await PlacementCompany.findOne({
    name: { $regex: new RegExp(`^${escaped}$`, 'i') }
  }).select('_id name').lean();
  return company || null;
}

async function resolveBillCompany(bill) {
  if (bill.referenceType === 'purchase_order' && bill.referenceId) {
    const cid = await resolveDocumentCompanyId({
      purchaseOrderId: bill.referenceId,
      fallbackHistorical: false
    });
    if (cid) return { companyId: cid, matchedVia: 'purchase_order' };
  }

  if (bill.referenceType === 'grn' && bill.referenceId) {
    const cid = await resolveDocumentCompanyId({
      grnId: bill.referenceId,
      fallbackHistorical: false
    });
    if (cid) return { companyId: cid, matchedVia: 'grn' };
  }

  const linked = Array.isArray(bill.linkedGRNs) ? bill.linkedGRNs : [];
  for (const row of linked) {
    if (row.poId) {
      const cid = await resolveDocumentCompanyId({
        purchaseOrderId: row.poId,
        fallbackHistorical: false
      });
      if (cid) return { companyId: cid, matchedVia: 'linked_po' };
    }
    if (row.grnId) {
      const cid = await resolveDocumentCompanyId({
        grnId: row.grnId,
        fallbackHistorical: false
      });
      if (cid) return { companyId: cid, matchedVia: 'linked_grn' };
    }
  }

  const linePo = (bill.lineItems || []).find((li) => li.poId)?.poId;
  if (linePo) {
    const cid = await resolveDocumentCompanyId({
      purchaseOrderId: linePo,
      fallbackHistorical: false
    });
    if (cid) return { companyId: cid, matchedVia: 'line_po' };
  }

  const byName = await resolveFromCompanyName(bill.company);
  if (byName) return { companyId: byName._id, matchedVia: 'company_name' };

  return null;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected. dryRun=${dryRun}`);

  const others = await findOrCreateOthersCompany();
  console.log(`Others company: ${others._id} (${others.name})`);

  const bills = await AccountsPayable.find({})
    .select('_id billNumber companyId company referenceType referenceId linkedGRNs lineItems')
    .lean();

  let updated = 0;
  let skipped = 0;
  let sentToOthers = 0;
  const sample = [];

  for (const bill of bills) {
    const match = await resolveBillCompany(bill);
    let resolved = match?.companyId || null;
    let matchedVia = match?.matchedVia || null;

    if (!resolved) {
      resolved = others._id;
      matchedVia = 'others';
      sentToOthers += 1;
    }

    const current = normalizeCompanyId(bill.companyId);
    if (current && String(current) === String(resolved)) {
      skipped += 1;
      continue;
    }

    const companyDoc = await PlacementCompany.findById(resolved).select('name').lean();
    const patch = {
      companyId: resolved,
      ...(companyDoc?.name ? { company: companyDoc.name } : {})
    };

    if (sample.length < 25) {
      sample.push({
        billNumber: bill.billNumber,
        from: current ? String(current) : null,
        to: String(resolved),
        company: companyDoc?.name || '',
        matchedVia
      });
    }

    if (!dryRun) {
      await AccountsPayable.updateOne({ _id: bill._id }, { $set: patch });
    }
    updated += 1;
  }

  console.log(JSON.stringify({
    total: bills.length,
    updated,
    skippedSame: skipped,
    sentToOthers,
    othersCompanyId: String(others._id),
    sample
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
