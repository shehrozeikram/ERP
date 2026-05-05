const mongoose = require('mongoose');
const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');
const Account = require('../models/finance/Account');
const AccountsPayable = require('../models/finance/AccountsPayable');
const AccountsReceivable = require('../models/finance/AccountsReceivable');
const VendorAdvance = require('../models/finance/VendorAdvance');

/**
 * Finance Helper Utility
 * Centralizes AR/AP creation and GL posting logic
 */
const FinanceHelper = {
  // Account Mapping Constants (matching actual database accounts)
  ACCOUNTS: {
    CASH: '1001',
    BANK: '1002',
    INVENTORY: '1100',       // Stock Valuation Asset — DR on GRN
    VENDOR_ADVANCE: '1110',  // Advance to Suppliers (asset) — vendor prepayments
    STAFF_ADVANCE: '1120',   // Cash Advance to Staff — petty cash / cash purchase advances
    RECEIVABLE: '1200',
    PAYABLE: '2001',
    GRNI: '2100',            // Goods Received Not Invoiced — CR on GRN, DR on AP Bill (THE KEY CLEARING ACCOUNT)
    SALARIES_PAYABLE: '2200',
    REVENUE_CAM: '4010',
    REVENUE_ELECTRICITY: '4020',
    REVENUE_RENT: '4030',
    COGS: '5000',            // Cost of Goods Sold — DR on SIN
    EXPENSE_GENERAL: '5001',
    EXPENSE_SALARIES: '5001'
  },

  /**
   * Resolve finance accounts for a given inventory item.
   * Priority: item-level field → category defaults → global account number defaults.
   * Returns { inventoryAccountId, grniAccountId, cogsAccountId }
   */
  resolveInventoryAccounts: async (inventoryItem) => {
    const InventoryCategory = mongoose.model('InventoryCategory');

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
      const acc = await Account.findOne({ accountNumber: FinanceHelper.ACCOUNTS.INVENTORY });
      inventoryAccountId = acc?._id;
    }
    if (!grniAccountId) {
      const acc = await Account.findOne({ accountNumber: FinanceHelper.ACCOUNTS.GRNI });
      grniAccountId = acc?._id;
    }
    if (!cogsAccountId) {
      const acc = await Account.findOne({ accountNumber: FinanceHelper.ACCOUNTS.COGS });
      cogsAccountId = acc?._id;
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
  resolveGrniAccountForBill: async ({ referenceType, referenceId }) => {
    const GoodsReceive = mongoose.model('GoodsReceive');
    const Inventory = mongoose.model('Inventory');
    const PurchaseOrder = mongoose.model('PurchaseOrder');

    const grniFromInventoryDoc = async (inv) => {
      if (!inv) return null;
      const { grniAccountId } = await FinanceHelper.resolveInventoryAccounts(inv);
      if (!grniAccountId) return null;
      const acc = await Account.findById(grniAccountId);
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

    return await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.GRNI);
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
   * Helper to find an account by its number
   */
  getAccountByNumber: async (accountNumber) => {
    return await Account.findOne({ accountNumber });
  },

  /**
   * Ensure account 1120 — Cash Advance to Staff exists.
   * Auto-creates it if missing (same pattern as Vendor Advance 1110).
   */
  ensureStaffAdvanceAccount: async (createdBy) => {
    let acc = await Account.findOne({ accountNumber: FinanceHelper.ACCOUNTS.STAFF_ADVANCE });
    if (!acc) {
      acc = await Account.create({
        accountNumber: FinanceHelper.ACCOUNTS.STAFF_ADVANCE,
        name: 'Cash Advance to Staff',
        type: 'Asset',
        category: 'Current Asset',
        detailType: 'Other Current Assets',
        description: 'Temporary cash advances issued to procurement / staff for cash purchases. Cleared on settlement.',
        isSystem: true,
        isActive: true,
        createdBy
      });
    }
    return acc;
  },

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
        // Fetch the latest account balance to ensure running balance is accurate
        const currentAccount = await Account.findById(line.account._id).lean();
        
        ledgerEntries.push({
          journalEntry: entry._id,
          account: line.account._id,
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
   * Create a balanced Journal Entry and post it.
   * Validates that the posting date falls within an open fiscal period (if periods are defined).
   * Attaches journal (folder) if provided or resolved from journalCode.
   */
  createAndPostJournalEntry: async (data) => {
    try {
      // Validate fiscal period (lenient: skips if no periods configured)
      const postingDate = data.date || new Date();
      try {
        const FiscalPeriod = mongoose.model('FiscalPeriod');
        await FiscalPeriod.validatePostingDate(postingDate);
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
    return Math.round(((Number(bill.totalAmount) || 0) - (Number(bill.amountPaid) || 0) - (Number(bill.advanceApplied) || 0)) * 100) / 100;
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
        if (createdBy) arEntry.updatedBy = createdBy;
        await arEntry.save();
        return arEntry; // Skip GL posting - existing entry already has it
      }

      arEntry = new AccountsReceivable({
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

      const arAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.RECEIVABLE);
      if (arAccount) {
        const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
        const amountRounded = round2(amount);
        const lines = [{ account: arAccount._id, description: `Receivable from ${customerName}`, debit: amountRounded, department }];

        if (charges && charges.length > 0) {
          const fallbackRev = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.REVENUE_CAM);
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

            let revAccount = await FinanceHelper.getAccountByNumber(revAccountNum);
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
          const revAccount = await FinanceHelper.getAccountByNumber(revAccountNum);
          if (revAccount) {
            lines.push({ account: revAccount._id, description: `Revenue from ${invoiceNumber}`, credit: amountRounded, department });
          }
        }

        if (lines.length < 2) {
          throw new Error('Could not build balanced journal entry: missing revenue account(s)');
        }

        await FinanceHelper.createAndPostJournalEntry({
          date: invoiceDate,
          reference: invoiceNumber,
          description: `AR Invoice: ${invoiceNumber} for ${customerName}`,
          department,
          module,
          referenceId: arEntry._id,
          referenceType: 'invoice',
          createdBy,
          lines
        });
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
        linkedGRNs
      } = options;

      // Normalize billDate to start of day so the bill appears in default date filters (e.g. current month)
      let billDateNorm = billDate ? new Date(billDate) : new Date();
      if (isNaN(billDateNorm.getTime())) billDateNorm = new Date();
      billDateNorm.setHours(0, 0, 0, 0);

      // Default line item so the bill matches working bills (e.g. REF-FINAL-001) and flows through finance modules
      const lineItems = optsLineItems && optsLineItems.length > 0
        ? optsLineItems
        : [{ description: lineDescription || `Amount as per approved document`, quantity: 1, unitPrice: amount }];

      const apEntry = new AccountsPayable({
        vendor: { name: vendorName, email: vendorEmail, vendorId: vendorId },
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

      const apAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.PAYABLE);

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
          debitAccount = await FinanceHelper.resolveGrniAccountForBill({ referenceType, referenceId });
        }
        if (!debitAccount) {
          debitAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.EXPENSE_GENERAL);
        }

        if (debitAccount) {
          const debitDescription = isGrnBacked
            ? `GRNI cleared – ${billNumber} (matched to GRN/PO)`
            : `Expense for ${billNumber}`;

          await FinanceHelper.createAndPostJournalEntry({
            date: billDateNorm,
            reference: billNumber,
            description: `AP Bill: ${billNumber} from ${vendorName}`,
            department,
            module,
            referenceId: apEntry._id,
            referenceType: 'bill',
            journalCode: 'PURCH',
            createdBy,
            lines: [
              { account: debitAccount._id, description: debitDescription, debit: amount, department },
              { account: apAccount._id, description: `Payable to ${vendorName}`, credit: amount, department }
            ]
          });
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

      const arAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.RECEIVABLE);
      let bankAccount = bankAccountId ? await Account.findById(bankAccountId) : null;
      if (!bankAccount) {
        bankAccount = await FinanceHelper.getAccountByNumber(
          paymentMethod === 'cash' ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
        );
      }

      if (arAccount && bankAccount) {
        await FinanceHelper.createAndPostJournalEntry({
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
        });
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
      const bill = await AccountsPayable.findById(billId);
      if (!bill) throw new Error('Bill not found');

      const { amount, paymentMethod, reference, date, createdBy, whtRate = 0, bankAccountId, allocations } = paymentData;

      // Validate amount doesn't exceed balance
      const balance = FinanceHelper.getAPOutstanding(bill);
      if (amount > balance + 0.01) {
        throw new Error(`Payment amount PKR ${amount} exceeds outstanding balance PKR ${balance}`);
      }

      // WHT calculation
      const whtAmount = whtRate > 0 ? Math.round(amount * (whtRate / 100) * 100) / 100 : 0;
      const netBankAmount = Math.round((amount - whtAmount) * 100) / 100;

      const normalizedAllocations = Array.isArray(allocations)
        ? allocations
          .map((a) => ({
            grnId: a?.grnId || null,
            amount: Math.round((Number(a?.amount) || 0) * 100) / 100
          }))
          .filter((a) => a.grnId && a.amount > 0)
        : [];
      bill.payments.push({ amount, paymentDate: date || new Date(), paymentMethod, reference, createdBy, allocations: normalizedAllocations });
      bill.amountPaid = Math.round((bill.amountPaid + amount) * 100) / 100;
      FinanceHelper._updateDocumentStatus(bill);
      await bill.save();

      const apAccount  = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.PAYABLE);
      let bankAccount  = bankAccountId ? await Account.findById(bankAccountId) : null;
      if (!bankAccount) {
        bankAccount = await FinanceHelper.getAccountByNumber(
          paymentMethod === 'cash' ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
        );
      }

      if (apAccount && bankAccount) {
        const lines = [
          { account: apAccount._id,  description: `Payment to ${bill.vendor.name} – ${bill.billNumber}`, debit: amount,        department: bill.department },
          { account: bankAccount._id, description: `Bank payment – ${bill.billNumber}`,                  credit: netBankAmount, department: bill.department }
        ];

        // WHT deduction line
        if (whtAmount > 0) {
          const whtAccount = await FinanceHelper.getAccountByNumber('2004'); // WHT Payable
          if (whtAccount) {
            lines.push({ account: whtAccount._id, description: `WHT @ ${whtRate}% on ${bill.vendor.name}`, credit: whtAmount, department: bill.department });
          } else {
            // If no WHT account, add to bank credit to keep it balanced
            lines[1].credit = amount;
          }
        }

        await FinanceHelper.createAndPostJournalEntry({
          date:          date || new Date(),
          reference:     reference || bill.billNumber,
          description:   `Payment: ${bill.billNumber} – ${bill.vendor.name}`,
          department:    bill.department,
          module:        bill.module,
          referenceId:   bill._id,
          referenceType: 'payment',
          journalCode:   'BANK',
          createdBy,
          lines
        });
      }

      return bill;
    } catch (error) {
      console.error('❌ Error recording AP payment:', error);
      throw error;
    }
  },

  recordVendorAdvance: async ({ vendorName, vendorEmail, vendorId, amount, paymentMethod, reference, date, createdBy, department = 'procurement', module = 'procurement', bankAccountId = null, referenceType = 'advance', referenceId = null }) => {
    const amount_ = Math.round((Number(amount) || 0) * 100) / 100;
    if (amount_ <= 0) throw new Error('Advance amount must be greater than zero');

    const advance = await VendorAdvance.create({
      vendor: { name: vendorName || 'Vendor', email: vendorEmail || '', vendorId: vendorId || null },
      amount: amount_,
      paymentMethod: paymentMethod || 'bank_transfer',
      reference: reference || `ADV-${Date.now()}`,
      paymentDate: date || new Date(),
      createdBy,
      department,
      module,
      referenceType,
      referenceId
    });

    let advAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.VENDOR_ADVANCE);
    if (!advAccount) {
      advAccount = await Account.create({
        accountNumber: FinanceHelper.ACCOUNTS.VENDOR_ADVANCE,
        name: 'Advance to Suppliers',
        type: 'Asset',
        category: 'Current Asset',
        detailType: 'Other Current Assets',
        description: 'Vendor advances paid before bill settlement',
        isSystem: true,
        createdBy
      });
    }
    let bankAccount = bankAccountId ? await Account.findById(bankAccountId) : null;
    if (!bankAccount) {
      bankAccount = await FinanceHelper.getAccountByNumber(
        (paymentMethod || 'bank_transfer') === 'cash' ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
      );
    }
    if (!advAccount || !bankAccount) throw new Error('Advance or Bank/Cash account not found');

    await FinanceHelper.createAndPostJournalEntry({
      date: date || new Date(),
      reference: advance.reference,
      description: `Vendor Advance: ${vendorName || 'Vendor'}`,
      department,
      module,
      referenceId: advance._id,
      referenceType: 'payment',
      journalCode: 'BANK',
      createdBy,
      lines: [
        { account: advAccount._id, description: `Advance to ${vendorName || 'Vendor'}`, debit: amount_, department },
        { account: bankAccount._id, description: `Advance payment (${advance.reference})`, credit: amount_, department }
      ]
    });

    return advance;
  },

  applyVendorAdvanceToBill: async (billId, requestedAmount = null, createdBy = null) => {
    const bill = await AccountsPayable.findById(billId);
    if (!bill) throw new Error('Bill not found');

    let remainingBill = FinanceHelper.getAPOutstanding(bill);
    if (remainingBill <= 0) return { bill, applied: 0, adjustments: [] };

    let remainingRequest = requestedAmount == null ? remainingBill : Math.round((Number(requestedAmount) || 0) * 100) / 100;
    if (remainingRequest <= 0) throw new Error('Apply amount must be greater than zero');

    const advAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.VENDOR_ADVANCE);
    const apAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.PAYABLE);
    if (!advAccount || !apAccount) throw new Error('AP or Vendor Advance account not found');

    const query = bill.vendor?.vendorId
      ? { 'vendor.vendorId': bill.vendor.vendorId, status: { $in: ['open', 'partially_applied'] } }
      : { 'vendor.name': bill.vendor?.name || '', status: { $in: ['open', 'partially_applied'] } };
    const advances = await VendorAdvance.find(query).sort({ paymentDate: 1, createdAt: 1 });

    const adjustments = [];
    for (const adv of advances) {
      if (remainingBill <= 0 || remainingRequest <= 0) break;
      const advRemaining = Math.round(((Number(adv.amount) || 0) - (Number(adv.appliedAmount) || 0)) * 100) / 100;
      if (advRemaining <= 0) continue;
      const applyAmount = Math.min(remainingBill, remainingRequest, advRemaining);
      if (applyAmount <= 0) continue;

      await FinanceHelper.createAndPostJournalEntry({
        date: new Date(),
        reference: `ADV-ADJ-${bill.billNumber}`,
        description: `Vendor advance adjusted against ${bill.billNumber}`,
        department: bill.department,
        module: bill.module,
        referenceId: bill._id,
        referenceType: 'payment',
        journalCode: 'PURCH',
        createdBy: createdBy || bill.createdBy,
        lines: [
          { account: apAccount._id, description: `Advance adjusted – ${bill.billNumber}`, debit: applyAmount, department: bill.department },
          { account: advAccount._id, description: `Advance utilization – ${adv.reference || adv._id}`, credit: applyAmount, department: bill.department }
        ]
      });

      bill.advanceApplied = Math.round(((Number(bill.advanceApplied) || 0) + applyAmount) * 100) / 100;
      adv.appliedAmount = Math.round(((Number(adv.appliedAmount) || 0) + applyAmount) * 100) / 100;
      const newRem = Math.round(((Number(adv.amount) || 0) - (Number(adv.appliedAmount) || 0)) * 100) / 100;
      adv.status = newRem <= 0.01 ? 'applied' : 'partially_applied';
      // Keep a detailed allocation history for UI breakdown.
      if (!Array.isArray(adv.allocations)) adv.allocations = [];
      adv.allocations.push({
        billId: bill._id,
        billNumber: bill.billNumber,
        amount: applyAmount,
        appliedAt: new Date()
      });
      await adv.save();

      adjustments.push({ advanceId: adv._id, reference: adv.reference, amount: applyAmount });
      remainingBill = FinanceHelper.getAPOutstanding(bill);
      remainingRequest = Math.round((remainingRequest - applyAmount) * 100) / 100;
    }

    FinanceHelper._updateDocumentStatus(bill);
    await bill.save();
    return { bill, applied: adjustments.reduce((s, a) => s + a.amount, 0), adjustments };
  },

  /**
   * Post COGS journal for goods issued from store.
   * DR Cost of Goods Sold / CR Inventory
   */
  postCOGSJournal: async ({ items, sinDoc, createdBy }) => {
    const lineGroups = [];
    for (const item of items) {
      try {
        const inv = item.inventoryItem;
        if (!inv) continue;
        const qty = Number(item.qtyIssued || item.quantity) || 0;
        if (qty <= 0) continue;
        // Use WAC (averageCost) first; fall back to unitPrice so newly added items
        // with no GRN history still produce a COGS entry at their list price.
        const unitCost = Number(inv.averageCost) > 0 ? Number(inv.averageCost) : Number(inv.unitPrice) || 0;
        if (unitCost <= 0) {
          console.warn(`[COGS] Skipped ${inv.name || inv._id}: no WAC or unit price set`);
          continue;
        }
        const cost = Math.round(qty * unitCost * 100) / 100;
        const { inventoryAccountId, cogsAccountId } = await FinanceHelper.resolveInventoryAccounts(inv);
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
      await FinanceHelper.createAndPostJournalEntry({
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
      });
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
  postGRNJournal: async ({ inventoryItem, grnDoc, qty, unitPrice, createdBy }) => {
    try {
      const qty_ = Number(qty) || 0;
      const unitPrice_ = Number(unitPrice) || 0;
      if (qty_ <= 0 || unitPrice_ <= 0) return;

      // Resolve accounts: item-level → category → global defaults
      const { inventoryAccountId, grniAccountId } = await FinanceHelper.resolveInventoryAccounts(inventoryItem);
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
      await FinanceHelper.createAndPostJournalEntry({
        date: grnDoc.receiveDate || new Date(),
        reference: referenceNumber,
        description: `GRN ${referenceNumber}: Stock received – ${inventoryItem.name}`,
        department: 'procurement',
        module: 'procurement',
        referenceId: grnDoc._id,
        referenceType: 'grn',
        journalCode: 'INV',
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
      });

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
  postSINJournal: async ({ inventoryItem, sinDoc, qty, createdBy }) => {
    try {
      const qty_ = Number(qty) || 0;
      if (qty_ <= 0) return;

      // Resolve accounts: item-level → category → global defaults
      const { inventoryAccountId, cogsAccountId } = await FinanceHelper.resolveInventoryAccounts(inventoryItem);
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
      await FinanceHelper.createAndPostJournalEntry({
        date: sinDoc.issueDate || new Date(),
        reference: referenceNumber,
        description: `SIN ${referenceNumber}: Stock issued – ${inventoryItem.name}`,
        department: 'procurement',
        module: 'procurement',
        referenceId: sinDoc._id,
        referenceType: 'sin',
        journalCode: 'INV',
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
      });

      console.log(`[SIN Journal] Posted: DR COGS ${amount} / CR Inventory ${amount} for ${inventoryItem.name}`);
    } catch (err) {
      console.error('❌ FinanceHelper.postSINJournal error:', err.message);
    }
  },

  /**
   * Record Payroll Accrual (Expense)
   */
  recordPayrollAccrual: async (payroll, createdBy) => {
    try {
      const expAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.EXPENSE_SALARIES);
      const payableAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.SALARIES_PAYABLE);

      if (expAccount && payableAccount) {
        await FinanceHelper.createAndPostJournalEntry({
          date: new Date(),
          reference: `PAYROLL-${payroll.month}-${payroll.year}`,
          description: `Payroll Accrual for ${payroll.employeeName} (${payroll.month}/${payroll.year})`,
          department: 'hr',
          module: 'payroll',
          referenceId: payroll._id,
          referenceType: 'payroll',
          createdBy,
          lines: [
            { account: expAccount._id, description: `Salary Expense`, debit: payroll.netSalary, department: 'hr' },
            { account: payableAccount._id, description: `Salary Payable`, credit: payroll.netSalary, department: 'hr' }
          ]
        });
      }
    } catch (error) {
      console.error('❌ Error recording payroll accrual:', error);
    }
  },

  /**
   * Record Payroll Payment
   */
  recordPayrollPayment: async (payroll, paymentMethod, createdBy) => {
    try {
      const payableAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.SALARIES_PAYABLE);
      const bankAccount = await FinanceHelper.getAccountByNumber(
        paymentMethod === 'cash' ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
      );

      if (payableAccount && bankAccount) {
        await FinanceHelper.createAndPostJournalEntry({
          date: new Date(),
          reference: `SAL-PAY-${payroll.month}-${payroll.year}`,
          description: `Salary Payment to ${payroll.employeeName}`,
          department: 'hr',
          module: 'payroll',
          referenceId: payroll._id,
          referenceType: 'payment',
          createdBy,
          lines: [
            { account: payableAccount._id, description: `Debit Salaries Payable`, debit: payroll.netSalary, department: 'hr' },
            { account: bankAccount._id, description: `Credit Bank/Cash`, credit: payroll.netSalary, department: 'hr' }
          ]
        });
      }
    } catch (error) {
      console.error('❌ Error recording payroll payment:', error);
    }
  }
};

module.exports = FinanceHelper;
