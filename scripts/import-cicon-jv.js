/**
 * Flexible CICON Journal Vouchers Importer Script
 *
 * Supports running locally or on production via CLI options.
 * Matches Excel columns: Date, Voucher No, Account Code, Account Name, Description, Debit, Credit.
 * Auto-resolves / Creates CICON company and Chart of Accounts.
 * Creates JournalEntry documents and GeneralLedger records without deleting existing entries.
 * Sets clearanceStatus='cleared' and isReconciled=true so entries appear in Banking Reconciled view.
 *
 * Usage:
 *   node import-cicon-jv.js --file="../docs/CICON data import year 2025-26.xlsx" --company="CICON" --dry-run
 *   node import-cicon-jv.js --file="../docs/CICON data import year 2025-26.xlsx" --company="CICON" --apply
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const xlsx = require('xlsx');

// Load environment variables from server/.env or .env
const envPathServer = path.join(__dirname, '../server/.env');
const envPathRoot = path.join(__dirname, '../.env');
if (fs.existsSync(envPathServer)) {
  require('dotenv').config({ path: envPathServer });
} else if (fs.existsSync(envPathRoot)) {
  require('dotenv').config({ path: envPathRoot });
}

// Parse command-line args
const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isDryRun = !isApply;

function getArgValue(argName, defaultValue = '') {
  const match = args.find((a) => a.startsWith(`--${argName}=`));
  if (match) return match.split('=')[1].trim();
  return defaultValue;
}

const relativeFilePath = getArgValue('file', 'docs/CICON data import year 2025-26.xlsx');
const companyNameInput = getArgValue('company', 'CICON');

function excelDateToJS(excelDate) {
  if (typeof excelDate === 'string') {
    const parsed = new Date(excelDate);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (typeof excelDate === 'number') {
    return new Date(Math.round((excelDate - 25569) * 86400 * 1000));
  }
  return new Date();
}

function determineAccountType(code, name) {
  const num = Number(code);
  if (num >= 1000 && num < 2000) return { type: 'Asset', category: 'Current Assets' };
  if (num >= 2000 && num < 3000) return { type: 'Liability', category: 'Current Liabilities' };
  if (num >= 3000 && num < 4000) return { type: 'Equity', category: 'Equity' };
  if (num >= 4000 && num < 5000) return { type: 'Revenue', category: 'Operating Revenue' };
  if (num >= 5000 && num < 6000) return { type: 'Expense', category: 'Operating Expenses' };
  
  const lower = name.toLowerCase();
  if (lower.includes('expense') || lower.includes('charges') || lower.includes('tax')) return { type: 'Expense', category: 'Operating Expenses' };
  if (lower.includes('revenue') || lower.includes('fee') || lower.includes('income')) return { type: 'Revenue', category: 'Operating Revenue' };
  if (lower.includes('payable') || lower.includes('wht')) return { type: 'Liability', category: 'Current Liabilities' };
  if (lower.includes('advance') || lower.includes('deposit') || lower.includes('bank') || lower.includes('cash')) return { type: 'Asset', category: 'Current Assets' };

  return { type: 'Expense', category: 'Operating Expenses' };
}

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL || 'mongodb://127.0.0.1:27017/sgc_erp';
  console.log(`\n======================================================`);
  console.log(`🚀 CICON Journal Vouchers Importer`);
  console.log(`   Mode      : ${isApply ? 'APPLY (Writing changes to DB)' : 'DRY-RUN (Simulating)'}`);
  console.log(`   Target DB : ${mongoUri.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`   File      : ${relativeFilePath}`);
  console.log(`   Company   : ${companyNameInput}`);
  console.log(`======================================================\n`);

  const filePath = path.isAbsolute(relativeFilePath)
    ? relativeFilePath
    : path.join(__dirname, '..', relativeFilePath);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: Excel file not found at path: ${filePath}`);
    process.exit(1);
  }

  console.log(`📖 Reading Excel file...`);
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // Filter out summary/total footer rows (e.g. 'TOTAL', 'Difference must be nil ->')
  const rows = rawRows.filter(r => {
    const desc = String(r['Description'] || '').trim().toLowerCase();
    const hasVoucher = Boolean(r['Voucher No']);
    const hasCode = Boolean(r['Account Code']);
    const hasName = Boolean(r['Account Name']);
    if (desc === 'total' || desc.includes('difference must be nil')) return false;
    return hasVoucher || hasCode || hasName;
  });

  console.log(`✅ Loaded ${rows.length} valid transaction rows from sheet "${sheetName}".`);

  console.log(`🔌 Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  // Collections
  const companiesCol = db.collection('companies');
  const accountsCol = db.collection('accounts');
  const journalEntriesCol = db.collection('journalentries');
  const generalLedgersCol = db.collection('generalledgers');
  const departmentsCol = db.collection('departments');

  // 1. Get or Create Company
  let company = await companiesCol.findOne({ name: new RegExp(`^${companyNameInput}`, 'i') });
  if (!company) {
    const companyCodeVal = companyNameInput.toUpperCase();
    if (isApply) {
      const insertRes = await companiesCol.insertOne({
        name: companyNameInput,
        code: companyCodeVal,
        companyCode: companyCodeVal,
        type: 'Private Limited',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      company = { _id: insertRes.insertedId, name: companyNameInput };
      console.log(`➕ Created Company: ${companyNameInput} (ID: ${company._id})`);
    } else {
      company = { _id: new mongoose.Types.ObjectId(), name: companyNameInput };
      console.log(`[DRY-RUN] Will create Company: ${companyNameInput}`);
    }
  } else {
    console.log(`🏢 Found Target Company: ${company.name} (ID: ${company._id})`);
  }

  // 2. Department fallback
  let financeDept = await departmentsCol.findOne({ name: /Finance/i });
  const deptId = financeDept ? financeDept._id : new mongoose.Types.ObjectId();

  // 3. Load existing accounts for company
  const existingAccounts = await accountsCol.find({
    $or: [{ companyId: company._id }, { companyId: null }]
  }).toArray();

  const accountMapByCode = new Map();
  const accountMapByName = new Map();

  for (const acc of existingAccounts) {
    const code = String(acc.accountNumber || '').trim();
    const nameNorm = String(acc.name || '').trim().toLowerCase();
    if (code) accountMapByCode.set(code, acc);
    if (nameNorm) accountMapByName.set(nameNorm, acc);
  }

  // 4. Ensure all accounts in Excel exist in DB
  console.log(`\n🔍 Verifying Accounts...`);
  const excelAccountsMap = new Map();
  rows.forEach(r => {
    const code = String(r['Account Code'] || '').trim();
    const name = String(r['Account Name'] || '').trim();
    if (code || name) {
      if (!excelAccountsMap.has(code)) {
        excelAccountsMap.set(code, name);
      }
    }
  });

  let createdAccountCount = 0;
  for (const [code, name] of excelAccountsMap.entries()) {
    const nameNorm = name.toLowerCase();
    let targetAcc = accountMapByCode.get(code) || accountMapByName.get(nameNorm);

    if (!targetAcc) {
      const typeInfo = determineAccountType(code, name);
      const newAccDoc = {
        _id: new mongoose.Types.ObjectId(),
        companyId: company._id,
        accountNumber: code || '9000',
        name: name,
        type: typeInfo.type,
        category: typeInfo.category,
        detailType: 'Other',
        description: name,
        isActive: true,
        balance: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (isApply) {
        await accountsCol.insertOne(newAccDoc);
        console.log(`  ➕ Created Account [${code}] ${name} (${typeInfo.type})`);
      } else {
        console.log(`  [DRY-RUN] Will create Account [${code}] ${name} (${typeInfo.type})`);
      }

      accountMapByCode.set(code, newAccDoc);
      accountMapByName.set(nameNorm, newAccDoc);
      createdAccountCount++;
    }
  }

  console.log(`✅ Accounts verification complete. (${createdAccountCount} new accounts resolved)`);

  // 5. Group Rows by Voucher No
  console.log(`\n📦 Grouping transactions into Journal Vouchers...`);
  const jvGroups = new Map();
  rows.forEach((r, idx) => {
    const voucherNo = String(r['Voucher No'] || `JV-MANUAL-${idx}`).trim();
    if (!jvGroups.has(voucherNo)) {
      jvGroups.set(voucherNo, []);
    }
    jvGroups.get(voucherNo).push(r);
  });

  console.log(`📊 Found ${jvGroups.size} unique Journal Vouchers to process.`);

  let insertedJvCount = 0;
  let totalDebitSum = 0;
  let totalCreditSum = 0;
  let errorCount = 0;

  for (const [voucherNo, lines] of jvGroups.entries()) {
    const firstLine = lines[0];
    const jvDate = excelDateToJS(firstLine['Date']);
    const jvDescription = firstLine['Description'] || `Journal Voucher ${voucherNo}`;

    const jvLineDocs = [];
    let groupDebit = 0;
    let groupCredit = 0;

    for (const l of lines) {
      const accCode = String(l['Account Code'] || '').trim();
      const accName = String(l['Account Name'] || '').trim();
      const accDoc = accountMapByCode.get(accCode) || accountMapByName.get(accName.toLowerCase());

      if (!accDoc) {
        console.error(`❌ Could not resolve account for line: Code=${accCode}, Name=${accName} in JV ${voucherNo}`);
        errorCount++;
        continue;
      }

      const dr = Math.round((Number(l['Debit']) || 0) * 100) / 100;
      const cr = Math.round((Number(l['Credit']) || 0) * 100) / 100;

      groupDebit += dr;
      groupCredit += cr;

      jvLineDocs.push({
        account: accDoc._id,
        description: l['Description'] || jvDescription,
        debit: dr,
        credit: cr
      });
    }

    groupDebit = Math.round(groupDebit * 100) / 100;
    groupCredit = Math.round(groupCredit * 100) / 100;
    totalDebitSum += groupDebit;
    totalCreditSum += groupCredit;

    if (Math.abs(groupDebit - groupCredit) > 0.01) {
      console.warn(`⚠️ Warning: JV ${voucherNo} is out of balance! Debit: ${groupDebit}, Credit: ${groupCredit}`);
    }

    if (isApply) {
      // Check if entry already exists
      const existingJv = await journalEntriesCol.findOne({ companyId: company._id, entryNumber: voucherNo });

      const jvDocId = existingJv ? existingJv._id : new mongoose.Types.ObjectId();
      const journalEntryDoc = {
        companyId: company._id,
        entryNumber: voucherNo,
        voucherSeries: 'JV',
        date: jvDate,
        reference: voucherNo,
        description: jvDescription,
        department: deptId,
        module: 'finance',
        referenceType: 'manual',
        isReversed: false,
        clearanceStatus: 'cleared',
        clearedAt: jvDate,
        isReconciled: true,
        reconciledAt: jvDate,
        lines: jvLineDocs,
        status: 'posted',
        updatedAt: new Date()
      };

      if (!existingJv) {
        journalEntryDoc._id = jvDocId;
        journalEntryDoc.createdAt = new Date();
        await journalEntriesCol.insertOne(journalEntryDoc);
      } else {
        await journalEntriesCol.updateOne({ _id: jvDocId }, { $set: journalEntryDoc });
        // Clear previous GeneralLedger entries for re-posting
        await generalLedgersCol.deleteMany({ journalEntry: jvDocId });
      }

      // Create GeneralLedger entries for posting with clearanceStatus & isReconciled
      for (const line of jvLineDocs) {
        if (line.debit > 0 || line.credit > 0) {
          await generalLedgersCol.insertOne({
            journalEntry: jvDocId,
            account: line.account,
            companyId: company._id,
            date: jvDate,
            description: line.description,
            debit: line.debit,
            credit: line.credit,
            reference: voucherNo,
            clearanceStatus: 'cleared',
            clearedAt: jvDate,
            isReconciled: true,
            reconciledAt: jvDate,
            createdAt: new Date()
          });
        }
      }
    }

    insertedJvCount++;
  }

  console.log(`\n================ FINAL SUMMARY ================`);
  console.log(`   Mode                  : ${isApply ? 'APPLIED TO DB' : 'DRY-RUN'}`);
  console.log(`   Total Excel Rows      : ${rows.length}`);
  console.log(`   Total JVs Processed   : ${insertedJvCount}`);
  console.log(`   Total Debit Sum       : Rs. ${totalDebitSum.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`);
  console.log(`   Total Credit Sum      : Rs. ${totalCreditSum.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`);
  console.log(`   Errors / Unresolved   : ${errorCount}`);
  if (isDryRun) {
    console.log(`\n💡 To commit these changes to the database, run:`);
    console.log(`   node import-cicon-jv.js --file="${relativeFilePath}" --company="${companyNameInput}" --apply\n`);
  } else {
    console.log(`\n✅ Import completed successfully!\n`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(`💥 Execution failed:`, err);
  process.exit(1);
});
