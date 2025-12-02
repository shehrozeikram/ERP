import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Stack,
  MenuItem,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Divider,
  Collapse
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Payment as PaymentIcon,
  ReceiptLong as ReceiptIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AttachFile as AttachFileIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router-dom';
import {
  fetchCAMCharges,
  createCAMCharge,
  updateCAMCharge,
  addPaymentToPropertyCAM,
  deletePaymentFromCAMCharge
} from '../../../services/camChargesService';
import { createInvoice, updateInvoice, fetchInvoicesForProperty, deleteInvoice } from '../../../services/propertyInvoiceService';
import api from '../../../services/api';
import pakistanBanks from '../../../constants/pakistanBanks';

// Number to words converter
const numberToWords = (num) => {
  if (!num || num === 0) return 'Zero Rupees Only';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  const convert = (n) => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  
  const amount = Math.floor(num);
  const paise = Math.round((num - amount) * 100);
  
  let result = convert(amount) + ' Rupees';
  if (paise > 0) {
    result += ' and ' + convert(paise) + ' Paise';
  }
  result += ' Only';
  
  return result;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const defaultForm = {
  invoiceNumber: '',
  plotNo: '',
  rdaNo: '',
  street: '',
  sector: '',
  category: '',
  address: '',
  project: '',
  owner: '',
  contactNo: '',
  status: 'Active',
  fileSubmission: '',
  demarcationDate: '',
  constructionDate: '',
  familyStatus: '',
  arrears: 0,
  amount: 0,
  amountInWords: ''
};

const statusOptions = ['Active', 'Pending', 'Completed', 'Cancelled'];

const months = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
];

