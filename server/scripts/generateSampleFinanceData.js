const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Account = require('../models/finance/Account');
const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');
const AccountsReceivable = require('../models/finance/AccountsReceivable');
const AccountsPayable = require('../models/finance/AccountsPayable');
const Banking = require('../models/finance/Banking');

const generateSampleFinanceData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Clear existing data
    await Account.deleteMany({});
    await JournalEntry.deleteMany({});
    await GeneralLedger.deleteMany({});
    await AccountsReceivable.deleteMany({});
    await AccountsPayable.deleteMany({});
    await Banking.deleteMany({});
    console.log('Cleared existing finance data');

    // Create Chart of Accounts
    const accounts = [
      // Assets
      { accountNumber: '1001', name: 'Cash', type: 'Asset', category: 'Current Assets', department: 'finance', balance: 500000 },
      { accountNumber: '1002', name: 'Bank - Current Account', type: 'Asset', category: 'Current Assets', department: 'finance', balance: 2500000 },
      { accountNumber: '1003', name: 'Bank - Savings Account', type: 'Asset', category: 'Current Assets', department: 'finance', balance: 1000000 },
      { accountNumber: '1200', name: 'Accounts Receivable', type: 'Asset', category: 'Current Assets', department: 'sales', balance: 750000 },
      { accountNumber: '1300', name: 'Inventory', type: 'Asset', category: 'Current Assets', department: 'procurement', balance: 500000 },
      { accountNumber: '1400', name: 'Office Equipment', type: 'Asset', category: 'Fixed Assets', department: 'admin', balance: 800000 },
      { accountNumber: '1401', name: 'Computer Equipment', type: 'Asset', category: 'Fixed Assets', department: 'admin', balance: 600000 },

      // Liabilities
      { accountNumber: '2001', name: 'Accounts Payable', type: 'Liability', category: 'Current Liabilities', department: 'procurement', balance: 300000 },
      { accountNumber: '2100', name: 'Accrued Expenses', type: 'Liability', category: 'Current Liabilities', department: 'hr', balance: 150000 },
      { accountNumber: '2200', name: 'Payroll Liabilities', type: 'Liability', category: 'Current Liabilities', department: 'hr', balance: 200000 },

      // Equity
      { accountNumber: '3001', name: 'Owner\'s Equity', type: 'Equity', category: 'Owner Equity', department: 'finance', balance: 5000000 },
      { accountNumber: '3002', name: 'Retained Earnings', type: 'Equity', category: 'Retained Earnings', department: 'finance', balance: 800000 },

      // Revenue
      { accountNumber: '4001', name: 'Sales Revenue', type: 'Revenue', category: 'Operating Revenue', department: 'sales', balance: 0 },
      { accountNumber: '4002', name: 'Service Revenue', type: 'Revenue', category: 'Operating Revenue', department: 'sales', balance: 0 },
      { accountNumber: '4003', name: 'Interest Income', type: 'Revenue', category: 'Non-operating Revenue', department: 'finance', balance: 0 },

      // Expenses
      { accountNumber: '5001', name: 'Salaries and Wages', type: 'Expense', category: 'Operating Expenses', department: 'hr', balance: 0 },
      { accountNumber: '5002', name: 'Office Rent', type: 'Expense', category: 'Operating Expenses', department: 'admin', balance: 0 },
      { accountNumber: '5003', name: 'Utilities', type: 'Expense', category: 'Operating Expenses', department: 'admin', balance: 0 },
      { accountNumber: '5004', name: 'Office Supplies', type: 'Expense', category: 'Operating Expenses', department: 'procurement', balance: 0 },
      { accountNumber: '5005', name: 'Professional Services', type: 'Expense', category: 'Operating Expenses', department: 'admin', balance: 0 },
      { accountNumber: '5006', name: 'Marketing Expenses', type: 'Expense', category: 'Operating Expenses', department: 'sales', balance: 0 },
      { accountNumber: '5007', name: 'Travel Expenses', type: 'Expense', category: 'Operating Expenses', department: 'admin', balance: 0 },
      { accountNumber: '5008', name: 'Equipment Maintenance', type: 'Expense', category: 'Operating Expenses', department: 'admin', balance: 0 }
    ];

    const createdAccounts = await Account.insertMany(accounts);
    console.log(`Created ${createdAccounts.length} accounts`);

    // Create Bank Accounts
    const bankAccounts = [
      {
        accountName: 'Main Current Account',
        accountType: 'checking',
        bankName: 'Bank of Pakistan',
        accountNumber: '1234567890',
        routingNumber: '123456789',
        currentBalance: 2500000,
        availableBalance: 2500000,
        department: 'finance',
        isActive: true,
        createdBy: new mongoose.Types.ObjectId()
      },
      {
        accountName: 'Savings Account',
        accountType: 'savings',
        bankName: 'Allied Bank',
        accountNumber: '0987654321',
        routingNumber: '987654321',
        currentBalance: 1000000,
        availableBalance: 1000000,
        department: 'finance',
        isActive: true,
        createdBy: new mongoose.Types.ObjectId()
      }
    ];

    const createdBankAccounts = await Banking.insertMany(bankAccounts);
    console.log(`Created ${createdBankAccounts.length} bank accounts`);

    // Create Sample Journal Entries
    const journalEntries = [
      {
        entryNumber: 'JE-001',
        date: new Date('2024-01-15'),
        description: 'Monthly payroll for January 2024',
        department: 'hr',
        module: 'payroll',
        reference: 'PAY-2024-01',
        referenceType: 'payroll',
        createdBy: new mongoose.Types.ObjectId(),
        lines: [
          { account: createdAccounts.find(a => a.name === 'Salaries and Wages')._id, debit: 450000, credit: 0, description: 'Employee salaries' },
          { account: createdAccounts.find(a => a.name === 'Payroll Liabilities')._id, debit: 50000, credit: 0, description: 'Taxes and benefits' },
          { account: createdAccounts.find(a => a.name === 'Cash')._id, debit: 0, credit: 500000, description: 'Cash payment' }
        ]
      },
      {
        entryNumber: 'JE-002',
        date: new Date('2024-01-20'),
        description: 'Office rent payment',
        department: 'admin',
        module: 'admin',
        reference: 'RENT-2024-01',
        referenceType: 'bill',
        createdBy: new mongoose.Types.ObjectId(),
        lines: [
          { account: createdAccounts.find(a => a.name === 'Office Rent')._id, debit: 100000, credit: 0, description: 'Monthly office rent' },
          { account: createdAccounts.find(a => a.name === 'Bank - Current Account')._id, debit: 0, credit: 100000, description: 'Bank payment' }
        ]
      },
      {
        entryNumber: 'JE-003',
        date: new Date('2024-01-25'),
        description: 'Sales revenue recognition',
        department: 'sales',
        module: 'sales',
        reference: 'SALE-2024-01',
        referenceType: 'invoice',
        createdBy: new mongoose.Types.ObjectId(),
        lines: [
          { account: createdAccounts.find(a => a.name === 'Accounts Receivable')._id, debit: 800000, credit: 0, description: 'Customer invoice' },
          { account: createdAccounts.find(a => a.name === 'Sales Revenue')._id, debit: 0, credit: 800000, description: 'Sales revenue' }
        ]
      }
    ];

    const createdJournalEntries = await JournalEntry.insertMany(journalEntries);
    console.log(`Created ${createdJournalEntries.length} journal entries`);

    // Create Sample Accounts Receivable
    const accountsReceivable = [
      {
        invoiceNumber: 'INV-001',
        customer: {
          name: 'ABC Corporation',
          email: 'billing@abccorp.com',
          phone: '+92-300-1234567'
        },
        invoiceDate: new Date('2024-01-15'),
        dueDate: new Date('2024-02-15'),
        subtotal: 250000,
        taxAmount: 0,
        totalAmount: 250000,
        amountPaid: 0,
        status: 'sent',
        department: 'sales',
        createdBy: new mongoose.Types.ObjectId(),
        items: [
          { description: 'Software License', quantity: 1, rate: 200000, amount: 200000 },
          { description: 'Support Services', quantity: 1, rate: 50000, amount: 50000 }
        ]
      },
      {
        invoiceNumber: 'INV-002',
        customer: {
          name: 'XYZ Ltd',
          email: 'finance@xyzltd.com',
          phone: '+92-301-2345678'
        },
        invoiceDate: new Date('2024-01-20'),
        dueDate: new Date('2024-02-20'),
        subtotal: 180000,
        taxAmount: 0,
        totalAmount: 180000,
        amountPaid: 90000,
        status: 'partial',
        department: 'sales',
        createdBy: new mongoose.Types.ObjectId(),
        items: [
          { description: 'Consulting Services', quantity: 40, rate: 4500, amount: 180000 }
        ]
      },
      {
        invoiceNumber: 'INV-003',
        customer: {
          name: 'DEF Industries',
          email: 'accounts@defind.com',
          phone: '+92-302-3456789'
        },
        invoiceDate: new Date('2024-01-10'),
        dueDate: new Date('2024-02-10'),
        subtotal: 320000,
        taxAmount: 0,
        totalAmount: 320000,
        amountPaid: 320000,
        status: 'paid',
        department: 'sales',
        createdBy: new mongoose.Types.ObjectId(),
        items: [
          { description: 'Equipment Supply', quantity: 1, rate: 320000, amount: 320000 }
        ]
      }
    ];

    const createdAR = await AccountsReceivable.insertMany(accountsReceivable);
    console.log(`Created ${createdAR.length} accounts receivable entries`);

    // Create Sample Accounts Payable
    const accountsPayable = [
      {
        billNumber: 'BILL-001',
        vendor: {
          name: 'Office Supplies Inc',
          email: 'billing@officesupplies.com',
          phone: '+92-303-4567890'
        },
        billDate: new Date('2024-01-18'),
        dueDate: new Date('2024-02-18'),
        subtotal: 45000,
        taxAmount: 0,
        totalAmount: 45000,
        amountPaid: 0,
        status: 'received',
        department: 'procurement',
        createdBy: new mongoose.Types.ObjectId(),
        items: [
          { description: 'Office Stationery', quantity: 50, rate: 500, amount: 25000 },
          { description: 'Printing Services', quantity: 1, rate: 20000, amount: 20000 }
        ]
      },
      {
        billNumber: 'BILL-002',
        vendor: {
          name: 'Tech Solutions Ltd',
          email: 'accounts@techsolutions.com',
          phone: '+92-304-5678901'
        },
        billDate: new Date('2024-01-22'),
        dueDate: new Date('2024-02-22'),
        subtotal: 120000,
        taxAmount: 0,
        totalAmount: 120000,
        amountPaid: 60000,
        status: 'partial',
        department: 'admin',
        createdBy: new mongoose.Types.ObjectId(),
        items: [
          { description: 'IT Support Services', quantity: 1, rate: 120000, amount: 120000 }
        ]
      },
      {
        billNumber: 'BILL-003',
        vendor: {
          name: 'Utilities Company',
          email: 'billing@utilities.com',
          phone: '+92-305-6789012'
        },
        billDate: new Date('2024-01-25'),
        dueDate: new Date('2024-02-25'),
        subtotal: 75000,
        taxAmount: 0,
        totalAmount: 75000,
        amountPaid: 75000,
        status: 'paid',
        department: 'admin',
        createdBy: new mongoose.Types.ObjectId(),
        items: [
          { description: 'Electricity Bill', quantity: 1, rate: 45000, amount: 45000 },
          { description: 'Internet Services', quantity: 1, rate: 30000, amount: 30000 }
        ]
      }
    ];

    const createdAP = await AccountsPayable.insertMany(accountsPayable);
    console.log(`Created ${createdAP.length} accounts payable entries`);

    // Create Sample Banking Transactions
    const bankingTransactions = [
      {
        date: new Date('2024-01-15'),
        type: 'withdrawal',
        amount: -500000,
        description: 'Payroll payment',
        reference: 'PAY-2024-01',
        account: createdBankAccounts[0]._id,
        runningBalance: 2000000
      },
      {
        date: new Date('2024-01-20'),
        type: 'withdrawal',
        amount: -100000,
        description: 'Office rent payment',
        reference: 'RENT-2024-01',
        account: createdBankAccounts[0]._id,
        runningBalance: 1900000
      },
      {
        date: new Date('2024-01-25'),
        type: 'deposit',
        amount: 320000,
        description: 'Customer payment - DEF Industries',
        reference: 'INV-003',
        account: createdBankAccounts[0]._id,
        runningBalance: 2220000
      },
      {
        date: new Date('2024-01-28'),
        type: 'deposit',
        amount: 90000,
        description: 'Customer payment - XYZ Ltd',
        reference: 'INV-002',
        account: createdBankAccounts[0]._id,
        runningBalance: 2310000
      }
    ];

    // Add transactions to bank accounts
    for (const transaction of bankingTransactions) {
      await Banking.findByIdAndUpdate(
        transaction.account,
        { $push: { transactions: transaction } }
      );
    }

    console.log(`Created ${bankingTransactions.length} banking transactions`);

    // Create General Ledger entries
    const generalLedgerEntries = [];
    for (const journalEntry of createdJournalEntries) {
      for (const line of journalEntry.lines) {
        generalLedgerEntries.push({
          date: journalEntry.date,
          entryNumber: journalEntry.entryNumber,
          account: line.account,
          description: line.description,
          debit: line.debit,
          credit: line.credit,
          runningBalance: line.debit - line.credit,
          department: journalEntry.department,
          module: journalEntry.module,
          journalEntry: journalEntry._id,
          createdBy: journalEntry.createdBy
        });
      }
    }

    await GeneralLedger.insertMany(generalLedgerEntries);
    console.log(`Created ${generalLedgerEntries.length} general ledger entries`);

    console.log('✅ Sample finance data generated successfully!');
    console.log('\n📊 Summary:');
    console.log(`- ${createdAccounts.length} Chart of Accounts entries`);
    console.log(`- ${createdBankAccounts.length} Bank accounts`);
    console.log(`- ${createdJournalEntries.length} Journal entries`);
    console.log(`- ${createdAR.length} Accounts Receivable entries`);
    console.log(`- ${createdAP.length} Accounts Payable entries`);
    console.log(`- ${bankingTransactions.length} Banking transactions`);
    console.log(`- ${generalLedgerEntries.length} General Ledger entries`);

  } catch (error) {
    console.error('Error generating sample finance data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the script
generateSampleFinanceData();
