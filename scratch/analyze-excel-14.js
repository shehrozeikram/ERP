const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

let countRefs = new Set();
let countBPV = new Set();
let countEmpty = 0;

for (const row of data) {
  let ref = row['Reference No.'];
  if (ref && String(ref).trim() !== '') {
     ref = String(ref).trim();
     countRefs.add(ref);
     if (ref.startsWith('Transfer BPV')) {
         countBPV.add(ref);
     }
  } else {
     countEmpty++;
  }
}

console.log('Unique Refs:', countRefs.size);
console.log('Unique Refs starting with Transfer BPV:', countBPV.size);
console.log('Unique Refs NOT starting with Transfer BPV:', countRefs.size - countBPV.size);
console.log('Empty Refs:', countEmpty);

