const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

let hasData = 0;
let lastRowWithData = 0;
for (let i = 0; i < data.length; i++) {
  const row = data[i];
  let isRowEmpty = true;
  for (const key in row) {
    if (row[key] !== null && row[key] !== undefined && row[key] !== '') {
      isRowEmpty = false;
      break;
    }
  }
  if (!isRowEmpty) {
    hasData++;
    lastRowWithData = i;
  }
}
console.log('Rows with some data:', hasData);
console.log('Last row index with data:', lastRowWithData);
