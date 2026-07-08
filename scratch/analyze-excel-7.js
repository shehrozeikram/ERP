const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

const uniqueRefs = new Set();
for(const row of data) {
  const ref = row['Reference No.'];
  if (ref && String(ref).trim() !== '') {
     // Wait, if ref is "Transfer BPV-" what happens?
     uniqueRefs.add(String(ref).trim());
  }
}

let countValidRef = 0;
for(const ref of uniqueRefs) {
    if (ref !== 'Transfer BPV-') countValidRef++;
}

console.log('Unique refs:', uniqueRefs.size);
console.log('Unique refs ignoring "Transfer BPV-":', countValidRef);

