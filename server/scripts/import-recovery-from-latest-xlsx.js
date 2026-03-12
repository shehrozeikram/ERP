/**
 * Import Recovery Assignments from server/scripts/latest-recovery.xlsx
 *
 * Usage (from project root):
 *   node server/scripts/import-recovery-from-latest-xlsx.js
 *   node server/scripts/import-recovery-from-latest-xlsx.js --replace   # clear existing then import
 *
 * Expects column headers to match (or be aliased): Order Code, Customer Name,
 * Booking Date, Sector, Size, CNIC, Mobile Number/MobileNumber, Customer Address/CustomerAddress,
 * Next Of Kin CNIC/NextOfKinCNIC, Plot No., Status, Sale Price, Received, Currently Due
 */
require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const { connectDB } = require('../config/database');
const RecoveryAssignment = require('../models/finance/RecoveryAssignment');

const EXCEL_TO_DB = {
  'Order Code': 'orderCode',
  'Customer Name': 'customerName',
  'Booking Date': 'bookingDate',
  'Sector': 'sector',
  'Size': 'size',
  'CNIC': 'cnic',
  'MobileNumber': 'mobileNumber',
  'Mobile Number': 'mobileNumber',
  'CustomerAddress': 'customerAddress',
  'Customer Address': 'customerAddress',
  'Len': 'length',
  'Length': 'length',
  'Plot No.': 'plotNo',
  'Status': 'status',
  'Sale Price': 'salePrice',
  'Received': 'received',
  'Currently Due': 'currentlyDue'
};

const DB_FIELDS = [
  'orderCode', 'customerName', 'bookingDate', 'sector', 'size', 'cnic',
  'mobileNumber', 'customerAddress', 'length', 'plotNo', 'status',
  'salePrice', 'received', 'currentlyDue'
];

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + val * 86400000);
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseNumber(val) {
  if (val === '' || val === null || val === undefined) return 0;
  const cleaned = String(val).replace(/,/g, '').trim();
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function rowToDoc(row) {
  const doc = {};
  const getVal = (dbKey) => {
    for (const [excelKey, key] of Object.entries(EXCEL_TO_DB)) {
      if (key !== dbKey) continue;
      const v = row[excelKey];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
  };
  for (const dbKey of DB_FIELDS) {
    const val = getVal(dbKey);
    if (val === undefined) continue;
    if (dbKey === 'bookingDate') doc[dbKey] = parseDate(val);
    else if (['salePrice', 'received', 'currentlyDue'].includes(dbKey)) doc[dbKey] = parseNumber(val);
    else doc[dbKey] = String(val).trim();
  }
  return doc;
}

async function main() {
  const replace = process.argv.includes('--replace');
  const scriptDir = path.resolve(__dirname);
  const filePath = path.join(scriptDir, 'latest-recovery.xlsx');

  console.log('Recovery import: reading', filePath);
  let wb;
  try {
    wb = XLSX.readFile(filePath, { cellDates: true });
  } catch (e) {
    console.error('Failed to read file:', e.message);
    process.exit(1);
  }

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });

  const docs = rows
    .map((r, idx) => {
      const d = rowToDoc(r);
      if (d.orderCode || d.customerName) {
        d.sortOrder = idx + 1;
        return d;
      }
      return null;
    })
    .filter(Boolean);

  if (docs.length === 0) {
    console.log('No valid rows found in the sheet. Check column headers.');
    process.exit(1);
  }

  await connectDB();

  if (replace) {
    const deleted = await RecoveryAssignment.deleteMany({});
    console.log('Replaced: deleted', deleted.deletedCount, 'existing records');
  }

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    await RecoveryAssignment.insertMany(batch);
    inserted += batch.length;
    console.log('Inserted', inserted, '/', docs.length);
  }

  console.log('Done. Imported', inserted, 'recovery assignments.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
