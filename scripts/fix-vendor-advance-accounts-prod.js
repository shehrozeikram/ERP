const dbName = 'sgc_erp';
db = db.getSiblingDB(dbName);

const required = [
  {
    accountNumber: '1001',
    name: 'Cash',
    type: 'Asset',
    category: 'Current Asset',
    detailType: 'Cash and Cash Equivalents',
    description: 'Cash account for operational payments'
  },
  {
    accountNumber: '1002',
    name: 'Bank Account',
    type: 'Asset',
    category: 'Current Asset',
    detailType: 'Bank',
    description: 'Default bank account for payments and receipts'
  },
  {
    accountNumber: '1110',
    name: 'Advance to Suppliers',
    type: 'Asset',
    category: 'Current Asset',
    detailType: 'Other Current Assets',
    description: 'Vendor advances paid before bill settlement'
  }
];

const now = new Date();

for (const acc of required) {
  const exists = db.accounts.findOne({ accountNumber: acc.accountNumber });
  if (exists) {
    print(`EXISTS  ${acc.accountNumber}  ${exists.name}`);
    continue;
  }
  db.accounts.insertOne({
    ...acc,
    isActive: true,
    isSystem: true,
    createdAt: now,
    updatedAt: now
  });
  print(`CREATED ${acc.accountNumber}  ${acc.name}`);
}

print('\nVerification:');
printjson(
  db.accounts
    .find(
      { accountNumber: { $in: ['1001', '1002', '1110'] } },
      { _id: 0, accountNumber: 1, name: 1, type: 1, isActive: 1 }
    )
    .sort({ accountNumber: 1 })
    .toArray()
);
