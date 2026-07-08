const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

let hasSeller = 0;
for(const row of data) {
  if (row['Seller Name']) hasSeller++;
}
console.log('Total rows in sheet_to_json:', data.length);
console.log('Rows with Seller Name:', hasSeller);
