const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
console.log('Sheets:', workbook.SheetNames);
for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
  console.log(`\nSheet: ${sheetName}`);
  console.log(`Row count: ${data.length}`);
  if (data.length > 0) {
    console.log('Headers:', Object.keys(data[0]));
    console.log('First Row Sample:', data[0]);
  }
}
