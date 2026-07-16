/**
 * Test script for FY-aware tax calculation
 * Run with: node server/test_fy_tax.js
 */

// Inline the functions to avoid requiring the full module (no DB needed)

function getRemainingFYMonths(hireDate, payrollMonth, payrollYear) {
  if (!hireDate) return 12;
  const hire = new Date(hireDate);
  if (isNaN(hire.getTime())) return 12;

  const fyStartYear = payrollMonth >= 7 ? payrollYear : payrollYear - 1;
  const fyStartMonth = 7;
  const hireYear  = hire.getFullYear();
  const hireMonth = hire.getMonth() + 1;

  if (hireYear < fyStartYear || (hireYear === fyStartYear && hireMonth <= fyStartMonth)) {
    return 12;
  }
  if (hireYear > payrollYear || (hireYear === payrollYear && hireMonth > 6 && payrollMonth <= 6)) {
    return 1;
  }

  const fyEndYear  = fyStartYear + 1;
  const fyEndMonth = 6;
  const months = (fyEndYear - hireYear) * 12 + (fyEndMonth - hireMonth) + 1;
  return Math.min(12, Math.max(1, months));
}

function applyFBRSlabs(annualTaxableIncome) {
  let annualTax = 0;
  if (annualTaxableIncome <= 600000) {
    annualTax = 0;
  } else if (annualTaxableIncome <= 1200000) {
    annualTax = (annualTaxableIncome - 600000) * 0.01;
  } else if (annualTaxableIncome <= 2200000) {
    annualTax = 6000 + (annualTaxableIncome - 1200000) * 0.11;
  } else if (annualTaxableIncome <= 3200000) {
    annualTax = 116000 + (annualTaxableIncome - 2200000) * 0.20;
  } else if (annualTaxableIncome <= 4100000) {
    annualTax = 316000 + (annualTaxableIncome - 3200000) * 0.25;
  } else if (annualTaxableIncome <= 5600000) {
    annualTax = 541000 + (annualTaxableIncome - 4100000) * 0.29;
  } else if (annualTaxableIncome <= 7000000) {
    annualTax = 976000 + (annualTaxableIncome - 5600000) * 0.32;
  } else {
    annualTax = 1424000 + (annualTaxableIncome - 7000000) * 0.35;
  }
  if (annualTaxableIncome > 10000000) annualTax += annualTax * 0.09;
  return annualTax;
}

function calculateMonthlyTaxFYAware(monthlySalary, hireDate, payrollMonth, payrollYear) {
  if (!monthlySalary || monthlySalary <= 0) return 0;
  const fyMonths = getRemainingFYMonths(hireDate, payrollMonth, payrollYear);
  const annualTaxableIncome = monthlySalary * fyMonths;
  const annualTax = applyFBRSlabs(annualTaxableIncome);
  return Math.round(annualTax / 12);
}

function calculateMonthlyTax(monthlySalary) {
  if (!monthlySalary || monthlySalary <= 0) return 0;
  const annualTaxableIncome = monthlySalary * 12;
  const annualTax = applyFBRSlabs(annualTaxableIncome);
  return Math.round(annualTax / 12);
}

// ─── Test Cases ───────────────────────────────────────────────────────────────

const PKR = (n) => `Rs. ${n.toLocaleString('en-PK')}`;

const tests = [
  {
    name: 'Mansoor Zareen — Hired June 1, 2026 | Salary 400,000/mo | Payroll June 2026',
    hireDate: '2026-06-01',
    grossSalary: 400000,
    payrollMonth: 6,
    payrollYear: 2026,
    expectedFYMonths: 1,
    expectedTax: 0  // 400,000 × 1 = 400,000 annual → below 600,000 slab → 0 tax
  },
  {
    name: 'Employee hired July 1, 2025 (full FY) | Salary 400,000/mo',
    hireDate: '2025-07-01',
    grossSalary: 400000,
    payrollMonth: 6,
    payrollYear: 2026,
    expectedFYMonths: 12,
    expectedTax: 50400 // Taxable: 360,000 * 12 = 4.32M -> 541,000 + (4.32M - 4.1M)*0.29 = 604,800 -> 604,800 / 12 = 50,400
  },
  {
    name: 'Employee hired January 1, 2026 (6 months in FY) | Salary 400,000/mo',
    hireDate: '2026-01-01',
    grossSalary: 400000,
    payrollMonth: 6,
    payrollYear: 2026,
    expectedFYMonths: 6,
    expectedTax: null
  },
  {
    name: 'Employee hired August 1, 2025 (11 months in FY) | Salary 400,000/mo',
    hireDate: '2025-08-01',
    grossSalary: 400000,
    payrollMonth: 6,
    payrollYear: 2026,
    expectedFYMonths: 11,
    expectedTax: null
  },
  {
    name: 'Old employee (hired 2023) | Salary 400,000/mo | Current FY counts full 12',
    hireDate: '2023-01-01',
    grossSalary: 400000,
    payrollMonth: 6,
    payrollYear: 2026,
    expectedFYMonths: 12,
    expectedTax: null
  }
];

console.log('═'.repeat(80));
console.log('  FBR Financial Year-Aware Tax Calculation Test');
console.log('  FY: July 1 → June 30 | Medical 10% exempt applied before tax');
console.log('═'.repeat(80));

let allPassed = true;

tests.forEach((t, i) => {
  const taxableMonthly = t.grossSalary * 0.9; // 10% medical exempt
  const fyMonths = getRemainingFYMonths(t.hireDate, t.payrollMonth, t.payrollYear);
  const taxFYAware = calculateMonthlyTaxFYAware(taxableMonthly, t.hireDate, t.payrollMonth, t.payrollYear);
  const taxOld     = calculateMonthlyTax(taxableMonthly);

  const fyMonthsOk = fyMonths === t.expectedFYMonths;
  const taxOk = t.expectedTax === null ? true : taxFYAware === t.expectedTax;
  const passed = fyMonthsOk && taxOk;
  if (!passed) allPassed = false;

  console.log(`\n[${i + 1}] ${t.name}`);
  console.log(`    Hire Date      : ${t.hireDate}`);
  console.log(`    Payroll Period : ${t.payrollMonth}/${t.payrollYear}`);
  console.log(`    FY Months      : ${fyMonths}  ${fyMonthsOk ? '✅' : `❌ expected ${t.expectedFYMonths}`}`);
  console.log(`    Gross Salary   : ${PKR(t.grossSalary)} → Taxable (90%): ${PKR(Math.round(taxableMonthly))}`);
  console.log(`    Projected Annual Taxable: ${PKR(Math.round(taxableMonthly * fyMonths))}  (${fyMonths} months)`);
  console.log(`    OLD Tax (×12)  : ${PKR(taxOld)}/mo`);
  console.log(`    NEW Tax (FY)   : ${PKR(taxFYAware)}/mo  ${taxOk ? '✅' : `❌ expected ${PKR(t.expectedTax)}`}`);
});

console.log('\n' + '═'.repeat(80));
console.log(allPassed ? '  ✅ ALL TESTS PASSED' : '  ❌ SOME TESTS FAILED');
console.log('═'.repeat(80));
