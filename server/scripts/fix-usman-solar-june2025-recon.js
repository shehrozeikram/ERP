#!/usr/bin/env node
/**
 * Reverse mistaken Usman Solar JV-002500 (bank charges 10,388 posted 2026-09-22)
 * that double-counted charges already in the June 30 2025 bank statement.
 *
 * Usage:
 *   NODE_ENV=production node server/scripts/fix-usman-solar-june2025-recon.js
 *   NODE_ENV=production node server/scripts/fix-usman-solar-june2025-recon.js --apply
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');

const apply = process.argv.includes('--apply');
const EXPECTED = 4759514.75;
const USMAN_BANK_ID = '6a475f81b5a105a1ed16f30e';
const JV_NUMBER = 'JV-002500';

const asOfCleared = (row, asOf) => {
  const marked = row.clearanceStatus === 'cleared' || row.isReconciled;
  const clearDate = row.clearedAt || row.reconciledAt;
  if (!marked || !clearDate) return false;
  return new Date(clearDate).getTime() <= asOf.getTime();
};

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  await mongoose.connect(uri, getMongooseClientOptions(uri, /localhost|127/.test(uri || '')));
  const db = mongoose.connection.db;
  const bankId = new mongoose.Types.ObjectId(USMAN_BANK_ID);
  const asOf = new Date('2025-06-30T23:59:59.999Z');

  const je = await db.collection('journalentries').findOne({ entryNumber: JV_NUMBER, companyId: new mongoose.Types.ObjectId('6a34d5e38f72dc6ab5ef2a6b') });
  const glRows = je
    ? await db.collection('generalledgers').find({ journalEntry: je._id }).toArray()
    : await db.collection('generalledgers').find({ entryNumber: JV_NUMBER, account: bankId }).toArray();

  const summary = {
    apply,
    jvFound: Boolean(je),
    jeId: je?._id,
    jeStatus: je?.status,
    jePostedAt: je?.postedDate || je?.createdAt,
    glRows: glRows.map((g) => ({
      id: g._id,
      account: g.account,
      debit: g.debit,
      credit: g.credit,
      status: g.status,
      cleared: g.clearanceStatus
    }))
  };

  // Simulate bank statement balance after reversing JV bank credit
  const gl = await db.collection('generalledgers').find({
    account: bankId,
    date: { $lte: asOf },
    status: { $nin: ['cancelled', 'reversed'] }
  }).toArray();

  const withoutJv = gl.filter((g) => String(g.entryNumber) !== JV_NUMBER && String(g.journalEntry) !== String(je?._id || ''));
  const bankAfter = withoutJv
    .filter((g) => asOfCleared(g, asOf))
    .reduce((s, r) => s + (Number(r.debit) || 0) - (Number(r.credit) || 0), 0);
  const bankBefore = gl
    .filter((g) => asOfCleared(g, asOf))
    .reduce((s, r) => s + (Number(r.debit) || 0) - (Number(r.credit) || 0), 0);

  summary.bankStatementBeforeFix = Math.round(bankBefore * 100) / 100;
  summary.bankStatementAfterReverseJv = Math.round(bankAfter * 100) / 100;
  summary.expected = EXPECTED;
  summary.deltaAfter = Math.round((bankAfter - EXPECTED) * 100) / 100;

  if (apply && je) {
    // Cancel JE + GL (do not delete — audit trail)
    await db.collection('journalentries').updateOne(
      { _id: je._id },
      {
        $set: {
          status: 'cancelled',
          updatedAt: new Date(),
          notes: `${je.notes || ''}\n[auto] Cancelled ${new Date().toISOString()} — double-counted bank charges vs June 30 2025 statement closing ${EXPECTED}`.trim()
        }
      }
    );
    await db.collection('generalledgers').updateMany(
      { journalEntry: je._id },
      {
        $set: {
          status: 'cancelled',
          clearanceStatus: 'pending',
          isReconciled: false,
          clearedAt: null,
          reconciledAt: null,
          updatedAt: new Date()
        }
      }
    );

    // Adjust COA bank balance (+10388 credit reversal)
    const bankCredit = glRows
      .filter((g) => String(g.account) === USMAN_BANK_ID)
      .reduce((s, g) => s + (Number(g.credit) || 0) - (Number(g.debit) || 0), 0);
    if (bankCredit) {
      await db.collection('accounts').updateOne(
        { _id: bankId },
        { $inc: { balance: bankCredit }, $set: { updatedAt: new Date() } }
      );
      summary.accountBalanceInc = bankCredit;
    }
    summary.cancelled = true;
  }

  // Taj Projects placement companies + same as-of drift check on their ABL accounts
  const placement = await db.collection('placementcompanies').find({
    name: /Taj Project|TAJ PROJECT|Usman Solar/i
  }).project({ name: 1 }).toArray();
  summary.placementCompanies = placement;

  for (const co of placement) {
    const banks = await db.collection('accounts').find({
      companyId: co._id,
      name: /ABL-|Bank Islami|HBL-|MCB-/i
    }).project({ name: 1, accountNumber: 1 }).toArray();
    for (const b of banks) {
      const rows = await db.collection('generalledgers').find({
        account: b._id,
        date: { $lte: asOf },
        status: { $nin: ['cancelled', 'reversed'] }
      }).toArray();
      const netGl = rows.reduce((s, r) => s + (Number(r.debit) || 0) - (Number(r.credit) || 0), 0);
      const clearedAsOf = rows.filter((r) => asOfCleared(r, asOf));
      const bankAsOf = clearedAsOf.reduce((s, r) => s + (Number(r.debit) || 0) - (Number(r.credit) || 0), 0);
      const clearedLater = rows.filter((r) => {
        const marked = r.clearanceStatus === 'cleared' || r.isReconciled;
        const d = r.clearedAt || r.reconciledAt;
        return marked && d && new Date(d) > asOf;
      });
      summary[`bank_${co.name}_${b.name}`] = {
        glRows: rows.length,
        netGl: Math.round(netGl * 100) / 100,
        bankAsOf: Math.round(bankAsOf * 100) / 100,
        clearedLaterCount: clearedLater.length,
        clearedLaterNet: Math.round(clearedLater.reduce((s, r) => s + (Number(r.debit) || 0) - (Number(r.credit) || 0), 0) * 100) / 100
      };
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  console.log(apply ? 'APPLY_OK' : 'DRY_OK');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
