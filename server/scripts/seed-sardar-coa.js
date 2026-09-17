const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.production') });

const Account = require('../models/finance/Account');
const PlacementCompany = require('../models/hr/Company');

const seedData = [
  { accountNumber: '1001', name: 'Cash in Hand', type: 'Asset', category: 'Current Assets', detailType: 'Cash and Cash Equivalents' },
  { accountNumber: '1002', name: 'Bank Account', type: 'Asset', category: 'Current Asset', detailType: 'Bank' },
  { accountNumber: '1100', name: 'Accounts Receivable', type: 'Asset', category: 'Current Asset', detailType: 'Accounts Receivable' },
  { accountNumber: '1105', name: 'Advance Tax Recoverable-Electricity', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets' },
  { accountNumber: '1110', name: 'Security Deposits (Bidding)', type: 'Asset', category: 'Non-current assets', detailType: 'Security Deposits' },
  { accountNumber: '1120', name: 'Advances to Suppliers & Contractors', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets' },
  { accountNumber: '1125', name: 'Employee Loan Receivable', type: 'Asset', category: 'Current Asset', detailType: 'Other Current Assets' },
  { accountNumber: '1130', name: 'Advances to Employees', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets' },
  { accountNumber: '1135', name: 'Advance Against Salary', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets' },
  { accountNumber: '1200', name: 'Accounts Receivable', type: 'Asset', category: 'Current Assets', detailType: 'Accounts Receivable' },
  { accountNumber: '1501', name: 'Computer & Ancillary Equipment', type: 'Asset', category: 'Fixed Assets', detailType: 'Property, Plant and Equipment' },
  { accountNumber: '1502', name: 'Electrical Item', type: 'Asset', category: 'Fixed Assets', detailType: 'Property, Plant and Equipment' },
  { accountNumber: '1503', name: 'Furniture & Fixtures', type: 'Asset', category: 'Fixed Assets', detailType: 'Property, Plant and Equipment' },
  { accountNumber: '1504', name: 'Library Books', type: 'Asset', category: 'Fixed Assets', detailType: 'Property, Plant and Equipment' },
  { accountNumber: '1505', name: 'Solar System', type: 'Asset', category: 'Fixed Assets', detailType: 'Property, Plant and Equipment' },
  { accountNumber: '1599', name: 'Accumulated depreciation on PP&E', type: 'Asset', category: 'Fixed Assets', detailType: 'Accumulated Depreciation' },
  { accountNumber: '2000', name: 'Payable to Related Parties', type: 'Liability', category: 'Current liabilities', detailType: 'Other current liabilities' },
  { accountNumber: '2001', name: 'Accounts Payable', type: 'Liability', category: 'Current Liabilities', detailType: 'Accounts Payable' }
];

async function seedSardarCOA() {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    console.log('Connecting to database...');
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected.');

    const company = await PlacementCompany.findOne({ name: /Sardar Group/i });
    if (!company) {
      console.error('Company "Sardar Group" not found.');
      process.exit(1);
    }
    console.log(`Found company: ${company.name} (${company._id})`);

    // We only want to SHOW these in Sardar Group.
    // So we first set all existing accounts for Sardar Group to inactive, or we can just upsert these.
    // The user said "show only Sardar Group of companies chart of accounts and their sub accounts please".
    // I will delete existing accounts for Sardar Group that are not in this list, or maybe just upsert these first.
    // It is safer to just delete all accounts that don't match these numbers if they want ONLY these, 
    // but they might have existing journal entries linked to them. 
    // So instead of deleting, we can just upsert these specific ones to ensure they have the exact code.

    for (const item of seedData) {
      const existingByCode = await Account.findOne({ companyId: company._id, accountNumber: item.accountNumber });
      if (existingByCode) {
        existingByCode.name = item.name;
        existingByCode.type = item.type;
        existingByCode.category = item.category;
        existingByCode.detailType = item.detailType;
        await existingByCode.save();
        console.log(`Updated ${item.accountNumber} - ${item.name}`);
      } else {
        const newAccount = new Account({
          ...item,
          companyId: company._id,
          isActive: true
        });
        await newAccount.save();
        console.log(`Created ${item.accountNumber} - ${item.name}`);
      }
    }

    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seedSardarCOA();
