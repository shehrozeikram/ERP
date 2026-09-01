'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
require('../models/hr/Company');
require('../models/hr/Department');
require('../models/hr/Employee');
const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const ablAccId = '6a476190b5a105a1ed1790b3';
  
  for (const vrNo of ['JV-001213', 'JV-001280']) {
    const je = await JournalEntry.findOne({ entryNumber: vrNo }).lean();
    if (!je) {
      console.log(`${vrNo}: NOT FOUND in DB`);
      continue;
    }
    console.log(`\n=== ${vrNo} (JE lines: ${je.lines.length}) ===`);
    je.lines.forEach((l, i) => {
      const isABL = String(l.account) === ablAccId;
      console.log(`  Line ${i}: acc=${String(l.account)} ${isABL ? '** ABL **' : ''} dr=${l.debit} cr=${l.credit}`);
    });
    
    const gls = await GeneralLedger.find({ journalEntry: je._id }).lean();
    console.log(`  GL entries: ${gls.length}`);
    gls.forEach((g, i) => {
      const isABL = String(g.account) === ablAccId;
      console.log(`  GL ${i}: acc=${String(g.account)} ${isABL ? '** ABL **' : ''} dr=${g.debit} cr=${g.credit} cleared=${g.clearanceStatus}`);
    });
  }
  
  await mongoose.disconnect();
})();
