const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

let hasRef = 0;
for (const row of data) {
  if (row['Reference No.'] !== null && row['Reference No.'] !== undefined && String(row['Reference No.']).trim() !== '') {
    hasRef++;
  }
}
console.log(`Rows with Reference No: ${hasRef}`);
