const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

console.log("Row 821:", data[821]);
console.log("Row 822:", data[822]);
console.log("Row 823:", data[823]);
console.log("Row 824:", data[824]);
