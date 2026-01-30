import jsPDF from 'jspdf';
import dayjs from 'dayjs';
import { fetchPropertyById } from '../services/tajPropertiesService';

// Helper function to load and add logo image to PDF
const addLogoToPDF = async (pdf, x, y, width = 15, height = 15) => {
  try {
    // Load the logo image from public folder
    const logoPath = '/images/taj-logo.png';
    const img = new Image();
    
    return new Promise((resolve) => {
      img.onload = () => {
        try {
          pdf.addImage(img, 'PNG', x, y, width, height);
        } catch (error) {
          console.error('Error adding logo to PDF:', error);
          // Fallback to text if image fails
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'normal');
          pdf.text('LOGO', x, y + height / 2);
        }
        resolve();
      };
      img.onerror = () => {
        // Fallback to text if image fails to load
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.text('LOGO', x, y + height / 2);
        resolve();
      };
      img.src = logoPath;
    });
  } catch (error) {
    console.error('Error loading logo:', error);
    // Fallback to text
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text('LOGO', x, y + 5);
  }
};

// Shared helper function to ensure property has size data
const ensurePropertyWithSize = async (property, invoice) => {
  if (!property) return null;
  
  const hasAreaValue = (property.areaValue !== undefined && property.areaValue !== null && property.areaValue !== '') ||
                       (invoice?.property?.areaValue !== undefined && invoice?.property?.areaValue !== null && invoice?.property?.areaValue !== '');
  const hasAreaUnit = (property.areaUnit !== undefined && property.areaUnit !== null && property.areaUnit !== '') ||
                      (invoice?.property?.areaUnit !== undefined && invoice?.property?.areaUnit !== null && invoice?.property?.areaUnit !== '');
  
  const needsFetch = !hasAreaValue && !hasAreaUnit;
  const propertyId = property._id || property.id || (typeof property === 'string' ? property : null);
  
  if (needsFetch && propertyId) {
    try {
      const propertyResponse = await fetchPropertyById(propertyId);
      if (propertyResponse?.data?.data) {
        return { ...property, ...propertyResponse.data.data };
      }
    } catch (err) {
      // Silently fail - will use fallback values
    }
  }
  
  return property;
};

export const outputPDF = (pdf, filename, options = {}) => {
  if (options.openInNewTab) {
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    pdf.save(filename);
  }
};

