const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

let hasDealNo = 0;
let hasDealNoButNoSeller = 0;
let hasDealNoButNoPurchase = 0;
let hasSeller = 0;

for (const row of data) {
  if (row['Deal No.'] !== null && row['Deal No.'] !== undefined) {
    hasDealNo++;
    if (!row['Seller Name']) hasDealNoButNoSeller++;
  }
  if (row['Seller Name']) hasSeller++;
}
console.log(`Total rows: ${data.length}`);
console.log(`Rows with Deal No: ${hasDealNo}`);
console.log(`Rows with Deal No but no Seller: ${hasDealNoButNoSeller}`);
console.log(`Rows with Seller: ${hasSeller}`);

