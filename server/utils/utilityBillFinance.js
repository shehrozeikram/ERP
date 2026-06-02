/**
 * Post audit-approved utility bills to Finance (AP + GL).
 * DR 6200 Utilities (Electricity/Gas) — CR 2001 Accounts Payable.
 * Consolidated parent bills → one AP; child bills (consolidatedIntoBillId) are skipped.
 */

require('../models/finance/FiscalPeriod');
require('../models/finance/FinanceJournal');

const User = require('../models/User');
const AccountsPayable = require('../models/finance/AccountsPayable');
const JournalEntry = require('../models/finance/JournalEntry');
const FinanceHelper = require('./financeHelper');
const { createAndEmitNotification } = require('../services/realtimeNotificationService');

const UTILITY_EXPENSE_ACCOUNT = '6200';

/** Normalize user id from req.user or raw ObjectId (AP requires createdBy). */
const normalizeActorId = (userOrId) => {
  if (!userOrId) return null;
  if (typeof userOrId === 'object' && userOrId !== null) {
    return userOrId._id || userOrId.id || null;
  }
  return userOrId;
};

const getUserIdsByRoles = async (roles = []) => {
  const users = await User.find({ isActive: true, role: { $in: roles } }).select('_id');
  return users.map((u) => String(u._id));
};

/**
 * Build AP line items (one consolidated AP; optional multi-line for memo detail).
 */
const buildUtilityBillLineItems = (bill) => {
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  if (Array.isArray(bill.billLines) && bill.billLines.length > 0) {
    return bill.billLines.map((line) => {
      const amt = round2(line.amount);
      const label = line.itemName || line.utilityType || 'Item';
      const loc = line.site || line.location || '';
      const codePart = line.itemCode ? ` [${line.itemCode}]` : '';
      return {
        description: `${label}${codePart}${loc ? ` — ${loc}` : ''}${line.meterNumber ? ` (Meter ${line.meterNumber})` : ''}`.trim(),
        quantity: 1,
        unitPrice: amt,
        expenseAccount: line.expenseAccount,
        expenseAccountNumber: line.expenseAccountNumber
      };
    }).filter((li) => li.unitPrice > 0);
  }

  if (bill.isConsolidated && Array.isArray(bill.consolidatedFrom) && bill.consolidatedFrom.length > 0) {
    return bill.consolidatedFrom.map((line, idx) => {
      const amt = round2(line.amount);
      const site = line.site || line.department || '';
      const type = line.utilityType || bill.utilityType || 'Utility';
      const provider = line.provider || bill.provider || '';
      return {
        description: `${type}${site ? ` — ${site}` : ''}${provider ? ` (${provider})` : ''}`.trim() || `Line ${idx + 1}`,
        quantity: 1,
        unitPrice: amt
      };
    }).filter((li) => li.unitPrice > 0);
  }

  const amt = round2(bill.amount);
  const type = bill.utilityType || 'Utility';
  const site = bill.site || bill.accountHead || '';
  return [{
    description: `${type}${site ? ` — ${site}` : ''} (${bill.provider || 'Provider'})`.trim(),
    quantity: 1,
    unitPrice: amt
  }];
};

const getUtilityBillPostAmount = (bill) => {
  const lineItems = buildUtilityBillLineItems(bill);
  const total = lineItems.reduce((sum, li) => sum + (li.quantity * li.unitPrice), 0);
  return Math.round(total * 100) / 100;
};

const buildExpenseJournalLines = (apLineItems) => {
  if (!Array.isArray(apLineItems) || !apLineItems.length) return null;
  const rows = apLineItems
    .filter((li) => li.unitPrice > 0)
    .map((li) => ({
      account: li.expenseAccount || null,
      accountNumber: li.expenseAccountNumber || null,
      debit: Math.round((li.quantity * li.unitPrice) * 100) / 100,
      description: li.description
    }));
  const hasAccount = rows.some((r) => r.account || r.accountNumber);
  return hasAccount ? rows : null;
};

const buildUtilityBillApNotes = (bill) => {
  const narration = String(bill.notes || '').trim();
  const parts = [
    narration || null,
    `Admin utility bill ${bill.billId}`,
    bill.accountHead ? `Account head: ${bill.accountHead}` : null,
    bill.forWhat ? `For: ${bill.forWhat}` : null,
    bill.isConsolidated ? `Consolidated (${(bill.consolidatedFrom || []).length} bills)` : null
  ].filter(Boolean);
  return parts.join('. ');
};

const notifyFinanceUtilityBillPosted = async ({ actorId, bill, apEntry }) => {
  const recipientIds = await getUserIdsByRoles(['finance_manager', 'admin', 'super_admin']);
  if (!recipientIds.length) return;

  await createAndEmitNotification({
    recipientIds,
    title: 'Utility bill ready for payment',
    message: `Utility bill ${bill.billId} (${bill.provider}) — PKR ${Number(bill.amount || 0).toLocaleString()} posted to Accounts Payable.`,
    type: 'info',
    category: 'approval',
    priority: 'medium',
    actionUrl: '/finance/accounts-payable',
    createdBy: actorId,
    excludeUserId: actorId,
    metadata: {
      module: 'finance',
      entityId: apEntry._id,
      entityType: 'AccountsPayable',
      utilityBillId: bill._id,
      utilityBillNumber: bill.billId
    }
  });
};

