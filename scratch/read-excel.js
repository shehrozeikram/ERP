const xlsx = require('xlsx');

const workbook = xlsx.readFile('./docs/Land Transfer detail.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet);

console.log('Headers:', Object.keys(data[0] || {}));
console.log('First 3 rows:');
console.log(data.slice(0, 3));
