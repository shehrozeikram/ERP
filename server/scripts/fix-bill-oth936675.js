#!/usr/bin/env node
/**
 * Sync bill OTH936675 amount to 25200 in Finance AP (+ linked utility bill + JE/GL).
 * Avoids JournalEntry post-save re-posting full amounts; adjusts account balances by delta only.
 * Usage: node server/scripts/fix-bill-oth936675.js [--apply]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');

const TARGET = 'OTH936675';
const NEW_AMOUNT = 25200;
const apply = process.argv.includes('--apply');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  await mongoose.connect(uri, getMongooseClientOptions(uri, /localhost|127/.test(uri || '')));
  const db = mongoose.connection.db;

  require('../models/finance/AccountsPayable');
  require('../models/finance/JournalEntry');
  require('../models/finance/GeneralLedger');
  require('../models/finance/Account');
  const AP = mongoose.model('AccountsPayable');
  const JE = mongoose.model('JournalEntry');
  const GL = mongoose.model('GeneralLedger');
  const Account = mongoose.model('Account');

  const bill = await AP.findOne({ billNumber: new RegExp(`^${TARGET}$`, 'i') }).lean();
  if (!bill) {
    console.log(JSON.stringify({ error: 'AP bill not found', TARGET }));
    process.exit(1);
  }

  const utility = bill.referenceId
    ? await db.collection('utilitybills').findOne({ _id: bill.referenceId })
    : null;

  const jes = await JE.find({
    $or: [
      { reference: TARGET },
      { referenceId: bill._id },
      { description: new RegExp(TARGET, 'i') }
    ]
  }).lean();

  console.log(JSON.stringify({
    apply,
    ap: {
      _id: bill._id,
      billNumber: bill.billNumber,
      totalAmount: bill.totalAmount,
      subtotal: bill.subtotal,
      status: bill.status,
      referenceId: bill.referenceId,
      lineItems: bill.lineItems
    },
    utility: utility
      ? {
        _id: utility._id,
        billId: utility.billId,
        totalAmount: utility.totalAmount,
        amount: utility.amount,
        grandTotal: utility.grandTotal,
        status: utility.status,
        financeApBillId: utility.financeApBillId
      }
      : null,
    journalEntries: jes.map((j) => ({
      _id: j._id,
      entryNumber: j.entryNumber,
      totalDebits: j.totalDebits,
      totalCredits: j.totalCredits,
      status: j.status,
      lines: (j.lines || []).map((l) => ({
        account: l.account,
        debit: l.debit,
        credit: l.credit
      }))
    }))
  }, null, 2));

  if (!apply) {
    console.log('Dry-run only. Re-run with --apply to set amount to', NEW_AMOUNT);
    await mongoose.disconnect();
    return;
  }

  const oldAmount = round2(bill.totalAmount);
  const delta = round2(NEW_AMOUNT - oldAmount);

  const lineItems = Array.isArray(bill.lineItems) && bill.lineItems.length
    ? bill.lineItems.map((l, idx) => {
      if (idx === 0) {
        return { ...l, amount: NEW_AMOUNT, unitPrice: NEW_AMOUNT, quantity: l.quantity || 1 };
      }
      return { ...l, amount: 0, unitPrice: 0 };
    })
    : [{
      description: `Admin Supply — ${TARGET}`,
      quantity: 1,
      unitPrice: NEW_AMOUNT,
      amount: NEW_AMOUNT
    }];

  await AP.updateOne(
    { _id: bill._id },
    {
      $set: {
        totalAmount: NEW_AMOUNT,
        subtotal: NEW_AMOUNT,
        lineItems,
        updatedAt: new Date()
      }
    }
  );
  console.log('AP_UPDATED', { from: oldAmount, to: NEW_AMOUNT, delta });

  if (utility) {
    const ubSet = { updatedAt: new Date() };
    if (utility.totalAmount != null) ubSet.totalAmount = NEW_AMOUNT;
    if (utility.amount != null) ubSet.amount = NEW_AMOUNT;
    if (utility.grandTotal != null) ubSet.grandTotal = NEW_AMOUNT;
    if (utility.billAmount != null) ubSet.billAmount = NEW_AMOUNT;
    if (Array.isArray(utility.billLines) && utility.billLines.length) {
      ubSet.billLines = utility.billLines.map((l, idx) => (
        idx === 0
          ? { ...l, amount: NEW_AMOUNT, total: NEW_AMOUNT, unitPrice: NEW_AMOUNT }
          : l
      ));
    }
    if (Array.isArray(utility.items) && utility.items.length) {
      ubSet.items = utility.items.map((l, idx) => (
        idx === 0
          ? { ...l, amount: NEW_AMOUNT, total: NEW_AMOUNT, unitPrice: NEW_AMOUNT, price: NEW_AMOUNT }
          : l
      ));
    }
    await db.collection('utilitybills').updateOne({ _id: utility._id }, { $set: ubSet });
    console.log('UTILITY_UPDATED', String(utility._id));
  }

  for (const je of jes) {
    const newLines = (je.lines || []).map((l) => {
      const next = { ...l };
      if (Number(l.debit) > 0) next.debit = NEW_AMOUNT;
      if (Number(l.credit) > 0) next.credit = NEW_AMOUNT;
      return next;
    });

    await JE.collection.updateOne(
      { _id: je._id },
      {
        $set: {
          lines: newLines,
          totalDebits: NEW_AMOUNT,
          totalCredits: NEW_AMOUNT,
          updatedAt: new Date()
        }
      }
    );

    const glRows = await GL.find({ journalEntry: je._id }).lean();
    for (const g of glRows) {
      const set = { updatedAt: new Date() };
      if (Number(g.debit) > 0) set.debit = NEW_AMOUNT;
      if (Number(g.credit) > 0) set.credit = NEW_AMOUNT;
      await GL.collection.updateOne({ _id: g._id }, { $set: set });

      // Adjust account running balance by delta only (matches JE post-save formula: debit - credit)
      if (je.status === 'posted' && Math.abs(delta) > 0.009 && g.account) {
        let balInc = 0;
        if (Number(g.debit) > 0) balInc = delta;
        else if (Number(g.credit) > 0) balInc = -delta;
        if (balInc) {
          await Account.collection.updateOne(
            { _id: g.account },
            { $inc: { balance: balInc } }
          );
        }
      }
    }

    console.log('JE_GL_UPDATED', {
      entryNumber: je.entryNumber,
      oldAmount,
      newAmount: NEW_AMOUNT,
      delta,
      glCount: glRows.length
    });
  }

  const verify = await AP.findById(bill._id).lean();
  const verifyJe = await JE.find({
    $or: [{ reference: TARGET }, { referenceId: bill._id }]
  }).select('entryNumber totalDebits totalCredits').lean();

  console.log('APPLY_OK', JSON.stringify({
    billNumber: verify.billNumber,
    totalAmount: verify.totalAmount,
    subtotal: verify.subtotal,
    lineAmount: verify.lineItems?.[0]?.amount,
    journalEntries: verifyJe
  }, null, 2));

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
