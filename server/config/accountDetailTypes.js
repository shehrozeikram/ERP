/**
 * QuickBooks-style Account Types and Detail Types
 * Account type = single dropdown with grouped options (Asset | Cash and cash equivalents, etc.)
 * Detail type = second dropdown, required, options depend on account type
 */

// Account type options - displayed as one grouped dropdown (section headers + options)
const ACCOUNT_TYPES_GROUPED = {
  Asset: [
    'Cash and cash equivalents',
    'Accounts receivable (A/R)',
    'Current assets',
    'Fixed assets',
    'Non-current assets'
  ],
  Liability: [
    'Credit card',
    'Accounts payable (A/P)',
    'Current liabilities',
    'Non-current liabilities'
  ],
  Equity: ["Owner's equity"],
  Income: ['Income', 'Other income'],
  Expense: ['Cost of sales', 'Expenses', 'Other expense']
};

// Map account type value -> section (for account number range)
const ACCOUNT_TYPE_TO_SECTION = {};
Object.entries(ACCOUNT_TYPES_GROUPED).forEach(([section, opts]) => {
  opts.forEach((opt) => { ACCOUNT_TYPE_TO_SECTION[opt] = section; });
});

// Detail types per account type - second dropdown, REQUIRED
const DETAIL_TYPES_BY_ACCOUNT_TYPE = {
  'Cash and cash equivalents': ['Bank', 'Cash and cash equivalents', 'Cash on hand', 'Client trust account', 'Money Market', 'Rents Held in Trust', 'Savings'],
  'Accounts receivable (A/R)': ['Accounts receivable'],
  'Current assets': [
    'Allowance for bad debts',
    'Assets available for sale',
    'Development Costs',
    'Employee Cash Advances',
    'Inventory',
    'Investments - Other',
    'Loans To Officers',
    'Loans to Others',
    'Loans to Shareholders',
    'Other current assets',
    'Prepaid Expenses',
    'Retainage',
    'Undeposited Funds'
  ],
  'Fixed assets': [
    'Accumulated depletion',
    'Accumulated depreciation on property, plant and equipment',
    'Buildings',
    'Depletable Assets',
    'Furniture and Fixtures',
    'Land',
    'Leasehold Improvements',
    'Machinery and equipments',
    'Other fixed assets',
    'Vehicles'
  ],
  'Non-current assets': [
    'Accumulated amortisation of non-current assets',
    'Assets held for sale',
    'Deferred tax',
    'Goodwill',
    'Intangible Assets',
    'Lease Buyout',
    'Licences',
    'Long-term investments',
    'Organisational Costs',
    'Other non-current assets',
    'Security Deposits'
  ],
  'Credit card': ['Credit card'],
  'Accounts payable (A/P)': ['Accounts payable'],
  'Current liabilities': [
    'Accrued liabilities',
    'Client Trust Accounts - Liabilities',
    'Current Tax Liability',
    'Current portion of obligations under finance leases',
    'Dividends payable',
    'Income tax payable',
    'Insurance payable',
    'Line of Credit',
    'Loan Payable',
    'Other current liabilities',
    'Payroll Clearing',
    'Payroll liabilities',
    'Prepaid Expenses Payable',
    'Rents in trust - Liability',
    'Sales and service tax payable'
  ],
  'Non-current liabilities': [
    'Accrued holiday payable',
    'Accrued non-current liabilities',
    'Liabilities related to assets held for sale',
    'Long-term debt',
    'Notes Payable',
    'Other non-current liabilities',
    'Shareholder Notes Payable'
  ],
  "Owner's equity": [
    'Accumulated adjustment',
    'Dividend disbursed',
    'Equity in earnings of subsidiaries',
    'Opening Balance Equity',
    'Ordinary shares',
    'Other comprehensive income',
    "Owner's equity",
    'Paid-in capital or surplus',
    'Partner Contributions',
    'Partner Distributions',
    "Partner's Equity",
    'Preferred shares',
    'Retained Earnings',
    'Share capital',
    'Treasury Shares'
  ],
  Income: [
    'Discounts/Refunds Given',
    'Non-Profit Income',
    'Other Primary Income',
    'Revenue - General',
    'Sales - retail',
    'Sales - wholesale',
    'Sales of Product Income',
    'Service/Fee Income',
    'Unapplied Cash Payment Income'
  ],
  'Other income': [
    'Dividend income',
    'Interest earned',
    'Loss on disposal of assets',
    'Other Investment Income',
    'Other Miscellaneous Income',
    'Other operating income',
    'Tax-Exempt Interest',
    'Unrealised loss on securities, net of tax'
  ],
  'Cost of sales': [
    'Cost of labour - COS',
    'Equipment rental - COS',
    'Freight and delivery - COS',
    'Other costs of sales - COS',
    'Supplies and materials - COS'
  ],
  Expenses: [
    'Advertising/Promotional',
    'Amortisation expense',
    'Auto',
    'Bad debts',
    'Bank charges',
    'Charitable Contributions',
    'Commissions and fees',
    'Cost of Labour',
    'Dues and Subscriptions',
    'Equipment rental',
    'Finance costs',
    'Income tax expense',
    'Insurance',
    'Interest paid',
    'Legal and professional fees',
    'Loss on discontinued operations, net of tax',
    'Management compensation',
    'Meals and entertainment',
    'Office/General Administrative Expenses',
    'Other Miscellaneous Service Cost',
    'Other selling expenses',
    'Payroll Expenses',
    'Rent or Lease of Buildings',
    'Repair and maintenance',
    'Shipping and delivery expense',
    'Supplies and materials',
    'Taxes Paid',
    'Travel expenses - general and admin expense',
    'Travel expenses - selling expense',
    'Unapplied Cash Bill Payment Expense',
    'Utilities'
  ],
  'Other expense': [
    'Amortisation',
    'Depreciation',
    'Exchange Gain or Loss',
    'Interest expense',
    'Other Expense',
    'Penalties and settlements'
  ]
};

// Legacy
const LEGACY_CATEGORIES = [
  'Current Assets', 'Fixed Assets', 'Intangible Assets',
  'Current Liabilities', 'Long-term Liabilities',
  'Owner Equity', 'Retained Earnings',
  'Operating Revenue', 'Non-operating Revenue',
  'Operating Expenses', 'Non-operating Expenses', 'Cost of Goods Sold'
];

module.exports = {
  ACCOUNT_TYPES_GROUPED,
  ACCOUNT_TYPE_TO_SECTION,
  DETAIL_TYPES_BY_ACCOUNT_TYPE,
  LEGACY_CATEGORIES,
  getSectionForAccountType: (accountType) => ACCOUNT_TYPE_TO_SECTION[accountType],
  getDetailTypesForAccountType: (accountType) => DETAIL_TYPES_BY_ACCOUNT_TYPE[accountType] || [accountType]
};
