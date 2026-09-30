/**
 * LOCAL / DEV ONLY — seed "Payable to Related Parties" COA trees for flow testing.
 *
 * Companies:
 *  1) SARDAR GROUP OF COMPANIES
 *  2) TAJ RESIDENCIA (active local company — Taj Projects is inactive in dev)
 *
 * Usage (from repo root):
 *   node server/scripts/seed-related-party-payable-coa-local.js
 *
 * Refuses to run if NODE_ENV=production or if URI looks like production Atlas/droplet.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Account = require('../models/finance/Account');
const PlacementCompany = require('../models/hr/Company');

const LIABILITY = {
  type: 'Liability',
  category: 'Current liabilities',
  detailType: 'Other current liabilities',
  isActive: true,
  allowTransactions: true
};

const TREES = [
  {
    companyName: /SARDAR GROUP OF COMPANIES/i,
    label: 'SARDAR GROUP OF COMPANIES',
    parent: { accountNumber: '2000', name: 'Payable to Related Parties' },
    children: [
      { accountNumber: '2002', name: 'Taj Residencia' },
      { accountNumber: '2003', name: 'CICON - Country Health' },
      { accountNumber: '2005', name: 'TAJ Projects' }
    ]
  },
  {
    companyName: /TAJ RESIDENCIA/i,
    label: 'TAJ RESIDENCIA',
    parent: { accountNumber: '2212', name: 'Payable to Related Parties' },
    children: [
      { accountNumber: '2000', name: 'SGC-SARDAR GROUP OF COMPANIES' },
      { accountNumber: '2002', name: 'CICON - Country Health' },
      { accountNumber: '2003', name: 'Sardar Prime Builders' }
    ]
  }
];

function assertLocalUri(uri) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run: NODE_ENV=production');
  }
  const u = String(uri || '');
  if (!u) throw new Error('No MONGODB_URI_LOCAL / MONGODB_URI set');
  if (/atlas|mongodb\.net|68\.183\.215\.177|sgc_erp\?authSource=admin/i.test(u) && !/localhost|127\.0\.0\.1/i.test(u)) {
    throw new Error(`Refusing to run against non-local URI: ${u.replace(/\/\/.*@/, '//***@')}`);
  }
}

async function upsertAccount({ companyId, accountNumber, name, parentAccount = null }) {
  let doc = await Account.findOne({ companyId, accountNumber });
  if (doc) {
    doc.name = name;
    doc.type = LIABILITY.type;
    doc.category = LIABILITY.category;
    doc.detailType = LIABILITY.detailType;
    doc.isActive = true;
    doc.allowTransactions = true;
    if (parentAccount) doc.parentAccount = parentAccount;
    else if (doc.parentAccount) doc.parentAccount = undefined;
    await doc.save();
    return { doc, created: false };
  }
  doc = await Account.create({
    companyId,
    accountNumber,
    name,
    parentAccount: parentAccount || undefined,
    ...LIABILITY
  });
  return { doc, created: true };
}

async function seedTree(def) {
  const company = await PlacementCompany.findOne({ name: def.companyName }).select('_id name').lean();
  if (!company) {
    console.error(`✗ Company not found: ${def.label}`);
    return null;
  }
  console.log(`\n→ ${company.name} (${company._id})`);

  const { doc: parent, created: parentCreated } = await upsertAccount({
    companyId: company._id,
    accountNumber: def.parent.accountNumber,
    name: def.parent.name,
    parentAccount: null
  });
  console.log(`  ${parentCreated ? 'Created' : 'Updated'} ${parent.accountNumber} — ${parent.name} (parent)`);

  for (const child of def.children) {
    const { doc, created } = await upsertAccount({
      companyId: company._id,
      accountNumber: child.accountNumber,
      name: child.name,
      parentAccount: parent._id
    });
    console.log(`  ${created ? 'Created' : 'Updated'} ${doc.accountNumber} — ${doc.name} (subaccount of ${parent.accountNumber})`);
  }
  return company;
}

async function main() {
  const uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
  assertLocalUri(uri);
  console.log('Connecting (local/dev only)…');
  await mongoose.connect(uri);
  console.log(`DB: ${mongoose.connection.name}`);

  for (const tree of TREES) {
    await seedTree(tree);
  }

  console.log('\nDone. Open Chart of Accounts for Sardar Group and Taj Residencia to verify.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message || err);
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
  process.exit(1);
});
