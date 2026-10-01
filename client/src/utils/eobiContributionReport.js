/**
 * EOBI Contribution report PDF — matches HR monthly payroll contribution sheet layout.
 * Employer share = employee deduction × 5 (same rule as payroll BPV / finance breakdown).
 */

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const resolveEobiEmployerContribution = (employeeDeduction) =>
  Math.round((Number(employeeDeduction) || 0) / 0.2);

const pad2 = (n) => String(n).padStart(2, '0');

export const formatCnicDisplay = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 13) {
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  }
  const trimmed = String(raw || '').trim();
  return trimmed && trimmed !== 'N/A' ? trimmed : '—';
};

export const formatDojDisplay = (raw) => {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  const day = pad2(d.getDate());
  const mon = MONTH_SHORT[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yy}`;
};

export const formatAmountPk = (n) => {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString('en-PK');
};

/** Calendar days in payroll month, used when presentDays / proration missing. */
export const daysInPayrollMonth = (month, year) => {
  const m = Number(month);
  const y = Number(year);
  if (!m || !y) return 30;
  return new Date(y, m, 0).getDate();
};

export const resolveEobiNoOfDays = (row, month, year) => {
  const payable = Number(row?.proration?.payableDays);
  if (Number.isFinite(payable) && payable > 0) return Math.round(payable);
  const present = Number(row?.presentDays);
  if (Number.isFinite(present) && present > 0) return Math.round(present);
  return daysInPayrollMonth(month, year);
};

export const buildEobiContributionRows = (reportRows, month, year) => {
  const rows = (Array.isArray(reportRows) ? reportRows : [])
    .filter((r) => Number(r?.eobi || r?.eobiDeduction || 0) > 0)
    .map((r) => {
      const employeeContribution = Math.round(Number(r.eobi || r.eobiDeduction || 0));
      return {
        name: r.employeeName || '—',
        cnic: formatCnicDisplay(r.idCard),
        doj: formatDojDisplay(r.appointmentDate || r.joiningDate || r.hireDate),
        noOfDays: resolveEobiNoOfDays(r, month, year),
        employeeContribution,
        employerContribution: resolveEobiEmployerContribution(employeeContribution),
        remarks: '',
        company: r.company || '',
        project: r.project || ''
      };
    });

  const totalEmployee = rows.reduce((s, r) => s + r.employeeContribution, 0);
  const totalEmployer = rows.reduce((s, r) => s + r.employerContribution, 0);
  return {
    rows,
    totalEmployee,
    totalEmployer,
    grandTotal: totalEmployee + totalEmployer
  };
};

export const resolveEobiReportScopeLabel = (rows, filters = {}, projects = [], departments = []) => {
  if (filters.project) {
    const p = projects.find((x) => String(x._id) === String(filters.project));
    if (p?.name || p?.title) return p.name || p.title;
  }
  if (filters.department) {
    const d = departments.find((x) => String(x._id) === String(filters.department));
    if (d?.name) return d.name;
  }
  const companies = [...new Set((rows || []).map((r) => r.company).filter((c) => c && c !== 'N/A'))];
  if (companies.length === 1) return companies[0];
  const projectsSeen = [...new Set((rows || []).map((r) => r.project).filter((c) => c && c !== 'N/A'))];
  if (projectsSeen.length === 1) return projectsSeen[0];
  return '';
};

/**
 * Generate and download EOBI Contribution PDF for a monthly payroll period.
 * @returns {{ saved: boolean, rowCount: number }}
 */
export async function generateEobiContributionPdf({
  reportData,
  month,
  year,
  periodLabel,
  scopeLabel = '',
  companyName = 'Sardar Group of Companies'
}) {
  const monthNum = Number(month);
  const yearNum = Number(year);
  const { rows, totalEmployee, totalEmployer, grandTotal } = buildEobiContributionRows(
    reportData?.data || [],
    monthNum,
    yearNum
  );

  if (!rows.length) {
    return { saved: false, rowCount: 0 };
  }

  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 12;
  const contentW = pageW - marginX * 2;

  const monthName =
    MONTH_SHORT[monthNum - 1] ||
    String(periodLabel || '').split(/[\s-]/)[0] ||
    String(monthNum);
  const scope = String(scopeLabel || '').trim();
  const titleLine = scope
    ? `EOBI Contribution For ${scope} ${monthName} ${yearNum}`
    : `EOBI Contribution For ${monthName} ${yearNum}`;

  // Header band
  doc.setFillColor(80, 80, 80);
  doc.rect(marginX, 12, contentW, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(companyName, pageW / 2, 19.5, { align: 'center' });
  doc.setFontSize(11);
  doc.text(titleLine, pageW / 2, 26.5, { align: 'center' });

  const body = rows.map((r, i) => [
    String(i + 1),
    r.name,
    r.cnic,
    r.doj,
    String(r.noOfDays),
    formatAmountPk(r.employeeContribution),
    formatAmountPk(r.employerContribution),
    r.remarks || ''
  ]);

  body.push([
    { content: 'Total', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [210, 210, 210] } },
    { content: formatAmountPk(totalEmployee), styles: { fontStyle: 'bold', fillColor: [210, 210, 210], halign: 'right' } },
    { content: formatAmountPk(totalEmployer), styles: { fontStyle: 'bold', fillColor: [210, 210, 210], halign: 'right' } },
    { content: '', styles: { fillColor: [210, 210, 210] } }
  ]);

  body.push([
    { content: 'Grand Total', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [190, 190, 190] } },
    {
      content: formatAmountPk(grandTotal),
      colSpan: 2,
      styles: { fontStyle: 'bold', fillColor: [190, 190, 190], halign: 'right' }
    },
    { content: '', styles: { fillColor: [190, 190, 190] } }
  ]);

  autoTable(doc, {
    startY: 34,
    head: [[
      'Sr no',
      'NAME',
      'CNIC',
      'DOJ',
      'No of Days',
      'Employee Contributions',
      'Employer Contributions',
      'Remarks'
    ]],
    body,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 1.6,
      lineColor: [40, 40, 40],
      lineWidth: 0.2,
      textColor: [20, 20, 20],
      valign: 'middle'
    },
    headStyles: {
      fillColor: [70, 70, 70],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.5
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 38, halign: 'left' },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 28, halign: 'right' },
      7: { cellWidth: 14, halign: 'left' }
    },
    margin: { left: marginX, right: marginX }
  });

  const finalY = (doc.lastAutoTable?.finalY || 40) + 16;
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('_________________________', marginX, finalY);
  doc.text('Signature', marginX, finalY + 5);
  doc.text(`Date: _______________`, pageW - marginX - 45, finalY + 5);

  const safeScope = (scope || 'all').replace(/[^\w.-]+/g, '_');
  const safePeriod = String(periodLabel || `${monthName}-${yearNum}`).replace(/\s+/g, '-');
  doc.save(`EOBI-Contribution-${safeScope}-${safePeriod}.pdf`);

  return { saved: true, rowCount: rows.length, totalEmployee, totalEmployer, grandTotal };
}
