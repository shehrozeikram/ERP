/**
 * Remediate stale finance impact left behind by older journal-entry deletes
 * (JE removed but Account.balance / AR / AP / CA / banking / payroll still wrong).
 *
 * Safe defaults: dry-run only. Pass { apply: true } to write.
 */
const mongoose = require('mongoose');
const Account = require('../models/finance/Account');
const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');
const FinanceHelper = require('./financeHelper');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const emptyStats = () => ({
  postedJournalCount: 0,
  accountsBalanceReset: 0,
  accountsBalanceUpdated: 0,
  orphanGlDeleted: 0,
  glRepaired: 0,
  arInvoicesTouched: 0,
  arPaymentsRemoved: 0,
  apAppsRemoved: 0,
  apBillsTouched: 0,
  legacyApPaymentsRemoved: 0,
  cashApprovalsCleared: 0,
  vendorAdvancesCleared: 0,
  bankingAccountsTouched: 0,
  bankingTxRemoved: 0,
  payrollAppsRemoved: 0,
  payrollLettersRemoved: 0,
  landLinksCleared: 0,
  grnLinksCleared: 0,
  errors: []
});

const loadExistingJournalIdSet = async () => {
  const ids = await JournalEntry.distinct('_id');
  return new Set(ids.map((id) => String(id)));
};

const rebuildAccountBalancesFromPostedJournals = async ({ apply, stats }) => {
  const posted = await JournalEntry.find({ status: 'posted' })
    .select('lines.account lines.debit lines.credit')
    .lean();
  stats.postedJournalCount = posted.length;

  const totals = new Map();
  for (const je of posted) {
    for (const line of je.lines || []) {
      const accountId = line.account ? String(line.account) : null;
      if (!accountId || !mongoose.Types.ObjectId.isValid(accountId)) continue;
      const delta = (Number(line.debit) || 0) - (Number(line.credit) || 0);
      totals.set(accountId, round2((totals.get(accountId) || 0) + delta));
    }
  }

  const accounts = await Account.find({}).select('_id balance accountNumber name').lean();
  for (const acc of accounts) {
    const next = round2(totals.get(String(acc._id)) || 0);
    const prev = round2(acc.balance || 0);
    if (prev === next) continue;
    stats.accountsBalanceUpdated += 1;
    if (apply) {
      await Account.updateOne({ _id: acc._id }, { $set: { balance: next } });
    }
  }

  // Accounts with no posted activity should be zero if they still hold a stale balance
  // (already handled above via next=0). Count resets for reporting.
  stats.accountsBalanceReset = stats.accountsBalanceUpdated;
};

const cleanupOrphanGeneralLedger = async ({ apply, jeIds, stats }) => {
  const glRows = await GeneralLedger.find({}).select('_id journalEntry').lean();
  const orphanIds = [];
  for (const row of glRows) {
    const jid = row.journalEntry ? String(row.journalEntry) : '';
    if (!jid || !jeIds.has(jid)) orphanIds.push(row._id);
  }
  stats.orphanGlDeleted = orphanIds.length;
  if (apply && orphanIds.length) {
    await GeneralLedger.deleteMany({ _id: { $in: orphanIds } });
  }

  // Ensure every posted JE has GL rows (legacy rows often miss module)
  const postedIds = await JournalEntry.find({ status: 'posted' }).select('_id module').lean();
  for (const row of postedIds) {
    const count = await GeneralLedger.countDocuments({ journalEntry: row._id });
    if (count > 0) continue;
    stats.glRepaired += 1;
    if (apply) {
      try {
        // Older vouchers may have no module; GL schema requires it
        if (!row.module) {
          await JournalEntry.updateOne(
            { _id: row._id },
            { $set: { module: 'general' } }
          );
        }
        await FinanceHelper.postToGeneralLedger(row._id);
      } catch (err) {
        stats.errors.push(`GL repair ${row._id}: ${err.message}`);
      }
    }
  }
};

