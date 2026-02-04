/**
 * Import Recovery Assignments from RecoveryAssignment.xlsx
 * Run: node server/scripts/import-recovery-assignments.js
 */
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const RecoveryAssignment = require('../models/finance/RecoveryAssignment');

const EXCEL_TO_DB = {
  'Order Code': 'orderCode',
  'Customer Name': 'customerName',
  'Booking Date': 'bookingDate',
  'Sector': 'sector',
  'Size': 'size',
  'CNIC': 'cnic',
  'MobileNumber': 'mobileNumber',
  'CustomerAddress': 'customerAddress',
  'NextOfKinCNIC': 'nextOfKinCNIC',
  'Plot No.': 'plotNo',
  'Status': 'status',
  'Sale Price': 'salePrice',
  'Received': 'received',
  'Currently Due': 'currentlyDue'
};

const parseDate = (val) => {
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
};

const parseNum = (val) => {
  if (val === '' || val == null) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const mapRow = (row) => {
  const doc = {};
  Object.entries(EXCEL_TO_DB).forEach(([k, dbKey]) => {
    const v = row[k];
    if (v === undefined) return;
    if (dbKey === 'bookingDate') doc[dbKey] = parseDate(v);
    else if (['salePrice', 'received', 'currentlyDue'].includes(dbKey)) doc[dbKey] = parseNum(v);
    else doc[dbKey] = v != null ? String(v).trim() : '';
  });
  return doc;
};

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log('✅ MongoDB connected');
};

const main = async () => {
  const filePath = path.join(__dirname, 'RecoveryAssignment.xlsx');
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  const docs = rows.map(mapRow).filter((d) => d.orderCode || d.customerName);

  await connectDB();

  const existing = await RecoveryAssignment.countDocuments();
  if (existing > 0) {
    console.log(`⚠️ Collection has ${existing} records. Dropping and re-importing...`);
    await RecoveryAssignment.deleteMany({});
  }

  const BATCH = 2000;
  let total = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    await RecoveryAssignment.insertMany(batch);
    total += batch.length;
    console.log(`  Imported ${total}/${docs.length}`);
  }

  console.log(`✅ Imported ${total} recovery assignments`);
  await mongoose.disconnect();
  process.exit(0);
};

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
