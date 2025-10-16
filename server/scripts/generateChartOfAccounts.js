const mongoose = require('mongoose');
const Account = require('../models/finance/Account');
require('dotenv').config();

const defaultAccounts = [
  // ASSETS (1000-1999)
  // Current Assets (1000-1099)
  { accountNumber: '1000', name: 'Cash', type: 'Asset', category: 'Current Assets', department: 'finance', module: 'general' },
  { accountNumber: '1100', name: 'Petty Cash', type: 'Asset', category: 'Current Assets', department: 'admin', module: 'admin' },
  { accountNumber: '1200', name: 'Accounts Receivable', type: 'Asset', category: 'Current Assets', department: 'sales', module: 'sales' },
  { accountNumber: '1300', name: 'Inventory', type: 'Asset', category: 'Current Assets', department: 'procurement', module: 'procurement' },
  { accountNumber: '1400', name: 'Prepaid Expenses', type: 'Asset', category: 'Current Assets', department: 'admin', module: 'admin' },
  
  // Fixed Assets (1500-1599)
  { accountNumber: '1500', name: 'Office Equipment', type: 'Asset', category: 'Fixed Assets', department: 'admin', module: 'admin' },
  { accountNumber: '1510', name: 'Computer Equipment', type: 'Asset', category: 'Fixed Assets', department: 'admin', module: 'admin' },
  { accountNumber: '1520', name: 'Furniture & Fixtures', type: 'Asset', category: 'Fixed Assets', department: 'admin', module: 'admin' },
  { accountNumber: '1530', name: 'Vehicles', type: 'Asset', category: 'Fixed Assets', department: 'admin', module: 'admin' },
  { accountNumber: '1540', name: 'Accumulated Depreciation - Office Equipment', type: 'Asset', category: 'Fixed Assets', department: 'finance', module: 'general' },
  { accountNumber: '1541', name: 'Accumulated Depreciation - Computer Equipment', type: 'Asset', category: 'Fixed Assets', department: 'finance', module: 'general' },
  { accountNumber: '1542', name: 'Accumulated Depreciation - Furniture & Fixtures', type: 'Asset', category: 'Fixed Assets', department: 'finance', module: 'general' },
  { accountNumber: '1543', name: 'Accumulated Depreciation - Vehicles', type: 'Asset', category: 'Fixed Assets', department: 'finance', module: 'general' },

  // LIABILITIES (2000-2999)
  // Current Liabilities (2000-2099)
  { accountNumber: '2000', name: 'Accounts Payable', type: 'Liability', category: 'Current Liabilities', department: 'procurement', module: 'procurement' },
  { accountNumber: '2100', name: 'Accrued Expenses', type: 'Liability', category: 'Current Liabilities', department: 'finance', module: 'general' },
  { accountNumber: '2200', name: 'Payroll Liabilities', type: 'Liability', category: 'Current Liabilities', department: 'hr', module: 'payroll' },
  { accountNumber: '2210', name: 'Employee Income Tax Payable', type: 'Liability', category: 'Current Liabilities', department: 'hr', module: 'payroll' },
  { accountNumber: '2220', name: 'Employee Social Security Payable', type: 'Liability', category: 'Current Liabilities', department: 'hr', module: 'payroll' },
  { accountNumber: '2230', name: 'Employee Benefits Payable', type: 'Liability', category: 'Current Liabilities', department: 'hr', module: 'payroll' },
  { accountNumber: '2240', name: 'Employer Taxes Payable', type: 'Liability', category: 'Current Liabilities', department: 'hr', module: 'payroll' },
  { accountNumber: '2300', name: 'Short-term Loans', type: 'Liability', category: 'Current Liabilities', department: 'finance', module: 'general' },
  
  // Long-term Liabilities (2500-2599)
  { accountNumber: '2500', name: 'Long-term Debt', type: 'Liability', category: 'Long-term Liabilities', department: 'finance', module: 'general' },
  { accountNumber: '2600', name: 'Notes Payable', type: 'Liability', category: 'Long-term Liabilities', department: 'finance', module: 'general' },

  // EQUITY (3000-3999)
  { accountNumber: '3000', name: 'Owner Equity', type: 'Equity', category: 'Owner Equity', department: 'finance', module: 'general' },
  { accountNumber: '3100', name: 'Retained Earnings', type: 'Equity', category: 'Retained Earnings', department: 'finance', module: 'general' },
  { accountNumber: '3200', name: 'Current Year Earnings', type: 'Equity', category: 'Owner Equity', department: 'finance', module: 'general' },

  // REVENUE (4000-4999)
  // Operating Revenue (4000-4199)
  { accountNumber: '4000', name: 'Sales Revenue', type: 'Revenue', category: 'Operating Revenue', department: 'sales', module: 'sales' },
  { accountNumber: '4100', name: 'Service Revenue', type: 'Revenue', category: 'Operating Revenue', department: 'sales', module: 'sales' },
  { accountNumber: '4200', name: 'Project Revenue', type: 'Revenue', category: 'Operating Revenue', department: 'sales', module: 'sales' },
  
  // Non-operating Revenue (4300-4399)
  { accountNumber: '4300', name: 'Interest Income', type: 'Revenue', category: 'Non-operating Revenue', department: 'finance', module: 'general' },
  { accountNumber: '4400', name: 'Other Income', type: 'Revenue', category: 'Non-operating Revenue', department: 'finance', module: 'general' },

  // EXPENSES (5000-5999)
  // Cost of Goods Sold (5000-5099)
  { accountNumber: '5000', name: 'Cost of Goods Sold', type: 'Expense', category: 'Cost of Goods Sold', department: 'procurement', module: 'procurement' },
  { accountNumber: '5100', name: 'Direct Materials', type: 'Expense', category: 'Cost of Goods Sold', department: 'procurement', module: 'procurement' },
  { accountNumber: '5200', name: 'Direct Labor', type: 'Expense', category: 'Cost of Goods Sold', department: 'hr', module: 'payroll' },
  { accountNumber: '5300', name: 'Manufacturing Overhead', type: 'Expense', category: 'Cost of Goods Sold', department: 'procurement', module: 'procurement' },

  // Operating Expenses (5400-5799)
  // HR Expenses (5400-5499)
  { accountNumber: '5400', name: 'Salaries & Wages', type: 'Expense', category: 'Operating Expenses', department: 'hr', module: 'payroll' },
  { accountNumber: '5410', name: 'Employee Benefits', type: 'Expense', category: 'Operating Expenses', department: 'hr', module: 'payroll' },
  { accountNumber: '5420', name: 'Payroll Taxes', type: 'Expense', category: 'Operating Expenses', department: 'hr', module: 'payroll' },
  { accountNumber: '5430', name: 'Training & Development', type: 'Expense', category: 'Operating Expenses', department: 'hr', module: 'hr' },
  { accountNumber: '5440', name: 'Recruitment Expenses', type: 'Expense', category: 'Operating Expenses', department: 'hr', module: 'hr' },
  
  // Admin Expenses (5500-5599)
  { accountNumber: '5500', name: 'Office Rent', type: 'Expense', category: 'Operating Expenses', department: 'admin', module: 'admin' },
  { accountNumber: '5510', name: 'Utilities', type: 'Expense', category: 'Operating Expenses', department: 'admin', module: 'admin' },
  { accountNumber: '5520', name: 'Office Supplies', type: 'Expense', category: 'Operating Expenses', department: 'admin', module: 'admin' },
  { accountNumber: '5530', name: 'Insurance', type: 'Expense', category: 'Operating Expenses', department: 'admin', module: 'admin' },
  { accountNumber: '5540', name: 'Legal & Professional Fees', type: 'Expense', category: 'Operating Expenses', department: 'admin', module: 'admin' },
  { accountNumber: '5550', name: 'Depreciation Expense', type: 'Expense', category: 'Operating Expenses', department: 'finance', module: 'general' },
  
  // Procurement Expenses (5600-5699)
  { accountNumber: '5600', name: 'Raw Materials', type: 'Expense', category: 'Operating Expenses', department: 'procurement', module: 'procurement' },
  { accountNumber: '5610', name: 'Vendor Services', type: 'Expense', category: 'Operating Expenses', department: 'procurement', module: 'procurement' },
  { accountNumber: '5620', name: 'Shipping & Freight', type: 'Expense', category: 'Operating Expenses', department: 'procurement', module: 'procurement' },
  { accountNumber: '5630', name: 'Inventory Adjustments', type: 'Expense', category: 'Operating Expenses', department: 'procurement', module: 'procurement' },
  
  // Sales Expenses (5700-5799)
  { accountNumber: '5700', name: 'Sales Commissions', type: 'Expense', category: 'Operating Expenses', department: 'sales', module: 'sales' },
  { accountNumber: '5710', name: 'Marketing & Advertising', type: 'Expense', category: 'Operating Expenses', department: 'sales', module: 'sales' },
  { accountNumber: '5720', name: 'Travel & Entertainment', type: 'Expense', category: 'Operating Expenses', department: 'sales', module: 'sales' },
  { accountNumber: '5730', name: 'Customer Service', type: 'Expense', category: 'Operating Expenses', department: 'sales', module: 'sales' },
  
  // Finance Expenses (5800-5899)
  { accountNumber: '5800', name: 'Bank Fees', type: 'Expense', category: 'Operating Expenses', department: 'finance', module: 'general' },
  { accountNumber: '5810', name: 'Interest Expense', type: 'Expense', category: 'Operating Expenses', department: 'finance', module: 'general' },
  { accountNumber: '5820', name: 'Audit Fees', type: 'Expense', category: 'Operating Expenses', department: 'audit', module: 'audit' },
  { accountNumber: '5830', name: 'Tax Preparation', type: 'Expense', category: 'Operating Expenses', department: 'finance', module: 'general' },
  
  // Non-operating Expenses (5900-5999)
  { accountNumber: '5900', name: 'Bad Debt Expense', type: 'Expense', category: 'Non-operating Expenses', department: 'sales', module: 'sales' },
  { accountNumber: '5910', name: 'Loss on Sale of Assets', type: 'Expense', category: 'Non-operating Expenses', department: 'finance', module: 'general' },
  { accountNumber: '5920', name: 'Other Expenses', type: 'Expense', category: 'Non-operating Expenses', department: 'admin', module: 'admin' }
];