const remediateAccountsReceivable = async ({ apply, jeIds, stats }) => {
  const AccountsReceivable = require('../models/finance/AccountsReceivable');
  const invoices = await AccountsReceivable.find({
    $or: [
      { 'payments.journalEntry': { $exists: true, $ne: null } },
      { 'installments.lastJournalEntry': { $exists: true, $ne: null } }
    ]
  });

  for (const invoice of invoices) {
    let touched = false;
    let removedAmt = 0;

    if (!Array.isArray(invoice.payments)) invoice.payments = [];
    if (!Array.isArray(invoice.installments)) invoice.installments = [];

    const keepPayments = [];
    for (const pay of invoice.payments) {
      const jid = pay.journalEntry ? String(pay.journalEntry) : '';
      if (jid && !jeIds.has(jid)) {
        removedAmt = round2(removedAmt + Number(pay.amount || 0));
        stats.arPaymentsRemoved += 1;
        touched = true;

        if (pay.installmentId) {
          const inst = invoice.installments.id
            ? invoice.installments.id(pay.installmentId)
            : invoice.installments.find((i) => String(i._id) === String(pay.installmentId));
          if (inst) {
            inst.paidAmount = round2(Math.max(0, Number(inst.paidAmount || 0) - Number(pay.amount || 0)));
            if (String(inst.lastJournalEntry || '') === jid) {
              inst.lastJournalEntry = null;
              inst.lastPaymentDate = null;
            }
            if (inst.paidAmount <= 0.01) {
              inst.paidAmount = 0;
              const due = inst.dueDate ? new Date(inst.dueDate) : null;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              inst.status = due && due < today ? 'overdue' : 'pending';
            } else {
              inst.status = 'partial';
            }
          }
        }
        continue;
      }
      keepPayments.push(pay);
    }
    invoice.payments = keepPayments;

    // Clear installment voucher links to missing JEs; rebuild paidAmount from remaining payments
    const paidByInstallment = new Map();
    for (const pay of invoice.payments) {
      if (!pay.installmentId) continue;
      const key = String(pay.installmentId);
      paidByInstallment.set(key, round2((paidByInstallment.get(key) || 0) + Number(pay.amount || 0)));
    }

    for (const inst of invoice.installments) {
      const lastId = inst.lastJournalEntry ? String(inst.lastJournalEntry) : '';
      if (lastId && !jeIds.has(lastId)) {
        inst.lastJournalEntry = null;
        inst.lastPaymentDate = null;
        touched = true;
      }
      if (inst._id && paidByInstallment.has(String(inst._id))) {
        const fromPays = paidByInstallment.get(String(inst._id));
        if (round2(inst.paidAmount || 0) !== fromPays) {
          inst.paidAmount = fromPays;
          const amt = Number(inst.amount) || 0;
          if (fromPays <= 0.01) {
            inst.status = 'pending';
          } else if (fromPays + 0.01 >= amt) {
            inst.status = 'paid';
          } else {
            inst.status = 'partial';
          }
          touched = true;
        }
      }
    }

    if (removedAmt > 0) {
      invoice.amountPaid = round2(Math.max(0, Number(invoice.amountPaid || 0) - removedAmt));
      touched = true;
    }

    if (touched) {
      stats.arInvoicesTouched += 1;
      if (apply) {
        FinanceHelper._updateDocumentStatus(invoice);
        invoice.markModified('payments');
        invoice.markModified('installments');
        await invoice.save();
      }
    }
  }
};

