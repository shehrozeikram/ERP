/**
 * Update ONLY Pay + Deduction fields on July/August 2026 payrolls
 * for employees listed in docs/July & Aug 2026.xlsx.
 *
 * Does NOT change identity / bank / project / designation.
 * Uses native collection updates (bypasses Draft lock middleware).
 *
 * Usage (on server with production .env):
 *   node scripts/update-july-aug-2026-payroll-from-excel.js --dry-run
 *   node scripts/update-july-aug-2026-payroll-from-excel.js --apply
 */
'use strict';

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
const ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = path.join(ROOT, 'docs', 'July & Aug 2026.xlsx');

function loadEnv() {
  const candidates = [
    path.join(ROOT, '.env'),
    path.join(ROOT, '.env.production'),
    '/var/www/sgc-erp/.env'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      require('dotenv').config({ path: p, override: false });
    }
  }
}

function num(v) {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function allowance(amount) {
  const a = num(amount);
  return { isActive: a > 0, amount: a };
}

function readSheetRows(sheetName, month) {
  const openpyxlUnavailable = false;
  // Prefer xlsx (already in project)
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet not found: ${sheetName}`);
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, range: 2 }); // header row is Excel row 3 (0-index range start 2)
  const out = [];
  for (const row of rows) {
    const employeeId = String(row.ID ?? row.Id ?? row.id ?? '').trim();
    if (!employeeId || employeeId === 'ID') continue;

    const conveyance = num(row['Convance Allowance'] ?? row['Conveyance Allowance']);
    const house = num(row['House Allowance']);
    const food = num(row['Food Allowance']);
    const vehicle = num(row['Vehicle Allowance'] ?? row['Vehcle Allowance']);
    const medical = num(row['Medical Allowance']);
    const fuel = num(row['Fuel Allowance']);
    const basic = num(row.Basic);
    const arrears = num(row.Arears ?? row.Arrears);
    const standardGross = num(row['Standard Gross Salary']);
    const grossSalaryExcel = num(row['Gross Salary']);
    const incomeTax = num(row['Income Tax'] ?? row['Income tax']);
    const companyLoan = num(row['Company Loan']);
    const eobi = num(row['EOBI Deduction'] ?? row.EOBI ?? row['EOBI']);
    const employeeSecurity = num(row['Employee Security']);
    const netPayable = num(row['Net Payable']);

    out.push({
      month,
      year: 2026,
      employeeId,
      name: row.Name || '',
      pay: {
        basicSalary: basic,
        arrears,
        grossSalary: standardGross > 0 ? standardGross : grossSalaryExcel,
        totalEarnings: grossSalaryExcel > 0 ? grossSalaryExcel : standardGross,
        houseRentAllowance: house,
        medicalAllowance: medical,
        allowances: {
          conveyance: allowance(conveyance),
          houseRent: allowance(house),
          food: allowance(food),
          vehicle: allowance(vehicle),
          fuel: allowance(fuel),
          medical: allowance(medical),
          // keep vehicle+fuel split; zero legacy combo to avoid double count in reports
          vehicleFuel: { isActive: false, amount: 0 }
        }
      },
      deductions: {
        incomeTax,
        loanDeductions: companyLoan,
        companyLoanDeduction: companyLoan,
        eobi,
        employeeSecurity,
        netSalary: netPayable
      }
    });
  }
  return out;
}

function monthMatch(month) {
  // payroll.month may be number or zero-padded string in older data
  return { $in: [month, String(month), String(month).padStart(2, '0')] };
}

async function main() {
  loadEnv();
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel not found: ${EXCEL_PATH}`);
  }
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  if (!uri) throw new Error('MONGODB_URI not set');

  console.log(DRY_RUN ? '🔎 DRY RUN (no writes)' : '✍️  APPLY mode — writing to DB');
  console.log('DB:', uri.replace(/\/\/([^@]+)@/, '//***@').slice(0, 120));

  await mongoose.connect(uri);
  const employees = mongoose.connection.collection('employees');
  const payrolls = mongoose.connection.collection('payrolls');

  const sheets = [
    ...readSheetRows('July', 7),
    ...readSheetRows('Aug', 8)
  ];
  console.log(`Excel rows parsed: ${sheets.length}`);

  const summary = {
    updated: 0,
    missingEmployee: [],
    missingPayroll: [],
    unchanged: 0,
    samples: []
  };

  for (const row of sheets) {
    const eidRaw = String(row.employeeId).trim();
    const eidNum = Number(eidRaw);
    const eidVariants = new Set([eidRaw]);
    if (Number.isFinite(eidNum)) {
      eidVariants.add(String(eidNum));
      // Production employeeIds are often zero-padded (e.g. 06575)
      eidVariants.add(String(eidNum).padStart(4, '0'));
      eidVariants.add(String(eidNum).padStart(5, '0'));
      eidVariants.add(String(eidNum).padStart(6, '0'));
    }
    const emp = await employees.findOne(
      { employeeId: { $in: [...eidVariants] } },
      { projection: { _id: 1, employeeId: 1, firstName: 1, lastName: 1, isDeleted: 1 } }
    );
    if (!emp) {
      summary.missingEmployee.push({ month: row.month, employeeId: row.employeeId, name: row.name });
      continue;
    }

    let target = await payrolls.findOne({
      employee: emp._id,
      year: 2026,
      month: monthMatch(row.month),
      $or: [{ isManual: false }, { isManual: { $exists: false } }, { isManual: null }]
    });
    if (!target) {
      target = await payrolls.findOne({
        employee: emp._id,
        year: 2026,
        month: monthMatch(row.month)
      });
    }

    if (!target) {
      summary.missingPayroll.push({ month: row.month, employeeId: row.employeeId, name: row.name });
      continue;
    }

    const attendanceDeduction = num(target.attendanceDeduction);
    const leaveDeduction = num(target.leaveDeduction);
    const healthInsurance = num(target.healthInsurance);
    const advanceSalary = num(target.advanceSalary);
    const otherDeductions = num(target.otherDeductions);
    const providentFund = target.providentFundEnabled ? num(target.providentFund) : 0;

    const totalDeductions =
      num(row.deductions.incomeTax) +
      num(row.deductions.companyLoanDeduction) +
      num(row.deductions.eobi) +
      num(row.deductions.employeeSecurity) +
      attendanceDeduction +
      leaveDeduction +
      healthInsurance +
      advanceSalary +
      otherDeductions +
      providentFund;

    const $set = {
      basicSalary: row.pay.basicSalary,
      arrears: row.pay.arrears,
      grossSalary: row.pay.grossSalary,
      totalEarnings: row.pay.totalEarnings,
      houseRentAllowance: row.pay.houseRentAllowance,
      medicalAllowance: row.pay.medicalAllowance,
      'allowances.conveyance': row.pay.allowances.conveyance,
      'allowances.houseRent': row.pay.allowances.houseRent,
      'allowances.food': row.pay.allowances.food,
      'allowances.vehicle': row.pay.allowances.vehicle,
      'allowances.fuel': row.pay.allowances.fuel,
      'allowances.medical': row.pay.allowances.medical,
      'allowances.vehicleFuel': row.pay.allowances.vehicleFuel,
      incomeTax: row.deductions.incomeTax,
      loanDeductions: row.deductions.loanDeductions,
      companyLoanDeduction: row.deductions.companyLoanDeduction,
      eobi: row.deductions.eobi,
      employeeSecurity: row.deductions.employeeSecurity,
      totalDeductions,
      netSalary: row.deductions.netSalary,
      updatedAt: new Date()
    };

    const before = {
      basicSalary: target.basicSalary,
      totalEarnings: target.totalEarnings,
      incomeTax: target.incomeTax,
      netSalary: target.netSalary,
      status: target.status
    };

    if (summary.samples.length < 6) {
      summary.samples.push({
        month: row.month,
        employeeId: row.employeeId,
        name: row.name,
        status: target.status,
        before,
        after: {
          basicSalary: $set.basicSalary,
          totalEarnings: $set.totalEarnings,
          incomeTax: $set.incomeTax,
          netSalary: $set.netSalary
        }
      });
    }

    if (DRY_RUN) {
      summary.updated += 1;
      continue;
    }

    const res = await payrolls.updateOne({ _id: target._id }, { $set });
    if (res.modifiedCount || res.matchedCount) summary.updated += 1;
    else summary.unchanged += 1;
  }

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify({
    mode: DRY_RUN ? 'dry-run' : 'apply',
    wouldUpdateOrUpdated: summary.updated,
    unchanged: summary.unchanged,
    missingEmployee: summary.missingEmployee,
    missingPayroll: summary.missingPayroll,
    samples: summary.samples
  }, null, 2));

  await mongoose.disconnect();
  if (summary.missingEmployee.length || summary.missingPayroll.length) {
    process.exitCode = DRY_RUN ? 0 : 0;
  }
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