async function generateChartOfAccounts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');

    // Clear existing accounts (optional - remove this if you want to keep existing accounts)
    const existingAccounts = await Account.countDocuments();
    if (existingAccounts > 0) {
      console.log(`Found ${existingAccounts} existing accounts. Skipping creation to avoid duplicates.`);
      console.log('If you want to create accounts anyway, please clear the accounts collection first.');
      return;
    }

    // Create accounts
    console.log('Creating Chart of Accounts...');
    const createdAccounts = [];
    
    for (const accountData of defaultAccounts) {
      const account = new Account({
        ...accountData,
        isActive: true,
        allowTransactions: true,
        metadata: {
          createdBy: null // Will be set to system user if available
        }
      });
      
      await account.save();
      createdAccounts.push(account);
      console.log(`✓ Created account: ${account.accountNumber} - ${account.name} (${account.department})`);
    }

    console.log(`\n🎉 Successfully created ${createdAccounts.length} accounts in the Chart of Accounts!`);
    
    // Display summary by department
    const summary = {};
    createdAccounts.forEach(account => {
      if (!summary[account.department]) {
        summary[account.department] = 0;
      }
      summary[account.department]++;
    });

    console.log('\n📊 Accounts by Department:');
    Object.entries(summary).forEach(([department, count]) => {
      console.log(`  ${department}: ${count} accounts`);
    });

    console.log('\n✅ Chart of Accounts generation completed!');
    
  } catch (error) {
    console.error('❌ Error generating Chart of Accounts:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  generateChartOfAccounts();
}

module.exports = generateChartOfAccounts;
