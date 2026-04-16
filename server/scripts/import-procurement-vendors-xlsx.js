/* eslint-disable no-console */
/**
 * Import Approved Vendor List (AVL) from server/scripts/vendors.xlsx into Supplier (procurement vendors).
 *
 * Usage:
 *   node server/scripts/import-procurement-vendors-xlsx.js
 *   node server/scripts/import-procurement-vendors-xlsx.js --reset
 *   node server/scripts/import-procurement-vendors-xlsx.js /path/to/other.xlsx
 *
 * --reset : deletes suppliers where importSource === 'avl' before import
 */
require('dotenv').config();

const path = require('path');
const XLSX = require('xlsx');

const Supplier = require('../models/hr/Supplier');
const User = require('../models/User');

function cleanStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

function normalizePhone(p) {
  return cleanStr(p).replace(/[\s-]/g, '');
}

function placeholderEmail(supplierId) {
  return `avl.${supplierId.replace(/[^a-zA-Z0-9]/g, '')}@vendors.import.local`.toLowerCase();
}

function parseAvlRows(rows) {
  let currentCategory = '';
  const vendors = [];
  const seen = new Set();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const c0 = cleanStr(r[0]);
    const c1 = cleanStr(r[1]);

    if (!c0 && !c1) continue;

    if (c0 === 'Approved Vendor List') continue;

    if (c0 === 'Sr No' && c1 === 'Vendor Name') continue;

    const isNumericSr = c0 !== '' && !Number.isNaN(Number(c0)) && String(Number(c0)) === c0;

    if (!isNumericSr && c1 === '' && c0 !== 'Sr No') {
      currentCategory = c0;
      continue;
    }

    if (!isNumericSr) continue;

    const name = cleanStr(r[1]);
    if (!name) continue;

    const contactPerson = cleanStr(r[2]) || '—';
    const phoneRaw = cleanStr(r[3]);
    const phone = phoneRaw || '—';
    const emailRaw = cleanStr(r[4]).split(',')[0].trim();
    const ntnCnic = cleanStr(r[5]);
    const address = cleanStr(r[6]) || '—';
    const payeeName = cleanStr(r[7]);

    const cat = currentCategory || 'Uncategorized';
    const dedupeKey = `${cat}|${name.toLowerCase()}|${normalizePhone(phone)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    vendors.push({
      vendorCategory: cat,
      name,
      contactPerson,
      phone,
      emailRaw,
      ntnCnic,
      address,
      payeeName
    });
  }

  return vendors;
}

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const fileArg = args.find((a) => a && !a.startsWith('--'));
  const defaultXlsx = path.join(__dirname, 'vendors.xlsx');
  const abs = fileArg
    ? (path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg))
    : defaultXlsx;

  const { connectDB } = require('../config/database');
  await connectDB();

  const actor = await User.findOne({ role: 'super_admin' }).select('_id').lean()
    || await User.findOne().sort({ createdAt: 1 }).select('_id').lean();
  if (!actor) {
    console.error('No user found in database (need at least one user for createdBy).');
    process.exit(1);
  }

  if (reset) {
    const del = await Supplier.deleteMany({ importSource: 'avl' });
    console.log(`Reset: removed ${del.deletedCount || 0} suppliers with importSource=avl`);
  }

  const wb = XLSX.readFile(abs, { cellDates: true });
  const sheetName = wb.SheetNames.includes('AVL List') ? 'AVL List' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

  const parsed = parseAvlRows(rows);
  console.log(`Parsed ${parsed.length} unique vendor rows from sheet "${sheetName}"`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const lastSupplier = await Supplier.findOne().sort({ supplierId: -1 }).select('supplierId').lean();
  let supplierSeq = 0;
  if (lastSupplier && lastSupplier.supplierId) {
    const parts = String(lastSupplier.supplierId).split('-');
    supplierSeq = parseInt(parts[parts.length - 1], 10) || 0;
  }

  for (const row of parsed) {
    const existing = await Supplier.findOne({
      importSource: 'avl',
      vendorCategory: row.vendorCategory,
      name: row.name,
      phone: row.phone
    }).select('_id supplierId email').lean();

    const email = row.emailRaw && row.emailRaw.includes('@')
      ? row.emailRaw.toLowerCase()
      : null;

    if (existing) {
      await Supplier.updateOne(
        { _id: existing._id },
        {
          $set: {
            contactPerson: row.contactPerson,
            email: email || existing.email,
            address: row.address,
            ntnCnic: row.ntnCnic,
            payeeName: row.payeeName,
            vendorCategory: row.vendorCategory,
            status: 'Active'
          }
        }
      );
      updated++;
      continue;
    }

    const dupNameCat = await Supplier.findOne({
      vendorCategory: row.vendorCategory,
      name: row.name,
      importSource: { $ne: 'avl' }
    }).select('_id').lean();
    if (dupNameCat) {
      skipped++;
      continue;
    }

    supplierSeq += 1;
    const supplierId = `SUP-${String(supplierSeq).padStart(4, '0')}`;
    const finalEmail = email || placeholderEmail(supplierId);

    await Supplier.create({
      supplierId,
      name: row.name,
      contactPerson: row.contactPerson,
      phone: row.phone,
      email: finalEmail,
      address: row.address,
      paymentTerms: 'Cash',
      status: 'Active',
      notes: '',
      vendorCategory: row.vendorCategory,
      ntnCnic: row.ntnCnic,
      payeeName: row.payeeName,
      importSource: 'avl',
      createdBy: actor._id
    });
    inserted++;
  }

  console.log(`Done. inserted=${inserted}, updated=${updated}, skipped(non-avl duplicate)=${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
