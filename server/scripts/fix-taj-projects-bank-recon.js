#!/usr/bin/env node
/**
 * Fix Taj Projects Bank Islami reconciliation chronology.
 *
 * Many imported vouchers were booked on 2026-06-30 (dump date) but cleared
 * on earlier real bank dates (clearedAt < book date). That makes historical
 * as-of views inconsistent. This restores book date = clearance date when
 * clearance is before the voucher date.
 *
 * Also recalculates COA balance from live GL.
 *
 * Usage:
 *   NODE_ENV=production node server/scripts/fix-taj-projects-bank-recon.js
 *   NODE_ENV=production node server/scripts/fix-taj-projects-bank-recon.js --apply
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');

const apply = process.argv.includes('--apply');
const TAJ_BANK_ID = '6a95495f8299f712d61ab3a7';
const TAJ_COMPANY_ID = '6a34d5aa8f72dc6ab5ef1c82';

const asOfCleared = (row, asOf) => {
  const marked = row.clearanceStatus === 'cleared' || row.isReconciled;
  const clearDate = row.clearedAt || row.reconciledAt;
  if (!marked || !clearDate) return false;
  return new Date(clearDate).getTime() <= asOf.getTime();
};

const monthEnd = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0, 23, 59, 59, 999));

const snapshot = (rows, asOf) => {
  const upTo = rows.filter((r) => new Date(r.date) <= asOf && !['cancelled', 'reversed'].includes(r.status));
  const netGl = upTo.reduce((s, r) => s + (Number(r.debit) || 0) - (Number(r.credit) || 0), 0);
  const bank = upTo
    .filter((r) => asOfCleared(r, asOf))
    .reduce((s, r) => s + (Number(r.debit) || 0) - (Number(r.credit) || 0), 0);
  return {
    glRows: upTo.length,
    netGl: Math.round(netGl * 100) / 100,
    bankStatement: Math.round(bank * 100) / 100
  };
};

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  await mongoose.connect(uri, getMongooseClientOptions(uri, /localhost|127/.test(uri || '')));
  const db = mongoose.connection.db;
  const bankId = new mongoose.Types.ObjectId(TAJ_BANK_ID);
  const companyId = new mongoose.Types.ObjectId(TAJ_COMPANY_ID);

  const bank = await db.collection('accounts').findOne({ _id: bankId, companyId });
  if (!bank) {
    console.error('Taj bank account not found');
    process.exit(1);
  }

  const rows = await db.collection('generalledgers').find({ account: bankId }).toArray();
  const active = rows.filter((r) => !['cancelled', 'reversed'].includes(r.status));

  const before = {
    '2025-06-30': snapshot(active, monthEnd(2025, 5)),
    '2025-12-31': snapshot(active, monthEnd(2025, 11)),
    '2026-06-30': snapshot(active, monthEnd(2026, 5)),
    '2026-08-31': snapshot(active, monthEnd(2026, 7))
  };

  const toFixDates = []; // CLEAR_BEFORE_BOOK → move book date to clearedAt
  const toFixClears = []; // absurd later clears (>180d) → clearedAt = bookDate

  for (const g of active) {
    if (!(g.clearanceStatus === 'cleared' || g.isReconciled)) continue;
    const clearedAt = g.clearedAt || g.reconciledAt;
    if (!clearedAt || !g.date) continue;
    const clearT = new Date(clearedAt).getTime();
    const bookT = new Date(g.date).getTime();
    if (Number.isNaN(clearT) || Number.isNaN(bookT)) continue;

    if (clearT < bookT) {
      const newDate = new Date(clearedAt);
      newDate.setUTCHours(12, 0, 0, 0);
      toFixDates.push({
        glId: g._id,
        jeId: g.journalEntry,
        entry: g.entryNumber,
        oldDate: g.date,
        newDate,
        clearedAt,
        debit: g.debit,
        credit: g.credit,
        desc: (g.description || '').slice(0, 80)
      });
      continue;
    }

    const dayDiff = (clearT - bookT) / 86400000;
    if (dayDiff > 180) {
      const newCleared = new Date(g.date);
      newCleared.setUTCHours(12, 0, 0, 0);
      toFixClears.push({
        glId: g._id,
        entry: g.entryNumber,
        bookDate: g.date,
        oldClearedAt: clearedAt,
        newClearedAt: newCleared,
        dayDiff: Math.round(dayDiff),
        debit: g.debit,
        credit: g.credit,
        desc: (g.description || '').slice(0, 80)
      });
    }
  }

  // Also fix pending rows that still carry a clearedAt
  const pendingWithClear = active.filter(
    (g) => g.clearanceStatus === 'pending' && (g.clearedAt || g.reconciledAt)
  );

  const summary = {
    apply,
    bank: { id: bank._id, name: bank.name, coaBalanceBefore: bank.balance },
    clearBeforeBookFixes: toFixDates.length,
    absurdLaterClearFixes: toFixClears.length,
    pendingClearDateCleanups: pendingWithClear.length,
    sampleDateFixes: toFixDates.slice(0, 15),
    sampleClearFixes: toFixClears.slice(0, 15),
    before
  };

  const applySimulation = (sourceRows) => {
    const byId = new Map(sourceRows.map((r) => [String(r._id), { ...r }]));
    for (const f of toFixDates) {
      const row = byId.get(String(f.glId));
      if (row) row.date = f.newDate;
    }
    for (const f of toFixClears) {
      const row = byId.get(String(f.glId));
      if (row) {
        row.clearedAt = f.newClearedAt;
        row.reconciledAt = f.newClearedAt;
      }
    }
    return [...byId.values()];
  };

  if (apply) {
    for (const f of toFixDates) {
      const gl = await db.collection('generalledgers').findOne({ _id: f.glId });
      await db.collection('generalledgers').updateOne(
        { _id: f.glId },
        { $set: { date: f.newDate, updatedAt: new Date() } }
      );
      if (f.jeId && gl) {
        const je = await db.collection('journalentries').findOne({ _id: f.jeId });
        // Only move JE date when it still matches this GL's old dump date
        if (je && je.date && new Date(je.date).getTime() === new Date(f.oldDate).getTime()) {
          await db.collection('journalentries').updateOne(
            { _id: f.jeId },
            { $set: { date: f.newDate, updatedAt: new Date() } }
          );
        }
      }
    }

    for (const f of toFixClears) {
      await db.collection('generalledgers').updateOne(
        { _id: f.glId },
        {
          $set: {
            clearedAt: f.newClearedAt,
            reconciledAt: f.newClearedAt,
            clearanceStatus: 'cleared',
            isReconciled: true,
            updatedAt: new Date()
          }
        }
      );
    }

    for (const g of pendingWithClear) {
      await db.collection('generalledgers').updateOne(
        { _id: g._id },
        {
          $set: {
            clearedAt: null,
            reconciledAt: null,
            isReconciled: false,
            updatedAt: new Date()
          }
        }
      );
    }

    const refreshed = await db.collection('generalledgers').find({
      account: bankId,
      status: { $nin: ['cancelled', 'reversed'] }
    }).toArray();
    const bal = refreshed.reduce((s, r) => s + (Number(r.debit) || 0) - (Number(r.credit) || 0), 0);
    await db.collection('accounts').updateOne(
      { _id: bankId },
      { $set: { balance: bal, updatedAt: new Date() } }
    );

    summary.coaBalanceAfter = Math.round(bal * 100) / 100;
    summary.after = {
      '2025-06-30': snapshot(refreshed, monthEnd(2025, 5)),
      '2025-12-31': snapshot(refreshed, monthEnd(2025, 11)),
      '2026-06-30': snapshot(refreshed, monthEnd(2026, 5)),
      '2026-08-31': snapshot(refreshed, monthEnd(2026, 7))
    };
  } else {
    const sim = applySimulation(active);
    summary.afterSimulated = {
      '2025-06-30': snapshot(sim, monthEnd(2025, 5)),
      '2025-12-31': snapshot(sim, monthEnd(2025, 11)),
      '2026-06-30': snapshot(sim, monthEnd(2026, 5)),
      '2026-08-31': snapshot(sim, monthEnd(2026, 7))
    };
  }

  console.log(JSON.stringify(summary, null, 2));
  console.log(apply ? 'TAJ_APPLY_OK' : 'TAJ_DRY_OK');
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
