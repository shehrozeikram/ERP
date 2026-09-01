'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
require('../models/hr/Company');
require('../models/hr/Department');
require('../models/hr/Employee');
const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');
const Account = require('../models/finance/Account');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const ablAccount = await Account.findById('6a476190b5a105a1ed1790b3').lean();
  console.log('ABL Account:', ablAccount.name, ablAccount.accountNumber);
  
  // Find JV-001195
  const je1195 = await JournalEntry.findOne({ entryNumber: 'JV-001195' }).lean();
  console.log('\nJV-001195 lines count:', je1195.lines.length);
  je1195.lines.forEach((l, i) => {
    console.log('  Line', i, ': acc=', String(l.account), 'dr=', l.debit, 'cr=', l.credit, 'desc=', (l.description || '').slice(0,40));
  });
  
  const gls1195 = await GeneralLedger.find({ journalEntry: je1195._id }).lean();
  console.log('\nJV-001195 GL entries:', gls1195.length);
  gls1195.forEach((g, i) => {
    console.log('  GL', i, ': acc=', String(g.account), 'dr=', g.debit, 'cr=', g.credit, 'cleared=', g.clearanceStatus, 'isRecon=', g.isReconciled);
  });
  
  // How many GL cleared on ABL account total?
  const clearedOnABL = await GeneralLedger.countDocuments({ account: ablAccount._id, clearanceStatus: 'cleared' });
  console.log('\nTotal cleared GL entries on ABL account:', clearedOnABL);
  
  // How many GL total on ABL account?
  const totalOnABL = await GeneralLedger.countDocuments({ account: ablAccount._id });
  console.log('Total GL entries on ABL account:', totalOnABL);

  // Total cleared GL for entire CICON company
  const ciconCoId = '6a34d22b55c58ecbf374e23a';
  const clearedAll = await GeneralLedger.countDocuments({ companyId: ciconCoId, clearanceStatus: 'cleared' });
  console.log('Total cleared GL entries for CICON (any account):', clearedAll);

  // How many cleared JEs in CICON?
  const clearedJEs = await JournalEntry.countDocuments({ companyId: ciconCoId, clearanceStatus: 'cleared' });
  console.log('Total cleared JEs for CICON:', clearedJEs);

  await mongoose.disconnect();
})();
