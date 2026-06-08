import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import finalSettlementService from '../services/finalSettlementService';

const fmtPKR = (amount) =>
  `PKR ${Number(amount || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtDate = (date) =>
  date
    ? new Date(date).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

const earningRows = (earnings = {}) =>
  [
    ['Basic Salary', earnings.basicSalary],
    ['House Rent', earnings.houseRent],
    ['Medical Allowance', earnings.medicalAllowance],
    ['Conveyance Allowance', earnings.conveyanceAllowance],
    ['Other Allowances', earnings.otherAllowances],
    ['Overtime', earnings.overtime],
    ['Bonus', earnings.bonus],
    ['Gratuity', earnings.gratuity],
    ['Leave Encashment', earnings.leaveEncashment],
    ['Provident Fund', earnings.providentFund],
    ['EOBI', earnings.eobi]
  ];

const deductionRows = (deductions = {}) =>
  [
    ['Income Tax', deductions.incomeTax],
    ['Provident Fund', deductions.providentFund],
    ['EOBI', deductions.eobi],
    ['Loan Deductions', deductions.loanDeductions],
    ['Notice Period Deduction', deductions.noticePeriodDeduction],
    ['Other Deductions', deductions.otherDeductions]
  ];

export const generateFinalSettlementPdf = (settlement, company = {}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFillColor(25, 118, 210);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(company.name || 'SGC International', margin, 12);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Final Settlement Statement', margin, 20);
  if (company.ntn) {
    doc.setFontSize(8);
    doc.text(`NTN: ${company.ntn}`, margin, 26);
  }

  doc.setFontSize(10);
  doc.text(`Ref: ${settlement.employeeId || '—'}`, pageWidth - margin, 12, { align: 'right' });
  doc.text(
    `Status: ${finalSettlementService.getStatusLabel(settlement.status).toUpperCase()}`,
    pageWidth - margin,
    20,
    { align: 'right' }
  );

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  let y = 36;

  doc.setFont('helvetica', 'bold');
  doc.text('EMPLOYEE:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(settlement.employeeName || '—', margin, y + 5);
  doc.text(`ID: ${settlement.employeeId || '—'}`, margin, y + 10);
  doc.text(`Department: ${settlement.department || '—'}`, margin, y + 15);
  doc.text(`Designation: ${settlement.designation || '—'}`, margin, y + 20);

  doc.setFont('helvetica', 'bold');
  doc.text('SETTLEMENT DETAILS:', 120, y);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Type: ${finalSettlementService.getSettlementTypeLabel(settlement.settlementType)}`,
    120,
    y + 5
  );
  doc.text(`Last Working Date: ${fmtDate(settlement.lastWorkingDate)}`, 120, y + 10);
  doc.text(`Settlement Date: ${fmtDate(settlement.settlementDate)}`, 120, y + 15);
  doc.text(
    `Notice Period: ${settlement.noticePeriodServed || 0}/${settlement.noticePeriod || 0} days`,
    120,
    y + 20
  );

  y += 30;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Financial Summary', margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    head: [['Description', 'Amount']],
    body: [
      ['Gross Settlement Amount', fmtPKR(settlement.grossSettlementAmount)],
      ['Total Deductions', fmtPKR(settlement.deductions?.totalDeductions)],
      ['Net Settlement Amount', fmtPKR(settlement.netSettlementAmount)]
    ],
    headStyles: { fillColor: [25, 118, 210], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: margin, right: margin }
  });

  y = doc.lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Earnings Breakdown', margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    theme: 'striped',
    head: [['Component', 'Amount']],
    body: [
      ...earningRows(settlement.earnings).map(([label, amount]) => [label, fmtPKR(amount)]),
      ['Total Earnings', fmtPKR(settlement.earnings?.totalEarnings)]
    ],
    headStyles: { fillColor: [76, 175, 80], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: margin, right: margin }
  });

  y = doc.lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Deductions Breakdown', margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    theme: 'striped',
    head: [['Component', 'Amount']],
    body: [
      ...deductionRows(settlement.deductions).map(([label, amount]) => [label, fmtPKR(amount)]),
      ['Total Deductions', fmtPKR(settlement.deductions?.totalDeductions)]
    ],
    headStyles: { fillColor: [244, 67, 54], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: margin, right: margin }
  });

  y = doc.lastAutoTable.finalY + 8;

  if (settlement.loans?.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Loan Settlements', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      theme: 'striped',
      head: [['Loan Type', 'Original', 'Outstanding', 'Settled', 'Status']],
      body: settlement.loans.map((loan) => [
        loan.loanType || '—',
        fmtPKR(loan.originalAmount),
        fmtPKR(loan.outstandingBalance),
        fmtPKR(loan.settledAmount),
        (loan.settlementType || 'pending').replace(/_/g, ' ')
      ]),
      headStyles: { fillColor: [96, 125, 139], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    y = doc.lastAutoTable.finalY + 8;
  }

  if (settlement.reason) {
    if (y > 250) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Reason', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const reasonLines = doc.splitTextToSize(settlement.reason, pageWidth - margin * 2);
    doc.text(reasonLines, margin, y);
    y += reasonLines.length * 4 + 4;
  }

  if (settlement.notes) {
    if (y > 260) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Additional Notes', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(settlement.notes, pageWidth - margin * 2);
    doc.text(noteLines, margin, y);
  }

  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    company.invoiceFooter || `${company.name || 'SGC International'} — Final Settlement`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  return doc;
};

export const downloadFinalSettlementPdf = (settlement, company = {}) => {
  const doc = generateFinalSettlementPdf(settlement, company);
  const fileName = `final-settlement-${settlement.employeeId || 'record'}-${new Date(settlement.settlementDate || Date.now()).toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};

export const printFinalSettlementPdf = (settlement, company = {}) => {
  const doc = generateFinalSettlementPdf(settlement, company);
  const blobUrl = doc.output('bloburl');
  const printWindow = window.open(blobUrl, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }
};
