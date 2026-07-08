const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

let bpvRefs = 0;
for (const row of data) {
  const ref = row['Reference No.'];
  if (ref && String(ref).includes('BPV')) {
     bpvRefs++;
  }
}
console.log('Refs with BPV:', bpvRefs);
