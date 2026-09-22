#!/usr/bin/env node
/**
 * Change company on bill OTH128959 from Head Office → CICON (AP + utility + JE).
 * Usage: node server/scripts/fix-bill-oth128959-company.js [--apply]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');

const TARGET = 'OTH128959';
const NEW_COMPANY_NAME = 'CICON';
const apply = process.argv.includes('--apply');

const looksLikeHeadOffice = (value) => {
  const s = String(value || '').trim().toLowerCase();
  return !s || s === 'head office' || s === 'head-office' || s === 'headoffice' || s.includes('head office');
};

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  await mongoose.connect(uri, getMongooseClientOptions(uri, /localhost|127/.test(uri || '')));
  const db = mongoose.connection.db;

  require('../models/finance/AccountsPayable');
  require('../models/finance/JournalEntry');
  require('../models/hr/Company');
  const AP = mongoose.model('AccountsPayable');
  const JE = mongoose.model('JournalEntry');
  const PlacementCompany = mongoose.model('PlacementCompany');

  const bill = await AP.findOne({ billNumber: new RegExp(`^${TARGET}$`, 'i') }).lean();
  if (!bill) {
    console.log(JSON.stringify({ error: 'AP bill not found', TARGET }));
    process.exit(1);
  }

  const cicon = await PlacementCompany.findOne({
    name: { $regex: '^CICON$', $options: 'i' },
    isActive: { $ne: false }
  }).select('_id name companyCode isActive').lean()
    || await PlacementCompany.findOne({
      name: { $regex: 'CICON', $options: 'i' }
    }).select('_id name companyCode isActive').lean();

  if (!cicon) {
    console.log(JSON.stringify({ error: 'CICON company not found in PlacementCompany' }));
    process.exit(1);
  }

  const utility = bill.referenceId
    ? await db.collection('utilitybills').findOne({ _id: bill.referenceId })
    : await db.collection('utilitybills').findOne({ billId: new RegExp(`^${TARGET}$`, 'i') });

  const jes = await JE.find({
    $or: [
      { reference: TARGET },
      { referenceId: bill._id },
      { description: new RegExp(TARGET, 'i') }
    ]
  }).select('_id entryNumber companyId description status').lean();

  console.log(JSON.stringify({
    apply,
    targetCompany: { _id: cicon._id, name: cicon.name, companyCode: cicon.companyCode },
    ap: {
      _id: bill._id,
      billNumber: bill.billNumber,
      company: bill.company,
      companyId: bill.companyId,
      project: bill.project,
      status: bill.status,
      lineItems: (bill.lineItems || []).map((l) => ({
        description: l.description,
        company: l.company,
        project: l.project,
        amount: l.amount || l.unitPrice
      }))
    },
    utility: utility
      ? {
        _id: utility._id,
        billId: utility.billId,
        site: utility.site,
        accountHead: utility.accountHead,
        location: utility.location,
        financeApBillId: utility.financeApBillId,
        billLines: (utility.billLines || []).map((l) => ({
          itemName: l.itemName,
          site: l.site,
          location: l.location,
          amount: l.amount
        }))
      }
      : null,
    journalEntries: jes
  }, null, 2));

  if (!apply) {
    console.log('Dry-run only. Re-run with --apply to set company to', NEW_COMPANY_NAME);
    await mongoose.disconnect();
    return;
  }

  const updatedLineItems = (bill.lineItems || []).map((l) => {
    const next = { ...l };
    if (looksLikeHeadOffice(next.company) || !next.company) {
      next.company = NEW_COMPANY_NAME;
    }
    if (typeof next.description === 'string' && /head\s*office/i.test(next.description)) {
      next.description = next.description.replace(/head\s*office/gi, NEW_COMPANY_NAME);
    }
    return next;
  });

  await db.collection('accountspayables').updateOne(
    { _id: bill._id },
    {
      $set: {
        company: NEW_COMPANY_NAME,
        companyId: cicon._id,
        lineItems: updatedLineItems,
        updatedAt: new Date()
      }
    }
  );
  console.log('AP_UPDATED', {
    billNumber: TARGET,
    company: NEW_COMPANY_NAME,
    companyId: String(cicon._id)
  });

  if (utility) {
    const utilitySet = {
      site: NEW_COMPANY_NAME,
      updatedAt: new Date()
    };
    if (looksLikeHeadOffice(utility.accountHead)) {
      // accountHead enum may not include CICON — leave unless already Head Office string fields elsewhere
    }

    const billLines = Array.isArray(utility.billLines)
      ? utility.billLines.map((l) => {
        const next = { ...l };
        if (looksLikeHeadOffice(next.site) || !next.site) next.site = NEW_COMPANY_NAME;
        return next;
      })
      : utility.billLines;

    if (billLines) utilitySet.billLines = billLines;

    await db.collection('utilitybills').updateOne(
      { _id: utility._id },
      { $set: utilitySet }
    );
    console.log('UTILITY_UPDATED', { _id: String(utility._id), site: NEW_COMPANY_NAME });
  }

  for (const je of jes) {
    await db.collection('journalentries').updateOne(
      { _id: je._id },
      { $set: { companyId: cicon._id, updatedAt: new Date() } }
    );
    console.log('JE_UPDATED', { entryNumber: je.entryNumber, companyId: String(cicon._id) });
  }

  const verify = await AP.findById(bill._id).lean();
  console.log('APPLY_OK', JSON.stringify({
    billNumber: verify.billNumber,
    company: verify.company,
    companyId: verify.companyId,
    lineCompanies: (verify.lineItems || []).map((l) => l.company)
  }, null, 2));

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
