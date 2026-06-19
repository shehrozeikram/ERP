const esc = (value) => String(value ?? '—')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const fmtMoney = (amount) =>
  Math.round(Number(amount) || 0).toLocaleString('en-PK');

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

export const getNetPayableColumnLabel = (periodLabel = '') => {
  const compact = String(periodLabel || '').replace(/\s+/g, '');
  return compact ? `Net Payable ${compact}` : 'Net Payable';
};

export const PROJECT_SUMMARY_AMOUNT_COLUMNS = [
  { key: 'standardGrossSalary', label: 'Standard Gross Salary' },
  { key: 'basic', label: 'Basic' },
  { key: 'arrears', label: 'Arears' },
  { key: 'conveyanceAllowance', label: 'Covance Allowance' },
  { key: 'houseAllowance', label: 'House Allowance' },
  { key: 'foodAllowance', label: 'Food Allowance' },
  { key: 'vehicleAllowance', label: 'Vehicle Allowance' },
  { key: 'medicalAllowance', label: 'Medical Allowance' },
  { key: 'fuelAllowance', label: 'Fuel Allowance' },
  { key: 'grossSalary', label: 'Gross Salary' },
  { key: 'incomeTax', label: 'Income Tax' },
  { key: 'companyLoan', label: 'Company Loan' },
  { key: 'eobiDeduction', label: 'EOBI Deduction' },
  { key: 'empSecurityDed', label: 'Emp- Security Ded' }
];

const emptyAmountTotals = () =>
  PROJECT_SUMMARY_AMOUNT_COLUMNS.reduce((acc, col) => {
    acc[col.key] = 0;
    return acc;
  }, {});

const createProjectSummaryRow = (project) => ({
  project,
  employeeCount: 0,
  ...emptyAmountTotals(),
  netPayable: 0
});

const addPayrollToProjectSummary = (entry, payroll) => {
  entry.employeeCount += 1;
  PROJECT_SUMMARY_AMOUNT_COLUMNS.forEach((col) => {
    entry[col.key] += Number(payroll[col.key]) || 0;
  });
  entry.netPayable += Number(payroll.netPayable ?? payroll.netSalary) || 0;
};

const roundProjectSummaryRow = (row) => {
  const rounded = { ...row };
  PROJECT_SUMMARY_AMOUNT_COLUMNS.forEach((col) => {
    rounded[col.key] = Math.round(rounded[col.key] || 0);
  });
  rounded.netPayable = Math.round(rounded.netPayable || 0);
  return rounded;
};

export const buildPayrollProjectSummary = (payrollRows = []) => {
  const byProject = new Map();

  payrollRows.forEach((row) => {
    const project = (row.employee?.project || '').trim() || 'Unassigned';
    if (!byProject.has(project)) {
      byProject.set(project, createProjectSummaryRow(project));
    }
    addPayrollToProjectSummary(byProject.get(project), row);
  });

  const rows = [...byProject.values()]
    .map(roundProjectSummaryRow)
    .sort((a, b) => a.project.localeCompare(b.project));

  const totals = createProjectSummaryRow('Grand Total (All Projects)');
  totals.project = 'Grand Total (All Projects)';
  payrollRows.forEach((row) => addPayrollToProjectSummary(totals, row));
  const roundedTotals = roundProjectSummaryRow(totals);

  return { rows, totals: roundedTotals };
};

