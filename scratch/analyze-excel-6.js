const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '../docs/Land Transfer detail.xlsx');
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

let conditions = {
  hasReferenceNo: 0,
  hasDealNo: 0,
  hasSeller: 0,
  hasPurchaser: 0,
  hasDealNoAndSeller: 0,
  hasDate: 0,
  nonEmptyDealNoStr: 0,
};

for (const row of data) {
  if (row['Reference No.']) conditions.hasReferenceNo++;
  if (row['Deal No.'] !== null) conditions.hasDealNo++;
  if (row['Seller Name']) conditions.hasSeller++;
  if (row['Purchaser Name']) conditions.hasPurchaser++;
  if (row['Deal No.'] !== null && row['Seller Name']) conditions.hasDealNoAndSeller++;
  if (row['Transfer Date']) conditions.hasDate++;
  if (String(row['Deal No.'] || '').trim() !== '') conditions.nonEmptyDealNoStr++;
}
console.log(conditions);
console.log('Total rows:', data.length);