const remediateApPaymentApplications = async ({ apply, jeIds, stats }) => {
  const ApPaymentApplication = require('../models/finance/ApPaymentApplication');
  const AccountsPayable = require('../models/finance/AccountsPayable');
  const CashApproval = require('../models/procurement/CashApproval');
  const VendorAdvance = require('../models/finance/VendorAdvance');

  const apps = await ApPaymentApplication.find({});
  for (const app of apps) {
    const jid = app.journalEntryId ? String(app.journalEntryId) : '';
    // Only touch apps that still point at a journal entry that no longer exists
    if (!jid || jeIds.has(jid)) continue;

    const billsToProcess =
      app.bills?.length > 0
        ? app.bills
        : app.accountsPayableId
          ? [{ billId: app.accountsPayableId, amount: app.amount }]
          : [];

    const fullyApproved = app.workflowStatus === 'fully_approved';
    const refToMatch = app.paymentMeta?.reference;
    const entryId = app.journalEntryId;

    for (const item of billsToProcess) {
      const bill = await AccountsPayable.findById(item.billId);
      if (!bill) continue;
      const amountToRemove = round2(item.amount);
      stats.apBillsTouched += 1;

      if (apply) {
        if (fullyApproved) {
          if (app.sourceType === 'bank_payment') {
            if (Array.isArray(bill.payments)) {
              const idx = bill.payments.findIndex(
                (p) =>
                  (entryId && p.journalEntry && String(p.journalEntry) === String(entryId)) ||
                  (refToMatch && p.reference === refToMatch && round2(p.amount) === amountToRemove)
              );
              if (idx > -1) bill.payments.splice(idx, 1);
            }
            bill.amountPaid = round2(Math.max(0, Number(bill.amountPaid || 0) - amountToRemove));
          } else if (app.sourceType === 'cash_approval') {
            bill.advanceApplied = round2(Math.max(0, Number(bill.advanceApplied || 0) - amountToRemove));
            if (Array.isArray(bill.employeeAdvanceAllocations) && app.cashApprovalId) {
              bill.employeeAdvanceAllocations = bill.employeeAdvanceAllocations.filter(
                (a) =>
                  !(
                    String(a.cashApprovalId) === String(app.cashApprovalId) &&
                    round2(a.amount) === amountToRemove
                  )
              );
            }
            if (app.cashApprovalId) {
              const ca = await CashApproval.findById(app.cashApprovalId);
              if (ca) {
                ca.apAdvanceApplied = round2(Math.max(0, Number(ca.apAdvanceApplied || 0) - amountToRemove));
                await ca.save();
              }
            }
          } else if (app.sourceType === 'vendor_advance') {
            bill.advanceApplied = round2(Math.max(0, Number(bill.advanceApplied || 0) - amountToRemove));
            if (app.vendorAdvanceId) {
              const adv = await VendorAdvance.findById(app.vendorAdvanceId);
              if (adv) {
                adv.appliedAmount = round2(Math.max(0, Number(adv.appliedAmount || 0) - amountToRemove));
                if (Array.isArray(adv.allocations)) {
                  adv.allocations = adv.allocations.filter(
                    (a) =>
                      !(String(a.billId) === String(bill._id) && round2(a.amount) === amountToRemove)
                  );
                }
                const rem = round2((Number(adv.amount) || 0) - (Number(adv.appliedAmount) || 0));
                if (adv.appliedAmount <= 0.01) adv.status = 'open';
                else if (rem > 0.01) adv.status = 'partially_applied';
                else adv.status = 'applied';
                await adv.save();
              }
            }
          }
        } else if (app.sourceType === 'bank_payment') {
          bill.paymentPending = round2(Math.max(0, Number(bill.paymentPending || 0) - amountToRemove));
        } else {
          bill.advancePending = round2(Math.max(0, Number(bill.advancePending || 0) - amountToRemove));
        }

        FinanceHelper._updateDocumentStatus(bill);
        bill.markModified('payments');
        bill.markModified('employeeAdvanceAllocations');
        await bill.save();
      }
    }

    stats.apAppsRemoved += 1;
    if (apply) await ApPaymentApplication.findByIdAndDelete(app._id);
  }
};

const remediateLegacyApPayments = async ({ apply, jeIds, stats }) => {
  const AccountsPayable = require('../models/finance/AccountsPayable');
  const bills = await AccountsPayable.find({ 'payments.journalEntry': { $exists: true, $ne: null } });
  for (const bill of bills) {
    let removed = 0;
    const next = [];
    for (const p of bill.payments || []) {
      const jid = p.journalEntry ? String(p.journalEntry) : '';
      if (jid && !jeIds.has(jid)) {
        removed = round2(removed + Number(p.amount || 0));
        stats.legacyApPaymentsRemoved += 1;
        continue;
      }
      next.push(p);
    }
    if (removed > 0) {
      stats.apBillsTouched += 1;
      if (apply) {
        bill.payments = next;
        bill.amountPaid = round2(Math.max(0, Number(bill.amountPaid || 0) - removed));
        FinanceHelper._updateDocumentStatus(bill);
        bill.markModified('payments');
        await bill.save();
      }
    }
  }
};

const remediateCashApprovals = async ({ apply, jeIds, stats }) => {
  const CashApproval = require('../models/procurement/CashApproval');
  const cas = await CashApproval.find({ voucherEntryId: { $ne: null } });
  for (const ca of cas) {
    const jid = String(ca.voucherEntryId);
    if (jeIds.has(jid)) continue;
    stats.cashApprovalsCleared += 1;
    if (apply) {
      ca.voucherEntryId = null;
      if (ca.status === 'Advance Issued') ca.status = 'Finance Authority Approved';
      await ca.save();
    }
  }
};

const remediateVendorAdvances = async ({ apply, jeIds, stats }) => {
  const VendorAdvance = require('../models/finance/VendorAdvance');
  const rows = await VendorAdvance.find({ journalEntryId: { $ne: null } });
  for (const adv of rows) {
    const jid = String(adv.journalEntryId);
    if (jeIds.has(jid)) continue;
    stats.vendorAdvancesCleared += 1;
    if (apply) {
      adv.journalEntryId = null;
      if (adv.voucherWorkflowStatus === 'fully_approved' || adv.voucherWorkflowStatus === 'immediate') {
        adv.voucherWorkflowStatus = 'rejected';
      }
      await adv.save();
    }
  }
};

