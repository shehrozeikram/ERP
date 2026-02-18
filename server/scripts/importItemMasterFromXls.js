/* eslint-disable no-console */
require('dotenv').config();

const path = require('path');
const mongoose = require('mongoose');

// NOTE: This script expects the `xlsx` package (SheetJS).
// Install: npm i xlsx
const XLSX = require('xlsx');

const ItemMaster = require('../models/general/ItemMaster');

function cleanStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const filePath = args.find((a) => a && !a.startsWith('--'));
  if (!filePath) {
    console.error('Usage: node server/scripts/importItemMasterFromXls.js [--reset] "<absolute_path_to_Item List.xls>"');
    process.exit(1);
  }

  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  const { connectDB } = require('../config/database');
  await connectDB();

  if (reset) {
    const del = await ItemMaster.deleteMany({});
    console.log(`Reset: deleted ${del.deletedCount || 0} existing ItemMaster records`);
  }

  const wb = XLSX.readFile(abs, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Get rows as arrays (0-based columns)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

  // File format (as per your Item List.xls):
  // - Column 0 (A): item/category code
  // - Column 1 (B): category name OR "0" for item rows
  // - Column 2 (C): item name (3rd column) <-- per your instruction
  const hierarchy = {}; // level -> name
  const byCategoryCounter = new Map(); // categoryPath -> next srNo
  let inserted = 0;
  let skipped = 0;

  function inferLevelFromCode(code) {
    const len = (code || '').length;
    if (len <= 2) return 1;
    if (len <= 4) return 2;
    if (len <= 7) return 3;
    if (len <= 10) return 4;
    return 5;
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const code = cleanStr(r[0]);
    const colB = cleanStr(r[1]);
    const colC = cleanStr(r[2]);

    const isCategoryRow = !!code && !!colB && colB !== '0' && !colC;
    const isItemRow = !!code && colB === '0' && !!colC;

    if (isCategoryRow) {
      const lvl = inferLevelFromCode(code);
      hierarchy[lvl] = colB;
      // Clear deeper levels
      for (let j = lvl + 1; j <= 10; j++) delete hierarchy[j];
      continue;
    }

    if (!isItemRow) {
      skipped++;
      continue;
    }

    const pathParts = Object.keys(hierarchy)
      .map((k) => [parseInt(k, 10), hierarchy[k]])
      .sort((a, b) => a[0] - b[0])
      .map((x) => x[1])
      .filter(Boolean);

    const categoryPath = pathParts.join(' > ') || 'Uncategorized';
    const category = pathParts[pathParts.length - 1] || 'Uncategorized';

    const nextNo = (byCategoryCounter.get(categoryPath) || 0) + 1;
    byCategoryCounter.set(categoryPath, nextNo);

    // Upsert to avoid duplicates
    await ItemMaster.updateOne(
      { categoryPath, name: colC },
      { $setOnInsert: { category, categoryPath, name: colC, srNo: nextNo, isActive: true } },
      { upsert: true }
    );
    inserted++;
  }

  console.log(`Done. inserted/upserted: ${inserted}, skipped: ${skipped}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

