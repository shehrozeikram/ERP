const mongoose = require('mongoose');
const Account = require('../models/finance/Account');
require('dotenv').config();

const accounts = [
  // Assets (1000-1999)
  { accountNumber: '1100', name: 'Cash in Hand', type: 'Asset', category: 'Current Assets', isSystem: true },
  { accountNumber: '1110', name: 'Bank Balance', type: 'Asset', category: 'Current Assets', isSystem: true },
  { accountNumber: '1200', name: 'Accounts Receivable', type: 'Asset', category: 'Current Assets', isSystem: true },
  { accountNumber: '1300', name: 'Inventory', type: 'Asset', category: 'Current Assets', isSystem: true },
  { accountNumber: '1500', name: 'Fixed Assets', type: 'Asset', category: 'Fixed Assets', isSystem: true },
  
  // Liabilities (2000-2999)
  { accountNumber: '2100', name: 'Accounts Payable', type: 'Liability', category: 'Current Liabilities', isSystem: true },
  { accountNumber: '2200', name: 'Salaries Payable', type: 'Liability', category: 'Current Liabilities', isSystem: true },
  { accountNumber: '2300', name: 'Tax Payable', type: 'Liability', category: 'Current Liabilities', isSystem: true },
  { accountNumber: '2500', name: 'Long Term Loans', type: 'Liability', category: 'Long-term Liabilities', isSystem: true },
  
  // Equity (3000-3999)
  { accountNumber: '3100', name: 'Owners Equity', type: 'Equity', category: 'Owner Equity', isSystem: true },
  { accountNumber: '3200', name: 'Retained Earnings', type: 'Equity', category: 'Retained Earnings', isSystem: true },
  
  // Revenue (4000-4999)
  { accountNumber: '4010', name: 'CAM Charges Revenue', type: 'Revenue', category: 'Operating Revenue', isSystem: true },
  { accountNumber: '4020', name: 'Electricity Revenue', type: 'Revenue', category: 'Operating Revenue', isSystem: true },
  { accountNumber: '4030', name: 'Rental Revenue', type: 'Revenue', category: 'Operating Revenue', isSystem: true },
  { accountNumber: '4500', name: 'Other Income', type: 'Revenue', category: 'Non-operating Revenue', isSystem: true },
  
  // Expenses (5000-5999)
  { accountNumber: '5100', name: 'Salary Expense', type: 'Expense', category: 'Operating Expenses', isSystem: true },
  { accountNumber: '5200', name: 'Utility Expense', type: 'Expense', category: 'Operating Expenses', isSystem: true },
  { accountNumber: '5300', name: 'Maintenance Expense', type: 'Expense', category: 'Operating Expenses', isSystem: true },
  { accountNumber: '5400', name: 'Office Supplies', type: 'Expense', category: 'Operating Expenses', isSystem: true },
  { accountNumber: '5500', name: 'Marketing Expense', type: 'Expense', category: 'Operating Expenses', isSystem: true },
  { accountNumber: '5900', name: 'Miscellaneous Expense', type: 'Expense', category: 'Operating Expenses', isSystem: true }
];

const seedCOA = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp';
    console.log(`Connecting to MongoDB at ${uri}...`);
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    for (const accountData of accounts) {
      const existing = await Account.findOne({ accountNumber: accountData.accountNumber });
      if (existing) {
        console.log(`Account ${accountData.accountNumber} already exists, updating...`);
        await Account.updateOne({ accountNumber: accountData.accountNumber }, accountData);
      } else {
        console.log(`Creating account ${accountData.accountNumber}: ${accountData.name}`);
        await Account.create(accountData);
      }
    }

    console.log('Chart of Accounts seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding COA:', error);
    process.exit(1);
  }
};

seedCOA();
