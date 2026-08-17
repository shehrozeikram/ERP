require('dotenv').config({ path: './server/.env' });
require('dotenv').config({ path: './.env' });
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mongoose = require('mongoose');

const Employee = require('../models/hr/Employee');
const Loan = require('../models/hr/Loan');
const User = require('../models/User');

const PDF_DIR = process.env.LOANS_PDF_DIR || '/Users/shehroze/Downloads/loans';

const monthMap = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function cleanNum(val) {
  if (!val) return 0;
  const s = String(val).replace(/[^\d.]/g, '');
  return s.includes('.') ? parseFloat(s) || 0 : parseInt(s, 10) || 0;
}

function parseAllPdfsUsingPython(pdfDir) {
  const pyScript = `
import os, re, json, fitz

folder = "${pdfDir}"
files = sorted([f for f in os.listdir(folder) if f.endswith(".pdf")])

month_map = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
}

def clean_num(val):
    if not val: return 0
    s = re.sub(r'[^\\d.]', '', str(val))
    try: return float(s) if '.' in s else int(s)
    except: return 0

def parse_full_pdf(filepath):
    doc = fitz.open(filepath)
    all_lines = []
    for page_no, page in enumerate(doc):
        words = page.get_text("words")
        words.sort(key=lambda w: (w[1], w[0]))
        cur_line = []
        cur_y = None
        for w in words:
            if cur_y is None or abs(w[1] - cur_y) < 4:
                cur_line.append(w)
                cur_y = w[1]
            else:
                all_lines.append((page_no + 1, cur_line))
                cur_line = [w]
                cur_y = w[1]
        if cur_line:
            all_lines.append((page_no + 1, cur_line))

    text_lines = [" ".join([w[4] for w in l[1]]) for l in all_lines]
    full_text = "\\n".join(text_lines)
    filename = os.path.basename(filepath)

    emp_id = ""
    emp_name = ""
    for tl in text_lines[:10]:
        m = re.match(r'^(\\d{3,5})\\s+([A-Za-z\\s\\.\\'-]+?)\\s+\\d{2}/\\d{2}/\\d{4}', tl)
        if m:
            emp_id = m.group(1).strip()
            emp_name = m.group(2).strip()
            break
            
    if not emp_id:
        fn_m = re.match(r'^(\\d+)[-_](.+?)\\.pdf', filename)
        if fn_m:
            emp_id = fn_m.group(1)
            emp_name = fn_m.group(2).replace('_', ' ')

    loan_num = ""
    ln_m = re.search(r'Loan Number\\s*:\\s*(\\d+)', full_text)
    if ln_m: loan_num = ln_m.group(1)
    else:
        ln_m2 = re.search(r'\\b(02\\d{3})\\b', full_text)
        if ln_m2: loan_num = ln_m2.group(1)

    loan_amt = 0
    la_m = re.search(r'Loan Sanctioned:\\s*([\\d,]+\\.?\\d*)', full_text)
    if la_m: loan_amt = clean_num(la_m.group(1))
    else:
        la_m2 = re.search(r'([\\d,]+)\\s+Loan Admissible', full_text)
        if la_m2: loan_amt = clean_num(la_m2.group(1))

    monthly_ded = 0
    md_m = re.search(r'Monthly Deduction\\s+([\\d,]+)', full_text)
    if md_m: monthly_ded = clean_num(md_m.group(1))
    else:
        md_m2 = re.search(r'Monthly Deduction.*?([\\d,]+)', full_text)
        if md_m2: monthly_ded = clean_num(md_m2.group(1))

    no_of_inst = 0
    ni_m = re.search(r'No Of Installments\\s*:\\s*Start From\\s*:\\s*(\\d+)', full_text)
    if ni_m: no_of_inst = int(ni_m.group(1))
    else:
        ni_m2 = re.search(r'No Of Installments\\s*:\\s*(\\d+)', full_text)
        if ni_m2: no_of_inst = int(ni_m2.group(1))

    start_date_str = ""
    sd_m = re.search(r'Start From\\s*:\\s*(?:\\d+\\s+)?(\\d{1,2}/\\d{1,2}/\\d{4})', full_text)
    if sd_m: start_date_str = sd_m.group(1)

    schedule_rows = []
    row_pattern = re.compile(r'^(\\d+)\\s+([A-Za-z]{3}-\\d{4})\\s+([\\d,]+)\\s+.*?00\\.00%\\s+([\\d,]+)\\s+\\d+\\s+([\\d,]+)\\s+([\\d,]+)(?:\\s+(Paid|Due))?', re.IGNORECASE)

    for tl in text_lines:
        m = row_pattern.match(tl)
        if m:
            inst_num = int(m.group(1))
            period = m.group(2)
            opening = clean_num(m.group(3))
            principal = clean_num(m.group(4))
            total_ded = clean_num(m.group(5))
            closing = clean_num(m.group(6))
            status_token = (m.group(7) or "").strip().lower()

            is_paid = status_token == 'paid'
            mon_s, yr_s = period.split('-')
            mon_num = month_map.get(mon_s.lower(), 1)
            due_date = f"{int(yr_s):04d}-{mon_num:02d}-01"

            schedule_rows.append({
                'installmentNumber': inst_num,
                'period': period,
                'dueDate': due_date,
                'amount': total_ded,
                'principal': principal,
                'interest': 0,
                'balance': closing,
                'status': 'Paid' if is_paid else 'Pending',
                'isPaid': is_paid,
                'paidAmount': total_ded if is_paid else 0
            })

    schedule_rows.sort(key=lambda s: s['installmentNumber'])
    total_paid = sum([s['amount'] for s in schedule_rows if s['isPaid']])
    paid_count = len([s for s in schedule_rows if s['isPaid']])
    pending_count = len([s for s in schedule_rows if not s['isPaid']])
    outstanding = loan_amt - total_paid

    return {
        'filename': filename,
        'empId': emp_id,
        'empName': emp_name,
        'loanNumber': loan_num,
        'loanAmount': loan_amt,
        'monthlyDeduction': monthly_ded,
        'noOfInstallments': no_of_inst if no_of_inst > 0 else len(schedule_rows),
        'startDate': start_date_str,
        'scheduleLength': len(schedule_rows),
        'paidCount': paid_count,
        'pendingCount': pending_count,
        'totalPaid': total_paid,
        'outstandingBalance': outstanding,
        'schedule': schedule_rows
    }

out = [parse_full_pdf(os.path.join(folder, f)) for f in files]
print(json.dumps(out))
`;

  const tmpScript = path.join(__dirname, 'tmp_loan_parser.py');
  fs.writeFileSync(tmpScript, pyScript);
  const result = execSync(`python3 "${tmpScript}"`, { maxBuffer: 50 * 1024 * 1024 }).toString();
  fs.unlinkSync(tmpScript);
  return JSON.parse(result);
}

