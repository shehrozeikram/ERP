const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const PlacementCompany = require('../models/hr/Company');
const Account = require('../models/finance/Account');

const CICON_COA = [
  // Assets - Fixed Assets
  { accountNumber: '1501', name: 'Computer & Ancillary Equipment', type: 'Asset', category: 'Fixed Assets', detailType: 'Property, Plant and Equipment' },
  { accountNumber: '1502', name: 'Electrical Item', type: 'Asset', category: 'Fixed Assets', detailType: 'Property, Plant and Equipment' },
  { accountNumber: '1503', name: 'Furniture & Fixtures', type: 'Asset', category: 'Fixed Assets', detailType: 'Property, Plant and Equipment' },
  { accountNumber: '1504', name: 'Library Books', type: 'Asset', category: 'Fixed Assets', detailType: 'Property, Plant and Equipment' },
  { accountNumber: '1505', name: 'Solar System', type: 'Asset', category: 'Fixed Assets', detailType: 'Property, Plant and Equipment' },
  { accountNumber: '1599', name: 'Accumulated depreciation on PP&E', type: 'Asset', category: 'Fixed Assets', detailType: 'Accumulated Depreciation' },

  // Assets - Current Assets (Cash & Bank)
  { accountNumber: '1001', name: 'Cash in Hand', type: 'Asset', category: 'Current Assets', detailType: 'Cash and Cash Equivalents', accountCode: 'CASH' },
  { accountNumber: '1010', name: 'ABL - 0010134070860019 - COUNTRY HEALTH COMPL', type: 'Asset', category: 'Current Assets', detailType: 'Bank', accountCode: 'BANK_ABL' },
  { accountNumber: '1020', name: 'Bank Islami-CHC-0001', type: 'Asset', category: 'Current Assets', detailType: 'Bank', accountCode: 'BANK_ISLAMI' },

  // Assets - Advances & Deposits
  { accountNumber: '1105', name: 'Advance Tax Recoverable-Electricity', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets' },
  { accountNumber: '1110', name: 'Security Deposits (Bidding)', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets' },
  { accountNumber: '1120', name: 'Advances to Suppliers & Contractors', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets', accountCode: 'VENDOR_ADVANCE' },
  { accountNumber: '1130', name: 'Advances to Employees', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets', accountCode: 'STAFF_ADVANCE' },
  { accountNumber: '1135', name: 'Advance Against Salary', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets' },
  { accountNumber: '1200', name: 'Accounts Receivable', type: 'Asset', category: 'Current Assets', detailType: 'Accounts Receivable', accountCode: 'RECEIVABLE', isSystem: true },

  // Equity
  { accountNumber: '3001', name: 'Issued Share Capital', type: 'Equity', category: 'Equity', detailType: "Owner's Equity", accountCode: 'SHARE_CAPITAL' },
  { accountNumber: '3002', name: 'Retained Earnings', type: 'Equity', category: 'Equity', detailType: 'Retained Earnings', accountCode: 'RETAINED_EARNINGS', isSystem: true },

  // Liabilities - Payables & Taxes
  { accountNumber: '2001', name: 'Accounts Payable', type: 'Liability', category: 'Current Liabilities', detailType: 'Accounts Payable', accountCode: 'PAYABLE', isSystem: true },
  { accountNumber: '2211', name: 'EOBI Employer Contribution', type: 'Liability', category: 'Current Liabilities', detailType: 'Payroll Liabilities', accountCode: 'EOBI_PAYABLE' },
  { accountNumber: '2212', name: 'EOBI Employees Contribution', type: 'Liability', category: 'Current Liabilities', detailType: 'Payroll Liabilities' },
  { accountNumber: '2301', name: 'SGC-Sardar Group of Companies Pvt Ltd', type: 'Liability', category: 'Current Liabilities', detailType: 'Intercompany Payable' },
  { accountNumber: '2302', name: 'Taj Residencia', type: 'Liability', category: 'Current Liabilities', detailType: 'Intercompany Payable' },
  { accountNumber: '2010', name: 'WHT Employees Salary', type: 'Liability', category: 'Current Liabilities', detailType: 'Tax Payable' },
  { accountNumber: '2015', name: 'WHT- Supplies - 5.5%', type: 'Liability', category: 'Current Liabilities', detailType: 'Tax Payable' },
  { accountNumber: '2200', name: 'Salaries Payable', type: 'Liability', category: 'Current Liabilities', detailType: 'Payroll Liabilities', accountCode: 'SALARIES_PAYABLE', isSystem: true },

  // Income / Revenue
  { accountNumber: '4001', name: 'Revenue Of Student Fee Collection', type: 'Revenue', category: 'Operating Revenue', detailType: 'Sales', accountCode: 'STUDENT_FEE_REVENUE' },
  { accountNumber: '4100', name: 'Interest Income', type: 'Revenue', category: 'Non-operating Revenue', detailType: 'Other Income' },

  // Expenses
  { accountNumber: '5001', name: 'Salaries Expense', type: 'Expense', category: 'Operating Expenses', detailType: 'Payroll Expenses', accountCode: 'EXPENSE_SALARIES' },
  { accountNumber: '5002', name: 'EOBI Expense', type: 'Expense', category: 'Operating Expenses', detailType: 'Payroll Expenses', accountCode: 'EOBI_EXPENSE' },
  { accountNumber: '5010', name: 'Rent Expense', type: 'Expense', category: 'Operating Expenses', detailType: 'Rent Expenses' },
  { accountNumber: '5020', name: 'Water-Utilities Expenses', type: 'Expense', category: 'Operating Expenses', detailType: 'Utilities' },
  { accountNumber: '5021', name: 'Electricity Charges -Utilities Expenses', type: 'Expense', category: 'Operating Expenses', detailType: 'Utilities' },
  { accountNumber: '5022', name: 'Internet Charges', type: 'Expense', category: 'Operating Expenses', detailType: 'Utilities' },
  { accountNumber: '5023', name: 'Gas Charges', type: 'Expense', category: 'Operating Expenses', detailType: 'Utilities' },
  { accountNumber: '5030', name: 'Office Supplies', type: 'Expense', category: 'Operating Expenses', detailType: 'Admin Expenses' },
  { accountNumber: '5031', name: 'IT Consumables', type: 'Expense', category: 'Operating Expenses', detailType: 'Admin Expenses' },
  { accountNumber: '5040', name: 'Travel & Conveyance-Local', type: 'Expense', category: 'Operating Expenses', detailType: 'Travel Expenses' },
  { accountNumber: '5050', name: 'Entertainment Expenses', type: 'Expense', category: 'Operating Expenses', detailType: 'Admin Expenses' },
  { accountNumber: '5060', name: 'Printing and Stationery', type: 'Expense', category: 'Operating Expenses', detailType: 'Admin Expenses' },
  { accountNumber: '5070', name: 'Professional / Consultancy Charges', type: 'Expense', category: 'Operating Expenses', detailType: 'Professional Fees' },
  { accountNumber: '5075', name: 'Repair & Maintenance', type: 'Expense', category: 'Operating Expenses', detailType: 'Maintenance' },
  { accountNumber: '5080', name: "Auditor's remuneration", type: 'Expense', category: 'Operating Expenses', detailType: 'Professional Fees' },
  { accountNumber: '5085', name: 'Advertisment Expenses', type: 'Expense', category: 'Operating Expenses', detailType: 'Marketing Expenses' },
  { accountNumber: '5090', name: 'Dues and subscriptions', type: 'Expense', category: 'Operating Expenses', detailType: 'Admin Expenses' },
  { accountNumber: '5100', name: 'Depreciation Expense', type: 'Expense', category: 'Operating Expenses', detailType: 'Depreciation', accountCode: 'DEPRECIATION' },
  { accountNumber: '5110', name: 'Miscellaneous Expense', type: 'Expense', category: 'Operating Expenses', detailType: 'Other Operating Expenses', accountCode: 'EXPENSE_GENERAL' },
  { accountNumber: '5120', name: 'Zakat Deduction', type: 'Expense', category: 'Operating Expenses', detailType: 'Other Expenses' },
  { accountNumber: '5190', name: 'Uncategorised Expense', type: 'Expense', category: 'Operating Expenses', detailType: 'Other Operating Expenses' },
  { accountNumber: '5195', name: 'Bank Charge - CHCI -ABL-0019', type: 'Expense', category: 'Operating Expenses', detailType: 'Financial Charges' }
];

async function importCiconCOA() {
  const uri = process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local' || 'mongodb://localhost:27017/sgc_erp';
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);

  // 1. Find or create PlacementCompany CICON
  let ciconCompany = await PlacementCompany.findOne({
    name: { $regex: /^CICON/i }
  });

  if (!ciconCompany) {
    console.log('Creating PlacementCompany "CICON"...');
    ciconCompany = await PlacementCompany.create({
      name: 'CICON',
      companyCode: 'CICON',
      type: 'Private Limited',
      isActive: true
    });
    console.log('Created CICON Company with ID:', ciconCompany._id);
  } else {
    console.log('Found existing CICON Company with ID:', ciconCompany._id);
  }

  const companyId = ciconCompany._id;

  // 2. Clean up duplicates in Account collection for this company
  console.log('\n--- Checking for duplicates for CICON company ---');
  const existingAccounts = await Account.find({ companyId });
  console.log(`Found ${existingAccounts.length} existing accounts for CICON.`);

  // Track accounts by normalized name
  const nameMap = new Map();
  for (const acc of existingAccounts) {
    const norm = acc.name.trim().toLowerCase();
    if (!nameMap.has(norm)) {
      nameMap.set(norm, [acc]);
    } else {
      nameMap.get(norm).push(acc);
    }
  }

  // Remove exact name duplicates
  for (const [normName, list] of nameMap.entries()) {
    if (list.length > 1) {
      console.log(`Duplicate found for "${normName}": ${list.length} records. Keeping the first one (${list[0]._id}).`);
      const toDelete = list.slice(1);
      for (const d of toDelete) {
        await Account.findByIdAndDelete(d._id);
        console.log(`  - Deleted duplicate ID: ${d._id} (accountNumber: ${d.accountNumber})`);
      }
    }
  }

  // 3. Upsert / Import all CICON COA accounts
  console.log('\n--- Importing CICON Chart of Accounts ---');
  let createdCount = 0;
  let updatedCount = 0;

  for (const item of CICON_COA) {
    const normName = item.name.trim().toLowerCase();

    // Check if account already exists for CICON by name (case-insensitive) or by accountNumber
    const existing = await Account.findOne({
      companyId,
      $or: [
        { name: { $regex: new RegExp(`^${normName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { accountNumber: item.accountNumber }
      ]
    });

    if (existing) {
      // Update existing account
      existing.name = item.name;
      existing.type = item.type;
      existing.category = item.category;
      existing.detailType = item.detailType || existing.detailType;
      if (item.accountCode) existing.accountCode = item.accountCode;
      existing.isActive = true;
      await existing.save();
      console.log(`✓ Updated [${existing.accountNumber}] ${existing.name} (${existing.type})`);
      updatedCount++;
    } else {
      // Check if accountNumber is already used by a different account under this company
      let acctNum = item.accountNumber;
      while (await Account.exists({ companyId, accountNumber: acctNum })) {
        acctNum = String(Number(acctNum) + 1);
      }

      const created = await Account.create({
        companyId,
        accountNumber: acctNum,
        name: item.name,
        type: item.type,
        category: item.category,
        detailType: item.detailType,
        accountCode: item.accountCode || undefined,
        description: item.name,
        isActive: true,
        isSystem: item.isSystem || false,
        balance: 0
      });
      console.log(`+ Created [${created.accountNumber}] ${created.name} (${created.type})`);
      createdCount++;
    }
  }

  // Also import them globally (with companyId: null) if needed so they are available system-wide
  console.log('\n--- Checking global accounts ---');
  for (const item of CICON_COA) {
    const normName = item.name.trim().toLowerCase();
    const existingGlobal = await Account.findOne({
      companyId: null,
      name: { $regex: new RegExp(`^${normName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    if (!existingGlobal) {
      let acctNum = item.accountNumber;
      while (await Account.exists({ companyId: null, accountNumber: acctNum })) {
        acctNum = String(Number(acctNum) + 1);
      }
      await Account.create({
        companyId: null,
        accountNumber: acctNum,
        name: item.name,
        type: item.type,
        category: item.category,
        detailType: item.detailType,
        accountCode: item.accountCode || undefined,
        description: item.name,
        isActive: true,
        balance: 0
      });
      console.log(`+ Created Global [${acctNum}] ${item.name}`);
    }
  }

  const finalCiconAccounts = await Account.find({ companyId }).sort({ accountNumber: 1 }).lean();
  console.log(`\n========================================`);
  console.log(`Summary: ${createdCount} created, ${updatedCount} updated.`);
  console.log(`Total CICON Accounts in DB: ${finalCiconAccounts.length}`);
  console.log(`========================================`);

  await mongoose.disconnect();
}

importCiconCOA().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
