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

// Generate Electricity Invoice PDF
export const generateElectricityInvoicePDF = async (invoice, propertyParam = null) => {
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
  const arrears = calcData.previousArrears !== undefined ? calcData.previousArrears : (electricityCharge?.arrears !== undefined ? electricityCharge.arrears : (electricityBill.arrears || 0));
  const amountReceived = electricityBill.receivedAmount || 0;
  const payableWithinDueDate = totalBill + arrears - amountReceived;
  const latePaymentSurcharge = Math.max(Math.round(payableWithinDueDate * 0.1), 0);
  const payableAfterDueDate = payableWithinDueDate + latePaymentSurcharge;

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
    const fixedCharges = charges.fixedCharges !== undefined ? charges.fixedCharges : (calcData.slab?.fixRate !== undefined ? calcData.slab.fixRate : (electricityBill.fixedCharges || 0));
    
    const rows = [
      { label: 'Unit price', value: formatRate(unitRate) },
      { label: 'Share of IESCO Supply Cost Rate', value: formatAmount(electricityCost) },
      { label: 'FC Surcharge', value: formatAmount(fcSurcharge) },
      { label: 'Sales Tax', value: formatAmount(gst) },
      { label: 'Electricity Duty', value: formatAmount(electricityDuty) },
      { label: 'Fixed Charges', value: formatAmount(fixedCharges) },
      { label: 'Charges for the Month', value: formatAmount(totalBill) },
      { label: 'Payable Within Due Date', value: formatAmount(payableWithinDueDate) },
      { label: 'Late Payment Surcharge', value: formatAmount(latePaymentSurcharge) },
      { label: 'Payable After Due Date', value: formatAmount(payableAfterDueDate) }
    ];

    const rowHeight = 6;
    const availableWidth = panelWidth - marginX * 2;
    pdf.setFontSize(7);
    rows.forEach((row, idx) => {
      const y = startY + idx * rowHeight;
      pdf.setFont('helvetica', idx >= rows.length - 2 ? 'bold' : 'normal');
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
      ['Account No.', 'PK68ABPA0010035700420129'],
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
  pdf.save(`Electricity_Invoice_${sanitizedName || property._id}.pdf`);
};

// Generate CAM Invoice PDF
export const generateCAMInvoicePDF = async (invoice, propertyParam = null) => {
  let property = invoice?.property || propertyParam;
  
  if (!property || !invoice) return;
  
  property = await ensurePropertyWithSize(property, invoice);
  if (!property) return;
  
  const camCharge = invoice.charges?.find(c => c.type === 'CAM');
  const camAmount = camCharge?.amount || 0;
  const arrears = camCharge?.arrears || 0;

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

  const payableWithinDue = invoice?.grandTotal || (camAmount + arrears);
  const lateSurcharge = Math.max(Math.round(payableWithinDue * 0.1), 0);
  const payableAfterDue = payableWithinDue + lateSurcharge;

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
      ['Arrears', invoice.totalArrears ? formatMoney(invoice.totalArrears) : '-'],
      ['Payable Within Due Date', formatMoney(payableWithinDue)],
      ['Payable After Due Date', formatMoney(payableAfterDue)]
    ];

    rows.forEach((row) => {
      pdf.setDrawColor(210);
      pdf.rect(startX, y - 5, width, 7);
      pdf.setFont('helvetica', 'bold');
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
      ['Account No.', 'PK68ABPA0010035700420129'],
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
  pdf.save(`CAM_Invoice_${sanitizedName || property._id}.pdf`);
};

// Generate Rent Invoice PDF
export const generateRentInvoicePDF = async (invoice, propertyParam = null) => {
  let property = invoice?.property || propertyParam;
  
  if (!property || !invoice) return;
  
  property = await ensurePropertyWithSize(property, invoice);
  if (!property) return;
  
  const rentCharge = invoice.charges?.find(c => c.type === 'RENT');
  const rentAmount = rentCharge?.amount || 0;
  const arrears = rentCharge?.arrears || 0;

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

  const payableWithinDue = invoice?.grandTotal || (rentAmount + arrears);
  const lateSurcharge = Math.max(Math.round(payableWithinDue * 0.1), 0);
  const payableAfterDue = payableWithinDue + lateSurcharge;

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
      ['Arrears', arrears ? formatMoney(arrears) : '-'],
      ['Payable Within Due Date', formatMoney(payableWithinDue)],
      ['Payable After Due Date', formatMoney(payableAfterDue)]
    ];

    rows.forEach((row) => {
      pdf.setDrawColor(210);
      pdf.rect(startX, y - 5, width, 7);
      pdf.setFont('helvetica', 'bold');
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
      ['Account No.', 'PK68ABPA0010035700420129'],
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
  pdf.save(`Rent_Invoice_${sanitizedName || property._id}.pdf`);
};