async function findMatchingEmployee(item) {
  const rawId = String(item.empId || '').trim();
  const cleanId = String(parseInt(rawId, 10)); // e.g. '00339' -> '339'
  const padded5 = cleanId.padStart(5, '0');
  const padded4 = cleanId.padStart(4, '0');

  // Primary: Match by exact employeeId variations
  let emp = await Employee.findOne({
    $or: [
      { employeeId: rawId },
      { employeeId: cleanId },
      { employeeId: padded5 },
      { employeeId: padded4 }
    ]
  });

  if (!emp && item.empName) {
    const parts = item.empName.trim().split(/\s+/);
    if (parts.length >= 2) {
      emp = await Employee.findOne({
        firstName: new RegExp(`^${parts[0]}$`, 'i'),
        lastName: new RegExp(`^${parts.slice(1).join(' ')}$`, 'i')
      });
    }
  }

  return emp;
}

async function importLoansToDatabase(uri, parsedLoans) {
  console.log('\n================================================================================');
  console.log('Connecting to database:', uri);
  console.log('================================================================================');
  await mongoose.connect(uri);

  const adminUser = await User.findOne({ role: 'admin' }).select('_id');
  const defaultCreatedBy = adminUser ? adminUser._id : new mongoose.Types.ObjectId();

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const item of parsedLoans) {
    const emp = await findMatchingEmployee(item);
    if (!emp) {
      console.error(`❌ Employee NOT FOUND in DB: [${item.empId}] ${item.empName} (File: ${item.filename})`);
      skippedCount++;
      continue;
    }

    // Build loan schedule formatted for Mongoose Schema
    const schedule = item.schedule.map((s) => ({
      installmentNumber: s.installmentNumber,
      dueDate: new Date(s.dueDate),
      amount: s.amount,
      principal: s.principal,
      interest: 0,
      balance: s.balance,
      status: s.isPaid ? 'Paid' : 'Pending',
      paidAmount: s.isPaid ? s.amount : 0,
      paymentDate: s.isPaid ? new Date(s.dueDate) : undefined,
      paymentMethod: s.isPaid ? 'Salary Deduction' : undefined
    }));

    let appDate = schedule.length > 0 ? schedule[0].dueDate : new Date();
    if (item.startDate) {
      const parts = item.startDate.split('/');
      if (parts.length === 3) {
        appDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }

    const loanPayload = {
      employee: emp._id,
      loanNumber: item.loanNumber || `LN-${item.empId}`,
      loanType: 'Personal',
      loanAmount: item.loanAmount,
      loanAdmissible: item.loanAmount,
      interestRate: 0,
      loanTerm: item.noOfInstallments || schedule.length,
      monthlyInstallment: item.monthlyDeduction,
      totalPayable: item.loanAmount,
      totalPaid: item.totalPaid,
      totalPrincipalPaid: item.totalPaid,
      totalInterestPaid: 0,
      outstandingBalance: item.outstandingBalance,
      status: item.outstandingBalance <= 0 ? 'Completed' : 'Active',
      applicationDate: appDate,
      approvalDate: appDate,
      disbursementDate: appDate,
      purpose: 'Company Loan',
      emiManuallyAdjusted: true,
      loanSchedule: schedule,
      createdBy: defaultCreatedBy,
      updatedBy: defaultCreatedBy
    };

    // Check if loan already exists for this employee
    let loanDoc = await Loan.findOne({
      employee: emp._id,
      $or: [
        { loanNumber: item.loanNumber },
        { loanAmount: item.loanAmount }
      ]
    });

    if (loanDoc) {
      Object.assign(loanDoc, loanPayload);
      await loanDoc.save();
      updatedCount++;
      console.log(`🔄 UPDATED: [${emp.employeeId}] ${emp.firstName} ${emp.lastName} | Loan #: ${item.loanNumber} | Amount: ${item.loanAmount.toLocaleString()} | Paid: ${item.totalPaid.toLocaleString()} | Balance: ${item.outstandingBalance.toLocaleString()}`);
    } else {
      await Loan.create(loanPayload);
      createdCount++;
      console.log(`✅ CREATED: [${emp.employeeId}] ${emp.firstName} ${emp.lastName} | Loan #: ${item.loanNumber} | Amount: ${item.loanAmount.toLocaleString()} | Paid: ${item.totalPaid.toLocaleString()} | Balance: ${item.outstandingBalance.toLocaleString()}`);
    }
  }

  console.log('\n--------------------------------------------------------------------------------');
  console.log(`Database Import Summary for ${uri}:`);
  console.log(`  ✅ Created: ${createdCount} | 🔄 Updated: ${updatedCount} | ❌ Skipped: ${skippedCount} | Total: ${parsedLoans.length}`);
  console.log('--------------------------------------------------------------------------------\n');

  await mongoose.disconnect();
}

async function main() {
  console.log('🚀 Starting Bulk Employee Loan Schedule Importer...');
  console.log(`📂 Source Directory: ${PDF_DIR}`);

  if (!fs.existsSync(PDF_DIR)) {
    console.error(`❌ Directory does not exist: ${PDF_DIR}`);
    process.exit(1);
  }

  console.log('📄 Parsing PDF files...');
  const parsedLoans = parseAllPdfsUsingPython(PDF_DIR);
  console.log(`✅ Successfully parsed ${parsedLoans.length} loan schedule PDFs!\n`);

  const uris = [];
  if (process.env.MONGODB_URI_LOCAL) uris.push(process.env.MONGODB_URI_LOCAL);
  else uris.push('mongodb://127.0.0.1:27017/sgc_erp_local');

  if (process.env.MONGODB_URI && !uris.includes(process.env.MONGODB_URI)) {
    uris.push(process.env.MONGODB_URI);
  }

  for (const uri of uris) {
    try {
      await importLoansToDatabase(uri, parsedLoans);
    } catch (err) {
      console.error(`❌ Error importing to ${uri}:`, err.message);
      try { await mongoose.disconnect(); } catch (e) {}
    }
  }

  console.log('🎉 Bulk Loan Import Complete!');
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