const buildSummaryHtml = ({ periodLabel, company = {}, summary }) => {
  const netPayableLabel = getNetPayableColumnLabel(periodLabel);
  const headerCells = `
    <th>Sr No</th>
    <th>Project Name</th>
    <th class="num">No of Employees</th>
    ${PROJECT_SUMMARY_AMOUNT_COLUMNS.map((col) => `<th class="num">${esc(col.label)}</th>`).join('')}
    <th class="num">${esc(netPayableLabel)}</th>
  `;

  const rowsHtml = summary.rows.map((row, index) => {
    const amountCells = PROJECT_SUMMARY_AMOUNT_COLUMNS
      .map((col) => `<td class="num">${fmtMoney(row[col.key])}</td>`)
      .join('');
    return `
      <tr>
        <td class="num">${index + 1}</td>
        <td>${esc(row.project)}</td>
        <td class="num">${row.employeeCount}</td>
        ${amountCells}
        <td class="num">${fmtMoney(row.netPayable)}</td>
      </tr>
    `;
  }).join('');

  const totalAmountCells = PROJECT_SUMMARY_AMOUNT_COLUMNS
    .map((col) => `<td class="num"><strong>${fmtMoney(summary.totals[col.key])}</strong></td>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payroll Summary — ${esc(periodLabel)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      margin: 0;
      padding: 20px 24px;
      background: #fff;
    }
    .org-title {
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 6px;
      text-transform: uppercase;
    }
    .report-subtitle {
      text-align: center;
      font-size: 13px;
      margin: 0 0 18px;
      font-weight: 600;
    }
    table { width: 100%; border-collapse: collapse; font-size: 9px; }
    th, td { border: 1px solid #999; padding: 5px 6px; text-align: left; vertical-align: middle; }
    th { background: #d9d9d9; font-weight: 700; text-align: center; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    tfoot td {
      font-weight: 800;
      background: #e5e7eb;
      font-size: 10px;
      color: #111;
    }
    tfoot strong { font-weight: 800; }
  </style>
</head>
<body>
  <div class="org-title">${esc(company.name || 'SARDAR GROUP OF COMPANIES')}</div>
  <div class="report-subtitle">Company-Wise Summary of Salary for the month of ${esc(periodLabel)}</div>

  <table>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="2" align="right"><strong>Grand Total (All Projects)</strong></td>
        <td class="num"><strong>${summary.totals.employeeCount}</strong></td>
        ${totalAmountCells}
        <td class="num"><strong>${fmtMoney(summary.totals.netPayable)}</strong></td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
};

const printHtmlInHiddenFrame = (html, frameId = 'payroll-summary-print-frame') => {
  const existing = document.getElementById(frameId);
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = frameId;
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = 'Payroll summary print';
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

export const openPayrollProjectSummaryPrint = ({ periodLabel, company = {}, summary }) => {
  if (!summary?.rows?.length) {
    return { ok: false, message: 'No payroll summary data available.' };
  }
  const html = buildSummaryHtml({ periodLabel, company, summary });
  return printHtmlInHiddenFrame(html);
};

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

const styleTitleRow = (worksheet, rowIndex, colCount, text) => {
  worksheet.mergeCells(rowIndex, 1, rowIndex, colCount);
  const cell = worksheet.getCell(rowIndex, 1);
  cell.value = text;
  cell.font = { bold: true, size: 13 };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  worksheet.getRow(rowIndex).height = 24;
};

const styleDataRow = (row, colCount, { bold = false, fill = null } = {}) => {
  for (let col = 1; col <= colCount; col += 1) {
    const cell = row.getCell(col);
    cell.font = { bold };
    if (fill) cell.fill = fill;
    cell.border = EXCEL_THIN_BORDER;

    if (col === 1) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else if (col === 2) {
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (col >= 3) cell.numFmt = '#,##0';
    }
  }
};

export const downloadPayrollProjectSummaryExcel = async ({ periodLabel, summary }) => {
  if (!summary?.rows?.length) {
    return { ok: false, message: 'No payroll summary data available.' };
  }

  const { Workbook } = await import('exceljs');
  const netPayableLabel = getNetPayableColumnLabel(periodLabel);
  const headers = [
    'Sr No',
    'Project Name',
    'No of Employees',
    ...PROJECT_SUMMARY_AMOUNT_COLUMNS.map((col) => col.label),
    netPayableLabel
  ];
  const colCount = headers.length;

  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Company Wise Summary', {
    views: [{ state: 'frozen', ySplit: 4 }]
  });

  worksheet.columns = [
    { width: 8 },
    { width: 28 },
    { width: 16 },
    ...PROJECT_SUMMARY_AMOUNT_COLUMNS.map(() => ({ width: 18 })),
    { width: 20 }
  ];

  styleTitleRow(worksheet, 1, colCount, 'SARDAR GROUP OF COMPANIES');
  styleTitleRow(
    worksheet,
    2,
    colCount,
    `Company-Wise Summary of Salary for the month of ${periodLabel}`
  );
  worksheet.addRow(Array(colCount).fill(''));

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = EXCEL_HEADER_FILL;
    cell.border = EXCEL_THIN_BORDER;
  });

  summary.rows.forEach((row, index) => {
    const dataRow = worksheet.addRow([
      index + 1,
      row.project,
      row.employeeCount,
      ...PROJECT_SUMMARY_AMOUNT_COLUMNS.map((col) => row[col.key] ?? 0),
      row.netPayable ?? 0
    ]);
    dataRow.height = 20;
    styleDataRow(dataRow, colCount);
  });

  const footerRow = worksheet.addRow([
    '',
    'Grand Total (All Projects)',
    summary.totals.employeeCount,
    ...PROJECT_SUMMARY_AMOUNT_COLUMNS.map((col) => summary.totals[col.key] ?? 0),
    summary.totals.netPayable ?? 0
  ]);
  footerRow.height = 22;
  styleDataRow(footerRow, colCount, {
    bold: true,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
  });

  const safePeriod = String(periodLabel || 'payroll').replace(/\s+/g, '-').toLowerCase();
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob(
    [buffer],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payroll-project-summary-${safePeriod}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { ok: true };
};