const hasUtilityBillJournal = async (apEntry) => {
  const billNumber = apEntry.billNumber;
  const count = await JournalEntry.countDocuments({
    $or: [
      { reference: billNumber, status: 'posted' },
      { referenceId: apEntry._id, referenceType: 'bill', status: 'posted' }
    ]
  });
  return count > 0;
};

const postJournalForUtilityAp = async (apEntry, bill, createdByUserId) => {
  if (await hasUtilityBillJournal(apEntry)) {
    return { journalPosted: true, repaired: false };
  }

  const amount = Math.round(Number(apEntry.totalAmount || 0) * 100) / 100;
  if (amount <= 0) {
    return { journalPosted: false, error: 'zero_amount' };
  }

  const lineItems = (apEntry.lineItems && apEntry.lineItems.length > 0)
    ? apEntry.lineItems
    : buildUtilityBillLineItems(bill);

  const debitAccount = await FinanceHelper.getAccountByNumber(UTILITY_EXPENSE_ACCOUNT);
  const apAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.PAYABLE);
  if (!debitAccount || !apAccount) {
    return {
      journalPosted: false,
      error: `Chart of accounts missing (${!debitAccount ? UTILITY_EXPENSE_ACCOUNT : ''}${!apAccount ? ' 2001' : ''})`
    };
  }

  const billDateNorm = apEntry.billDate ? new Date(apEntry.billDate) : new Date();
  billDateNorm.setHours(0, 0, 0, 0);
  const vendorName = apEntry.vendor?.name || bill.provider || 'Utility Provider';
  const department = apEntry.department || 'admin';
  const module = apEntry.module || 'admin';
  const useSplitDebits = lineItems.length > 1;

  let journalLines;
  if (useSplitDebits) {
    journalLines = lineItems.map((li) => ({
      account: debitAccount._id,
      description: (li.description || `Utility — ${apEntry.billNumber}`).slice(0, 200),
      debit: Math.round((Number(li.quantity) || 1) * (Number(li.unitPrice) || 0) * 100) / 100,
      department
    }));
    const debitSum = journalLines.reduce((s, l) => s + l.debit, 0);
    if (Math.abs(debitSum - amount) > 0.01 && journalLines.length > 0) {
      journalLines[journalLines.length - 1].debit += amount - debitSum;
      journalLines[journalLines.length - 1].debit =
        Math.round(journalLines[journalLines.length - 1].debit * 100) / 100;
    }
    journalLines.push({
      account: apAccount._id,
      description: `Payable to ${vendorName}`,
      credit: amount,
      department
    });
  } else {
    journalLines = [
      {
        account: debitAccount._id,
        description: `Utility expense — ${apEntry.billNumber}`,
        debit: amount,
        department
      },
      {
        account: apAccount._id,
        description: `Payable to ${vendorName}`,
        credit: amount,
        department
      }
    ];
  }

  await FinanceHelper.createAndPostJournalEntry({
    date: billDateNorm,
    reference: apEntry.billNumber,
    description: `AP Bill: ${apEntry.billNumber} from ${vendorName}`,
    department,
    module,
    referenceId: apEntry._id,
    referenceType: 'bill',
    journalCode: 'PURCH',
    voucherSeries: 'BILL',
    createdBy: createdByUserId,
    lines: journalLines
  });

  return { journalPosted: true, repaired: true };
};

const linkUtilityBillToAp = async (bill, apEntry, createdByUserId, historyComment) => {
  bill.financeApBillId = apEntry._id;
  bill.financePostedAt = bill.financePostedAt || new Date();
  bill.financePostedBy = bill.financePostedBy || createdByUserId;

  if (historyComment) {
    if (!Array.isArray(bill.workflowHistory)) bill.workflowHistory = [];
    bill.workflowHistory.push({
      fromStatus: bill.auditStatus,
      toStatus: bill.auditStatus,
      changedBy: createdByUserId,
      changedAt: new Date(),
      comments: historyComment,
      module: 'finance'
    });
  }

  await bill.save();
};

/**
 * Create AP + journal for an audit-director-approved utility bill.
 * @returns {{ posted: boolean, skipped?: boolean, reason?: string, apId?: string, error?: string, repaired?: boolean }}
 */