const remediateBanking = async ({ apply, jeIds, stats }) => {
  const Banking = require('../models/finance/Banking');
  const accounts = await Banking.find({ 'transactions.journalEntry': { $exists: true, $ne: null } });
  for (const bank of accounts) {
    const before = (bank.transactions || []).length;
    const next = (bank.transactions || []).filter((t) => {
      const jid = t.journalEntry ? String(t.journalEntry) : '';
      if (jid && !jeIds.has(jid)) {
        stats.bankingTxRemoved += 1;
        return false;
      }
      return true;
    });
    if (next.length !== before) {
      stats.bankingAccountsTouched += 1;
      if (apply) {
        bank.transactions = next;
        bank.markModified('transactions');
        await bank.save();
      }
    }
  }
};

const remediatePayroll = async ({ apply, jeIds, stats }) => {
  const PayrollPeriodPaymentApplication = require('../models/finance/PayrollPeriodPaymentApplication');
  const apps = await PayrollPeriodPaymentApplication.find({}).select('_id journalEntryId').lean();
  const orphanAppIds = apps
    .filter((a) => a.journalEntryId && !jeIds.has(String(a.journalEntryId)))
    .map((a) => a._id);
  stats.payrollAppsRemoved = orphanAppIds.length;
  if (apply && orphanAppIds.length) {
    await PayrollPeriodPaymentApplication.deleteMany({ _id: { $in: orphanAppIds } });
  }

  try {
    const PayrollBankLetter = require('../models/finance/PayrollBankLetter');
    const letters = await PayrollBankLetter.find({}).select('_id journalEntryId').lean();
    const orphanLetterIds = letters
      .filter((l) => l.journalEntryId && !jeIds.has(String(l.journalEntryId)))
      .map((l) => l._id);
    stats.payrollLettersRemoved = orphanLetterIds.length;
    if (apply && orphanLetterIds.length) {
      await PayrollBankLetter.deleteMany({ _id: { $in: orphanLetterIds } });
    }
  } catch (_) {
    /* optional */
  }
};

const remediateLandAndGrn = async ({ apply, jeIds, stats }) => {
  try {
    const LandPurchase = require('../models/tajResidencia/LandPurchase');
    const purchases = await LandPurchase.find({ 'installments.voucherEntryId': { $ne: null } });
    for (const doc of purchases) {
      let changed = false;
      (doc.installments || []).forEach((row) => {
        const jid = row.voucherEntryId ? String(row.voucherEntryId) : '';
        if (jid && !jeIds.has(jid)) {
          row.voucherEntryId = null;
          changed = true;
          stats.landLinksCleared += 1;
        }
      });
      if (changed && apply) {
        doc.markModified('installments');
        await doc.save();
      }
    }
  } catch (_) {
    /* optional */
  }

  try {
    const LandTransfer = require('../models/tajResidencia/LandTransfer');
    const transfers = await LandTransfer.find({ 'transferPayments.voucherEntryId': { $ne: null } });
    for (const doc of transfers) {
      let changed = false;
      (doc.transferPayments || []).forEach((row) => {
        const jid = row.voucherEntryId ? String(row.voucherEntryId) : '';
        if (jid && !jeIds.has(jid)) {
          row.voucherEntryId = null;
          changed = true;
          stats.landLinksCleared += 1;
        }
      });
      if (changed && apply) {
        doc.markModified('transferPayments');
        await doc.save();
      }
    }
  } catch (_) {
    /* optional */
  }

  try {
    const GoodsReceive = require('../models/procurement/GoodsReceive');
    const grns = await GoodsReceive.find({ journalEntry: { $ne: null } }).select('_id journalEntry').lean();
    const orphan = grns.filter((g) => g.journalEntry && !jeIds.has(String(g.journalEntry)));
    stats.grnLinksCleared = orphan.length;
    if (apply && orphan.length) {
      await GoodsReceive.updateMany(
        { _id: { $in: orphan.map((g) => g._id) } },
        { $unset: { journalEntry: 1 } }
      );
    }
  } catch (_) {
    /* optional */
  }
};

/**
 * @param {{ apply?: boolean }} options
 */
const remediateOrphanJournalImpacts = async (options = {}) => {
  const apply = !!options.apply;
  const stats = emptyStats();
  const jeIds = await loadExistingJournalIdSet();

  await rebuildAccountBalancesFromPostedJournals({ apply, stats });
  await cleanupOrphanGeneralLedger({ apply, jeIds, stats });
  await remediateAccountsReceivable({ apply, jeIds, stats });
  await remediateApPaymentApplications({ apply, jeIds, stats });
  await remediateLegacyApPayments({ apply, jeIds, stats });
  await remediateCashApprovals({ apply, jeIds, stats });
  await remediateVendorAdvances({ apply, jeIds, stats });
  await remediateBanking({ apply, jeIds, stats });
  await remediatePayroll({ apply, jeIds, stats });
  await remediateLandAndGrn({ apply, jeIds, stats });

  return { apply, journalEntryCount: jeIds.size, stats };
};

module.exports = {
  remediateOrphanJournalImpacts
};
