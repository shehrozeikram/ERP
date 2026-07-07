const mongoose = require('mongoose');
const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');
const Account = require('../models/finance/Account');
const AccountsPayable = require('../models/finance/AccountsPayable');
const AccountsReceivable = require('../models/finance/AccountsReceivable');
const VendorAdvance = require('../models/finance/VendorAdvance');
const CashApproval = require('../models/procurement/CashApproval');
const Employee = require('../models/hr/Employee');
const FiscalPeriod = require('../models/finance/FiscalPeriod');
const FinanceJournal = require('../models/finance/FinanceJournal');
const { ensureStaffAdvanceAccount } = require('./staffAdvanceAccount');
const {
  getBillNarration,
  getCashApprovalNarration,
  getGrnNarration,
  getSinNarration,
  getArInvoiceNarration,
  getVendorAdvanceNarration,
  withVoucherNarration
} = require('./documentNarration');
const { co, acct, withCompany } = require('./financePosting');
const { resolveDocumentCompanyId } = require('./financeCompanyContext');

/**
 * Finance Helper Utility
 * Centralizes AR/AP creation and GL posting logic
 */
const FinanceHelper = {
  // Account Mapping Constants (matching actual database accounts)
  ACCOUNTS: {
    CASH: '1001',
    BANK: '1002',
    INVENTORY: '1200',       // Stock Valuation Asset — DR on GRN
    VENDOR_ADVANCE: '1110',  // Advance to Suppliers (asset) — vendor prepayments
    STAFF_ADVANCE: '1120',   // Cash Advance to Staff — petty cash / cash purchase advances
    EMPLOYEE_LOAN: '1125',
    RECEIVABLE: '1100',
    PAYABLE: '2001',
    WHT_PAYABLE: '2004',
    GRNI: '2140',            // Goods Received Not Invoiced — CR on GRN, DR on AP Bill (THE KEY CLEARING ACCOUNT)
    SALARIES_PAYABLE: '2200',
    PF_PAYABLE: '2210',
    EOBI_PAYABLE: '2211',
    EOBI_PAYABLE_EMP: '2211-01',
    EOBI_PAYABLE_ER: '2211-02',
    EOBI_EXPENSE: '5015',
    OTHER_PAYROLL_DED: '2212',
    REVENUE_CAM: '4010',
    REVENUE_ELECTRICITY: '4020',
    REVENUE_RENT: '4030',
    COGS: '5000',            // Cost of Goods Sold — DR on SIN
    EXPENSE_GENERAL: '5001',
    EXPENSE_SALARIES: '5002',
    UTILITIES: '6200'
  },

  /**
   * Resolve finance accounts for a given inventory item.
   * Priority: item-level field → category defaults → global account number defaults.
   * Returns { inventoryAccountId, grniAccountId, cogsAccountId }
   */
  resolveInventoryAccounts: async (inventoryItem, companyId = null) => {
    const InventoryCategory = mongoose.model('InventoryCategory');
    const A = acct(companyId);
    const cid = co(companyId);
    const scoped = (query) => (cid ? { ...query, companyId: cid } : query);
    const mapRef = async (id) => {
      if (!id) return null;
      const mapped = await A.map(id);
      return mapped?._id || id;
    };
    const findGrniFallback = async () => {
      let acc = await Account.findOne(scoped({
        type: 'Liability',
        name: { $regex: 'goods\\s*received\\s*not\\s*invoiced|\\bgrni\\b', $options: 'i' }
      }));
      if (!acc) acc = await A.resolve(FinanceHelper.ACCOUNTS.GRNI);
      const looksLikeAp = /\baccounts?\s*payable\b|\bap\b/i.test(String(acc?.name || ''));
      if (acc && (String(acc.type || '').toLowerCase() !== 'liability' || looksLikeAp)) return null;
      return acc;
    };
    const findInventoryFallback = async () => {
      let acc = await A.resolve(FinanceHelper.ACCOUNTS.INVENTORY);
      const looksLikeReceivable = /\baccounts?\s*receivable\b|\bar\b/i.test(String(acc?.name || ''));
      if (acc && String(acc.type || '').toLowerCase() === 'asset' && !looksLikeReceivable) return acc;
      return Account.findOne(scoped({
        type: 'Asset',
        name: { $regex: 'inventory|stock|raw material', $options: 'i' }
      }));
    };

    let inventoryAccountId = inventoryItem.inventoryAccount;
    let grniAccountId = inventoryItem.grniAccount;
    let cogsAccountId = inventoryItem.cogsAccount;

    // Try category-level defaults for any missing account
    if ((!inventoryAccountId || !grniAccountId || !cogsAccountId) && inventoryItem.inventoryCategory) {
      const catId = inventoryItem.inventoryCategory?._id || inventoryItem.inventoryCategory;
      const cat = await InventoryCategory.findById(catId).lean();
      if (cat) {
        if (!inventoryAccountId) inventoryAccountId = cat.stockValuationAccount;
        if (!grniAccountId)      grniAccountId      = cat.stockInputAccount;
        if (!cogsAccountId)      cogsAccountId      = cat.stockOutputAccount;
      }
    }

    // Final fallback: find by well-known account numbers
    if (!inventoryAccountId) {
      const acc = await findInventoryFallback();
      inventoryAccountId = acc?._id;
    }
    if (!grniAccountId) {
      const acc = await findGrniFallback();
      grniAccountId = acc?._id;
    }
    if (!cogsAccountId) {
      const acc = await A.resolve(FinanceHelper.ACCOUNTS.COGS);
      cogsAccountId = acc?._id;
    }

    inventoryAccountId = await mapRef(inventoryAccountId);
    grniAccountId = await mapRef(grniAccountId);
    cogsAccountId = await mapRef(cogsAccountId);

    // Safety guards: if item/category has wrong account head linked, auto-correct at posting time.
    if (inventoryAccountId) {
      const invAcc = await Account.findById(inventoryAccountId).select('type name');
      const looksLikeAr = /\baccounts?\s*receivable\b|\bar\b/i.test(String(invAcc?.name || ''));
      if (!invAcc || String(invAcc.type || '').toLowerCase() !== 'asset' || looksLikeAr) {
        const fallback = await findInventoryFallback();
        inventoryAccountId = fallback?._id || null;
      }
    }
    if (grniAccountId) {
      const grniAcc = await Account.findById(grniAccountId).select('type name');
      const looksLikeAr = /\baccounts?\s*receivable\b|\bar\b/i.test(String(grniAcc?.name || ''));
      const looksLikeAp = /\baccounts?\s*payable\b|\bap\b/i.test(String(grniAcc?.name || ''));
      if (!grniAcc || String(grniAcc.type || '').toLowerCase() !== 'liability' || looksLikeAr || looksLikeAp) {
        const fallback = await findGrniFallback();
        grniAccountId = fallback?._id || null;
      }
    }

    return { inventoryAccountId, grniAccountId, cogsAccountId };
  },

  /**
   * Resolve GRNI account for AP bill clearing based on linked GRN/PO item mapping.
   * Priority:
   *   1) GRN lines → inventory (linked id, then code/name match) → item/category GRNI
   *   2) When no GRN yet (AP is often created at PO approval before GRN): PO lines →
   *      inventory by productCode / description (same idea as GRN stock sync)
   *   3) Global GRNI account number fallback (ACCOUNTS.GRNI, often 2100)
   */
  resolveGrniAccountForBill: async ({ referenceType, referenceId, companyId = null } = {}) => {
    const GoodsReceive = mongoose.model('GoodsReceive');
    const Inventory = mongoose.model('Inventory');
    const PurchaseOrder = mongoose.model('PurchaseOrder');

    const cid = co({ companyId }) || await resolveDocumentCompanyId({
      grnId: referenceType === 'grn' ? referenceId : null,
      purchaseOrderId: referenceType === 'purchase_order' ? referenceId : null
    });

    const grniFromInventoryDoc = async (inv) => {
      if (!inv) return null;
      const { grniAccountId } = await FinanceHelper.resolveInventoryAccounts(inv, cid);
      if (!grniAccountId) return null;
      const acc = await Account.findById(grniAccountId);
      const looksLikeAp = /\baccounts?\s*payable\b|\bap\b/i.test(String(acc?.name || ''));
      if (looksLikeAp) return null;
      return acc || null;
    };

    const resolveInventoryFromGrnLine = async (item) => {
      let inv = null;
      const linkedId = item.inventoryItem?._id || item.inventoryItem;
      if (linkedId) {
        inv = await Inventory.findById(linkedId).lean();
      }
      if (!inv) {
        const code = String(item.itemCode || item.productCode || '').trim();
        const name = String(item.itemName || '').trim();
        if (code && code !== '—') inv = await Inventory.findOne({ itemCode: code }).lean();
        if (!inv && name && name !== '—') {
          inv = await Inventory.findOne({ name }).sort({ createdAt: -1 }).lean();
        }
      }
      return inv;
    };

    const resolveInventoryFromPoLine = async (line) => {
      let inv = null;
      const code = String(line.productCode || '').trim();
      const desc = String(line.description || '').trim();
      if (code && code !== '—') inv = await Inventory.findOne({ itemCode: code }).lean();
      if (!inv && desc && desc !== '—') {
        inv = await Inventory.findOne({ name: desc }).sort({ createdAt: -1 }).lean();
      }
      return inv;
    };

    let grnDoc = null;
    if (referenceType === 'grn' && referenceId) {
      grnDoc = await GoodsReceive.findById(referenceId).lean();
    } else if (referenceType === 'purchase_order' && referenceId) {
      grnDoc = await GoodsReceive.findOne({
        purchaseOrder: referenceId,
        status: { $in: ['Received', 'Complete', 'Partial'] }
      })
        .sort({ receiveDate: -1, createdAt: -1 })
        .lean();
    }

    if (grnDoc?.items?.length) {
      for (const item of grnDoc.items) {
        const inv = await resolveInventoryFromGrnLine(item);
        const acc = await grniFromInventoryDoc(inv);
        if (acc) return acc;
      }
    }

    // AP bill is often posted when the PO is approved — before any GRN exists.
    // Match PO lines to inventory master so GRNI matches GRN posting later (e.g. 2140).
    if (referenceType === 'purchase_order' && referenceId) {
      const po = await PurchaseOrder.findById(referenceId).lean();
      if (po?.items?.length) {
        for (const line of po.items) {
          const inv = await resolveInventoryFromPoLine(line);
          const acc = await grniFromInventoryDoc(inv);
          if (acc) return acc;
        }
      }
    }

    return (await acct(cid).resolve(FinanceHelper.ACCOUNTS.GRNI)) || null;
  },

  /**
   * Resolve the Journal document ID for a given journal code.
   * Returns the journal _id or null if not found.
   */
  resolveJournal: async (code) => {
    try {
      const FinanceJournal = mongoose.model('FinanceJournal');
      const j = await FinanceJournal.findOne({ code: code.toUpperCase(), isActive: true }).lean();
      return j?._id || null;
    } catch {
      return null;
    }
  },

  /**
   * Helper to find an account by number (optionally scoped to a company).
   * Usage: getAccountByNumber('1002') OR getAccountByNumber(companyId, '1002')
   */
  getAccountByNumber: async (accountNumberOrCompanyId, accountNumberMaybe) => {
    const AccountResolver = require('./accountResolver');
    if (accountNumberMaybe !== undefined) {
      return AccountResolver.resolveSystemAccount(accountNumberOrCompanyId, accountNumberMaybe);
    }
    return AccountResolver.resolveSystemAccount(null, accountNumberOrCompanyId);
  },

  /** @see staffAdvanceAccount.js */
  ensureStaffAdvanceAccount,

  /**
   * Post a Journal Entry to the General Ledger
   */
  postToGeneralLedger: async (journalEntryId) => {
    try {
      const entry = await JournalEntry.findById(journalEntryId).populate('lines.account');
      if (!entry || entry.status !== 'posted') {
        throw new Error('Journal entry not found or not posted');
      }

      const ledgerEntries = [];
      for (const line of entry.lines) {
        const accountRef = (line.account && line.account._id) ? line.account._id : line.account;
        if (!accountRef) {
          throw new Error('Journal line is missing account for GL posting');
        }
        // Fetch the latest account balance to ensure running balance is accurate
        const currentAccount = await Account.findById(accountRef).lean();
        if (!currentAccount) {
          throw new Error(`Account not found for GL posting: ${accountRef}`);
        }

        ledgerEntries.push({
          companyId: entry.companyId || currentAccount.companyId || null,
          journalEntry: entry._id,
          account: accountRef,
          date: entry.date,
          entryNumber: entry.entryNumber,
          reference: entry.reference,
          description: line.description || entry.description,
          debit: line.debit,
          credit: line.credit,
          department: line.department || entry.department,
          module: entry.module,
          referenceId: entry.referenceId,
          referenceType: entry.referenceType,
          costCenter: line.costCenter || null,
          status: 'posted',
          createdBy: entry.createdBy,
          runningBalance: currentAccount.balance
        });
      }

      await GeneralLedger.insertMany(ledgerEntries);
      return true;
    } catch (error) {
      console.error('❌ Error posting to General Ledger:', error);
      throw error;
    }
  },

  /**
   * Create a balanced journal entry in **draft** (no GL, no account balance update).
   */
  createDraftJournalEntry: async (data) => {
    const postingDate = data.date || new Date();
    try {
      await FiscalPeriod.validatePostingDate(postingDate, data.companyId || null);
    } catch (periodErr) {
      throw periodErr;
    }

    let journalId = data.journal || null;
    if (!journalId && data.journalCode) {
      journalId = await FinanceHelper.resolveJournal(data.journalCode);
    }

    const journalEntry = new JournalEntry({
      ...data,
      journal: journalId,
      date: postingDate,
      status: 'draft',
      isAutoGenerated: true
    });

    await journalEntry.save();
    return journalEntry;
  },

  /**
   * Create a balanced Journal Entry and post it.
   * Validates that the posting date falls within an open fiscal period (if periods are defined).
   * Attaches journal (folder) if provided or resolved from journalCode.
   */
  createAndPostJournalEntry: async (data) => {
    try {
      // Validate fiscal period (lenient: skips if no periods configured)
      const postingDate = data.date || new Date();
      try {
        await FiscalPeriod.validatePostingDate(postingDate, data.companyId || null);
      } catch (periodErr) {
        throw periodErr; // Re-throw period validation errors
      }

      // Resolve journal (folder) from code if not supplied as ID
      let journalId = data.journal || null;
      if (!journalId && data.journalCode) {
        journalId = await FinanceHelper.resolveJournal(data.journalCode);
      }

      const journalEntry = new JournalEntry({
        ...data,
        journal: journalId,
        date: postingDate,
        status: 'posted',
        postedBy: data.createdBy,
        postedDate: new Date(),
        isAutoGenerated: true
      });

      // Save triggers pre-save validation and post-save balance updates
      await journalEntry.save();
      
      // Post to GL after balances have been updated
      await FinanceHelper.postToGeneralLedger(journalEntry._id);
      
      return journalEntry;
    } catch (error) {
      console.error('❌ Error creating/posting Journal Entry:', error);
      throw error;
    }
  },

  /**
   * Internal helper to update AR/AP status based on paid amount
   */
  _updateDocumentStatus: (doc) => {
    const settled = (doc.amountPaid || 0) + (doc.advanceApplied || 0);
    if (settled >= doc.totalAmount) {
      doc.status = 'paid';
    } else if (settled > 0) {
      doc.status = 'partial';
    }
  },

  getAPOutstanding: (bill) => {
    return Math.round(
      ((Number(bill.totalAmount) || 0)
        - (Number(bill.amountPaid) || 0)
        - (Number(bill.advanceApplied) || 0)
        - (Number(bill.advancePending) || 0)
        - (Number(bill.paymentPending) || 0)) * 100
    ) / 100;
  },

  /**
   * Create Accounts Receivable from a source
   * If AR with same invoiceNumber exists (e.g. from deleted/recreated invoice), updates it instead of creating duplicate
   */
  createARFromInvoice: async (options) => {
    try {
      const { 
        customerName, customerEmail, customerId, 
        invoiceNumber, invoiceDate, dueDate, 
        amount, department, module, referenceId,
        charges, createdBy 
      } = options;
      const companyId = co(options);
      const A = acct(companyId);

      // Check if AR already exists (e.g. orphaned from deleted invoice - avoid E11000 duplicate key)
      let arEntry = await AccountsReceivable.findOne({ invoiceNumber });
      if (arEntry) {
        arEntry.customer = { name: customerName, email: customerEmail, customerId: customerId };
        arEntry.invoiceDate = invoiceDate || new Date();
        arEntry.dueDate = dueDate;
        arEntry.totalAmount = amount;
        arEntry.subtotal = amount;
        arEntry.referenceId = referenceId;
        arEntry.referenceType = 'invoice';
        if (companyId && !arEntry.companyId) arEntry.companyId = companyId;
        if (createdBy) arEntry.updatedBy = createdBy;
        await arEntry.save();
        return arEntry; // Skip GL posting - existing entry already has it
      }

      arEntry = new AccountsReceivable({
        companyId: companyId || undefined,
        customer: { name: customerName, email: customerEmail, customerId: customerId },
        invoiceNumber,
        invoiceDate: invoiceDate || new Date(),
        dueDate,
        totalAmount: amount,
        subtotal: amount,
        status: 'draft',
        department,
        module,
        referenceId,
        referenceType: 'invoice',
        createdBy
      });

      await arEntry.save();

      const arAccount = await A.resolve(FinanceHelper.ACCOUNTS.RECEIVABLE);
      if (arAccount) {
        const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
        const amountRounded = round2(amount);
        const lines = [{ account: arAccount._id, description: `Receivable from ${customerName}`, debit: amountRounded, department }];

        if (charges && charges.length > 0) {
          const fallbackRev = await A.resolve(FinanceHelper.ACCOUNTS.REVENUE_CAM);
          let sumCredits = 0;
          const creditLines = [];

          for (const charge of charges) {
            const chargeAmt = round2(charge.total ?? charge.amount ?? 0);
            if (chargeAmt <= 0) continue;

            const revAccountNum = {
              'CAM': FinanceHelper.ACCOUNTS.REVENUE_CAM,
              'ELECTRICITY': FinanceHelper.ACCOUNTS.REVENUE_ELECTRICITY,
              'RENT': FinanceHelper.ACCOUNTS.REVENUE_RENT
            }[String(charge.type || '').toUpperCase()] || FinanceHelper.ACCOUNTS.REVENUE_CAM;

            let revAccount = await A.resolve(revAccountNum);
            if (!revAccount) revAccount = fallbackRev;
            if (!revAccount) continue;

            creditLines.push({
              account: revAccount._id,
              description: charge.description || `Revenue from ${charge.type || 'charges'}`,
              credit: chargeAmt,
              department
            });
            sumCredits += chargeAmt;
          }

          if (creditLines.length > 0) {
            const diff = round2(amountRounded - sumCredits);
            if (Math.abs(diff) > 0.01) {
              const lastLine = creditLines[creditLines.length - 1];
              const adjusted = round2(lastLine.credit + diff);
              if (adjusted > 0) {
                lastLine.credit = adjusted;
              } else {
                creditLines.length = 0;
              }
            }
            if (creditLines.length > 0) {
              lines.push(...creditLines);
            }
          }
        }

        if (lines.length === 1) {
          const revAccountNum = options.revenueAccountNum || FinanceHelper.ACCOUNTS.REVENUE_CAM;
          const revAccount = await A.resolve(revAccountNum);
          if (revAccount) {
            lines.push({ account: revAccount._id, description: `Revenue from ${invoiceNumber}`, credit: amountRounded, department });
          }
        }

        if (lines.length < 2) {
          throw new Error('Could not build balanced journal entry: missing revenue account(s)');
        }

        await FinanceHelper.createAndPostJournalEntry(withCompany({
          date: invoiceDate,
          reference: invoiceNumber,
          description: `AR Invoice: ${invoiceNumber} for ${customerName}`,
          department,
          module,
          referenceId: arEntry._id,
          referenceType: 'invoice',
          createdBy,
          lines
        }, companyId));
      }

      return arEntry;
    } catch (error) {
      console.error('❌ Error creating AR from Invoice:', error);
      throw error;
    }
  },

  /**
   * Create Accounts Payable from a source (CEO-approved indent, PO, or manual).
   * Matches REF-FINAL-001 style: creates bill with lineItems, posts to GL, so it shows in AP and impacts other finance modules.
   */
  createAPFromBill: async (options) => {
    let apEntry = null;
    try {
      const {
        vendorName, vendorEmail, vendorId,
        billNumber, vendorInvoiceNumber, billDate, dueDate,
        amount, department, module, referenceId,
        createdBy, notes,
        referenceType = 'manual',
        lineItems: optsLineItems,
        lineDescription,
        paymentTerms,
        linkedGRNs,
        debitAccountNumber,
        multiLineExpenseJournal = false,
        expenseJournalLines = null
      } = options;
      const companyId = co(options);
      const A = acct(companyId);

      // Normalize billDate to start of day so the bill appears in default date filters (e.g. current month)
      let billDateNorm = billDate ? new Date(billDate) : new Date();
      if (isNaN(billDateNorm.getTime())) billDateNorm = new Date();
      billDateNorm.setHours(0, 0, 0, 0);

      // Default line item so the bill matches working bills (e.g. REF-FINAL-001) and flows through finance modules
      const lineItems = optsLineItems && optsLineItems.length > 0
        ? optsLineItems
        : [{ description: lineDescription || `Amount as per approved document`, quantity: 1, unitPrice: amount }];

      apEntry = new AccountsPayable({
        companyId: companyId || undefined,
        company: options.company || '',
        project: options.project || '',
        vendor: { name: vendorName, email: vendorEmail, vendorId: vendorId },
        payeeEmployee: options.payeeEmployeeId || options.payeeEmployee || null,
        billNumber,
        vendorInvoiceNumber: vendorInvoiceNumber || '',
        billDate: billDateNorm,
        dueDate,
        totalAmount: amount,
        subtotal: amount,
        status: 'approved',
        department,
        module,
        referenceId,
        referenceType: referenceType,
        paymentTerms: paymentTerms || undefined,
        lineItems,
        linkedGRNs: Array.isArray(linkedGRNs) ? linkedGRNs : [],
        notes: notes || '',
        createdBy
      });

      await apEntry.save();

      const apAccount = await A.resolve(FinanceHelper.ACCOUNTS.PAYABLE);

      if (apAccount) {
        // ─── CORRECT ODOO-STYLE AP JOURNAL ────────────────────────────────────────
        // When AP bill is backed by a GRN/PO:
        //   DR GRNI (clears the accrual created at GRN time)
        //   CR Accounts Payable (records what we owe the specific vendor)
        //
        // When AP bill is a direct expense (no GRN):
        //   DR Expense Account
        //   CR Accounts Payable
        // ─────────────────────────────────────────────────────────────────────────
        const isGrnBacked = ['purchase_order', 'grn'].includes(referenceType);
        let debitAccount = null;

        if (isGrnBacked) {
          debitAccount = await FinanceHelper.resolveGrniAccountForBill({ referenceType, referenceId, companyId });
        }
        if (!debitAccount && debitAccountNumber) {
          debitAccount = await A.resolve(String(debitAccountNumber));
        }
        if (!debitAccount) {
          debitAccount = await A.resolve(FinanceHelper.ACCOUNTS.EXPENSE_GENERAL);
        }

        if (debitAccount || (Array.isArray(expenseJournalLines) && expenseJournalLines.length > 0)) {
          let useCustomDebits = Array.isArray(expenseJournalLines) && expenseJournalLines.length > 0 && !isGrnBacked;
          let journalLines;

          if (useCustomDebits) {
            journalLines = [];
            for (const row of expenseJournalLines) {
              let accRef = row.account;
              if (!accRef && row.accountNumber) {
                accRef = (await A.resolve(String(row.accountNumber)))?._id;
              }
              if (!accRef) continue;
              journalLines.push({
                account: accRef,
                description: (row.description || `Expense — ${billNumber}`).slice(0, 200),
                debit: Math.round(Number(row.debit) * 100) / 100,
                department
              });
            }
            const creditAmount = Math.round(Number(amount) * 100) / 100;
            if (journalLines.length === 0) {
              useCustomDebits = false;
            } else {
              journalLines.push({
                account: apAccount._id,
                description: `Payable to ${vendorName}`,
                credit: creditAmount,
                department
              });
            }
          }

          if (!useCustomDebits) {
            const useSplitDebits = multiLineExpenseJournal && lineItems.length > 1 && !isGrnBacked;
            if (useSplitDebits) {
              journalLines = lineItems.map((li) => ({
                account: debitAccount._id,
                description: (li.description || lineDescription || `Expense — ${billNumber}`).slice(0, 200),
                debit: Math.round((Number(li.quantity) || 1) * (Number(li.unitPrice) || 0) * 100) / 100,
                department
              }));
              const debitSum = journalLines.reduce((s, l) => s + l.debit, 0);
              const creditAmount = Math.round(Number(amount) * 100) / 100;
              if (Math.abs(debitSum - creditAmount) > 0.01 && journalLines.length > 0) {
                journalLines[journalLines.length - 1].debit += creditAmount - debitSum;
                journalLines[journalLines.length - 1].debit =
                  Math.round(journalLines[journalLines.length - 1].debit * 100) / 100;
              }
              journalLines.push({
                account: apAccount._id,
                description: `Payable to ${vendorName}`,
                credit: creditAmount,
                department
              });
            } else {
              const debitDescription = isGrnBacked
                ? `GRNI cleared – ${billNumber} (matched to GRN/PO)`
                : `Expense for ${billNumber}`;
              journalLines = [
                { account: debitAccount._id, description: debitDescription, debit: amount, department },
                { account: apAccount._id, description: `Payable to ${vendorName}`, credit: amount, department }
              ];
            }
          }

          await FinanceHelper.createAndPostJournalEntry(
            withVoucherNarration(withCompany({
              date: billDateNorm,
              reference: billNumber,
              description: `AP Bill: ${billNumber} from ${vendorName}`,
              department,
              module,
              referenceId: apEntry._id,
              referenceType: 'bill',
              journalCode: 'PURCH',
              voucherSeries: 'BILL',
              createdBy,
              lines: journalLines
            }, companyId), getBillNarration(apEntry))
          );
        }
      }

      // Auto-apply any open vendor advances to newly created bill (oldest first)
      try {
        if (vendorId || vendorName) {
          await FinanceHelper.applyVendorAdvanceToBill(apEntry._id, null, createdBy);
        }
      } catch (advErr) {
        console.warn('[AP Advance] auto-apply skipped:', advErr.message);
      }

      return apEntry;
    } catch (error) {
      if (apEntry?._id) {
        try {
          await AccountsPayable.findByIdAndDelete(apEntry._id);
        } catch (deleteErr) {
          console.error('Failed to roll back AP after journal error:', deleteErr.message);
        }
      }
      console.error('❌ Error creating AP from Bill:', error);
      throw error;
    }
  },

  /**
   * Record payment for an AR Invoice
   */
  recordARPayment: async (invoiceId, paymentData) => {
    try {
      const invoice = await AccountsReceivable.findById(invoiceId);
      if (!invoice) throw new Error('Invoice not found');

      const { amount, paymentMethod, reference, date, createdBy, bankAccountId } = paymentData;

      const balance = Math.round((invoice.totalAmount - invoice.amountPaid) * 100) / 100;
      if (amount > balance + 0.01) {
        throw new Error(`Receipt amount PKR ${amount} exceeds outstanding balance PKR ${balance}`);
      }

      invoice.payments.push({ amount, paymentDate: date || new Date(), paymentMethod, reference, createdBy });
      invoice.amountPaid = Math.round((invoice.amountPaid + amount) * 100) / 100;
      FinanceHelper._updateDocumentStatus(invoice);
      await invoice.save();

      const companyId = co(invoice);
      const A = acct(companyId);
      const arAccount = await A.resolve(FinanceHelper.ACCOUNTS.RECEIVABLE);
      let bankAccount = bankAccountId ? await A.map(bankAccountId) : null;
      if (!bankAccount) {
        bankAccount = await A.resolve(
          paymentMethod === 'cash' ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
        );
      }

      if (arAccount && bankAccount) {
        await FinanceHelper.createAndPostJournalEntry(
          withVoucherNarration(withCompany({
            date:          date || new Date(),
            reference:     reference || invoice.invoiceNumber,
            description:   `Receipt: ${invoice.invoiceNumber} from ${invoice.customer?.name || 'Customer'}`,
            department:    invoice.department,
            module:        invoice.module,
            referenceId:   invoice._id,
            referenceType: 'receipt',
            journalCode:   'BANK',
            createdBy,
            lines: [
              { account: bankAccount._id, description: `Receipt – ${invoice.invoiceNumber}`, debit:  amount, department: invoice.department },
              { account: arAccount._id,   description: `Clear AR – ${invoice.invoiceNumber}`, credit: amount, department: invoice.department }
            ]
          }, companyId), getArInvoiceNarration(invoice))
        );
      }

      return invoice;
    } catch (error) {
      console.error('❌ Error recording AR payment:', error);
      throw error;
    }
  },

  /**
   * Record payment for an AP Bill
   */
  recordAPPayment: async (billId, paymentData) => {
    try {
      const ApPayment = require('./apPaymentApplication');
      const bill = await AccountsPayable.findById(billId);
      if (!bill) throw new Error('Bill not found');

      const {
        amount,
        paymentMethod,
        reference,
        date,
        createdBy,
        whtRate = 0,
        bankAccountId,
        allocations,
        financeApprovalAuthorities
      } = paymentData;

      const amount_ = Math.round((Number(amount) || 0) * 100) / 100;
      const balance = FinanceHelper.getAPOutstanding(bill);
      if (amount_ > balance + 0.01) {
        throw new Error(`Payment amount PKR ${amount_} exceeds outstanding balance PKR ${balance}`);
      }

      const whtAmount = whtRate > 0 ? Math.round(amount_ * (whtRate / 100) * 100) / 100 : 0;
      const netBankAmount = Math.round((amount_ - whtAmount) * 100) / 100;

      const normalizedAllocations = Array.isArray(allocations)
        ? allocations
          .map((a) => ({
            grnId: a?.grnId || null,
            amount: Math.round((Number(a?.amount) || 0) * 100) / 100
          }))
          .filter((a) => a.grnId && a.amount > 0)
        : [];

      const companyId = co(bill);
      const A = acct(companyId);
      const apAccount = await A.resolve(FinanceHelper.ACCOUNTS.PAYABLE);
      let bankAccount = bankAccountId ? await A.map(bankAccountId) : null;
      if (!bankAccount) {
        bankAccount = await A.resolve(
          paymentMethod === 'cash' ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
        );
      }
      
      if (!apAccount || !bankAccount) {
        const missing = [];
        if (!apAccount) missing.push('AP account (2001)');
        if (!bankAccount) {
          if (bankAccountId) missing.push(`Bank/Cash account (ID: ${bankAccountId})`);
          else missing.push(`Bank/Cash account (${paymentMethod === 'cash' ? '1001' : '1002'})`);
        }
        throw new Error(`${missing.join(' and ')} not found. Please ensure these accounts exist in the Chart of Accounts.`);
      }

      const lines = [
        { account: apAccount._id, description: `Payment to ${bill.vendor.name} – ${bill.billNumber}`, debit: amount_, department: bill.department },
        { account: bankAccount._id, description: `Bank payment – ${bill.billNumber} (pending signatures)`, credit: netBankAmount, department: bill.department }
      ];
      if (whtAmount > 0) {
        const whtAccount = await A.resolve('2004');
        if (whtAccount) {
          lines.push({ account: whtAccount._id, description: `WHT @ ${whtRate}% on ${bill.vendor.name}`, credit: whtAmount, department: bill.department });
        } else {
          lines[1].credit = amount_;
        }
      }

      const authorities = await ApPayment.resolvePaymentFinanceAuthorities(
        bill,
        financeApprovalAuthorities,
        createdBy
      );

      const { application, journalEntry } = await ApPayment.submitSettlement({
        bill,
        amount: amount_,
        sourceType: 'bank_payment',
        createdBy,
        financeApprovalAuthorities: authorities,
        journalPayload: withVoucherNarration(withCompany({
          date: date || new Date(),
          reference: reference || bill.billNumber,
          description: `Payment: ${bill.billNumber} – ${bill.vendor.name} (pending finance signatures)`,
          department: bill.department,
          module: bill.module,
          referenceType: 'payment',
          journalCode: 'BANK',
          voucherSeries: paymentMethod === 'cash' ? 'CPV' : 'BPV',
          lines
        }, companyId), getBillNarration(bill)),
        paymentMeta: {
          paymentMethod,
          reference: reference || bill.billNumber,
          whtRate,
          bankAccountId: bankAccount._id,
          allocations: normalizedAllocations
        }
      });

      const fresh = await AccountsPayable.findById(bill._id);
      fresh._pendingSettlement = {
        applicationId: application._id,
        journalEntryId: journalEntry._id,
        amount: amount_,
        workflowStatus: 'pending_authority'
      };
      return fresh;
    } catch (error) {
      console.error('❌ Error recording AP payment:', error);
      throw error;
    }
  },

  recordVendorAdvance: async ({
    vendorName,
    vendorEmail,
    vendorId,
    amount,
    paymentMethod,
    reference,
    date,
    createdBy,
    department = 'procurement',
    module = 'procurement',
    bankAccountId = null,
    referenceType = 'advance',
    referenceId = null,
    financeApprovalAuthorities = null,
    companyId: optsCompanyId = null
  }) => {
    const amount_ = Math.round((Number(amount) || 0) * 100) / 100;
    if (amount_ <= 0) throw new Error('Advance amount must be greater than zero');

    const companyId = co({ companyId: optsCompanyId });
    const A = acct(companyId);

    const fa = financeApprovalAuthorities || {};
    const am = fa.accountsManagerUser || fa.accountsManager;
    const fc = fa.financeControllerUser || fa.financeController;
    if (!am || !fc) {
      throw new Error('Sr Manager Accounts and GM Finance approvers are required for every vendor advance.');
    }
    // Accounts Officer / AM is always the user who records the advance (not client-assigned).
    const nowPreparer = new Date();

    let advAccount = await A.resolve(FinanceHelper.ACCOUNTS.VENDOR_ADVANCE);
    if (!advAccount) {
      advAccount = await Account.create({
        accountNumber: FinanceHelper.ACCOUNTS.VENDOR_ADVANCE,
        name: 'Advance to Suppliers',
        type: 'Asset',
        category: 'Current Asset',
        detailType: 'Other Current Assets',
        description: 'Vendor advances paid before bill settlement',
        isSystem: true,
        companyId: companyId || undefined,
        createdBy
      });
    }
    let bankAccount = bankAccountId ? await A.map(bankAccountId) : null;
    if (bankAccountId && !bankAccount) {
      throw new Error('Selected bank or cash account was not found. Pick a valid chart account.');
    }
    if (!bankAccount) {
      bankAccount = await A.resolve(
        (paymentMethod || 'bank_transfer') === 'cash' ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
      );
    }
    if (!advAccount || !bankAccount) throw new Error('Advance or Bank/Cash account not found');

    const advance = await VendorAdvance.create({
      vendor: { name: vendorName || 'Vendor', email: vendorEmail || '', vendorId: vendorId || null },
      amount: amount_,
      paymentMethod: paymentMethod || 'bank_transfer',
      bankAccountId: bankAccount._id,
      reference: reference || `ADV-${Date.now()}`,
      paymentDate: date || new Date(),
      createdBy,
      department,
      module,
      referenceType,
      referenceId,
      voucherWorkflowStatus: 'pending_authority',
      financeApprovalAuthorities: {
        accountsOfficerUser: createdBy,
        accountsManagerUser: am,
        financeControllerUser: fc
      },
      financeAuthorityApprovals: [{
        authorityKey: 'accountsOfficerUser',
        authorityLabel: 'Accounts Officer / AM',
        approver: createdBy,
        decision: 'approved',
        approvedAt: nowPreparer,
        comments: 'Preparer — recorded vendor advance'
      }]
    });

    const linePayload = [
      { account: advAccount._id, description: `Advance to ${vendorName || 'Vendor'}`, debit: amount_, department },
      { account: bankAccount._id, description: `Advance payment (${advance.reference})`, credit: amount_, department }
    ];

    const journalEntry = await FinanceHelper.createDraftJournalEntry(
      withVoucherNarration(
        withCompany({
          date: date || new Date(),
          reference: advance.reference,
          description: `Vendor Advance: ${vendorName || 'Vendor'} (pending finance signatures)`,
          department,
          module,
          referenceId: advance._id,
          referenceType: 'payment',
          journalCode: 'BANK',
          voucherSeries: (paymentMethod || 'bank_transfer') === 'cash' ? 'CPV' : 'BPV',
          createdBy,
          lines: linePayload
        }, companyId),
        getVendorAdvanceNarration(advance) || reference
      )
    );
    advance.journalEntryId = journalEntry._id;
    await advance.save();
    return advance;
  },

  applyVendorAdvanceToBill: async (billId, requestedAmount = null, createdBy = null, options = {}) => {
    const ApPayment = require('./apPaymentApplication');
    const bill = await AccountsPayable.findById(billId);
    if (!bill) throw new Error('Bill not found');

    let remainingBill = FinanceHelper.getAPOutstanding(bill);
    if (remainingBill <= 0) return { bill, applied: 0, pending: 0, adjustments: [], applications: [] };

    let remainingRequest = requestedAmount == null ? remainingBill : Math.round((Number(requestedAmount) || 0) * 100) / 100;
    if (remainingRequest <= 0) throw new Error('Apply amount must be greater than zero');

    const companyId = co(bill);
    const A = acct(companyId);
    const advAccount = await A.resolve(FinanceHelper.ACCOUNTS.VENDOR_ADVANCE);
    const apAccount = await A.resolve(FinanceHelper.ACCOUNTS.PAYABLE);
    if (!advAccount || !apAccount) throw new Error('AP or Vendor Advance account not found');

    const query = bill.vendor?.vendorId
      ? { 'vendor.vendorId': bill.vendor.vendorId, status: { $in: ['open', 'partially_applied'] } }
      : { 'vendor.name': bill.vendor?.name || '', status: { $in: ['open', 'partially_applied'] } };
    const advances = await VendorAdvance.find(query).sort({ paymentDate: 1, createdAt: 1 });

    const adjustments = [];
    const applications = [];
    let totalPending = 0;

    for (const adv of advances) {
      if (remainingBill <= 0 || remainingRequest <= 0) break;
      const wf = adv.voucherWorkflowStatus || 'immediate';
      if (wf === 'pending_authority' || wf === 'rejected') continue;
      const advRemaining = Math.round(((Number(adv.amount) || 0) - (Number(adv.appliedAmount) || 0)) * 100) / 100;
      const pendingOnAdv = await ApPayment.sumPendingForVendorAdvance(adv._id);
      const openAdv = Math.max(0, Math.round((advRemaining - pendingOnAdv) * 100) / 100);
      if (openAdv <= 0) continue;
      const applyAmount = Math.min(remainingBill, remainingRequest, openAdv);
      if (applyAmount <= 0) continue;

      const { application, journalEntry } = await ApPayment.submitSettlement({
        bill,
        amount: applyAmount,
        sourceType: 'vendor_advance',
        createdBy: createdBy || bill.createdBy,
        financeApprovalAuthorities: options.financeApprovalAuthorities,
        authoritySourceDoc: adv,
        vendorAdvanceId: adv._id,
        journalPayload: withVoucherNarration(withCompany({
          date: new Date(),
          reference: `ADV-ADJ-${bill.billNumber}`,
          description: `Vendor advance adjusted against ${bill.billNumber} (pending finance signatures)`,
          department: bill.department,
          module: bill.module,
          referenceType: 'adjustment',
          journalCode: 'ADJUSTMENT',
          voucherSeries: 'JV',
          lines: [
            { account: apAccount._id, description: `Advance adjusted – ${bill.billNumber}`, debit: applyAmount, department: bill.department },
            { account: advAccount._id, description: `Advance utilization – ${adv.reference || adv._id}`, credit: applyAmount, department: bill.department }
          ]
        }, companyId), getBillNarration(bill)),
      });

      adjustments.push({ advanceId: adv._id, reference: adv.reference, amount: applyAmount, pending: true });
      applications.push({
        applicationId: application._id,
        journalEntryId: journalEntry._id,
        advanceId: adv._id
      });
      totalPending += applyAmount;
      remainingBill = FinanceHelper.getAPOutstanding(bill);
      remainingRequest = Math.round((remainingRequest - applyAmount) * 100) / 100;
    }

    const fresh = await AccountsPayable.findById(bill._id);
    return {
      bill: fresh,
      applied: 0,
      pending: totalPending,
      adjustments,
      applications
    };
  },

  _getCaOpenAdvanceForAp: async (ca) => {
    const ApPayment = require('./apPaymentApplication');
    return ApPayment.getCaOpenForAp(ca);
  },

  _applyOneCashApprovalToBill: async (ca, bill, applyAmount, employee, createdBy, options = {}) => {
    const ApPayment = require('./apPaymentApplication');
    const companyId = co(bill);
    const A = acct(companyId);
    const apAccount = await A.resolve(FinanceHelper.ACCOUNTS.PAYABLE);
    if (!apAccount) throw new Error('Accounts Payable account not found');

    const caRemaining = await FinanceHelper._getCaOpenAdvanceForAp(ca);
    const amount = Math.round((Number(applyAmount) || 0) * 100) / 100;
    if (amount <= 0) throw new Error('Apply amount must be greater than zero');
    if (amount > caRemaining + 0.009) {
      throw new Error(`Amount exceeds open balance on ${ca.caNumber} (open: ${caRemaining})`);
    }

    let advAccount = null;
    if (ca.advanceGlAccount) {
      advAccount = await Account.findById(ca.advanceGlAccount);
    }
    if (!advAccount) {
      const { resolveEmployeeAdvanceAccount, ensureEmployeeAdvanceAccount } = require('./employeeAdvanceAccount');
      advAccount = await resolveEmployeeAdvanceAccount(employee, { createdBy, companyId });
      if (!advAccount) {
        advAccount = await ensureEmployeeAdvanceAccount(employee, createdBy, companyId);
      }
    }
    if (!advAccount) throw new Error(`No advance account for ${ca.caNumber}`);

    const { application, journalEntry } = await ApPayment.submitSettlement({
      bill,
      amount,
      sourceType: 'cash_approval',
      createdBy: createdBy || bill.createdBy,
      financeApprovalAuthorities: options.financeApprovalAuthorities,
      authoritySourceDoc: ca,
      cashApprovalId: ca._id,
      journalPayload: withVoucherNarration(withCompany({
        date: new Date(),
        reference: `CA-ADJ-${bill.billNumber}`,
        description: `Cash approval ${ca.caNumber} applied to bill ${bill.billNumber} (pending finance signatures)`,
        department: bill.department || 'general',
        module: bill.module || 'general',
        referenceType: 'adjustment',
        journalCode: 'ADJUSTMENT',
        voucherSeries: 'JV',
        lines: [
          { account: apAccount._id, description: `Advance applied – ${bill.billNumber}`, debit: amount, department: bill.department },
          { account: advAccount._id, description: `CA ${ca.caNumber} utilized`, credit: amount, department: bill.department || 'general' }
        ]
      }, companyId), getBillNarration(bill))
    });

    return {
      cashApprovalId: ca._id,
      caNumber: ca.caNumber,
      amount,
      pending: true,
      applicationId: application._id,
      journalEntryId: journalEntry._id
    };
  },

  applyEmployeeAdvanceToBill: async (billId, requestedAmount = null, employeeId = null, createdBy = null, options = {}) => {
    const bill = await AccountsPayable.findById(billId);
    if (!bill) throw new Error('Bill not found');

    const empId = employeeId || bill.payeeEmployee;
    if (!empId) throw new Error('Employee is required to apply cash approval advance');

    const employee = await Employee.findById(empId);
    if (!employee) throw new Error('Employee not found');

    let remainingBill = FinanceHelper.getAPOutstanding(bill);
    if (remainingBill <= 0) return { bill, applied: 0, pending: 0, adjustments: [] };

    const adjustments = [];
    const explicitAllocations = Array.isArray(options.allocations)
      ? options.allocations
        .map((row) => ({
          cashApprovalId: String(row?.cashApprovalId || row?.caId || '').trim(),
          amount: Math.round((Number(row?.amount) || 0) * 100) / 100
        }))
        .filter((row) => row.cashApprovalId && row.amount > 0)
      : [];

    if (explicitAllocations.length > 0) {
      for (const row of explicitAllocations) {
        if (remainingBill <= 0) break;

        const ca = await CashApproval.findById(row.cashApprovalId);
        if (!ca) throw new Error('Cash approval not found');
        if (!ca.advanceIssuedAt) {
          throw new Error(`${ca.caNumber || 'Cash approval'}: advance has not been issued yet`);
        }
        if (String(ca.advanceToEmployee || '') !== String(empId)) {
          throw new Error(`${ca.caNumber || 'Cash approval'} is not for this employee`);
        }

        const applyAmount = Math.min(row.amount, remainingBill);
        const adj = await FinanceHelper._applyOneCashApprovalToBill(ca, bill, applyAmount, employee, createdBy, options);
        if (!bill.payeeEmployee) bill.payeeEmployee = empId;
        adjustments.push(adj);
        remainingBill = FinanceHelper.getAPOutstanding(bill);
      }
    } else {
      let remainingRequest = requestedAmount == null
        ? remainingBill
        : Math.round((Number(requestedAmount) || 0) * 100) / 100;
      if (remainingRequest <= 0) throw new Error('Apply amount must be greater than zero');

      const cas = await CashApproval.find({
        advanceToEmployee: empId,
        advanceIssuedAt: { $ne: null },
        status: { $nin: ['Draft', 'Cancelled', 'Rejected'] }
      }).sort({ advanceIssuedAt: 1, createdAt: 1 });

      for (const ca of cas) {
        if (remainingBill <= 0 || remainingRequest <= 0) break;

        const caRemaining = await FinanceHelper._getCaOpenAdvanceForAp(ca);
        if (caRemaining <= 0) continue;

        const applyAmount = Math.min(remainingBill, remainingRequest, caRemaining);
        if (applyAmount <= 0) continue;

        const adj = await FinanceHelper._applyOneCashApprovalToBill(ca, bill, applyAmount, employee, createdBy, options);
        if (!bill.payeeEmployee) bill.payeeEmployee = empId;
        adjustments.push(adj);
        remainingBill = FinanceHelper.getAPOutstanding(bill);
        remainingRequest = Math.round((remainingRequest - applyAmount) * 100) / 100;
      }
    }

    const pending = adjustments.reduce((s, a) => s + a.amount, 0);
    if (pending <= 0) {
      throw new Error('No open cash approval advance balance for this employee');
    }
    const fresh = await AccountsPayable.findById(bill._id);
    return { bill: fresh, applied: 0, pending, adjustments };
  },

  /**
   * Apply one or more cash approval advances to one or more AP bills (Taj deposit-style reconciliation).
   * Total from cashApprovalUsages must equal total from billAllocations.
   */
  applyEmployeeAdvanceBatch: async (employeeId, cashApprovalUsages = [], billAllocations = [], createdBy = null, options = {}) => {
    const empId = employeeId;
    if (!empId) throw new Error('Employee is required');

    const caRows = (cashApprovalUsages || [])
      .map((r) => ({
        cashApprovalId: String(r?.cashApprovalId || '').trim(),
        amount: Math.round((Number(r?.amount) || 0) * 100) / 100
      }))
      .filter((r) => r.cashApprovalId && r.amount > 0);

    const billRows = (billAllocations || [])
      .map((r) => ({
        billId: String(r?.billId || '').trim(),
        amount: Math.round((Number(r?.amount) || 0) * 100) / 100
      }))
      .filter((r) => r.billId && r.amount > 0);

    if (!caRows.length) throw new Error('Enter amount to use on at least one cash approval');
    if (!billRows.length) throw new Error('Allocate advance to at least one bill');

    const totalCa = Math.round(caRows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
    const totalBills = Math.round(billRows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
    if (Math.abs(totalCa - totalBills) > 0.009) {
      throw new Error(
        `Total from cash approvals (${totalCa}) must equal total applied to bills (${totalBills})`
      );
    }

    const employee = await Employee.findById(empId);
    if (!employee) throw new Error('Employee not found');

    const pool = caRows.map((r) => ({ ...r, remaining: r.amount }));
    const adjustments = [];

    for (const billAlloc of billRows) {
      const bill = await AccountsPayable.findById(billAlloc.billId);
      if (!bill) throw new Error('Bill not found');

      let billNeed = billAlloc.amount;
      const billOutstanding = FinanceHelper.getAPOutstanding(bill);
      if (billAlloc.amount > billOutstanding + 0.009) {
        throw new Error(`Amount for ${bill.billNumber} exceeds open balance (${billOutstanding})`);
      }

      for (const p of pool) {
        if (billNeed <= 0) break;
        if (p.remaining <= 0) continue;

        const ca = await CashApproval.findById(p.cashApprovalId);
        if (!ca) throw new Error('Cash approval not found');
        if (String(ca.advanceToEmployee || '') !== String(empId)) {
          throw new Error(`${ca.caNumber || 'CA'} is not for this employee`);
        }

        const caOpen = await FinanceHelper._getCaOpenAdvanceForAp(ca);
        const applyAmt = Math.min(billNeed, p.remaining, caOpen);
        if (applyAmt <= 0) continue;

        const adj = await FinanceHelper._applyOneCashApprovalToBill(ca, bill, applyAmt, employee, createdBy, options);
        if (!bill.payeeEmployee) bill.payeeEmployee = empId;
        adjustments.push({ ...adj, billId: String(bill._id), billNumber: bill.billNumber });
        p.remaining = Math.round((p.remaining - applyAmt) * 100) / 100;
        billNeed = Math.round((billNeed - applyAmt) * 100) / 100;
      }

      if (billNeed > 0.009) {
        throw new Error(`Could not apply full amount to bill ${bill.billNumber}. Reduce bill allocation or add cash approval balance.`);
      }
    }

    const pending = Math.round(adjustments.reduce((s, a) => s + a.amount, 0) * 100) / 100;
    return { applied: 0, pending, adjustments };
  },

  /**
   * Post COGS journal for goods issued from store.
   * DR Cost of Goods Sold / CR Inventory
   */
  postCOGSJournal: async ({ items, sinDoc, createdBy, companyId }) => {
    const cid = await resolveDocumentCompanyId({
      companyId,
      userId: createdBy,
      grnId: sinDoc?.goodsReceive || sinDoc?.grn,
      purchaseOrderId: sinDoc?.purchaseOrder
    });
    const lineGroups = [];
    for (const item of items) {
      try {
        const inv = item.inventoryItem;
        if (!inv) continue;
        const qty = Number(item.qtyIssued || item.quantity) || 0;
        if (qty <= 0) continue;
        const unitCost = Number(inv.averageCost) > 0 ? Number(inv.averageCost) : Number(inv.unitPrice) || 0;
        if (unitCost <= 0) {
          console.warn(`[COGS] Skipped ${inv.name || inv._id}: no WAC or unit price set`);
          continue;
        }
        const cost = Math.round(qty * unitCost * 100) / 100;
        const { inventoryAccountId, cogsAccountId } = await FinanceHelper.resolveInventoryAccounts(inv, cid);
        if (inventoryAccountId && cogsAccountId) {
          lineGroups.push({ inventoryAccountId, cogsAccountId, cost, itemName: inv.name || item.itemName });
        } else {
          console.warn(`[COGS] Skipped ${inv.name || inv._id}: could not resolve inventory/COGS accounts`);
        }
      } catch (itemErr) {
        console.warn('[COGS] Item error:', itemErr.message);
      }
    }

    if (lineGroups.length === 0) return;

    const lines = [];
    for (const g of lineGroups) {
      lines.push({ account: g.cogsAccountId,       description: `COGS – ${g.itemName}`, debit:  g.cost, department: sinDoc.department || 'procurement' });
      lines.push({ account: g.inventoryAccountId,  description: `Inventory out – ${g.itemName}`, credit: g.cost, department: sinDoc.department || 'procurement' });
    }

    try {
      await FinanceHelper.createAndPostJournalEntry(
        withVoucherNarration(withCompany({
          date:          sinDoc.issueDate || new Date(),
          reference:     sinDoc.issueNumber || 'SIN',
          description:   `COGS – Store Issue ${sinDoc.issueNumber || ''}`,
          department:    sinDoc.department || 'procurement',
          module:        'procurement',
          referenceId:   sinDoc._id,
          referenceType: 'expense',
          journalCode:   'INV',
          createdBy,
          lines
        }, cid), getSinNarration(sinDoc))
      );
    } catch (cogsErr) {
      console.warn('[COGS] GL posting skipped:', cogsErr.message);
    }
  },

  /**
   * Post journal entry for a Goods Received Note (GRN).
   *
   * CORRECT ODOO-STYLE ENTRY:
   *   DR  Stock Valuation / Inventory Account   (Asset ↑)
   *   CR  Stock Input / GRNI Account            (Liability ↑)  ← cleared later by AP bill
   *
   * Also updates the Weighted Average Cost (WAC) on the inventory item.
   * WAC = (existingQty × existingWAC + receivedQty × receiptPrice) / (existingQty + receivedQty)
   *
   * Safe to call – silently skips if accounts cannot be resolved or amount is zero.
   */
  postGRNJournal: async ({ inventoryItem, grnDoc, qty, unitPrice, createdBy, companyId }) => {
    try {
      const qty_ = Number(qty) || 0;
      const unitPrice_ = Number(unitPrice) || 0;
      if (qty_ <= 0 || unitPrice_ <= 0) return;

      const cid = await resolveDocumentCompanyId({
        companyId,
        grnId: grnDoc?._id,
        purchaseOrderId: grnDoc?.purchaseOrder?._id || grnDoc?.purchaseOrder
      });
      const { inventoryAccountId, grniAccountId } = await FinanceHelper.resolveInventoryAccounts(inventoryItem, cid);
      if (!inventoryAccountId || !grniAccountId) {
        console.warn(`[GRN Journal] Skipped – no inventory/GRNI accounts for item: ${inventoryItem.name || inventoryItem._id}`);
        return;
      }

      const amount = Math.round(qty_ * unitPrice_ * 100) / 100;

      // ─── Update Weighted Average Cost ─────────────────────────────────────
      try {
        const Inventory = mongoose.model('Inventory');
        const inv = await Inventory.findById(inventoryItem._id || inventoryItem);
        if (inv) {
          const existingQty = inv.quantity || 0;
          const existingWAC = inv.averageCost || inv.unitPrice || 0;
          const newTotalQty = existingQty + qty_;
          const newWAC = newTotalQty > 0
            ? ((existingQty * existingWAC) + (qty_ * unitPrice_)) / newTotalQty
            : unitPrice_;
          inv.averageCost = Math.round(newWAC * 100) / 100;
          await inv.save();
        }
      } catch (wacErr) {
        console.warn('[GRN Journal] WAC update failed:', wacErr.message);
      }
      // ──────────────────────────────────────────────────────────────────────

      const referenceNumber = grnDoc.receiveNumber || grnDoc._id?.toString() || 'GRN';
      await FinanceHelper.createAndPostJournalEntry(
        withVoucherNarration(withCompany({
          date: grnDoc.receiveDate || new Date(),
          reference: referenceNumber,
          description: `GRN ${referenceNumber}: Stock received – ${inventoryItem.name}`,
          department: 'procurement',
          module: 'procurement',
          referenceId: grnDoc._id,
          referenceType: 'grn',
          journalCode: 'INV',
          voucherSeries: 'GRN',
          createdBy,
          lines: [
            {
              account: inventoryAccountId,
              description: `Inventory in – ${inventoryItem.name} (${qty_} × ${unitPrice_})`,
              debit: amount,
              department: 'procurement'
            },
            {
              account: grniAccountId,
              description: `GRNI – ${inventoryItem.name} via GRN ${referenceNumber}`,
              credit: amount,
              department: 'procurement'
            }
          ]
        }, cid), getGrnNarration(grnDoc))
      );

      console.log(`[GRN Journal] Posted: DR Inventory ${amount} / CR GRNI ${amount} for ${inventoryItem.name}`);
    } catch (err) {
      console.error('❌ FinanceHelper.postGRNJournal error:', err.message);
    }
  },

  /**
   * Post journal entry for a Store Issue Note (SIN).
   *
   * CORRECT ODOO-STYLE ENTRY:
   *   DR  COGS / Project Expense Account    (Expense ↑)
   *   CR  Stock Valuation / Inventory       (Asset ↓)
   *
   * Uses Weighted Average Cost for the issued qty.
   * Safe to call – silently skips if accounts cannot be resolved or amount is zero.
   */
  postSINJournal: async ({ inventoryItem, sinDoc, qty, createdBy, companyId }) => {
    try {
      const qty_ = Number(qty) || 0;
      if (qty_ <= 0) return;

      const cid = await resolveDocumentCompanyId({
        companyId,
        userId: createdBy,
        grnId: sinDoc?.goodsReceive || sinDoc?.grn,
        purchaseOrderId: sinDoc?.purchaseOrder
      });
      const { inventoryAccountId, cogsAccountId } = await FinanceHelper.resolveInventoryAccounts(inventoryItem, cid);
      if (!cogsAccountId || !inventoryAccountId) {
        console.warn(`[SIN Journal] Skipped – no COGS/inventory accounts for item: ${inventoryItem.name || inventoryItem._id}`);
        return;
      }

      // Use WAC (averageCost) first; fall back to unitPrice for newly created items
      const unitCost = Number(inventoryItem.averageCost) > 0
        ? Number(inventoryItem.averageCost)
        : Number(inventoryItem.unitPrice) || 0;
      const amount = Math.round(qty_ * unitCost * 100) / 100;
      if (amount <= 0) {
        console.warn(`[SIN Journal] Skipped ${inventoryItem.name || inventoryItem._id}: unitCost is 0`);
        return;
      }

      const referenceNumber = sinDoc.issueNumber || sinDoc.sinNumber || sinDoc._id?.toString() || 'SIN';
      await FinanceHelper.createAndPostJournalEntry(
        withVoucherNarration(withCompany({
          date: sinDoc.issueDate || new Date(),
          reference: referenceNumber,
          description: `SIN ${referenceNumber}: Stock issued – ${inventoryItem.name}`,
          department: 'procurement',
          module: 'procurement',
          referenceId: sinDoc._id,
          referenceType: 'sin',
          journalCode: 'INV',
          voucherSeries: 'SIN',
          createdBy,
          lines: [
            {
              account: cogsAccountId,
              description: `COGS – ${inventoryItem.name} (${qty_} × WAC ${unitCost})`,
              debit: amount,
              department: 'procurement'
            },
            {
              account: inventoryAccountId,
              description: `Inventory out – ${inventoryItem.name} via SIN ${referenceNumber}`,
              credit: amount,
              department: 'procurement'
            }
          ]
        }, cid), getSinNarration(sinDoc))
      );

      console.log(`[SIN Journal] Posted: DR COGS ${amount} / CR Inventory ${amount} for ${inventoryItem.name}`);
    } catch (err) {
      console.error('❌ FinanceHelper.postSINJournal error:', err.message);
    }
  },

  /**
   * Per-employee PAYAC is skipped — the company payroll BPV posts gross expense,
   * EOBI expense, all deduction liabilities (EOBI sub-accounts, loans, advances), and bank.
   */
  recordPayrollAccrual: async () => null,

  /**
   * Record Payroll Payment
   */
  recordPayrollPayment: async (payroll, paymentMethod, createdBy) => {
    try {
      const companyId = await resolveDocumentCompanyId({ employeeId: payroll.employee });
      const A = acct(companyId);
      const payableAccount = await A.resolve(FinanceHelper.ACCOUNTS.SALARIES_PAYABLE);
      const bankAccount = await A.resolve(
        paymentMethod === 'cash' ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
      );

      if (payableAccount && bankAccount) {
        const isCash = paymentMethod === 'cash';
        await FinanceHelper.createAndPostJournalEntry(withCompany({
          date: new Date(),
          reference: `SAL-PAY-${payroll.month}-${payroll.year}`,
          description: `Salary Payment to ${payroll.employeeName}`,
          department: 'hr',
          module: 'payroll',
          referenceId: payroll._id,
          referenceType: 'payment',
          journalCode: 'BANK',
          voucherSeries: isCash ? 'CPV' : 'BPV',
          createdBy,
          lines: [
            { account: payableAccount._id, description: `Debit Salaries Payable`, debit: payroll.netSalary, department: 'hr' },
            { account: bankAccount._id, description: `Credit Bank/Cash`, credit: payroll.netSalary, department: 'hr' }
          ]
        }, companyId));
      }
    } catch (error) {
      console.error('❌ Error recording payroll payment:', error);
    }
  }
};

module.exports = FinanceHelper;