const CAMCharges = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingCharge, setViewingCharge] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [editingCharge, setEditingCharge] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  
  // Properties state
  const [properties, setProperties] = useState([]);
  const [currentOverviewLoading, setCurrentOverviewLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  // Payment state
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [paymentContext, setPaymentContext] = useState({ baseCharge: 0, baseArrears: 0 });
  const [selectedPaymentMonth, setSelectedPaymentMonth] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    arrears: 0,
    paymentDate: dayjs().format('YYYY-MM-DD'),
    month: dayjs().format('MM'),
    year: dayjs().format('YYYY'),
    invoiceNumber: '',
    paymentMethod: 'Bank Transfer',
    bankName: '',
    reference: '',
    notes: ''
  });
  const [paymentAttachment, setPaymentAttachment] = useState(null);
  
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceProperty, setInvoiceProperty] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [propertyInvoices, setPropertyInvoices] = useState({});
  const [loadingInvoices, setLoadingInvoices] = useState({});

  const loadCharges = async () => {
    try {
      setLoading(true);
      setError('');
      await fetchCAMCharges({ search });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load CAM Charges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCharges();
    loadProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProperties = async () => {
    try {
      setCurrentOverviewLoading(true);
      const response = await api.get('/taj-utilities/cam-charges/current-overview');
      setProperties(response.data.data?.properties || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
      setError('Failed to load properties');
    } finally {
      setCurrentOverviewLoading(false);
    }
  };

  const toggleRowExpansion = async (propertyId) => {
    const newExpanded = new Set(expandedRows);
    const isExpanding = !newExpanded.has(propertyId);
    
    if (isExpanding) {
      newExpanded.add(propertyId);
      // Fetch invoices when expanding
      if (!propertyInvoices[propertyId]) {
        try {
          setLoadingInvoices(prev => ({ ...prev, [propertyId]: true }));
          const response = await fetchInvoicesForProperty(propertyId);
          setPropertyInvoices(prev => ({ ...prev, [propertyId]: response.data?.data || [] }));
        } catch (err) {
          console.error('Error fetching invoices:', err);
          setPropertyInvoices(prev => ({ ...prev, [propertyId]: [] }));
        } finally {
          setLoadingInvoices(prev => ({ ...prev, [propertyId]: false }));
        }
      }
    } else {
      newExpanded.delete(propertyId);
    }
    setExpandedRows(newExpanded);
  };

  const totalPayments = (payments) => {
    return payments?.reduce((sum, p) => sum + (p.totalAmount || p.amount || 0), 0) || 0;
  };


  const handleCreateInvoice = async (property) => {
    setInvoiceProperty(property);
    setInvoiceData(null);
    setInvoiceError('');
    setInvoiceDialogOpen(true);

    try {
      setInvoiceLoading(true);
      const response = await createInvoice(property._id, {
        includeCAM: true,
        includeElectricity: false,
        includeRent: false
      });
      setInvoiceData(response.data?.data || null);
      if (!response.data?.data) {
        setInvoiceError('Failed to create invoice.');
      }
    } catch (err) {
      setInvoiceError(err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleInvoiceFieldChange = (field, value) => {
    if (!invoiceData) return;
    
    if (field.startsWith('charge.')) {
      const [, chargeIndex, chargeField] = field.split('.');
      const updatedCharges = [...invoiceData.charges];
      updatedCharges[chargeIndex] = {
        ...updatedCharges[chargeIndex],
        [chargeField]: chargeField === 'amount' || chargeField === 'arrears' ? Number(value) || 0 : value
      };
      
      // Recalculate totals - only include CAM charges
      const camCharges = updatedCharges.filter(c => c.type === 'CAM');
      const subtotal = camCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
      const totalArrears = camCharges.reduce((sum, charge) => sum + (charge.arrears || 0), 0);
      const grandTotal = subtotal + totalArrears;
      
      setInvoiceData({
        ...invoiceData,
        charges: updatedCharges,
        subtotal,
        totalArrears,
        grandTotal
      });
    } else {
      setInvoiceData({
        ...invoiceData,
        [field]: field === 'periodFrom' || field === 'periodTo' || field === 'dueDate' || field === 'invoiceDate'
          ? (value ? new Date(value) : null)
          : field === 'grandTotal' || field === 'subtotal' || field === 'totalArrears'
          ? Number(value) || 0
          : value
      });
    }
  };

  const handleSaveInvoice = async () => {
    if (!invoiceData || !invoiceData._id) {
      setInvoiceError('Invoice data is incomplete');
      return;
    }

    try {
      setInvoiceLoading(true);
      setInvoiceError('');
      
      const response = await updateInvoice(invoiceData._id, {
        invoiceNumber: invoiceData.invoiceNumber,
        invoiceDate: invoiceData.invoiceDate,
        dueDate: invoiceData.dueDate,
        periodFrom: invoiceData.periodFrom,
        periodTo: invoiceData.periodTo,
        charges: invoiceData.charges,
        subtotal: invoiceData.subtotal,
        totalArrears: invoiceData.totalArrears,
        grandTotal: invoiceData.grandTotal
      });

      setInvoiceData(response.data?.data || invoiceData);
      setSuccess('Invoice saved successfully');
      
      // Refresh invoices for this property
      if (invoiceProperty?._id) {
        const invoiceResponse = await fetchInvoicesForProperty(invoiceProperty._id);
        setPropertyInvoices(prev => ({ ...prev, [invoiceProperty._id]: invoiceResponse.data?.data || [] }));
      }
      
      // Close dialog after a short delay
      setTimeout(() => {
        handleCloseInvoiceDialog();
      }, 1500);
    } catch (err) {
      setInvoiceError(err.response?.data?.message || 'Failed to save invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleCloseInvoiceDialog = () => {
    setInvoiceDialogOpen(false);
    setInvoiceProperty(null);
    setInvoiceData(null);
    setInvoiceError('');
  };

  const handleDeleteInvoice = async (property, invoice) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber || invoice._id}?`)) {
      return;
    }

    try {
      setError('');
      await deleteInvoice(invoice._id);
      setSuccess('Invoice deleted successfully');
      
      // Refresh invoices for this property
      if (property?._id) {
        const invoiceResponse = await fetchInvoicesForProperty(property._id);
        setPropertyInvoices(prev => ({ ...prev, [property._id]: invoiceResponse.data?.data || [] }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete invoice');
    }
  };

  const generateInvoicePDF = () => {
    if (!invoiceProperty || !invoiceData) return;

    const property = invoiceProperty;
    const invoice = invoiceData;
    
    // Get CAM charge from invoice
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

    const formatDate = (value, pattern = 'DD-MMM-YY') =>
      value ? dayjs(value).format(pattern) : '—';

    const formatFullDate = (value) =>
      value ? dayjs(value).format('MMMM D, YYYY') : '—';

    const formatMoney = (value) =>
      (Number(value) || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 });

    const periodFromRaw = invoice?.periodFrom || null;
    const periodToRaw = invoice?.periodTo || null;

    const periodFrom = formatDate(periodFromRaw);
    const periodTo = formatDate(periodToRaw);
    const invoiceNumber = invoice?.invoiceNumber || '—';
    const invoicingDate = formatFullDate(invoice?.invoiceDate || invoice?.createdAt);
    const computedDueDate = invoice?.dueDate || (periodToRaw ? dayjs(periodToRaw).add(30, 'day').toDate() : null);
    const dueDate = formatFullDate(computedDueDate);
    const monthLabel = (periodToRaw
      ? dayjs(periodToRaw)
      : invoice?.invoiceDate
      ? dayjs(invoice.invoiceDate)
      : dayjs()
    ).format('MMM-YY').toUpperCase();

    const residentName = property.tenantName || property.ownerName || '—';
    const propertyAddress =
      property.address ||
      [property.plotNumber ? `Plot No ${property.plotNumber}` : '', property.street, property.sector]
        .filter(Boolean)
        .join(', ') ||
      '—';
    const propertySize = property.areaValue
      ? `${property.areaValue} ${property.areaUnit || ''}`.trim()
      : '—';

    const payableWithinDue = invoice?.grandTotal || (camAmount + arrears);
    const lateSurcharge = Math.max(Math.round(payableWithinDue * 0.1), 0);
    const payableAfterDue = payableWithinDue + lateSurcharge;

    pdf.setDrawColor(170);
    pdf.setLineWidth(0.3);
    if (pdf.setLineDash) {
      pdf.setLineDash([1, 2], 0);
    }
    [panelWidth, panelWidth * 2].forEach((xPos) => {
      pdf.line(xPos, topMargin - 5, xPos, pageHeight - 15);
    });
    if (pdf.setLineDash) {
      pdf.setLineDash([], 0);
    }

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
      '2. Please make your cheque/bank draft/cash deposit on our specified deposit slip at any Allied Bank Ltd. branch in Pakistan to Account Title: Taj Residencia, Allied Bank Limited, The Centaurus Mall Branch, Islamabad (0317). Bank Account No.: PK58ABPA0015030024702289.',
      '3. Please deposit your dues before the due date to avoid Late Payment Surcharge.',
      '4. Please share proof of payment to TAJ Official WhatsApp No.: 0345 77 88 442.'
    ];

    const drawPanel = (copyLabel, columnIndex) => {
      const startX = columnIndex * panelWidth + marginX;
      let cursorY = topMargin;

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.text(`(${copyLabel})`, startX + contentWidth / 2, cursorY, { align: 'center' });
      cursorY += 5;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(178, 34, 34);
      pdf.text(
        `Taj CAM Charges Invoice For The Month Of ${monthLabel}`,
        startX + contentWidth / 2,
        cursorY,
        { align: 'center' }
      );
      pdf.setTextColor(0, 0, 0);
      cursorY += 6;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text('Statement of CAM Charges', startX + contentWidth / 2, cursorY, { align: 'center' });
      cursorY += 6;

      const inlineRows = [
        ['Residents Name', residentName],
        ['Address', propertyAddress],
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

    const copies = ['Bank Copy', 'Office Copy', 'Client Copy'];
    copies.forEach((copy, index) => drawPanel(copy, index));

    const sanitizedName = (property.propertyName || property.plotNumber || property.srNo || 'cam-property')
      .toString()
      .replace(/[^a-z0-9-_ ]/gi, '')
      .trim()
      .replace(/\s+/g, '_');

    pdf.save(`CAM_Invoice_${sanitizedName || property._id}.pdf`);
  };

  const handleDownloadInvoice = () => {
    if (!invoiceProperty || !invoiceData) return;
    generateInvoicePDF();
  };

  const renderInvoicePreview = () => {
    if (invoiceLoading) {
      return (
        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      );
    }

    if (invoiceError) {
      return <Alert severity="error">{invoiceError}</Alert>;
    }

    if (!invoiceProperty) {
      return <Typography color="text.secondary">Select a property to create invoice.</Typography>;
    }

    if (!invoiceData) {
      return <Typography color="text.secondary">Creating invoice...</Typography>;
    }

    const formatDisplayDate = (value) => (value ? dayjs(value).format('DD MMM YYYY') : '—');
    
    // Calculate total amount from charges + arrears
    const camCharges = invoiceData.charges?.filter(c => c.type === 'CAM') || [];
    const chargesTotal = camCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
    const arrearsTotal = camCharges.reduce((sum, charge) => sum + (charge.arrears || 0), 0);
    const totalAmount = chargesTotal + arrearsTotal;

    return (
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Property
          </Typography>
          <Typography variant="h6">
            {invoiceProperty.propertyName || invoiceProperty.propertyType || '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {invoiceProperty.address || invoiceProperty.street || 'No address recorded'}
          </Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Invoice Number"
              value={invoiceData.invoiceNumber || ''}
              onChange={(e) => handleInvoiceFieldChange('invoiceNumber', e.target.value)}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Period From"
              type="date"
              value={invoiceData.periodFrom ? dayjs(invoiceData.periodFrom).format('YYYY-MM-DD') : ''}
              onChange={(e) => handleInvoiceFieldChange('periodFrom', e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Period To"
              type="date"
              value={invoiceData.periodTo ? dayjs(invoiceData.periodTo).format('YYYY-MM-DD') : ''}
              onChange={(e) => handleInvoiceFieldChange('periodTo', e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          {invoiceData.charges?.filter(charge => charge.type === 'CAM').map((charge, filteredIdx) => {
            const originalIdx = invoiceData.charges.findIndex(c => c === charge);
            return (
              <React.Fragment key={originalIdx}>
          <Grid item xs={12} sm={6}>
                  <TextField
                    label={charge.description}
                    type="number"
                    value={charge.amount || 0}
                    onChange={(e) => handleInvoiceFieldChange(`charge.${originalIdx}.amount`, e.target.value)}
                    fullWidth
                    size="small"
                    InputProps={{
                      startAdornment: <Typography sx={{ mr: 1 }}>PKR</Typography>
                    }}
                  />
          </Grid>
          <Grid item xs={12} sm={6}>
                  <TextField
                    label={`${charge.description} Arrears`}
                    type="number"
                    value={charge.arrears || 0}
                    onChange={(e) => handleInvoiceFieldChange(`charge.${originalIdx}.arrears`, e.target.value)}
                    fullWidth
                    size="small"
                    InputProps={{
                      startAdornment: <Typography sx={{ mr: 1 }}>PKR</Typography>
                    }}
                  />
          </Grid>
              </React.Fragment>
            );
          })}
          <Grid item xs={12} sm={6}>
            <TextField
              label="Total Amount"
              value={formatCurrency(totalAmount)}
              fullWidth
              size="small"
              InputProps={{ readOnly: true }}
              sx={{
                '& .MuiInputBase-input': {
                  fontWeight: 600,
                  fontSize: '1.1rem'
                }
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Due Date"
              type="date"
              value={invoiceData.dueDate ? dayjs(invoiceData.dueDate).format('YYYY-MM-DD') : ''}
              onChange={(e) => handleInvoiceFieldChange('dueDate', e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
        <Alert severity="info">
          Download to view the tri-fold invoice (Bank, Office & Client copies).
        </Alert>
      </Stack>
    );
  };

  const getPaymentStatusConfig = (status) => {
    const normalized = (status || 'unpaid').toLowerCase();
    switch (normalized) {
      case 'paid':
        return { color: 'success', label: 'Paid', iconColor: 'success.main' };
      case 'partial_paid':
        return { color: 'warning', label: 'Partial Paid', iconColor: 'warning.main' };
      case 'unpaid':
      default:
        return { color: 'error', label: 'Unpaid', iconColor: 'error.main' };
    }
  };

  const handleOpenPaymentDialog = (property) => {
    setSelectedProperty(property);
    const baseCharge = Number(property.camAmount || 0);
    const baseArrears = Number(property.camArrears || 0);
    const currentDate = dayjs();
    const currentMonthKey = currentDate.format('YYYY-MM');
    
    setPaymentForm({
      amount: baseCharge > 0 ? baseCharge : '',
      arrears: 0,
      paymentDate: currentDate.format('YYYY-MM-DD'),
      month: currentDate.format('MM'),
      year: currentDate.format('YYYY'),
      invoiceNumber: '',
      paymentMethod: 'Bank Transfer',
      bankName: '',
      reference: '',
      notes: ''
    });
    setPaymentContext({ baseCharge, baseArrears });
    setSelectedPaymentMonth(currentMonthKey);
    setPaymentAttachment(null);
    setPaymentDialog(true);
  };

  const handlePaymentDateChange = (dateValue) => {
    setPaymentForm((prev) => ({ ...prev, paymentDate: dateValue }));
  };

  const handleMonthYearChange = (month, year) => {
    const baseCharge = Number(paymentContext.baseCharge || 0);
    const selectedMonthKey = `${year}-${month}`;
    const monthChanged = selectedMonthKey !== selectedPaymentMonth;

    if (monthChanged) {
      // Auto-populate amount with CAM Amount when month changes
    setPaymentForm((prev) => ({
      ...prev,
        month: month,
        year: year,
        amount: baseCharge > 0 ? baseCharge : '',
        arrears: 0 // Reset arrears when month changes
      }));
      setSelectedPaymentMonth(selectedMonthKey);
    } else {
      setPaymentForm((prev) => ({
        ...prev,
        month: month,
        year: year
      }));
    }
  };

  const handleCamAmountChange = (value) => {
    // Allow empty string to clear the field, otherwise convert to number
    const amountValue = value === '' || value === null || value === undefined 
      ? '' 
      : (Number(value) || 0);
    setPaymentForm((prev) => ({ ...prev, amount: amountValue }));
  };

  const handleCamPaymentMethodChange = (value) => {
    setPaymentForm((prev) => ({
      ...prev,
      paymentMethod: value,
      bankName: value === 'Cash' ? '' : prev.bankName
    }));
  };

  const handleCamAttachmentChange = (event) => {
    const file = event.target.files?.[0];
    setPaymentAttachment(file || null);
  };

  const handleClosePaymentDialog = () => {
    setPaymentDialog(false);
    setPaymentAttachment(null);
  };

  const handlePaymentSave = async () => {
    try {
      setError('');
      if (!selectedProperty) return;

      // Convert month/year to periodFrom/periodTo
      const selectedMonth = paymentForm.month || dayjs().format('MM');
      const selectedYear = paymentForm.year || dayjs().format('YYYY');
      const periodFrom = dayjs(`${selectedYear}-${selectedMonth}-01`).startOf('month').format('YYYY-MM-DD');
      const periodTo = dayjs(`${selectedYear}-${selectedMonth}-01`).endOf('month').format('YYYY-MM-DD');

      const formData = new FormData();
      Object.entries(paymentForm).forEach(([key, value]) => {
        // Skip month and year fields, we'll add periodFrom/periodTo instead
        if (key === 'month' || key === 'year') {
          return;
        }
        // Convert empty string to 0 for amount and arrears fields
        if ((key === 'amount' || key === 'arrears') && (value === '' || value === null || value === undefined)) {
          formData.append(key, 0);
        } else {
          formData.append(key, value ?? '');
        }
      });
      
      // Add periodFrom and periodTo from month/year
      formData.append('periodFrom', periodFrom);
      formData.append('periodTo', periodTo);
      
      if (paymentAttachment) {
        formData.append('attachment', paymentAttachment);
      }

      await addPaymentToPropertyCAM(selectedProperty._id, formData);
      setSuccess('Payment recorded successfully');
      handleClosePaymentDialog();
      loadProperties();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record payment');
    }
  };

  const handleDeletePayment = async (property, payment) => {
    if (!window.confirm('Are you sure you want to delete this payment?')) {
      return;
    }

    try {
      setError('');
      // Find the charge ID from the payment
      const chargeId = payment.chargeId;
      const paymentId = payment._id;

      if (!chargeId || !paymentId) {
        setError('Payment information is incomplete');
        return;
      }

      await deletePaymentFromCAMCharge(chargeId, paymentId);
      setSuccess('Payment deleted successfully');
      loadProperties();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete payment');
    }
  };


  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCharge(null);
    setFormData(defaultForm);
  };


  const handleCloseViewDialog = () => {
    setViewDialogOpen(false);
    setViewingCharge(null);
  };

  const handlePrintBill = () => {
    if (!viewingCharge) return;
    
    const printWindow = window.open('', '_blank');
    const printDate = new Date().toLocaleString();
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>CAM Charge - ${viewingCharge.invoiceNumber || 'N/A'}</title>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              margin: 15px;
              color: #000;
              line-height: 1.5;
              font-size: 14px;
            }
            .header {
              text-align: center;
              border: 3px solid #000;
              padding: 20px;
              margin-bottom: 25px;
              background-color: #f9f9f9;
            }
            .header h1 {
              margin: 0 0 10px 0;
              color: #000;
            }
            .section {
              margin-bottom: 20px;
              border: 1px solid #ddd;
              padding: 15px;
            }
            .section-title {
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 10px;
              border-bottom: 2px solid #000;
              padding-bottom: 5px;
            }
            .field-row {
              display: flex;
              margin-bottom: 8px;
            }
            .field-label {
              font-weight: bold;
              width: 200px;
            }
            .field-value {
              flex: 1;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 10px;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CAM Charge</h1>
            <p><strong>Invoice Number:</strong> ${viewingCharge.invoiceNumber || 'N/A'}</p>
            <p><strong>Serial Number:</strong> ${viewingCharge.serialNumber || 'N/A'}</p>
          </div>

          <div class="section">
            <div class="section-title">Invoice Information</div>
            <div class="field-row">
              <div class="field-label">Invoice Number:</div>
              <div class="field-value">${viewingCharge.invoiceNumber || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Serial Number:</div>
              <div class="field-value">${viewingCharge.serialNumber || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Status:</div>
              <div class="field-value">${viewingCharge.status || 'Active'}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Property Information</div>
            <div class="field-row">
              <div class="field-label">Plot No:</div>
              <div class="field-value">${viewingCharge.plotNo || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">RDA No:</div>
              <div class="field-value">${viewingCharge.rdaNo || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Street:</div>
              <div class="field-value">${viewingCharge.street || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Sector:</div>
              <div class="field-value">${viewingCharge.sector || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Category:</div>
              <div class="field-value">${viewingCharge.category || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Project:</div>
              <div class="field-value">${viewingCharge.project || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Address:</div>
              <div class="field-value">${viewingCharge.address || 'N/A'}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Owner Information</div>
            <div class="field-row">
              <div class="field-label">Owner:</div>
              <div class="field-value">${viewingCharge.owner || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Contact Number:</div>
              <div class="field-value">${viewingCharge.contactNo || 'N/A'}</div>
            </div>
            ${viewingCharge.familyStatus ? `
            <div class="field-row">
              <div class="field-label">Family Status:</div>
              <div class="field-value">${viewingCharge.familyStatus}</div>
            </div>
            ` : ''}
          </div>

          <div class="section">
            <div class="section-title">Financial Details</div>
            <div class="field-row">
              <div class="field-label">Amount:</div>
              <div class="field-value"><strong>${formatCurrency(viewingCharge.amount || 0)}</strong></div>
            </div>
            <div class="field-row">
              <div class="field-label">Arrears:</div>
              <div class="field-value">${formatCurrency(viewingCharge.arrears || 0)}</div>
            </div>
            ${viewingCharge.amountInWords ? `
            <div class="field-row">
              <div class="field-label">Amount in Words:</div>
              <div class="field-value">${viewingCharge.amountInWords}</div>
            </div>
            ` : ''}
          </div>

          ${(viewingCharge.fileSubmission || viewingCharge.demarcationDate || viewingCharge.constructionDate) ? `
          <div class="section">
            <div class="section-title">Important Dates</div>
            ${viewingCharge.fileSubmission ? `
            <div class="field-row">
              <div class="field-label">File Submission:</div>
              <div class="field-value">${dayjs(viewingCharge.fileSubmission).format('DD-MMM-YYYY')}</div>
            </div>
            ` : ''}
            ${viewingCharge.demarcationDate ? `
            <div class="field-row">
              <div class="field-label">Demarcation Date:</div>
              <div class="field-value">${dayjs(viewingCharge.demarcationDate).format('DD-MMM-YYYY')}</div>
            </div>
            ` : ''}
            ${viewingCharge.constructionDate ? `
            <div class="field-row">
              <div class="field-label">Construction Date:</div>
              <div class="field-value">${dayjs(viewingCharge.constructionDate).format('DD-MMM-YYYY')}</div>
            </div>
            ` : ''}
          </div>
          ` : ''}

          <div class="footer">
            <p><strong>Generated from SGC ERP System - Taj Utilities CAM Charges</strong></p>
            <p>Charge ID: ${viewingCharge._id || 'N/A'} | Printed: ${printDate}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  const handleDownloadPDF = () => {
    if (!viewingCharge) return;

    const pdf = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const leftMargin = margin;
    const rightMargin = pageWidth - margin;
    let yPos = margin;

    // Helper function to add new page if needed
    const checkNewPage = (requiredSpace) => {
      if (yPos + requiredSpace > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    // Header
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TAJ RESIDENCIA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    pdf.setFontSize(16);
    pdf.text('CAM Charge', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Invoice Information
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Invoice Information', leftMargin, yPos);
    yPos += 6;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Invoice Number:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(viewingCharge.invoiceNumber || 'N/A'), leftMargin + 40, yPos);
    yPos += 5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.text('Serial Number:', leftMargin, yPos);
    pdf.text(String(viewingCharge.serialNumber || 'N/A'), leftMargin + 40, yPos);
    pdf.text('Status:', rightMargin - 30, yPos, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(viewingCharge.status || 'Active'), rightMargin, yPos, { align: 'right' });
    yPos += 8;

    // Property Information
    checkNewPage(30);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Property Information', leftMargin, yPos);
    yPos += 6;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Plot No:', leftMargin, yPos);
    pdf.text(String(viewingCharge.plotNo || 'N/A'), leftMargin + 30, yPos);
    pdf.text('RDA No:', rightMargin - 30, yPos, { align: 'right' });
    pdf.text(String(viewingCharge.rdaNo || 'N/A'), rightMargin, yPos, { align: 'right' });
    yPos += 5;
    
    pdf.text('Street:', leftMargin, yPos);
    pdf.text(String(viewingCharge.street || 'N/A'), leftMargin + 30, yPos);
    pdf.text('Sector:', rightMargin - 30, yPos, { align: 'right' });
    pdf.text(String(viewingCharge.sector || 'N/A'), rightMargin, yPos, { align: 'right' });
    yPos += 5;
    
    pdf.text('Category:', leftMargin, yPos);
    pdf.text(String(viewingCharge.category || 'N/A'), leftMargin + 30, yPos);
    pdf.text('Project:', rightMargin - 30, yPos, { align: 'right' });
    pdf.text(String(viewingCharge.project || 'N/A'), rightMargin, yPos, { align: 'right' });
    yPos += 5;
    
    pdf.text('Address:', leftMargin, yPos);
    const addressLines = pdf.splitTextToSize(String(viewingCharge.address || 'N/A'), pageWidth - 2 * margin - 30);
    pdf.text(String(addressLines[0]), leftMargin + 30, yPos);
    if (addressLines.length > 1) {
      yPos += 5;
      pdf.text(String(addressLines[1]), leftMargin + 30, yPos);
    }
    yPos += 8;

    // Owner Information
    checkNewPage(20);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Owner Information', leftMargin, yPos);
    yPos += 6;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Owner:', leftMargin, yPos);
    pdf.text(String(viewingCharge.owner || 'N/A'), leftMargin + 25, yPos);
    yPos += 5;
    
    pdf.text('Contact Number:', leftMargin, yPos);
    pdf.text(String(viewingCharge.contactNo || 'N/A'), leftMargin + 40, yPos);
    yPos += 5;
    
    if (viewingCharge.familyStatus) {
      pdf.text('Family Status:', leftMargin, yPos);
      pdf.text(String(viewingCharge.familyStatus), leftMargin + 35, yPos);
      yPos += 5;
    }
    yPos += 5;

    // Financial Details
    checkNewPage(25);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Financial Details', leftMargin, yPos);
    yPos += 6;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Amount:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(formatCurrency(viewingCharge.amount || 0)), rightMargin, yPos, { align: 'right' });
    yPos += 5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.text('Arrears:', leftMargin, yPos);
    pdf.text(String(formatCurrency(viewingCharge.arrears || 0)), rightMargin, yPos, { align: 'right' });
    yPos += 5;
    
    if (viewingCharge.amountInWords) {
      pdf.text('Amount in Words:', leftMargin, yPos);
      const words = pdf.splitTextToSize(String(viewingCharge.amountInWords), pageWidth - 2 * margin - 40);
      pdf.text(String(words[0]), leftMargin + 40, yPos);
      yPos += 5;
      if (words.length > 1) {
        pdf.text(String(words[1]), leftMargin + 40, yPos);
        yPos += 5;
      }
    }
    yPos += 5;

    // Important Dates
    if (viewingCharge.fileSubmission || viewingCharge.demarcationDate || viewingCharge.constructionDate) {
      checkNewPage(20);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Important Dates', leftMargin, yPos);
      yPos += 6;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      if (viewingCharge.fileSubmission) {
        pdf.text('File Submission:', leftMargin, yPos);
        pdf.text(dayjs(viewingCharge.fileSubmission).format('DD-MMM-YYYY'), leftMargin + 40, yPos);
        yPos += 5;
      }
      
      if (viewingCharge.demarcationDate) {
        pdf.text('Demarcation Date:', leftMargin, yPos);
        pdf.text(dayjs(viewingCharge.demarcationDate).format('DD-MMM-YYYY'), leftMargin + 40, yPos);
        yPos += 5;
      }
      
      if (viewingCharge.constructionDate) {
        pdf.text('Construction Date:', leftMargin, yPos);
        pdf.text(dayjs(viewingCharge.constructionDate).format('DD-MMM-YYYY'), leftMargin + 40, yPos);
        yPos += 5;
      }
    }

    // Footer
    yPos = pageHeight - 15;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Generated from SGC ERP System - Taj Utilities CAM Charges', pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    pdf.text(`Charge ID: ${viewingCharge._id || 'N/A'} | Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });

    pdf.save(`CAM-Charge-${viewingCharge.invoiceNumber || 'INV'}.pdf`);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    let updatedForm = { ...formData, [name]: value };
    
    // Auto-generate amount in words when amount changes
    if (name === 'amount') {
      const amountValue = Number(value) || 0;
      updatedForm.amountInWords = numberToWords(amountValue);
    }
    
    setFormData(updatedForm);
  };

  const handleSaveCharge = async () => {
    try {
      setError('');
      const payload = {
        ...formData,
        amount: Number(formData.amount) || 0,
        arrears: Number(formData.arrears) || 0,
        fileSubmission: formData.fileSubmission || undefined,
        demarcationDate: formData.demarcationDate || undefined,
        constructionDate: formData.constructionDate || undefined
      };

      if (editingCharge) {
        await updateCAMCharge(editingCharge._id, payload);
        setSuccess('CAM Charge updated successfully');
      } else {
        await createCAMCharge(payload);
        setSuccess('CAM Charge created successfully');
      }
      handleCloseDialog();
      loadCharges();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save CAM Charge');
    }
  };


  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Taj Utilities — CAM Charges
          </Typography>
          <Typography color="text.secondary">
            Manage Common Area Maintenance charges for properties.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="Search charges"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Tooltip title="Refresh">
            <IconButton onClick={loadCharges} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={50}></TableCell>
                  <TableCell>Sr. No</TableCell>
                  <TableCell>Property</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Payment Status</TableCell>
                  <TableCell align="right">CAM Amount</TableCell>
                  <TableCell align="right">Arrears</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentOverviewLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : properties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">No properties found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  properties.map((property) => {
                    return (
                    <React.Fragment key={property._id}>
                      <TableRow hover>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => toggleRowExpansion(property._id)}
                          >
                            {expandedRows.has(property._id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>{property.srNo || '—'}</TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="subtitle2" fontWeight={600}>
                              {property.propertyName || property.propertyType || '—'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {property.plotNumber || '—'} / {property.rdaNumber || '—'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{property.address || '—'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {property.street || '—'} • Sector {property.sector || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{property.ownerName || '—'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {property.contactNumber || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={property.status || 'Pending'}
                            size="small"
                            color={
                              property.status === 'Active' || property.status === 'active' ? 'success' :
                              property.status === 'Pending' || property.status === 'pending' ? 'warning' :
                              property.status === 'Completed' || property.status === 'completed' ? 'info' : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const { color, label } = getPaymentStatusConfig(property.paymentStatus || 'unpaid');
                            return (
                              <Chip
                                label={label}
                                color={color}
                                size="small"
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={600}>
                            {formatCurrency(property.camAmount || 0)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={600} color={property.camArrears > 0 ? 'error.main' : 'text.primary'}>
                            {formatCurrency(property.camArrears || 0)}
                            </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => navigate(`/finance/taj-utilities-charges/taj-properties/${property._id}`)}
                              >
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Create Invoice">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleCreateInvoice(property)}
                              >
                                <ReceiptIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Add Payment">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenPaymentDialog(property)}
                              >
                                <PaymentIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                      <TableCell colSpan={10} sx={{ py: 0, border: 0 }}>
                          <Collapse in={expandedRows.has(property._id)} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 2, px: 3 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Invoice History
                              </Typography>
                              {loadingInvoices[property._id] ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                  <CircularProgress size={20} />
                                </Box>
                              ) : propertyInvoices[property._id] && propertyInvoices[property._id].length > 0 ? (
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Invoice #</TableCell>
                                      <TableCell>Date</TableCell>
                                      <TableCell>Period</TableCell>
                                      <TableCell>Due Date</TableCell>
                                      <TableCell align="right">Amount</TableCell>
                                      <TableCell>Status</TableCell>
                                      <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {propertyInvoices[property._id]
                                      .filter(inv => inv.chargeTypes?.includes('CAM'))
                                      .map((invoice) => (
                                      <TableRow key={invoice._id}>
                                        <TableCell>{invoice.invoiceNumber || 'N/A'}</TableCell>
                                        <TableCell>
                                          {invoice.invoiceDate ? dayjs(invoice.invoiceDate).format('MMM D, YYYY') : 'N/A'}
                                        </TableCell>
                                        <TableCell>
                                          {invoice.periodFrom && invoice.periodTo ? (
                                            `${dayjs(invoice.periodFrom).format('MMM D')} - ${dayjs(invoice.periodTo).format('MMM D, YYYY')}`
                                          ) : (
                                            'N/A'
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {invoice.dueDate ? dayjs(invoice.dueDate).format('MMM D, YYYY') : 'N/A'}
                                        </TableCell>
                                        <TableCell align="right">{formatCurrency(invoice.grandTotal || 0)}</TableCell>
                        <TableCell>
                          {(() => {
                                            const { color, label } = getPaymentStatusConfig(invoice.paymentStatus || 'unpaid');
                            return (
                              <Chip
                                label={label}
                                color={color}
                                size="small"
                              />
                            );
                          })()}
                        </TableCell>
                                        <TableCell align="right">
                                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                                            <Tooltip title="View Invoice">
                                              <IconButton
                                                size="small"
                                                color="primary"
                                                onClick={() => {
                                                  setInvoiceProperty(property);
                                                  setInvoiceData(invoice);
                                                  setInvoiceDialogOpen(true);
                                                }}
                                              >
                                                <ViewIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Download Invoice">
                                              <IconButton
                                                size="small"
                                                color="primary"
                                                onClick={() => {
                                                  setInvoiceProperty(property);
                                                  setInvoiceData(invoice);
                                                  setTimeout(() => {
                                                    generateInvoicePDF();
                                                  }, 100);
                                                }}
                                              >
                                                <DownloadIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete Invoice">
                                              <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => handleDeleteInvoice(property, invoice)}
                                              >
                                                <DeleteIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                          </Stack>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No invoices found. Create an invoice using the "Create Invoice" button.
                                </Typography>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={invoiceDialogOpen} onClose={handleCloseInvoiceDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Invoice Preview</DialogTitle>
        <DialogContent dividers>{renderInvoicePreview()}</DialogContent>
        <DialogActions>
          <Button onClick={handleCloseInvoiceDialog}>Close</Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadInvoice}
            disabled={invoiceLoading || !invoiceData}
          >
            Download
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveInvoice}
            disabled={invoiceLoading || !invoiceData || !invoiceData._id}
          >
            {invoiceLoading ? 'Saving...' : 'Save Invoice'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <DialogTitle>
          {editingCharge ? 'Update CAM Charge' : 'New CAM Charge'}
          <IconButton
            onClick={handleCloseDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Invoice Number"
                name="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={handleInputChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Plot No"
                name="plotNo"
                value={formData.plotNo}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="RDA No"
                name="rdaNo"
                value={formData.rdaNo}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Street"
                name="street"
                value={formData.street}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Sector"
                name="sector"
                value={formData.sector}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                fullWidth
                required
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Project"
                name="project"
                value={formData.project}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Owner"
                name="owner"
                value={formData.owner}
                onChange={handleInputChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Contact No"
                name="contactNo"
                value={formData.contactNo}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  label="Status"
                >
                  {statusOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="File Submission"
                type="date"
                name="fileSubmission"
                value={formData.fileSubmission}
                onChange={handleInputChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Demarcation Date"
                type="date"
                name="demarcationDate"
                value={formData.demarcationDate}
                onChange={handleInputChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Construction Date"
                type="date"
                name="constructionDate"
                value={formData.constructionDate}
                onChange={handleInputChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Family Status"
                name="familyStatus"
                value={formData.familyStatus}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Arrears (PKR)"
                type="number"
                name="arrears"
                value={formData.arrears}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Amount (PKR)"
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Amount in Words"
                name="amountInWords"
                value={formData.amountInWords}
                fullWidth
                multiline
                rows={2}
                InputProps={{
                  readOnly: true
                }}
                helperText="Auto-generated from amount"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveCharge}>
            {editingCharge ? 'Update' : 'Create'} Charge
          </Button>
        </DialogActions>
      </Dialog>


      {/* View CAM Charge Details Dialog */}
      <Dialog open={viewDialogOpen} onClose={handleCloseViewDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">CAM Charge Details</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrintBill}
                disabled={!viewingCharge}
              >
                Print
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadPDF}
                disabled={!viewingCharge}
              >
                Download PDF
              </Button>
              <IconButton onClick={handleCloseViewDialog} size="small">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {viewingCharge ? (
            <Grid container spacing={3}>
              {/* Invoice Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                  Invoice Information
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Invoice Number</Typography>
                <Typography variant="body1" fontWeight={600}>{viewingCharge.invoiceNumber || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Serial Number</Typography>
                <Typography variant="body1">{viewingCharge.serialNumber || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                <Chip 
                  label={viewingCharge.status || 'Active'} 
                  color={viewingCharge.status === 'Active' ? 'success' : viewingCharge.status === 'Pending' ? 'warning' : 'default'}
                  size="small"
                />
              </Grid>

              {/* Property Information */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                  Property Information
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Plot No</Typography>
                <Typography variant="body1">{viewingCharge.plotNo || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">RDA No</Typography>
                <Typography variant="body1">{viewingCharge.rdaNo || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Street</Typography>
                <Typography variant="body1">{viewingCharge.street || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Sector</Typography>
                <Typography variant="body1">{viewingCharge.sector || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Category</Typography>
                <Typography variant="body1">{viewingCharge.category || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Project</Typography>
                <Typography variant="body1">{viewingCharge.project || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Address</Typography>
                <Typography variant="body1">{viewingCharge.address || 'N/A'}</Typography>
              </Grid>

              {/* Owner Information */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                  Owner Information
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Owner</Typography>
                <Typography variant="body1" fontWeight={600}>{viewingCharge.owner || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Contact Number</Typography>
                <Typography variant="body1">{viewingCharge.contactNo || 'N/A'}</Typography>
              </Grid>
              {viewingCharge.familyStatus && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Family Status</Typography>
                  <Typography variant="body1">{viewingCharge.familyStatus}</Typography>
                </Grid>
              )}

              {/* Financial Details */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                  Financial Details
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Amount</Typography>
                <Typography variant="body1" fontWeight={600} fontSize="1.2rem" color="primary.main">
                  {formatCurrency(viewingCharge.amount || 0)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Arrears</Typography>
                <Typography variant="body1" color={viewingCharge.arrears > 0 ? 'error.main' : 'text.secondary'}>
                  {formatCurrency(viewingCharge.arrears || 0)}
                </Typography>
              </Grid>
              {viewingCharge.amountInWords && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Amount in Words</Typography>
                  <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
                    {viewingCharge.amountInWords}
                  </Typography>
                </Grid>
              )}

              {/* Important Dates */}
              {(viewingCharge.fileSubmission || viewingCharge.demarcationDate || viewingCharge.constructionDate) && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                      Important Dates
                    </Typography>
                  </Grid>
                  {viewingCharge.fileSubmission && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">File Submission</Typography>
                      <Typography variant="body1">
                        {dayjs(viewingCharge.fileSubmission).format('DD-MMM-YYYY')}
                      </Typography>
                    </Grid>
                  )}
                  {viewingCharge.demarcationDate && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Demarcation Date</Typography>
                      <Typography variant="body1">
                        {dayjs(viewingCharge.demarcationDate).format('DD-MMM-YYYY')}
                      </Typography>
                    </Grid>
                  )}
                  {viewingCharge.constructionDate && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Construction Date</Typography>
                      <Typography variant="body1">
                        {dayjs(viewingCharge.constructionDate).format('DD-MMM-YYYY')}
                      </Typography>
                    </Grid>
                  )}
                </>
              )}
            </Grid>
          ) : (
            <Alert severity="info">No charge data available</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseViewDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onClose={handleClosePaymentDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Record Payment
          <IconButton
            onClick={handleClosePaymentDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Property: {selectedProperty?.propertyName || selectedProperty?.plotNumber} ({selectedProperty?.srNo || 'N/A'})
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Amount (PKR)"
                type="number"
                fullWidth
                value={paymentForm.amount || ''}
                onChange={(e) => handleCamAmountChange(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Arrears (PKR)"
                type="number"
                fullWidth
                value={paymentForm.arrears}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, arrears: Number(e.target.value) }))}
                helperText="Outstanding amount from previous periods"
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ 
                p: 2, 
                borderRadius: 1, 
                backgroundColor: '#f5f5f5',
                borderLeft: '3px solid #1976d2'
              }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Payment Amount
                </Typography>
                <Typography variant="h6" fontWeight={600} color="primary">
                  {formatCurrency((paymentForm.amount || 0) + (paymentForm.arrears || 0))}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Payment Date"
                type="date"
                fullWidth
                value={paymentForm.paymentDate}
                onChange={(e) => handlePaymentDateChange(e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  value={paymentForm.month}
                  label="Month"
                  onChange={(e) => handleMonthYearChange(e.target.value, paymentForm.year)}
                >
                  {months.map((month) => (
                    <MenuItem key={month.value} value={month.value}>
                      {month.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Year</InputLabel>
                <Select
                  value={paymentForm.year}
                  label="Year"
                  onChange={(e) => handleMonthYearChange(paymentForm.month, e.target.value)}
                >
                  {(() => {
                    const currentYear = dayjs().year();
                    const years = [];
                    // Generate years from 2020 to 10 years in the future
                    for (let year = 2020; year <= currentYear + 10; year++) {
                      years.push(year);
                    }
                    return years.map((year) => (
                      <MenuItem key={year} value={year.toString()}>
                        {year}
                      </MenuItem>
                    ));
                  })()}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Invoice Number"
                fullWidth
                value={paymentForm.invoiceNumber}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => handleCamPaymentMethodChange(e.target.value)}
                  label="Payment Method"
                >
                  <MenuItem value="Cash">Cash</MenuItem>
                  <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                  <MenuItem value="Cheque">Cheque</MenuItem>
                  <MenuItem value="Online">Online</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {paymentForm.paymentMethod !== 'Cash' && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Receiving Bank</InputLabel>
                  <Select
                    value={paymentForm.bankName}
                    label="Receiving Bank"
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, bankName: e.target.value }))}
                  >
                    {pakistanBanks.map((bank) => (
                      <MenuItem key={bank} value={bank}>
                        {bank}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<AttachFileIcon />}
                sx={{ mr: 2 }}
              >
                {paymentAttachment ? 'Change Attachment' : 'Attach Receipt'}
                <input type="file" hidden accept="image/*,.pdf" onChange={handleCamAttachmentChange} />
              </Button>
              {paymentAttachment && (
                <>
                  <Typography variant="caption" sx={{ mr: 2 }}>
                    {paymentAttachment.name}
                  </Typography>
                  <Button size="small" onClick={() => setPaymentAttachment(null)}>
                    Remove
                  </Button>
                </>
              )}
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Reference/Transaction ID"
                fullWidth
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                fullWidth
                multiline
                rows={3}
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePaymentDialog}>Cancel</Button>
          <Button variant="contained" onClick={handlePaymentSave}>
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CAMCharges;

