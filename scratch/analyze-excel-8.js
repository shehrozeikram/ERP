const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

const uniqueDeals = new Set();
let count = 0;
for(const row of data) {
  if (row['Deal No.'] !== null) {
     uniqueDeals.add(row['Deal No.']);
     count++;
  }
}

console.log('Unique deals:', uniqueDeals.size);