const postUtilityBillToFinance = async (bill, createdByUserId) => {
  if (!bill || !bill._id) {
    return { posted: false, skipped: true, reason: 'invalid_bill' };
  }

  const actorId = normalizeActorId(createdByUserId);
  if (!actorId) {
    console.error('[utilityBillFinance] missing createdBy user id for bill', bill.billId);
    return { posted: false, error: 'Missing approver user id for Finance posting' };
  }

  if (bill.consolidatedIntoBillId) {
    return { posted: false, skipped: true, reason: 'child_consolidated_line' };
  }

  if (!isUtilityBillAuditFinalApproved(bill.auditStatus)) {
    return { posted: false, skipped: true, reason: 'not_audit_approved' };
  }

  const findExistingAp = async () => {
    if (bill.financeApBillId) {
      const linked = await AccountsPayable.findById(bill.financeApBillId);
      if (linked) return linked;
    }
    return AccountsPayable.findOne({
      referenceId: bill._id,
      referenceType: 'utility_bill'
    });
  };

  const existingAP = await findExistingAp();
  if (existingAP) {
    try {
      const journalResult = await postJournalForUtilityAp(existingAP, bill, actorId);
      await linkUtilityBillToAp(
        bill,
        existingAP,
        actorId,
        journalResult.repaired
          ? `Finance GL posted for AP ${existingAP.billNumber} — DR ${UTILITY_EXPENSE_ACCOUNT} / CR AP`
          : null
      );
      return {
        posted: journalResult.journalPosted,
        skipped: !journalResult.repaired,
        repaired: journalResult.repaired,
        reason: journalResult.repaired ? 'journal_repaired' : 'already_posted',
        apId: String(existingAP._id),
        billNumber: existingAP.billNumber,
        error: journalResult.error
      };
    } catch (err) {
      console.error('repairUtilityBillFinance failed:', err);
      return { posted: false, apId: String(existingAP._id), error: err.message };
    }
  }

  const amount = getUtilityBillPostAmount(bill);
  if (amount <= 0) {
    return { posted: false, skipped: true, reason: 'zero_amount' };
  }

  const lineItems = buildUtilityBillLineItems(bill);
  if (!lineItems.length) {
    return { posted: false, skipped: true, reason: 'no_line_items' };
  }

  let billNumber = bill.billId || `UB-${bill._id.toString().slice(-8)}`;
  const duplicateBillNo = await AccountsPayable.findOne({
    billNumber,
    referenceId: { $ne: bill._id }
  }).lean();
  if (duplicateBillNo) {
    billNumber = `${billNumber}-AP${Date.now().toString().slice(-6)}`;
  }

  const billDate = bill.billDate ? new Date(bill.billDate) : new Date();
  const dueDate = bill.dueDate ? new Date(bill.dueDate) : new Date(billDate);
  if (dueDate < billDate) {
    dueDate.setTime(billDate.getTime());
  }

  try {
    const expenseJournalLines = buildExpenseJournalLines(lineItems);
    const apEntry = await FinanceHelper.createAPFromBill({
      vendorName: bill.provider || 'Utility Provider',
      vendorEmail: '',
      vendorId: bill.payeeEmployee ? null : (bill.vendorId || null),
      payeeEmployeeId: bill.payeeEmployee || null,
      billNumber,
      vendorInvoiceNumber: bill.accountNumber || '',
      billDate,
      dueDate,
      amount,
      department: 'admin',
      module: 'admin',
      referenceId: bill._id,
      referenceType: 'utility_bill',
      lineItems,
      lineDescription: `${bill.utilityType || 'Utility'} — ${bill.billId}`,
      notes: buildUtilityBillApNotes(bill),
      createdBy: actorId,
      debitAccountNumber: UTILITY_EXPENSE_ACCOUNT,
      multiLineExpenseJournal: !expenseJournalLines && lineItems.length > 1,
      expenseJournalLines: expenseJournalLines || undefined
    });

    await linkUtilityBillToAp(
      bill,
      apEntry,
      actorId,
      `Posted to Finance: AP ${billNumber} — DR ${UTILITY_EXPENSE_ACCOUNT} / CR AP`
    );

    try {
      await notifyFinanceUtilityBillPosted({ actorId, bill, apEntry });
    } catch (notifyErr) {
      console.error('Utility bill finance notification failed:', notifyErr.message);
    }

    return { posted: true, apId: String(apEntry._id), billNumber };
  } catch (err) {
    console.error('postUtilityBillToFinance failed:', err);
    return { posted: false, error: err.message || 'finance_post_failed' };
  }
};

const isUtilityBillAuditFinalApproved = (auditStatus) => {
  const s = String(auditStatus || '');
  return s.startsWith('Approved (from ');
};

/**
 * Run after auditStatus is set to final approved (idempotent).
 */
const tryAutoPostUtilityBillToFinance = async (billId, actorId) => {
  const UtilityBill = require('../models/hr/UtilityBill');
  const fresh = await UtilityBill.findById(billId);
  if (!fresh) return { posted: false, reason: 'bill_not_found' };
  return postUtilityBillToFinance(fresh, actorId);
};

module.exports = {
  UTILITY_EXPENSE_ACCOUNT,
  buildUtilityBillLineItems,
  getUtilityBillPostAmount,
  postUtilityBillToFinance,
  isUtilityBillAuditFinalApproved,
  postJournalForUtilityAp,
  tryAutoPostUtilityBillToFinance,
  normalizeActorId
};