// Generate Electricity Invoice PDF
export const generateElectricityInvoicePDF = async (invoice, propertyParam = null, options = {}) => {
  let property = invoice?.property || propertyParam;
  
  if (!property || !invoice) return;
  
  property = await ensurePropertyWithSize(property, invoice);
  if (!property) return;
  
  // Get electricity charge from invoice
  const electricityCharge = invoice.charges?.find(c => c.type === 'ELECTRICITY');
  const electricityBill = invoice.electricityBill || {};
  const calcData = invoice.calculationData || {};

  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const panelWidth = pageWidth / 3;
  const marginX = 6;
  const topMargin = 10;

  const formatDate = (value, format = 'D-MMM-YY') => value ? dayjs(value).format(format) : '—';
  const formatFullDate = (value) => value ? dayjs(value).format('MMMM D, YYYY') : '—';
  const formatAmount = (value) => {
    const num = Number(value) || 0;
    const formatted = Math.abs(num).toLocaleString('en-PK', { minimumFractionDigits: 0 });
    return num < 0 ? `(${formatted})` : formatted;
  };
  const formatRate = (value) => (Number(value) || 0).toFixed(2);
  const formatMonthLabel = () => {
    const dateToUse = invoice.periodTo || invoice.periodFrom;
    if (dateToUse) return dayjs(dateToUse).format('MMM-YY').toUpperCase();
    if (electricityBill.month) return electricityBill.month.toUpperCase();
    return dayjs().format('MMM-YY').toUpperCase();
  };

  const meterNo = calcData.meterNo || electricityBill.meterNo || property.electricityWaterMeterNo || '—';
  const clientName = property.ownerName || property.tenantName || '—';
  const residentId = property.resident?.residentId || property.residentId || '—';
  const sector = property.sector || '—';
  const address = electricityBill.address || property.address || '—';
  const matchedMeter = property.meters?.find(m => String(m.meterNo) === String(meterNo) && m.isActive !== false);
  const floor = matchedMeter?.floor || property.floor || '—';
  
  const sourceProperty = (property.areaValue !== undefined && property.areaValue !== null && property.areaValue !== '') 
    ? property : (invoice?.property?.areaValue !== undefined && invoice?.property?.areaValue !== null && invoice?.property?.areaValue !== '' ? invoice.property : property);
  let propertySize = '—';
  const areaValue = sourceProperty.areaValue;
  const areaUnit = sourceProperty.areaUnit;
  if (areaValue !== undefined && areaValue !== null && areaValue !== '') {
    const valueStr = String(areaValue).trim();
    const unitStr = areaUnit ? String(areaUnit).trim() : '';
    propertySize = valueStr ? `${valueStr}${unitStr ? ' ' + unitStr : ''}`.trim() : '—';
  }

  const invoiceNumber = invoice.invoiceNumber || '—';
  const periodFrom = formatDate(invoice.periodFrom || electricityBill.fromDate);
  const periodTo = formatDate(invoice.periodTo || electricityBill.toDate);
  const readingDate = formatFullDate(invoice.periodTo || electricityBill.toDate);
  const dueDate = formatFullDate(invoice.dueDate || electricityBill.dueDate);
  
  const unitsConsumed = calcData.unitsConsumed !== undefined ? calcData.unitsConsumed : (electricityBill.unitsConsumed !== undefined ? electricityBill.unitsConsumed : 0);
  const totalBill = electricityCharge?.amount || electricityBill.totalBill || electricityBill.amount || 0;
  
  // Get arrears from multiple sources - prioritize invoice charge data, then calculation data, then electricity bill, then invoice totalArrears
  let arrears = 0;
  if (electricityCharge?.arrears !== undefined && electricityCharge.arrears !== null) {
    arrears = electricityCharge.arrears;
  } else if (invoice.totalArrears !== undefined && invoice.totalArrears !== null) {
    arrears = invoice.totalArrears;
  } else if (calcData.previousArrears !== undefined && calcData.previousArrears !== null) {
    arrears = calcData.previousArrears;
  } else if (electricityBill.arrears !== undefined && electricityBill.arrears !== null) {
    arrears = electricityBill.arrears;
  }
  
  const amountReceived = electricityBill.receivedAmount || 0;
  const totalPaid = invoice.totalPaid || amountReceived || 0;
  const grandTotal = invoice.grandTotal || (totalBill + arrears);
  const payableWithinDueDate = totalBill + arrears - amountReceived;
  // Late payment surcharge is 10% of "Charges for the Month" (totalBill), then added to arrears
  const latePaymentSurcharge = Math.max(Math.round(totalBill * 0.1), 0);
  const payableAfterDueDate = totalBill + arrears + latePaymentSurcharge - amountReceived;
  
  // Always use "Payable Within Due Date" (no surcharge applied)
  const payableAmount = payableWithinDueDate;
  
  // Calculate remaining balance: if overdue (after due date ends), use payableAfterDueDate, otherwise use payableWithinDueDate
  const invoiceDueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const dueStart = invoiceDueDate ? new Date(invoiceDueDate) : null; if (dueStart) dueStart.setHours(0, 0, 0, 0);
  const isOverdue = dueStart && todayStart > dueStart;
  const isUnpaid = invoice.paymentStatus === 'unpaid' || invoice.paymentStatus === 'partial_paid' || (invoice.balance || 0) > 0;
  const balance = (isOverdue && isUnpaid) ? (payableAfterDueDate - totalPaid) : (payableWithinDueDate - totalPaid);

  pdf.setDrawColor(170);
  pdf.setLineWidth(0.3);
  if (pdf.setLineDash) pdf.setLineDash([1, 2], 0);
  pdf.line(panelWidth, topMargin - 5, panelWidth, pageHeight - 15);
  pdf.line(panelWidth * 2, topMargin - 5, panelWidth * 2, pageHeight - 15);
  if (pdf.setLineDash) pdf.setLineDash([], 0);

  const drawInlineField = (label, value, startX, startY, labelWidth = 30, fontSize = 7) => {
    const valueWidth = panelWidth - marginX * 2 - labelWidth;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(fontSize);
    pdf.text(label, startX, startY);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(String(value || '—'), valueWidth);
    lines.forEach((line, idx) => {
      pdf.text(line, startX + labelWidth, startY + idx * 4);
    });
    return startY + lines.length * 4 + 1;
  };

  const drawMeterTable = (startX, startY) => {
    const headers = ['Meter No.', 'Previous', 'Present', 'Unit Consumed', 'IESCO SLAB'];
    const previousReading = calcData.previousReading !== undefined ? calcData.previousReading : (electricityBill.prvReading !== undefined ? electricityBill.prvReading : 0);
    const currentReading = calcData.currentReading !== undefined ? calcData.currentReading : (electricityBill.curReading !== undefined ? electricityBill.curReading : 0);
    const slabLabel = calcData.slab?.unitsSlab || electricityBill.iescoSlabs || '—';
    const values = [meterNo, String(previousReading), String(currentReading), String(unitsConsumed), slabLabel];
    const cellWidth = (panelWidth - marginX * 2) / headers.length;
    const headerHeight = 5;
    const valueHeight = 6;
    headers.forEach((header, idx) => {
      const cellX = startX + idx * cellWidth;
      pdf.rect(cellX, startY, cellWidth, headerHeight);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(5);
      pdf.text(header, cellX + cellWidth / 2, startY + headerHeight - 1.2, { align: 'center' });
    });
    values.forEach((value, idx) => {
      const cellX = startX + idx * cellWidth;
      pdf.rect(cellX, startY + headerHeight, cellWidth, valueHeight);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(5.5);
      pdf.text(String(value || '—'), cellX + cellWidth / 2, startY + headerHeight + valueHeight - 1.2, { align: 'center' });
    });
    return startY + headerHeight + valueHeight;
  };

  const drawComputationTable = (startX, startY) => {
    const charges = calcData.charges || {};
    const unitRate = calcData.slab?.unitRate !== undefined ? calcData.slab.unitRate : (electricityBill.iescoUnitPrice || 0);
    const electricityCost = charges.electricityCost !== undefined ? charges.electricityCost : (electricityBill.electricityCost || 0);
    const fcSurcharge = charges.fcSurcharge !== undefined ? charges.fcSurcharge : (electricityBill.fcSurcharge || 0);
    const gst = charges.gst !== undefined ? charges.gst : (electricityBill.gst || 0);
    const electricityDuty = charges.electricityDuty !== undefined ? charges.electricityDuty : (electricityBill.electricityDuty || 0);
    const rows = [
      { label: 'Unit price', value: formatRate(unitRate) },
      { label: 'Share of IESCO Supply Cost Rate', value: formatAmount(electricityCost) },
      { label: 'FC Surcharge', value: formatAmount(fcSurcharge) },
      { label: 'Sales Tax', value: formatAmount(gst) },
      { label: 'Electricity Duty', value: formatAmount(electricityDuty) },
      { label: 'Charges for the Month', value: formatAmount(totalBill) },
      { label: 'Arrears', value: formatAmount(arrears) },
      { label: 'Payable', value: formatAmount(payableAmount) },
      { label: 'Late Payment Surcharge', value: formatAmount(latePaymentSurcharge) },
      { label: 'Payable After Due Date', value: formatAmount(payableAfterDueDate) },
      { label: 'Paid Amount', value: totalPaid > 0 ? formatAmount(totalPaid) : '-' },
      { label: 'Remaining Balance', value: formatAmount(balance) }
    ];

    const rowHeight = 6;
    const availableWidth = panelWidth - marginX * 2;
    pdf.setFontSize(7);
    rows.forEach((row, idx) => {
      const y = startY + idx * rowHeight;
      pdf.setFont('helvetica', idx >= rows.length - 3 ? 'bold' : 'normal');
      pdf.text(row.label, startX, y + 4);
      pdf.text(String(row.value), startX + availableWidth, y + 4, { align: 'right' });
      pdf.line(startX, y + rowHeight, startX + availableWidth, y + rowHeight);
    });
    return startY + rows.length * rowHeight;
  };

  const drawPanel = async (copyLabel, columnIndex) => {
    const startX = columnIndex * panelWidth + marginX;
    let cursorY = topMargin - 3; // Move first row up
    const contentWidth = panelWidth - marginX * 2;

    // Header row: Copy Label (left) | Taj Residencia (center) | Logo (right)
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(copyLabel, startX, cursorY); // Left: Copy label
    pdf.setFontSize(10);
    pdf.setTextColor(178, 34, 34);
    pdf.text('Taj Residencia', startX + contentWidth / 2, cursorY, { align: 'center' }); // Center: Taj Residencia
    pdf.setTextColor(0, 0, 0);
    
    // Add logo image on the right - bigger and better positioned
    const logoWidth = 20;
    const logoHeight = 20;
    const logoX = startX + contentWidth - logoWidth - 1; // Slight margin from edge
    const logoY = cursorY - 5; // Center vertically with text, accounting for larger size
    await addLogoToPDF(pdf, logoX, logoY, logoWidth, logoHeight);
    
    cursorY += 7; // Increased spacing to accommodate larger logo

    pdf.setFont('helvetica', 'bold'); // Make invoice type bold
    pdf.setFontSize(9); // Reduced from 11 to 9
    pdf.setTextColor(178, 34, 34);
    pdf.text('Invoice of Electricity Charges', startX + (panelWidth - marginX * 2) / 2, cursorY, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    cursorY += 6;

    // Render "For The Month Of" in normal, then month label in bold
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const monthPrefix = 'For The Month Of ';
    const monthValue = formatMonthLabel();
    const prefixWidth = pdf.getTextWidth(monthPrefix);
    const totalWidth = pdf.getTextWidth(monthPrefix + monthValue);
    const centerX = startX + (panelWidth - marginX * 2) / 2;
    pdf.text(monthPrefix, centerX - totalWidth / 2, cursorY);
    pdf.setFont('helvetica', 'bold'); // Make date/year bold
    pdf.text(monthValue, centerX - totalWidth / 2 + prefixWidth, cursorY);
    cursorY += 6;

    const inlineFields = [
      ['Resident ID', residentId],
      ['Meter ID', meterNo],
      ['Client', clientName],
      ['Sector', sector],
      ['Floor', floor],
      ['Address', address],
      ['Size', propertySize],
      ['Period From', periodFrom],
      ['Period To', periodTo],
      ['Invoice No.', invoiceNumber],
      ['Reading Date', readingDate],
      ['Due Date', dueDate]
    ];
    inlineFields.forEach(([label, value], index) => {
      const fontSize = label === 'Sector' ? 6 : 7;
      cursorY = drawInlineField(label, value, startX, cursorY, 30, fontSize);
    });
    cursorY += 2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('IESCO Meter Reading', startX, cursorY);
    cursorY += 2;
    cursorY = drawMeterTable(startX - 2, cursorY);

    cursorY += 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('Bill Computation', startX, cursorY);
    cursorY += 3;
    cursorY = drawComputationTable(startX, cursorY);
    cursorY += 1;

    const panelFootnotes = [
      '1. The above mentioned charges are calculated based on proportionate share of user in total cost of electricity of the Project and do not include any profit element of Taj Residencia.',
      '2. Please make your cheque/bank draft/cash deposit on our specified deposit slip at any Allied Bank Ltd. branch in Pakistan to Account Title: Taj Residencia, Allied Bank Limited, The Centaurus Mall Branch, Islamabad (0917). Bank Account No.: PK68ABPA0010035700420129.',
      '3. Please deposit your bills before due date to avoid Late Payment Surcharge.',
      '4. Please share proof of payment to TAJ Official WhatsApp No.: 0345 77 68 442.'
    ];
    
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(5.2);
    let totalFooterHeight = 0;
    panelFootnotes.forEach((line) => {
      const wrapped = pdf.splitTextToSize(line, panelWidth - 2 * marginX);
      totalFooterHeight += wrapped.length * 3.2;
    });
    
    const footerStartY = Math.max(cursorY + 2, pageHeight - totalFooterHeight - 6);
    let noteY = footerStartY;
    panelFootnotes.forEach((line) => {
      const wrapped = pdf.splitTextToSize(line, panelWidth - 2 * marginX);
      wrapped.forEach((wrappedLine) => {
        pdf.text(wrappedLine, startX, noteY);
        noteY += 3.2;
      });
    });
  };

  // Draw all panels (await each one to ensure logo loads)
  for (let index = 0; index < 3; index++) {
    const copy = ['Bank Copy', 'Office Copy', 'Client Copy'][index];
    await drawPanel(copy, index);
  }

  const sanitizedName = (property.propertyName || property.plotNumber || property.srNo || 'electricity-property')
    .toString().replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '_');
  outputPDF(pdf, `Electricity_Invoice_${sanitizedName || property._id}.pdf`, options);
};

