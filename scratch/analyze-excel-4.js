const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

const refSet = new Set();
let duplicates = 0;
for (const row of data) {
  const ref = row['Reference No.'];
  if (ref !== null && ref !== undefined && String(ref).trim() !== '') {
    if (refSet.has(ref)) {
      duplicates++;
    } else {
      refSet.add(ref);
    }
  }
}
console.log(`Duplicate Reference Nos: ${duplicates}`);
console.log(`Unique Reference Nos: ${refSet.size}`);
