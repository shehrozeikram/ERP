const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

const uniqueRefs = new Set();
for (const row of data) {
  if (row['Seller Name']) {
     uniqueRefs.add(row['Reference No.']);
  }
}
console.log('Unique Refs with Seller Name:', uniqueRefs.size);
