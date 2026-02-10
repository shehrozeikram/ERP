import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import dayjs from 'dayjs';

// Configurable layout (adjustable)
const PDF_CONFIG = {
  margin: 14,
  fontSize: 10,
  fontSizeSmall: 8,
  fontSizeTitle: 16,
  fontSizeSection: 12,
  lineHeight: 6,
  sectionSpacing: 8,
  tableRowHeight: 6
};

const formatDate = (d, format = 'DD MMM YYYY') => (d ? dayjs(d).format(format) : '—');
const formatAmount = (value) => {
  const num = Number(value) || 0;
  return Math.abs(num).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

/**
 * Generate Resident Ledger Statement PDF
 * @param {Object} ledger - { resident, invoices, transactions }
 * @param {Object} options - { filename, openInNewTab }
 */
export const generateResidentLedgerPDF = (ledger, options = {}) => {
  if (!ledger || !ledger.resident) return;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = PDF_CONFIG.margin;
  const marginRight = pageWidth - margin;
  let y = margin;

  const resident = ledger.resident || {};
  const invoices = ledger.invoices || [];
  const transactions = ledger.transactions || [];

  const camInvoices = invoices.filter(inv => inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'CAM');
  const electricityInvoices = invoices.filter(inv => inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'ELECTRICITY');
  const rentInvoices = invoices.filter(inv => inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'RENT');
  const otherInvoices = invoices.filter(inv => {
    const types = inv.chargeTypes || [];
    if (types.length === 0) return true;
    if (types.length > 1) return true;
    return !['CAM', 'ELECTRICITY', 'RENT'].includes(types[0]);
  });

  const contactStr = [resident.contactNumber, resident.email].filter(Boolean).join(' • ') || '—';
  const sectorVal = resident.properties?.[0]?.sector?.name ?? resident.properties?.[0]?.sector ?? '—';

  const checkNewPage = (requiredSpace = 20) => {
    if (y + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  // Title
  pdf.setFontSize(PDF_CONFIG.fontSizeTitle);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Resident Ledger Statement', margin, y);
  y += 8;

  pdf.setFontSize(PDF_CONFIG.fontSizeSmall);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated on ${dayjs().format('DD MMM YYYY, hh:mm A')}`, margin, y);
  y += PDF_CONFIG.sectionSpacing;

  // Resident Information box
  checkNewPage(45);
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.3);
  const infoBoxHeight = 38;
  pdf.rect(margin, y, pageWidth - 2 * margin, infoBoxHeight);
  pdf.setFontSize(PDF_CONFIG.fontSizeSection);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Resident Information', margin + 2, y + 6);
  pdf.setFontSize(PDF_CONFIG.fontSizeSmall);
  pdf.setFont('helvetica', 'normal');

  const col1 = margin + 2;
  const col2 = margin + 55;
  const col3 = margin + 108;
  const row1 = y + 12;
  const row2 = y + 22;
  const row3 = y + 32;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Resident ID:', col1, row1);
  pdf.text('Name:', col1, row2);
  pdf.text('CNIC:', col1, row3);
  pdf.text('Contact:', col2, row1);
  pdf.text('Address:', col2, row2);
  pdf.text('Sector:', col2, row3);
  pdf.text('Balance:', col3, row1);
  pdf.setFont('helvetica', 'normal');
  pdf.text(String(resident.residentId || '—'), col1 + 22, row1);
  pdf.text(String(resident.name || '—').substring(0, 28), col1 + 14, row2);
  pdf.text(String(resident.cnic || '—').substring(0, 22), col1 + 12, row3);
  pdf.text(String(contactStr).substring(0, 32), col2 + 18, row1);
  pdf.text(String(resident.address || '—').substring(0, 38), col2 + 18, row2);
  pdf.text(String(sectorVal).substring(0, 20), col2 + 16, row3);
  pdf.text(`PKR ${formatAmount(resident.balance)}`, col3 + 18, row1);

  y += infoBoxHeight + PDF_CONFIG.sectionSpacing;

  const invoiceTableHead = [['Invoice Date', 'Invoice No', 'Due Date', 'Period', 'Invoice Amount', 'Arrears', 'Amount Due', 'Balance']];

  const addInvoiceTable = (sectionTitle, list) => {
    checkNewPage(25);
    pdf.setFontSize(PDF_CONFIG.fontSizeSection);
    pdf.setFont('helvetica', 'bold');
    pdf.text(sectionTitle, margin, y);
    y += 6;

    const body = list.length === 0
      ? [['No records', '', '', '', '', '', '', '']]
      : list.map(inv => [
          formatDate(inv.invoiceDate),
          String(inv.invoiceNumber || '—').substring(0, 14),
          formatDate(inv.dueDate),
          inv.periodFrom && inv.periodTo
            ? `${dayjs(inv.periodFrom).format('DD MMM YY')} - ${dayjs(inv.periodTo).format('DD MMM YY')}`
            : inv.periodTo ? dayjs(inv.periodTo).format('MMM YYYY') : '—',
          formatAmount(inv.subtotal),
          formatAmount(inv.totalArrears),
          formatAmount(inv.grandTotal),
          formatAmount(inv.balance)
        ]);

    autoTable(pdf, {
      startY: y,
      head: invoiceTableHead,
      body,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: PDF_CONFIG.fontSizeSmall },
      headStyles: { fillColor: [220, 220, 220], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 26 },
        2: { cellWidth: 22 },
        3: { cellWidth: 28 },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 20, halign: 'right' }
      }
    });
    y = pdf.lastAutoTable.finalY + PDF_CONFIG.sectionSpacing;
  };

  addInvoiceTable('CAM Charges', camInvoices);
  addInvoiceTable('Electricity Bill', electricityInvoices);
  addInvoiceTable('Rental Management', rentInvoices);
  if (otherInvoices.length > 0) {
    addInvoiceTable('Other / Mixed', otherInvoices);
  }

  // Transactions
  checkNewPage(25);
  pdf.setFontSize(PDF_CONFIG.fontSizeSection);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Transactions', margin, y);
  y += 6;

  const txnHead = [['Date', 'Type', 'Description', 'Amount', 'Ref']];
  const txnBody = transactions.length === 0
    ? [['No transactions', '', '', '', '']]
    : transactions.map(t => {
        const diff = (t.balanceAfter ?? 0) - (t.balanceBefore ?? 0);
        const sign = diff >= 0 ? '+' : '-';
        const typeLabel = (t.transactionType || '').replace('_', ' ');
        return [
          formatDate(t.createdAt),
          typeLabel,
          String(t.description || '—').substring(0, 35),
          `${sign} ${formatAmount(t.amount)}`,
          String(t.referenceNumberExternal || t.referenceNumber || '—').substring(0, 18)
        ];
      });

  autoTable(pdf, {
    startY: y,
    head: txnHead,
    body: txnBody,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: PDF_CONFIG.fontSizeSmall },
    headStyles: { fillColor: [220, 220, 220], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 22 },
      2: { cellWidth: 55 },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 35 }
    }
  });

  const filename = options.filename || `Resident-Ledger-${resident.residentId || resident._id}-${dayjs().format('YYYY-MM-DD')}.pdf`;
  if (options.openInNewTab) {
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    pdf.save(filename);
  }
};

export default generateResidentLedgerPDF;
