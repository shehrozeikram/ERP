const esc = (value) => String(value ?? '—')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const fmtAmount = (amount) =>
  Math.round(Number(amount) || 0).toLocaleString('en-PK');

const formatLetterDate = (date = new Date()) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

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

const styleExcelTitleRow = (worksheet, rowIndex, colCount, text, { bold = true, size = 11, align = 'left' } = {}) => {
  worksheet.mergeCells(rowIndex, 1, rowIndex, colCount);
  const cell = worksheet.getCell(rowIndex, 1);
  cell.value = text;
  cell.font = { bold, size };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  worksheet.getRow(rowIndex).height = align === 'left' ? Math.max(20, Math.ceil(String(text).length / 90) * 16) : 22;
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

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const convertBelow1000 = (n) => {
  if (n === 0) return '';
  if (n < 10) return ones[n];
  if (n < 20) return teens[n - 10];
  if (n < 100) {
    const rem = n % 10;
    return tens[Math.floor(n / 10)] + (rem ? ` ${ones[rem]}` : '');
  }
  const rem = n % 100;
  return `${ones[Math.floor(n / 100)]} Hundred${rem ? ` ${convertBelow1000(rem)}` : ''}`;
};

const convertIntl = (n) => {
  if (n === 0) return '';
  if (n < 1000) return convertBelow1000(n);
  if (n < 1000000) {
    const rem = n % 1000;
    const chunk = convertBelow1000(Math.floor(n / 1000));
    return `${chunk} Thousand${rem ? ` ${convertIntl(rem)}` : ''}`;
  }
  const rem = n % 1000000;
  const chunk = convertBelow1000(Math.floor(n / 1000000));
  return `${chunk} Million${rem ? ` ${convertIntl(rem)}` : ''}`;
};

const amountInWordsForLetter = (amount) => {
  const value = Math.round(Number(amount) || 0);
  if (!value) return 'Rupees Zero Only';
  const words = convertIntl(value).trim();
  return `Rupees ${words} Only`;
};

const buildLetterRef = (company = {}, letter = {}) => {
  if (letter.letterRef) return letter.letterRef;
  const prefix = String(company.salaryLetterRefPrefix || '').trim();
  if (prefix) {
    const now = new Date();
    return `${prefix}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return `SGC-S-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
};

const buildSubjectAccountLabel = (company = {}) => {
  const account = String(company.bankAccount || company.bankIBAN || '').trim();
  const companyName = String(company.legalName || company.name || company.companyName || 'Company').trim();
  if (!account) return companyName;
  return `${account}-${companyName}`;
};

const buildLetterMeta = ({ letter = {}, company = {} }) => {
  const bankName = 'Allied Bank';
  const branchName = 'Centaurus Branch';
  const city = String(company.city || 'Islamabad').trim();
  const chequeNumber = String(letter.chequeNumber || letter.reference || '________________').trim();
  const amount = Math.round(Number(letter.totalNetSalary) || 0);

  return {
    letterRef: buildLetterRef(company, letter),
    letterDate: formatLetterDate(letter.letterDate ? new Date(letter.letterDate) : new Date()),
    bankName,
    branchName,
    city,
    subjectAccount: buildSubjectAccountLabel(company),
    chequeNumber,
    amountFormatted: fmtAmount(amount),
    amountInWords: amountInWordsForLetter(amount),
    employeeCount: letter.employeeCount || 0,
    periodLabel: letter.periodLabel || '',
    filterName: letter.filterName || letter.companyName || letter.projectName || ''
  };
};

export const buildPayrollBankLetterData = ({
  payrollRows = [],
  periodLabel = '',
  companyName = '',
  projectName = '',
  chequeNumber = '',
  reference = '',
  letterRef = ''
}) => {
  const filterName = companyName || projectName || '';
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
  const label = filterName ? `${periodLabel} — ${filterName}` : periodLabel;

  return {
    periodLabel: label,
    companyName: companyName || '',
    projectName: projectName || '',
    filterName,
    chequeNumber: chequeNumber || reference || '',
    reference: reference || chequeNumber || '',
    letterRef,
    employeeCount: rows.length,
    totalNetSalary,
    rows
  };
};

const buildLetterBodyText = (meta) =>
  `You are requested to debit our above mentioned account by Cheque No ${meta.chequeNumber} of Rs  ${meta.amountFormatted} (${meta.amountInWords}) and arrange to transfer of funds to bank accounts of our employees as per attach list and total Employees are ${meta.employeeCount}.`;

const metaPeriodSuffix = (letter) => {
  const label = String(letter.periodLabel || '').trim();
  return label ? ` — ${label}` : '';
};

const buildAttachmentTableHtml = (letter) => {
  const rowsHtml = letter.rows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${esc(row.employeeId)}</td>
      <td>${esc(row.name)}</td>
      <td>${esc(row.cnic)}</td>
      <td>${esc(row.branchCode)}</td>
      <td>${esc(row.accountNumber)}</td>
      <td class="num">${fmtAmount(row.netSalary)}</td>
    </tr>
  `).join('');

  return `
    <div class="attachment">
      <div class="attachment-title">Attached List — Salary Transfer${metaPeriodSuffix(letter)}</div>
      <table>
        <thead>
          <tr>
            <th>Sr</th>
            <th>Employee ID</th>
            <th>Name</th>
            <th>CNIC</th>
            <th>Branch Code</th>
            <th>Account No</th>
            <th class="num">Net Salary</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="grand-total-row">
            <td colspan="6" align="right"><strong>Grand Total (${letter.employeeCount} Employees)</strong></td>
            <td class="num"><strong>${fmtAmount(letter.totalNetSalary)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
};

const buildPayrollBankLetterHtml = ({ letter, company = {} }) => {
  const meta = buildLetterMeta({ letter, company });
  const bodyText = buildLetterBodyText(meta);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Salary Transfer Letter — ${esc(letter.periodLabel)}</title>
  <style>
    @page { size: A4 portrait; margin: 18mm 16mm 16mm 22mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      color: #000;
      margin: 0;
      padding: 0;
      background: #fff;
      font-size: 12pt;
      line-height: 1.45;
    }
    .letter-page {
      max-width: 720px;
    }
    .ref-line {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 28px;
      font-size: 12pt;
    }
    .ref-line .date {
      white-space: nowrap;
    }
    .block {
      margin: 0 0 10px;
    }
    .spacer {
      height: 12px;
    }
    .subject,
    .body-text,
    .signatory {
      font-weight: 700;
    }
    .subject {
      margin: 18px 0 16px;
      text-align: left;
    }
    .body-text {
      margin: 14px 0 28px;
      text-align: justify;
    }
    .signature-line {
      margin: 28px 0 8px;
      letter-spacing: 1px;
    }
    .signatory {
      margin-top: 6px;
    }
    .attachment {
      page-break-before: always;
      padding-top: 8px;
    }
    .attachment-title {
      font-weight: 700;
      font-size: 13pt;
      margin: 0 0 12px;
      text-align: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      font-family: Arial, Helvetica, sans-serif;
    }
    th, td {
      border: 1px solid #000;
      padding: 5px 6px;
      text-align: left;
      vertical-align: middle;
    }
    th {
      background: #f3f3f3;
      font-weight: 700;
      text-align: center;
    }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .grand-total-row td {
      font-weight: 900;
      font-size: 11pt;
      background: #efefef;
    }
  </style>
</head>
<body>
  <div class="letter-page">
    <div class="ref-line">
      <span>${esc(meta.letterRef)}</span>
      <span class="date">${esc(meta.letterDate)}</span>
    </div>

    <div class="spacer"></div>
    <div class="spacer"></div>

    <p class="block">The Manager</p>
    <p class="block">${esc(meta.bankName)}${meta.bankName.endsWith(',') ? '' : ','}</p>
    <p class="block">${esc(meta.branchName)}</p>
    <p class="block">${esc(meta.city)}.</p>

    <div class="spacer"></div>

    <p class="subject">Subject: Transfer of Salary from A/c # ${esc(meta.subjectAccount)}</p>

    <div class="spacer"></div>
    <div class="spacer"></div>

    <p class="block">Dear Sir/Madam</p>

    <div class="spacer"></div>

    <p class="body-text">${esc(bodyText)}</p>

    <div class="spacer"></div>
    <div class="spacer"></div>
    <div class="spacer"></div>
    <div class="spacer"></div>

    <p class="signature-line">----------------------------</p>
    <p class="signatory">Authorized Signatory</p>
  </div>

  ${buildAttachmentTableHtml(letter)}
</body>
</html>`;
};

export const downloadPayrollBankLetterExcel = async ({ letter, company = {} }) => {
  if (!letter?.rows?.length) {
    return { ok: false, message: 'No payroll rows available for export.' };
  }

  const { Workbook } = await import('exceljs');
  const meta = buildLetterMeta({ letter, company });
  const bodyText = buildLetterBodyText(meta);
  const headers = [
    'Sr No',
    'Employee ID',
    'Name',
    'CNIC',
    'Branch Code',
    'Account No',
    'Net Salary'
  ];
  const colCount = headers.length;

  const workbook = new Workbook();

  const letterSheet = workbook.addWorksheet('Salary Letter');
  letterSheet.columns = [{ width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

  let rowIndex = 1;
  styleExcelTitleRow(letterSheet, rowIndex, colCount, `${meta.letterRef}${' '.repeat(40)}${meta.letterDate}`, { align: 'left' });
  rowIndex += 2;
  styleExcelTitleRow(letterSheet, rowIndex, colCount, 'The Manager', { bold: false });
  rowIndex += 1;
  styleExcelTitleRow(letterSheet, rowIndex, colCount, `${meta.bankName},`, { bold: false });
  rowIndex += 1;
  styleExcelTitleRow(letterSheet, rowIndex, colCount, meta.branchName, { bold: false });
  rowIndex += 1;
  styleExcelTitleRow(letterSheet, rowIndex, colCount, `${meta.city}.`, { bold: false });
  rowIndex += 2;
  styleExcelTitleRow(letterSheet, rowIndex, colCount, `Subject: Transfer of Salary from A/c # ${meta.subjectAccount}`, { bold: true });
  rowIndex += 2;
  styleExcelTitleRow(letterSheet, rowIndex, colCount, 'Dear Sir/Madam', { bold: false });
  rowIndex += 2;
  styleExcelTitleRow(letterSheet, rowIndex, colCount, bodyText, { bold: true, size: 11 });
  rowIndex += 3;
  styleExcelTitleRow(letterSheet, rowIndex, colCount, '----------------------------', { bold: false });
  rowIndex += 1;
  styleExcelTitleRow(letterSheet, rowIndex, colCount, 'Authorized Signatory', { bold: true });

  const listSheet = workbook.addWorksheet('Attached List');
  listSheet.columns = [
    { width: 8 },
    { width: 14 },
    { width: 28 },
    { width: 18 },
    { width: 14 },
    { width: 20 },
    { width: 16 }
  ];

  rowIndex = 1;
  styleExcelTitleRow(
    listSheet,
    rowIndex,
    colCount,
    `Attached List — Salary Transfer${metaPeriodSuffix(letter)}`,
    { align: 'center', size: 12 }
  );
  rowIndex += 2;

  const headerRow = listSheet.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = EXCEL_HEADER_FILL;
    cell.border = EXCEL_THIN_BORDER;
  });

  letter.rows.forEach((row, index) => {
    const dataRow = listSheet.addRow([
      index + 1,
      row.employeeId,
      row.name,
      row.cnic,
      row.branchCode,
      row.accountNumber,
      Math.round(Number(row.netSalary) || 0)
    ]);
    dataRow.height = 20;
    styleBankLetterDataRow(dataRow, colCount);
  });

  const footerRow = listSheet.addRow([
    '',
    'Grand Total',
    `${letter.employeeCount} Employees`,
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
