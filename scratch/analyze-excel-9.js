const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

let firstRef = null;
const dups = [];
for (const row of data) {
  if (row['Reference No.'] === 'Transfer BPV-1439 - JV-665') {
     dups.push(row);
  }
}

console.log(JSON.stringify(dups, null, 2));
