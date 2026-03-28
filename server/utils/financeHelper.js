const mongoose = require('mongoose');
const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');
const Account = require('../models/finance/Account');
const AccountsPayable = require('../models/finance/AccountsPayable');
const AccountsReceivable = require('../models/finance/AccountsReceivable');

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
      const cat = await InventoryCategory.findById(inventoryItem.inventoryCategory).lean();
      if (cat) {
        if (!inventoryAccountId) inventoryAccountId = cat.stockValuationAccount;
        if (!grniAccountId) inventoryAccountId = inventoryAccountId || cat.stockValuationAccount;
        if (!grniAccountId) grniAccountId = cat.stockInputAccount;
        if (!cogsAccountId) cogsAccountId = cat.stockOutputAccount;
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
    if (doc.amountPaid >= doc.totalAmount) {
      doc.status = 'paid';
    } else if (doc.amountPaid > 0) {
      doc.status = 'partial';
    }
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
        billNumber, billDate, dueDate,
        amount, department, module, referenceId,
        createdBy,
        referenceType = 'manual',
        lineItems: optsLineItems,
        lineDescription
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
        billDate: billDateNorm,
        dueDate,
        totalAmount: amount,
        subtotal: amount,
        status: 'approved',
        department,
        module,
        referenceId,
        referenceType: referenceType,
        lineItems,
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
          debitAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.GRNI);
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

      const { amount, paymentMethod, reference, date, createdBy } = paymentData;

      invoice.payments.push({ amount, paymentDate: date || new Date(), paymentMethod, reference, createdBy });
      invoice.amountPaid += amount;
      FinanceHelper._updateDocumentStatus(invoice);
      await invoice.save();

      const arAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.RECEIVABLE);
      const bankAccount = await FinanceHelper.getAccountByNumber(
        paymentMethod === 'cash' ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
      );

      if (arAccount && bankAccount) {
        await FinanceHelper.createAndPostJournalEntry({
          date: date,
          reference: reference || invoice.invoiceNumber,
          description: `Payment Receipt: ${invoice.invoiceNumber} from ${invoice.customer.name}`,
          department: invoice.department,
          module: invoice.module,
          referenceId: invoice._id,
          referenceType: 'payment',
          createdBy,
          lines: [
            { account: bankAccount._id, description: `Receipt for ${invoice.invoiceNumber}`, debit: amount, department: invoice.department },
            { account: arAccount._id, description: `Credit to AR for ${invoice.customer.name}`, credit: amount, department: invoice.department }
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

      const { amount, paymentMethod, reference, date, createdBy } = paymentData;

      bill.payments.push({ amount, paymentDate: date || new Date(), paymentMethod, reference, createdBy });
      bill.amountPaid += amount;
      FinanceHelper._updateDocumentStatus(bill);
      await bill.save();

      const apAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.PAYABLE);
      const bankAccount = await FinanceHelper.getAccountByNumber(
        paymentMethod === 'cash' ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
      );

      if (apAccount && bankAccount) {
        await FinanceHelper.createAndPostJournalEntry({
          date: date,
          reference: reference || bill.billNumber,
          description: `Bill Payment: ${bill.billNumber} to ${bill.vendor.name}`,
          department: bill.department,
          module: bill.module,
          referenceId: bill._id,
          referenceType: 'payment',
          createdBy,
          lines: [
            { account: apAccount._id, description: `Debit to AP for ${bill.vendor.name}`, debit: amount, department: bill.department },
            { account: bankAccount._id, description: `Payment from Bank/Cash`, credit: amount, department: bill.department }
          ]
        });
      }

      return bill;
    } catch (error) {
      console.error('❌ Error recording AP payment:', error);
      throw error;
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

      // Use Weighted Average Cost; fallback to unitPrice if WAC not set
      const unitCost = inventoryItem.averageCost || inventoryItem.unitPrice || 0;
      const amount = Math.round(qty_ * unitCost * 100) / 100;
      if (amount <= 0) return;

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
