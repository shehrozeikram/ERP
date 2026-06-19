const esc = (value) => String(value ?? '—')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const fmtMoney = (amount) =>
  `Rs. ${Math.round(Number(amount) || 0).toLocaleString('en-PK')}`;

const EXCEL_THIN_BORDER = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' }
};

const EXCEL_HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD9D9D9' }
};

const EXCEL_TOTAL_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFEFEFEF' }
};

const styleExcelTitleRow = (worksheet, rowIndex, colCount, text) => {
  worksheet.mergeCells(rowIndex, 1, rowIndex, colCount);
  const cell = worksheet.getCell(rowIndex, 1);
  cell.value = text;
  cell.font = { bold: true, size: 13 };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  worksheet.getRow(rowIndex).height = 24;
};

const styleExcelInfoRow = (worksheet, rowIndex, colCount, text) => {
  worksheet.mergeCells(rowIndex, 1, rowIndex, colCount);
  const cell = worksheet.getCell(rowIndex, 1);
  cell.value = text;
  cell.font = { size: 10 };
  cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  worksheet.getRow(rowIndex).height = 20;
};

const styleBankLetterDataRow = (row, colCount, { bold = false, fill = null } = {}) => {
  for (let col = 1; col <= colCount; col += 1) {
    const cell = row.getCell(col);
    cell.font = { bold, size: 10 };
    if (fill) cell.fill = fill;
    cell.border = EXCEL_THIN_BORDER;

    if (col === 1 || col === 2 || col === 6) {
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    } else if (col === colCount) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0';
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    }
  }
};

const companyDebitLines = (company = {}) => {
  const lines = [];
  if (company.bankName) lines.push(`Debit Bank: ${company.bankName}`);
  if (company.bankAccount) lines.push(`Company Account No: ${company.bankAccount}`);
  if (company.bankBranchCode) lines.push(`Company Branch Code: ${company.bankBranchCode}`);
  if (company.bankIBAN) lines.push(`IBAN: ${company.bankIBAN}`);
  return lines;
};

const companyDebitHtml = (company = {}) => {
  const lines = companyDebitLines(company);
  if (!lines.length) {
    return `<div class="debit-box"><strong>Company debit account:</strong> Not configured — add bank details in Finance → Company Profile.</div>`;
  }
  return `<div class="debit-box"><strong>Debit from company account:</strong><br />${lines.map((line) => esc(line)).join('<br />')}</div>`;
};

export const buildPayrollBankLetterData = ({ payrollRows = [], periodLabel = '', projectName = '' }) => {
  const rows = payrollRows
    .filter((row) => row.employee)
    .map((row) => ({
      employeeId: row.employee.employeeId || '—',
      name: row.employee.name || '—',
      cnic: row.employee.idCard || '—',
      bankName: row.employee.bankName || '—',
      branchCode: row.employee.branchCode || '—',
      accountNumber: row.employee.accountNumber || '—',
      netSalary: Math.round(Number(row.netSalary) || 0)
    }))
    .sort((a, b) => String(a.employeeId).localeCompare(String(b.employeeId), undefined, { numeric: true }));

  const totalNetSalary = rows.reduce((sum, row) => sum + (Number(row.netSalary) || 0), 0);
  const label = projectName ? `${periodLabel} — ${projectName}` : periodLabel;

  return {
    periodLabel: label,
    projectName: projectName || '',
    employeeCount: rows.length,
    totalNetSalary,
    rows
  };
};