// Generate CAM Invoice PDF
export const generateCAMInvoicePDF = async (invoice, propertyParam = null, options = {}) => {
  let property = invoice?.property || propertyParam;
  
  if (!property || !invoice) return;
  
  property = await ensurePropertyWithSize(property, invoice);
  if (!property) return;
  
  const camCharge = invoice.charges?.find(c => c.type === 'CAM');
  const camAmount = camCharge?.amount || 0;
  const arrears = camCharge?.arrears || invoice.totalArrears || 0;
  const totalPaid = invoice.totalPaid || 0;
  const grandTotal = invoice.grandTotal || (camAmount + arrears);

  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const panelWidth = pageWidth / 3;
  const marginX = 6;
  const topMargin = 10;
  const contentWidth = panelWidth - 2 * marginX;

  const formatDate = (value, pattern = 'DD-MMM-YY') => value ? dayjs(value).format(pattern) : '—';
  const formatFullDate = (value) => value ? dayjs(value).format('MMMM D, YYYY') : '—';
  const formatMoney = (value) => (Number(value) || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 });

  const periodFromRaw = invoice?.periodFrom || null;
  const periodToRaw = invoice?.periodTo || null;
  const periodFrom = formatDate(periodFromRaw);
  const periodTo = formatDate(periodToRaw);
  const invoiceNumber = invoice?.invoiceNumber || '—';
  const invoicingDate = formatFullDate(invoice?.invoiceDate || invoice?.createdAt);
  const computedDueDate = invoice?.dueDate || (periodToRaw ? dayjs(periodToRaw).add(30, 'day').toDate() : null);
  const dueDate = formatFullDate(computedDueDate);
  const monthLabel = (periodToRaw ? dayjs(periodToRaw) : invoice?.invoiceDate ? dayjs(invoice.invoiceDate) : dayjs()).format('MMM-YY').toUpperCase();

  const residentName = property.tenantName || property.ownerName || '—';
  const residentId = property.resident?.residentId || property.residentId || '—';
  const propertyAddress = property.address || [property.plotNumber ? `Plot No ${property.plotNumber}` : '', property.street].filter(Boolean).join(', ') || '—';
  const propertySector = property.sector || '—';
  
  const sourceProperty = (property.areaValue !== undefined && property.areaValue !== null && property.areaValue !== '') 
    ? property : (invoice?.property?.areaValue !== undefined && invoice?.property?.areaValue !== null && invoice?.property?.areaValue !== '' ? invoice.property : property);
  let propertySize = '—';
  const areaValue = sourceProperty.areaValue;
  const areaUnit = sourceProperty.areaUnit;
  if (areaValue !== undefined && areaValue !== null && areaValue !== '') {
    const valueStr = String(areaValue).trim();
    const unitStr = areaUnit ? String(areaUnit).trim() : '';
    propertySize = valueStr ? `${valueStr}${unitStr ? ' ' + unitStr : ''}`.trim() : '—';
  }

  const totalPaidCAM = invoice?.totalPaid || 0;
  const payableWithinDue = (invoice?.grandTotal || (camAmount + arrears)) - totalPaidCAM;
  // Late payment surcharge is 10% of "Charges for the Month" (camAmount), then added to arrears
  const lateSurcharge = Math.max(Math.round(camAmount * 0.1), 0);
  const payableAfterDue = camAmount + arrears + lateSurcharge - totalPaidCAM;
  
  // Always use "Payable Within Due Date" (no surcharge applied)
  const payableAmount = payableWithinDue;
  
  // Calculate remaining balance: if overdue (after due date ends), use payableAfterDue, otherwise use payableWithinDue
  const invoiceDueDate = computedDueDate ? new Date(computedDueDate) : null;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const dueStart = invoiceDueDate ? new Date(invoiceDueDate) : null; if (dueStart) dueStart.setHours(0, 0, 0, 0);
  const isOverdue = dueStart && todayStart > dueStart;
  const isUnpaid =
    invoice.paymentStatus === 'unpaid' ||
    invoice.paymentStatus === 'partial_paid' ||
    (invoice.balance || 0) > 0;
  const balanceCAM = (isOverdue && isUnpaid) ? payableAfterDue : payableWithinDue;

  pdf.setDrawColor(170);
  pdf.setLineWidth(0.3);
  if (pdf.setLineDash) pdf.setLineDash([1, 2], 0);
  [panelWidth, panelWidth * 2].forEach((xPos) => {
    pdf.line(xPos, topMargin - 5, xPos, pageHeight - 15);
  });
  if (pdf.setLineDash) pdf.setLineDash([], 0);

  const drawInlineField = (label, value, startX, startY, labelWidth = 34) => {
    const valueWidth = contentWidth - labelWidth;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.text(label, startX, startY);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(String(value || '—'), valueWidth);
    lines.forEach((line, idx) => {
      pdf.text(line, startX + labelWidth, startY + idx * 4.5);
    });
    return startY + lines.length * 4.5 + 1.5;
  };

  const drawRentDetails = (startX, startY) => {
    const width = contentWidth;
    let y = startY;
    pdf.setFillColor(242, 242, 242);
    pdf.rect(startX, y, width, 7, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(178, 34, 34);
    pdf.text('CAM CHARGES DETAILS', startX + width / 2, y + 4.5, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    y += 13;

    const rows = [
      ['CAM Charges', formatMoney(camAmount)],
      ['Charges for the Month', formatMoney(camAmount)],
      ['Arrears', formatMoney(arrears)],
      ['Payable', formatMoney(payableAmount)],
      ['Payable After Due Date', formatMoney(payableAfterDue)],
      ['Paid Amount', totalPaidCAM > 0 ? formatMoney(totalPaidCAM) : '-'],
      ['Remaining Balance', formatMoney(balanceCAM)]
    ];

    rows.forEach((row, idx) => {
      const isBoldRow = row[0] === 'Payable After Due Date' || row[0] === 'Paid Amount' || row[0] === 'Remaining Balance';
      pdf.setDrawColor(210);
      pdf.rect(startX, y - 5, width, 7);
      pdf.setFont('helvetica', isBoldRow ? 'bold' : 'normal');
      pdf.setFontSize(7);
      pdf.text(row[0], startX + 2, y - 1);
      pdf.setFont('helvetica', 'normal');
      pdf.text(row[1], startX + width - 2, y - 1, { align: 'right' });
      y += 7;
    });
    return y + 2;
  };

  const footnotes = [
    '1. The above-mentioned charges cover security, horticulture, road maintenance, garbage collection, society upkeep, and related services.',
    '2. Please make your cheque/bank draft/cash deposit on our specified deposit slip at any Allied Bank Ltd. branch in Pakistan to Account Title: Taj Residencia, Allied Bank Limited, The Centaurus Mall Branch, Islamabad (0917). Bank Account No.: PK68ABPA0010035700420129.',
    '3. Please deposit your dues before the due date to avoid Late Payment Surcharge.',
    '4. Please share proof of payment to TAJ Official WhatsApp No.: 0345 77 88 442.'
  ];

  const drawPanel = async (copyLabel, columnIndex) => {
    const startX = columnIndex * panelWidth + marginX;
    let cursorY = topMargin - 3; // Move first row up

    // Header row: Copy Label (left) | Taj Residencia (center) | Logo (right)
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(copyLabel, startX, cursorY); // Left: Copy label
    pdf.setFontSize(10);
    pdf.setTextColor(178, 34, 34);
    pdf.text('Taj Residencia', startX + contentWidth / 2, cursorY, { align: 'center' }); // Center: Taj Residencia
    pdf.setTextColor(0, 0, 0);
    
    // Add logo image on the right - bigger and better positioned
    const logoWidth = 20;
    const logoHeight = 20;
    const logoX = startX + contentWidth - logoWidth - 1; // Slight margin from edge
    const logoY = cursorY - 5; // Center vertically with text, accounting for larger size
    await addLogoToPDF(pdf, logoX, logoY, logoWidth, logoHeight);
    
    cursorY += 7; // Increased spacing to accommodate larger logo

    pdf.setFont('helvetica', 'bold'); // Make invoice type bold
    pdf.setFontSize(9); // Reduced from 11 to 9
    pdf.setTextColor(178, 34, 34);
    pdf.text('Invoice of CAM Charges', startX + contentWidth / 2, cursorY, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    cursorY += 6;

    // Render "For The Month Of" in normal, then month label in bold
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const monthPrefix = 'For The Month Of ';
    const monthValue = monthLabel;
    const prefixWidth = pdf.getTextWidth(monthPrefix);
    const totalWidth = pdf.getTextWidth(monthPrefix + monthValue);
    const centerX = startX + contentWidth / 2;
    pdf.text(monthPrefix, centerX - totalWidth / 2, cursorY);
    pdf.setFont('helvetica', 'bold'); // Make date/year bold
    pdf.text(monthValue, centerX - totalWidth / 2 + prefixWidth, cursorY);
    cursorY += 6;

    const inlineRows = [
      ['Resident ID', residentId],
      ['Residents Name', residentName],
      ['Address', propertyAddress],
      ['Sector', propertySector],
      ['Size', propertySize],
      ['Period From', periodFrom],
      ['Period To', periodTo],
      ['Invoice No.', invoiceNumber],
      ['Invoicing Date', invoicingDate],
      ['Due Date', dueDate]
    ];

    inlineRows.forEach(([label, value]) => {
      cursorY = drawInlineField(label, value, startX, cursorY);
    });

    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(6.5);
    pdf.text('(In Rupees)', startX + contentWidth, cursorY, { align: 'right' });
    cursorY += 4;

    cursorY = drawRentDetails(startX, cursorY);

    let footY = cursorY + 2;
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(5.2);
    footnotes.forEach((line) => {
      const wrapped = pdf.splitTextToSize(line, contentWidth);
      wrapped.forEach((wrappedLine) => {
        pdf.text(wrappedLine, startX, footY);
        footY += 3.2;
      });
    });
  };

  // Draw all panels (await each one to ensure logo loads)
  for (let index = 0; index < 3; index++) {
    const copy = ['Bank Copy', 'Office Copy', 'Client Copy'][index];
    await drawPanel(copy, index);
  }

  const sanitizedName = (property.propertyName || property.plotNumber || property.srNo || 'cam-property')
    .toString().replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '_');
  outputPDF(pdf, `CAM_Invoice_${sanitizedName || property._id}.pdf`, options);
};

// Generate Rent Invoice PDF
export const generateRentInvoicePDF = async (invoice, propertyParam = null, options = {}) => {
  let property = invoice?.property || propertyParam;
  
  if (!property || !invoice) return;
  
  property = await ensurePropertyWithSize(property, invoice);
  if (!property) return;
  
  const rentCharge = invoice.charges?.find(c => c.type === 'RENT');
  const rentAmount = rentCharge?.amount || 0;
  const arrears = rentCharge?.arrears || invoice.totalArrears || 0;
  const totalPaidRent = invoice.totalPaid || 0;
  const grandTotal = invoice.grandTotal || (rentAmount + arrears);

  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const panelWidth = pageWidth / 3;
  const marginX = 6;
  const topMargin = 10;
  const contentWidth = panelWidth - 2 * marginX;

  const formatDate = (value, pattern = 'DD-MMM-YY') => value ? dayjs(value).format(pattern) : '—';
  const formatFullDate = (value) => value ? dayjs(value).format('MMMM D, YYYY') : '—';
  const formatMoney = (value) => (Number(value) || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 });

  const periodFromRaw = invoice?.periodFrom || null;
  const periodToRaw = invoice?.periodTo || null;
  const periodFrom = formatDate(periodFromRaw);
  const periodTo = formatDate(periodToRaw);
  const invoiceNumber = invoice?.invoiceNumber || '—';
  const invoicingDate = formatFullDate(invoice?.invoiceDate || invoice?.createdAt);
  const computedDueDate = invoice?.dueDate || (periodToRaw ? dayjs(periodToRaw).add(30, 'day').toDate() : null);
  const dueDate = formatFullDate(computedDueDate);
  const monthLabel = (periodToRaw ? dayjs(periodToRaw) : invoice?.invoiceDate ? dayjs(invoice.invoiceDate) : dayjs()).format('MMM-YY').toUpperCase();

  const tenantName = property.tenantName || property.ownerName || '—';
  const residentId = property.resident?.residentId || property.residentId || '—';
  const propertyAddress = property.fullAddress || property.address || [property.plotNumber ? `Plot No ${property.plotNumber}` : '', property.street].filter(Boolean).join(', ') || '—';
  const propertySector = property.sector || '—';
  
  const sourceProperty = (property.areaValue !== undefined && property.areaValue !== null && property.areaValue !== '') 
    ? property : (invoice?.property?.areaValue !== undefined && invoice?.property?.areaValue !== null && invoice?.property?.areaValue !== '' ? invoice.property : property);
  let propertySize = '—';
  const areaValue = sourceProperty.areaValue;
  const areaUnit = sourceProperty.areaUnit;
  if (areaValue !== undefined && areaValue !== null && areaValue !== '') {
    const valueStr = String(areaValue).trim();
    const unitStr = areaUnit ? String(areaUnit).trim() : '';
    propertySize = valueStr ? `${valueStr}${unitStr ? ' ' + unitStr : ''}`.trim() : '—';
  }

  // Late payment surcharge is 10% of "Charges for the Month" (rentAmount), then added to arrears
  const lateSurcharge = Math.max(Math.round(rentAmount * 0.1), 0);
  const payableWithinDue = (invoice?.grandTotal || (rentAmount + arrears)) - totalPaidRent;
  const payableAfterDue = rentAmount + arrears + lateSurcharge - totalPaidRent;
  
  // Always use "Payable Within Due Date" (no surcharge applied)
  const payableAmount = payableWithinDue;
  
  // Calculate remaining balance: if overdue (after due date ends), use payableAfterDue, otherwise use payableWithinDue
  const invoiceDueDate = computedDueDate ? new Date(computedDueDate) : null;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const dueStart = invoiceDueDate ? new Date(invoiceDueDate) : null; if (dueStart) dueStart.setHours(0, 0, 0, 0);
  const isOverdue = dueStart && todayStart > dueStart;
  const isUnpaid =
    invoice.paymentStatus === 'unpaid' ||
    invoice.paymentStatus === 'partial_paid' ||
    (invoice.balance || 0) > 0;
  const balanceRent = (isOverdue && isUnpaid) ? payableAfterDue : payableWithinDue;

  pdf.setDrawColor(170);
  pdf.setLineWidth(0.3);
  if (pdf.setLineDash) pdf.setLineDash([1, 2], 0);
  [panelWidth, panelWidth * 2].forEach((xPos) => {
    pdf.line(xPos, topMargin - 5, xPos, pageHeight - 15);
  });
  if (pdf.setLineDash) pdf.setLineDash([], 0);

  const drawInlineField = (label, value, startX, startY, labelWidth = 34) => {
    const valueWidth = contentWidth - labelWidth;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.text(label, startX, startY);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(String(value || '—'), valueWidth);
    lines.forEach((line, idx) => {
      pdf.text(line, startX + labelWidth, startY + idx * 4.5);
    });
    return startY + lines.length * 4.5 + 1.5;
  };

  const drawRentDetails = (startX, startY) => {
    const width = contentWidth;
    let y = startY;
    pdf.setFillColor(242, 242, 242);
    pdf.rect(startX, y, width, 7, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(178, 34, 34);
    pdf.text('RENT DETAILS', startX + width / 2, y + 4.5, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    y += 13;

    const rows = [
      ['Monthly Rent', formatMoney(rentAmount)],
      ['Charges for the Month', formatMoney(rentAmount)],
      ['Arrears', formatMoney(arrears)],
      ['Payable', formatMoney(payableAmount)],
      ['Payable After Due Date', formatMoney(payableAfterDue)],
      ['Paid Amount', totalPaidRent > 0 ? formatMoney(totalPaidRent) : '-'],
      ['Remaining Balance', formatMoney(balanceRent)]
    ];

    rows.forEach((row, idx) => {
      const isBoldRow = row[0] === 'Payable After Due Date' || row[0] === 'Paid Amount' || row[0] === 'Remaining Balance';
      pdf.setDrawColor(210);
      pdf.rect(startX, y - 5, width, 7);
      pdf.setFont('helvetica', isBoldRow ? 'bold' : 'normal');
      pdf.setFontSize(7);
      pdf.text(row[0], startX + 2, y - 1);
      pdf.setFont('helvetica', 'normal');
      pdf.text(row[1], startX + width - 2, y - 1, { align: 'right' });
      y += 7;
    });
    return y + 2;
  };

  const footnotes = [
    '1. Please make your cheque/bank draft/cash deposit on our specified deposit slip at any Allied Bank Ltd. branch in Pakistan to Account Title: Taj Residencia, Allied Bank Limited, The Centaurus Mall Branch, Islamabad (0917). Bank Account No.: PK68ABPA0010035700420129.',
    '2. Please deposit your dues before the due date to avoid Late Payment Surcharge.',
    '3. Please share proof of payment to TAJ Official WhatsApp No.: 0345 77 88 442.',
    '4. Any returned or dishonored cheques will attract service charges.'
  ];

  const drawPanel = async (copyLabel, columnIndex) => {
    const startX = columnIndex * panelWidth + marginX;
    let cursorY = topMargin - 3; // Move first row up

    // Header row: Copy Label (left) | Taj Residencia (center) | Logo (right)
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(copyLabel, startX, cursorY); // Left: Copy label
    pdf.setFontSize(10);
    pdf.setTextColor(178, 34, 34);
    pdf.text('Taj Residencia', startX + contentWidth / 2, cursorY, { align: 'center' }); // Center: Taj Residencia
    pdf.setTextColor(0, 0, 0);
    
    // Add logo image on the right - bigger and better positioned
    const logoWidth = 20;
    const logoHeight = 20;
    const logoX = startX + contentWidth - logoWidth - 1; // Slight margin from edge
    const logoY = cursorY - 5; // Center vertically with text, accounting for larger size
    await addLogoToPDF(pdf, logoX, logoY, logoWidth, logoHeight);
    
    cursorY += 7; // Increased spacing to accommodate larger logo

    pdf.setFont('helvetica', 'bold'); // Make invoice type bold
    pdf.setFontSize(9); // Reduced from 11 to 9
    pdf.setTextColor(178, 34, 34);
    pdf.text('Invoice of Rent Charges', startX + contentWidth / 2, cursorY, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    cursorY += 6;

    // Render "For The Month Of" in normal, then month label in bold
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const monthPrefix = 'For The Month Of ';
    const monthValue = monthLabel;
    const prefixWidth = pdf.getTextWidth(monthPrefix);
    const totalWidth = pdf.getTextWidth(monthPrefix + monthValue);
    const centerX = startX + contentWidth / 2;
    pdf.text(monthPrefix, centerX - totalWidth / 2, cursorY);
    pdf.setFont('helvetica', 'bold'); // Make date/year bold
    pdf.text(monthValue, centerX - totalWidth / 2 + prefixWidth, cursorY);
    cursorY += 6;

    const inlineRows = [
      ['Resident ID', residentId],
      ['Tenant Name', tenantName],
      ['Address', propertyAddress],
      ['Sector', propertySector],
      ['Size', propertySize],
      ['Period From', periodFrom],
      ['Period To', periodTo],
      ['Invoice No.', invoiceNumber],
      ['Invoicing Date', invoicingDate],
      ['Due Date', dueDate]
    ];

    inlineRows.forEach(([label, value]) => {
      cursorY = drawInlineField(label, value, startX, cursorY);
    });

    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(6.5);
    pdf.text('(In Rupees)', startX + contentWidth, cursorY, { align: 'right' });
    cursorY += 4;

    cursorY = drawRentDetails(startX, cursorY);

    let footY = cursorY + 2;
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(5.2);
    footnotes.forEach((line) => {
      const wrapped = pdf.splitTextToSize(line, contentWidth);
      wrapped.forEach((wrappedLine) => {
        pdf.text(wrappedLine, startX, footY);
        footY += 3.2;
      });
    });
  };

  // Draw all panels (await each one to ensure logo loads)
  for (let index = 0; index < 3; index++) {
    const copy = ['Bank Copy', 'Office Copy', 'Client Copy'][index];
    await drawPanel(copy, index);
  }

  const sanitizedName = (property.propertyName || property.plotNumber || property.srNo || 'rent-property')
    .toString().replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '_');
  outputPDF(pdf, `Rent_Invoice_${sanitizedName || property._id}.pdf`, options);
};

// Generate General Invoice PDF (for custom invoice types, with or without properties)
export const generateGeneralInvoicePDF = async (invoice, propertyParam = null, options = {}) => {
  if (!invoice) return;
  
  // Property is optional for open invoices
  let property = invoice?.property || propertyParam;
  if (property) {
    property = await ensurePropertyWithSize(property, invoice);
  }

  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const panelWidth = pageWidth / 3;
  const marginX = 6;
  const topMargin = 10;
  const contentWidth = panelWidth - 2 * marginX;

  const formatDate = (value, pattern = 'DD-MMM-YY') => value ? dayjs(value).format(pattern) : '—';
  const formatFullDate = (value) => value ? dayjs(value).format('MMMM D, YYYY') : '—';
  const formatMoney = (value) => (Number(value) || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 });

  const periodFromRaw = invoice?.periodFrom || null;
  const periodToRaw = invoice?.periodTo || null;
  const periodFrom = formatDate(periodFromRaw);
  const periodTo = formatDate(periodToRaw);
  const invoiceNumber = invoice?.invoiceNumber || '—';
  const invoicingDate = formatFullDate(invoice?.invoiceDate || invoice?.createdAt);
  const computedDueDate = invoice?.dueDate || (periodToRaw ? dayjs(periodToRaw).add(30, 'day').toDate() : null);
  const dueDate = formatFullDate(computedDueDate);
  const monthLabel = (periodToRaw ? dayjs(periodToRaw) : invoice?.invoiceDate ? dayjs(invoice.invoiceDate) : dayjs()).format('MMM-YY').toUpperCase();

  // Handle invoices with or without properties
  const isOpenInvoice = !property; // Open invoice has no property
  const ownerName = property?.ownerName || invoice?.customerName || '—';
  const propertyAddress = property?.fullAddress || property?.address || invoice?.customerAddress || [property?.plotNumber ? `Plot No ${property.plotNumber}` : '', property?.street].filter(Boolean).join(', ') || '—';
  const propertySector = isOpenInvoice ? (invoice?.sector || '—') : (property?.sector || '—');
  
  // For open invoices, property may be null, so we need to handle that case
  const sourceProperty = property 
    ? ((property.areaValue !== undefined && property.areaValue !== null && property.areaValue !== '') 
      ? property 
      : (invoice?.property?.areaValue !== undefined && invoice?.property?.areaValue !== null && invoice?.property?.areaValue !== '' ? invoice.property : property))
    : (invoice?.property?.areaValue !== undefined && invoice?.property?.areaValue !== null && invoice?.property?.areaValue !== '' ? invoice.property : null);
  
  let propertySize = '—';
  if (sourceProperty) {
    const areaValue = sourceProperty.areaValue;
    const areaUnit = sourceProperty.areaUnit;
    if (areaValue !== undefined && areaValue !== null && areaValue !== '') {
      const valueStr = String(areaValue).trim();
      const unitStr = areaUnit ? String(areaUnit).trim() : '';
      propertySize = valueStr ? `${valueStr}${unitStr ? ' ' + unitStr : ''}`.trim() : '—';
    }
  }

  const charges = invoice.charges || [];
  const subtotal = invoice.subtotal || 0;
  const totalArrears = invoice.totalArrears || 0;
  const grandTotal = invoice.grandTotal || 0;
  const totalPaid = invoice.totalPaid || 0;
  
  // Calculate total charges amount (Charges for the Month)
  const totalChargesAmount = charges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
  
  // Calculate payable amounts
  const payableWithinDue = grandTotal - totalPaid;
  // Late payment surcharge is 10% of "Charges for the Month" (totalChargesAmount), then added to arrears
  const lateSurcharge = Math.max(Math.round(totalChargesAmount * 0.1), 0);
  const payableAfterDue = totalChargesAmount + totalArrears + lateSurcharge - totalPaid;
  
  // Always use "Payable Within Due Date" (no surcharge applied)
  const payableAmount = payableWithinDue;
  
  // Calculate remaining balance: if overdue (after due date ends), use payableAfterDue, otherwise use payableWithinDue
  const invoiceDueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const dueStart = invoiceDueDate ? new Date(invoiceDueDate) : null; if (dueStart) dueStart.setHours(0, 0, 0, 0);
  const isOverdue = dueStart && todayStart > dueStart;
  const isUnpaid =
    invoice.paymentStatus === 'unpaid' ||
    invoice.paymentStatus === 'partial_paid' ||
    (invoice.balance || 0) > 0;
  const balance = (isOverdue && isUnpaid) ? payableAfterDue : payableWithinDue;

  // Get charge type name for invoice title
  const chargeTypeName = invoice.chargeType || 'CHARGES';
  const invoiceTitle = `Invoice of ${chargeTypeName}`;

  // Get resident ID and name (for property-based invoices)
  const residentId = property?.resident?.residentId || property?.residentId || invoice?.customerId || '—';
  const residentName = property?.tenantName || property?.ownerName || invoice?.customerName || '—';

  // Vertical divider lines between panels
  pdf.setDrawColor(170);
  pdf.setLineWidth(0.3);
  if (pdf.setLineDash) pdf.setLineDash([1, 2], 0);
  [panelWidth, panelWidth * 2].forEach((xPos) => {
    pdf.line(xPos, topMargin - 5, xPos, pageHeight - 15);
  });
  if (pdf.setLineDash) pdf.setLineDash([], 0);

  const drawInlineField = (label, value, startX, startY, labelWidth = 34) => {
    const valueWidth = contentWidth - labelWidth;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.text(label, startX, startY);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(String(value || '—'), valueWidth);
    lines.forEach((line, idx) => {
      pdf.text(line, startX + labelWidth, startY + idx * 4.5);
    });
    return startY + lines.length * 4.5 + 1.5;
  };

  const drawChargesDetails = (startX, startY) => {
    const width = contentWidth;
    let y = startY;
    pdf.setFillColor(242, 242, 242);
    pdf.rect(startX, y, width, 7, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(178, 34, 34);
    pdf.text(`${chargeTypeName} DETAILS`, startX + width / 2, y + 4.5, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    y += 13;

    // Calculate total charges amount
    const totalChargesAmount = charges.reduce((sum, charge) => sum + (charge.amount || 0), 0);

    const rows = [
      ['Charges for the Month', formatMoney(totalChargesAmount)],
      ['Arrears', formatMoney(totalArrears)],
      ['Payable', formatMoney(payableAmount)],
      ['Payable After Due Date', formatMoney(payableAfterDue)],
      ['Paid Amount', totalPaid > 0 ? formatMoney(totalPaid) : '-'],
      ['Remaining Balance', formatMoney(balance)]
    ];

    rows.forEach((row, idx) => {
      const isBoldRow = row[0] === 'Payable After Due Date' || row[0] === 'Paid Amount' || row[0] === 'Remaining Balance';
      pdf.setDrawColor(210);
      pdf.rect(startX, y - 5, width, 7);
      pdf.setFont('helvetica', isBoldRow ? 'bold' : 'normal');
      pdf.setFontSize(7);
      pdf.text(row[0], startX + 2, y - 1);
      pdf.setFont('helvetica', 'normal');
      pdf.text(row[1], startX + width - 2, y - 1, { align: 'right' });
      y += 7;
    });
    return y + 2;
  };

  const footnotes = [
    '1. The above-mentioned charges cover security, horticulture, road maintenance, garbage collection, society upkeep, and related services.',
    '2. Please make your cheque/bank draft/cash deposit on our specified deposit slip at any Allied Bank Ltd. branch in Pakistan to Account Title: Taj Residencia, Allied Bank Limited, The Centaurus Mall Branch, Islamabad (0917). Bank Account No.: PK68ABPA0010035700420129.',
    '3. Please deposit your dues before the due date to avoid Late Payment Surcharge.',
    '4. Please share proof of payment to TAJ Official WhatsApp No.: 0345 77 88 442.'
  ];

  const drawPanel = async (copyLabel, columnIndex) => {
    const startX = columnIndex * panelWidth + marginX;
    let cursorY = topMargin - 3; // Move first row up

    // Header row: Copy Label (left) | Taj Residencia (center) | Logo (right)
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(copyLabel, startX, cursorY); // Left: Copy label
    pdf.setFontSize(10);
    pdf.setTextColor(178, 34, 34);
    pdf.text('Taj Residencia', startX + contentWidth / 2, cursorY, { align: 'center' }); // Center: Taj Residencia
    pdf.setTextColor(0, 0, 0);
    
    // Add logo image on the right - bigger and better positioned
    const logoWidth = 20;
    const logoHeight = 20;
    const logoX = startX + contentWidth - logoWidth - 1; // Slight margin from edge
    const logoY = cursorY - 5; // Center vertically with text, accounting for larger size
    await addLogoToPDF(pdf, logoX, logoY, logoWidth, logoHeight);
    
    cursorY += 7; // Increased spacing to accommodate larger logo

    pdf.setFont('helvetica', 'bold'); // Make invoice type bold
    pdf.setFontSize(9); // Reduced from 11 to 9
    pdf.setTextColor(178, 34, 34);
    pdf.text(invoiceTitle, startX + contentWidth / 2, cursorY, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    cursorY += 6;

    // Render "For The Month Of" in normal, then month label in bold
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const monthPrefix = 'For The Month Of ';
    const monthValue = monthLabel;
    const prefixWidth = pdf.getTextWidth(monthPrefix);
    const totalWidth = pdf.getTextWidth(monthPrefix + monthValue);
    const centerX = startX + contentWidth / 2;
    pdf.text(monthPrefix, centerX - totalWidth / 2, cursorY);
    pdf.setFont('helvetica', 'bold'); // Make date/year bold
    pdf.text(monthValue, centerX - totalWidth / 2 + prefixWidth, cursorY);
    cursorY += 6;

    // For open invoices, exclude Resident ID and Size
    const inlineRows = [];
    if (!isOpenInvoice) {
      inlineRows.push(['Resident ID', residentId]);
    }
    inlineRows.push(['Residents Name', residentName]);
    inlineRows.push(['Address', propertyAddress]);
    inlineRows.push(['Sector', propertySector]);
    if (!isOpenInvoice) {
      inlineRows.push(['Size', propertySize]);
    }
    inlineRows.push(['Period From', periodFrom]);
    inlineRows.push(['Period To', periodTo]);
    inlineRows.push(['Invoice No.', invoiceNumber]);
    inlineRows.push(['Invoicing Date', invoicingDate]);
    inlineRows.push(['Due Date', dueDate]);

    inlineRows.forEach(([label, value]) => {
      cursorY = drawInlineField(label, value, startX, cursorY);
    });

    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(6.5);
    pdf.text('(In Rupees)', startX + contentWidth, cursorY, { align: 'right' });
    cursorY += 4;

    cursorY = drawChargesDetails(startX, cursorY);

    let footY = cursorY + 2;
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(5.2);
    footnotes.forEach((line) => {
      const wrapped = pdf.splitTextToSize(line, contentWidth);
      wrapped.forEach((wrappedLine) => {
        pdf.text(wrappedLine, startX, footY);
        footY += 3.2;
      });
    });
  };

  // Draw all panels (await each one to ensure logo loads)
  for (let index = 0; index < 3; index++) {
    const copy = ['Bank Copy', 'Office Copy', 'Client Copy'][index];
    await drawPanel(copy, index);
  }

  const sanitizedName = property 
    ? (property.propertyName || property.plotNumber || property.srNo || 'invoice')
        .toString().replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '_')
    : (invoice.customerName || 'invoice')
        .toString().replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '_');
  outputPDF(pdf, `Invoice_${sanitizedName || invoice._id || 'invoice'}.pdf`, options);
};