export const downloadPayrollBankLetterExcel = async ({ letter, company = {} }) => {
  if (!letter?.rows?.length) {
    return { ok: false, message: 'No payroll rows available for export.' };
  }

  const { Workbook } = await import('exceljs');
  const headers = [
    'Sr No',
    'Employee ID',
    'Name',
    'CNIC',
    'Bank',
    'Branch Code',
    'Account No',
    'Net Salary'
  ];
  const colCount = headers.length;
  const companyName = company.name || 'SARDAR GROUP OF COMPANIES';
  const debitLines = companyDebitLines(company);
  const debitText = debitLines.length
    ? `Debit from company account: ${debitLines.join(' | ')}`
    : 'Company debit account: Not configured — add bank details in Finance → Company Profile.';

  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Bank Letter', {
    views: [{ state: 'frozen', ySplit: 5 }]
  });

  worksheet.columns = [
    { width: 8 },
    { width: 14 },
    { width: 28 },
    { width: 18 },
    { width: 18 },
    { width: 14 },
    { width: 20 },
    { width: 16 }
  ];

  let rowIndex = 1;
  styleExcelTitleRow(worksheet, rowIndex, colCount, companyName);
  rowIndex += 1;
  styleExcelTitleRow(
    worksheet,
    rowIndex,
    colCount,
    `Salary Transfer Instruction / Bank Letter for the month of ${letter.periodLabel}`
  );
  rowIndex += 1;
  styleExcelInfoRow(worksheet, rowIndex, colCount, debitText);
  rowIndex += 1;
  worksheet.addRow(Array(colCount).fill(''));
  rowIndex += 1;

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = EXCEL_HEADER_FILL;
    cell.border = EXCEL_THIN_BORDER;
  });
  rowIndex += 1;

  letter.rows.forEach((row, index) => {
    const dataRow = worksheet.addRow([
      index + 1,
      row.employeeId,
      row.name,
      row.cnic,
      row.bankName,
      row.branchCode,
      row.accountNumber,
      Math.round(Number(row.netSalary) || 0)
    ]);
    dataRow.height = 20;
    styleBankLetterDataRow(dataRow, colCount);
  });

  const footerRow = worksheet.addRow([
    '',
    'Grand Total',
    `${letter.employeeCount} Employees`,
    '',
    '',
    '',
    '',
    Math.round(Number(letter.totalNetSalary) || 0)
  ]);
  footerRow.height = 22;
  styleBankLetterDataRow(footerRow, colCount, { bold: true, fill: EXCEL_TOTAL_FILL });

  const safePeriod = String(letter.periodLabel || 'payroll').replace(/\s+/g, '-').toLowerCase();
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob(
    [buffer],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `salary-bank-letter-${safePeriod}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { ok: true };
};

const buildPayrollBankLetterHtml = ({ letter, company = {} }) => {
  const rowsHtml = letter.rows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${esc(row.employeeId)}</td>
      <td>${esc(row.name)}</td>
      <td>${esc(row.cnic)}</td>
      <td>${esc(row.bankName)}</td>
      <td>${esc(row.branchCode)}</td>
      <td>${esc(row.accountNumber)}</td>
      <td class="num">${fmtMoney(row.netSalary)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Salary Transfer Letter — ${esc(letter.periodLabel)}</title>
  <style>
    @page { size: A4 landscape; margin: 14mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      margin: 0;
      padding: 28px 32px 24px;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 32px;
      padding-bottom: 18px;
      margin-bottom: 22px;
      border-bottom: 2px solid #1f2937;
    }
    .company-block {
      flex: 1;
      min-width: 0;
      padding-top: 4px;
    }
    .company {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.2px;
      margin: 0 0 6px;
      line-height: 1.25;
    }
    .company-meta {
      font-size: 12px;
      color: #4b5563;
      line-height: 1.55;
      margin: 0;
    }
    .doc-meta {
      flex-shrink: 0;
      min-width: 200px;
      padding-top: 6px;
      text-align: right;
    }
    .doc-meta-row {
      display: flex;
      justify-content: flex-end;
      align-items: baseline;
      gap: 10px;
      font-size: 12px;
      line-height: 1.7;
      color: #374151;
    }
    .doc-meta-label {
      color: #6b7280;
      min-width: 72px;
      text-align: right;
    }
    .doc-meta-value {
      font-weight: 600;
      color: #111;
      min-width: 96px;
      text-align: left;
    }
    .doc-title {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 20px;
      padding: 0 2px;
      line-height: 1.35;
      letter-spacing: 0.15px;
      color: #111827;
    }
    .letter-box, .debit-box {
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 14px 16px;
      margin-bottom: 14px;
      font-size: 13px;
      line-height: 1.55;
    }
    .debit-box { background: #f8fafc; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; font-weight: 700; }
    td.num, th.num { text-align: right; }
    .summary {
      margin-top: 14px;
      display: flex;
      justify-content: flex-end;
      gap: 24px;
      font-size: 13px;
      font-weight: 700;
      padding-right: 2px;
    }
    .signatures {
      margin-top: 36px;
      display: flex;
      justify-content: space-between;
      gap: 24px;
      padding: 0 2px;
    }
    .sign-box {
      width: 30%;
      border-top: 1px solid #333;
      padding-top: 8px;
      font-size: 12px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-block">
      <div class="company">${esc(company.name || 'SGC International')}</div>
      ${company.address ? `<div class="company-meta">${esc(company.address)}</div>` : ''}
      ${company.ntn ? `<div class="company-meta">NTN: ${esc(company.ntn)}</div>` : ''}
    </div>
    <div class="doc-meta">
      <div class="doc-meta-row">
        <span class="doc-meta-label">Date</span>
        <span class="doc-meta-value">${new Date().toLocaleDateString('en-GB')}</span>
      </div>
      <div class="doc-meta-row">
        <span class="doc-meta-label">Period</span>
        <span class="doc-meta-value">${esc(letter.periodLabel)}</span>
      </div>
      <div class="doc-meta-row">
        <span class="doc-meta-label">Employees</span>
        <span class="doc-meta-value">${letter.employeeCount}</span>
      </div>
    </div>
  </div>

  <h1 class="doc-title">Salary Transfer Instruction / Bank Letter</h1>
  ${letter.projectName ? `<div class="letter-box" style="margin-bottom:14px;"><strong>Project:</strong> ${esc(letter.projectName)}</div>` : ''}
  ${companyDebitHtml(company)}
  <div class="letter-box">
    To,<br />
    The Branch Manager<br />
    <strong>Subject: Salary Transfer for the month of ${esc(letter.periodLabel)}</strong><br /><br />
    Please transfer the net salaries listed below to the respective employee accounts from our company account shown above.
    Total net salary amount: <strong>${fmtMoney(letter.totalNetSalary)}</strong>.
  </div>

  <table>
    <thead>
      <tr>
        <th>Sr</th>
        <th>Employee ID</th>
        <th>Name</th>
        <th>CNIC</th>
        <th>Bank</th>
        <th>Branch Code</th>
        <th>Account No</th>
        <th class="num">Net Salary</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="summary">
    <div>Total Employees: ${letter.employeeCount}</div>
    <div>Total Net Salary: ${fmtMoney(letter.totalNetSalary)}</div>
  </div>

  <div class="signatures">
    <div class="sign-box">Prepared By<br />Finance Department</div>
    <div class="sign-box">Checked By<br />Senior Finance Manager</div>
    <div class="sign-box">Authorized By<br />Management</div>
  </div>
</body>
</html>`;
};

const printHtmlInHiddenFrame = (html, frameId = 'payroll-bank-letter-print-frame') => {
  const existing = document.getElementById(frameId);
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = frameId;
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = 'Payroll bank letter print';
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!doc || !win) {
    iframe.remove();
    return { ok: false, message: 'Unable to prepare print preview.' };
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 500);
  };

  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
      win.addEventListener('afterprint', cleanup, { once: true });
      setTimeout(cleanup, 60000);
    } catch {
      iframe.remove();
      return { ok: false, message: 'Unable to open print dialog.' };
    }
    return { ok: true };
  };

  if (iframe.contentDocument?.readyState === 'complete') {
    setTimeout(triggerPrint, 100);
  } else {
    iframe.onload = () => setTimeout(triggerPrint, 100);
  }

  return { ok: true };
};

export const openPayrollBankLetterPrint = ({ letter, company = {} }) => {
  if (!letter?.rows?.length) {
    return { ok: false, message: 'No payroll rows available for bank letter.' };
  }

  const html = buildPayrollBankLetterHtml({ letter, company });
  return printHtmlInHiddenFrame(html);
};
