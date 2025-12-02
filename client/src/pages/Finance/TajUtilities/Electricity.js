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
  Collapse
} from '@mui/material';
import {
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
  fetchElectricity,
  createElectricity,
  updateElectricity,
  addPaymentToPropertyElectricity
} from '../../../services/electricityService';
import { createInvoice, updateInvoice, fetchInvoicesForProperty, getElectricityCalculation } from '../../../services/propertyInvoiceService';
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

// Generate invoice number with type prefix (same logic as backend)
const generateInvoiceNumber = (propertySrNo, year, month, type = 'ELC') => {
  const paddedMonth = String(month).padStart(2, '0');
  const paddedIndex = String(propertySrNo || 1).padStart(4, '0');
  
  // Determine prefix based on type
  let prefix = 'INV';
  if (type === 'CAM' || type === 'CMC') {
    prefix = 'INV-CMC';
  } else if (type === 'ELECTRICITY' || type === 'ELC') {
    prefix = 'INV-ELC';
  } else if (type === 'RENT' || type === 'REN') {
    prefix = 'INV-REN';
  } else if (type === 'MIXED' || type === 'MIX') {
    prefix = 'INV-MIX';
  }
  
  return `${prefix}-${year}-${paddedMonth}-${paddedIndex}`;
};

const formatUnitPrice = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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


const Electricity = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const [editingCharge, setEditingCharge] = useState(null);
  const [viewingCharge, setViewingCharge] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
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
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    arrears: 0,
    paymentDate: dayjs().format('YYYY-MM-DD'),
    periodFrom: dayjs().format('YYYY-MM-DD'),
    periodTo: dayjs().format('YYYY-MM-DD'),
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
  const [readingData, setReadingData] = useState({ previousReading: 0, previousArrears: 0, meterNo: '' });
  const [currentReading, setCurrentReading] = useState('');
  const [pendingReading, setPendingReading] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const loadCharges = async () => {
    try {
      setLoading(true);
      setError('');
      await fetchElectricity({ search });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load Electricity Bills');
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
      const response = await api.get('/taj-utilities/electricity/current-overview');
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
    setInvoiceError('');
    setCurrentReading('');
    setInvoiceDialogOpen(true);
    
    try {
      setInvoiceLoading(true);
      // Fetch previous reading
      const readingResponse = await getElectricityCalculation(property._id);
      const prevReading = readingResponse.data?.data?.previousReading || 0;
      const prevArrears = readingResponse.data?.data?.previousArrears || 0;
      // Get meter number from response or property
      const meterNo = readingResponse.data?.data?.meterNo || property.meterNumber || property.electricityWaterMeterNo || '';
      
      setReadingData({
        previousReading: prevReading,
        previousArrears: prevArrears,
        meterNo
      });
      
      // Initialize invoice data with default values
      const now = dayjs();
      const periodFrom = now.startOf('month').toDate();
      const periodTo = now.endOf('month').toDate();
      
      // Generate invoice number for Electricity
      const invoiceNumber = generateInvoiceNumber(
        property.srNo,
        now.year(),
        now.month() + 1,
        'ELECTRICITY'
      );
      
      setInvoiceData({
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate: dayjs(periodTo).add(30, 'day').toDate(),
        periodFrom,
        periodTo,
        chargeTypes: ['ELECTRICITY'],
        charges: [{
          type: 'ELECTRICITY',
          description: 'Electricity Bill',
          amount: 0,
          arrears: prevArrears,
          total: prevArrears
        }],
        subtotal: 0,
        totalArrears: prevArrears,
        grandTotal: prevArrears,
        calculationData: null
      });
    } catch (err) {
      console.error('Error fetching reading data:', err);
      // Get meter number from property as fallback
      const meterNo = property.meterNumber || property.electricityWaterMeterNo || '';
      setReadingData({ previousReading: 0, previousArrears: 0, meterNo });
      // Still initialize with defaults
      const now = dayjs();
      // Generate invoice number for Electricity
      const invoiceNumber = generateInvoiceNumber(
        property.srNo,
        now.year(),
        now.month() + 1,
        'ELECTRICITY'
      );
      
      setInvoiceData({
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate: now.add(30, 'day').toDate(),
        periodFrom: now.startOf('month').toDate(),
        periodTo: now.endOf('month').toDate(),
        chargeTypes: ['ELECTRICITY'],
        charges: [{
          type: 'ELECTRICITY',
          description: 'Electricity Bill',
          amount: 0,
          arrears: 0,
          total: 0
        }],
        subtotal: 0,
        totalArrears: 0,
        grandTotal: 0,
        calculationData: null
      });
    } finally {
      setInvoiceLoading(false);
    }
  };

  // Handle current reading input change (immediate update)
  const handleCurrentReadingChange = (value) => {
    setCurrentReading(value);
    
    // Validate and set pending reading for debounced calculation
    const trimmedValue = value?.trim() || '';
    if (!trimmedValue) {
      setPendingReading(null);
      // Clear calculation data if input is cleared
      if (invoiceData?.calculationData) {
        setInvoiceData(prev => prev ? { ...prev, calculationData: null } : null);
      }
      return;
    }
    
    const reading = parseFloat(trimmedValue);
    
    // Validate reading
    if (isNaN(reading) || reading < 0) {
      setPendingReading(null);
      return;
    }
    
    if (reading < readingData.previousReading) {
      setPendingReading(null);
      if (invoiceData?.calculationData) {
        setInvoiceData(prev => prev ? { ...prev, calculationData: null } : null);
      }
      return;
    }
    
    // Set pending reading for debounced calculation
    setPendingReading(reading);
  };

  // Debounced calculation effect
  useEffect(() => {
    // Don't calculate if no pending reading or missing dependencies
    if (pendingReading === null || !invoiceProperty?._id) {
      return;
    }

    // Debounce timer
    const timeoutId = setTimeout(async () => {
      try {
        setCalculating(true);
        setInvoiceError('');
        
        const response = await getElectricityCalculation(invoiceProperty._id, pendingReading);
        
        if (!response.data?.success) {
          throw new Error('Calculation failed');
        }
        
        const calcData = response.data.data;
        
        // Update invoice data with calculated values using functional update
        setInvoiceData(prev => {
          if (!prev) return prev;
          
          const chargeIndex = prev.charges?.findIndex(c => c.type === 'ELECTRICITY') ?? -1;
          const updatedCharges = prev.charges ? [...prev.charges] : [{
            type: 'ELECTRICITY',
            description: 'Electricity Bill',
            amount: 0,
            arrears: calcData.previousArrears || 0,
            total: 0
          }];
          
          // Round the bill amount to nearest integer (0.5 rounds up)
          const roundedAmount = Math.round(calcData.charges.withSurcharge || 0);
          const roundedGrandTotal = Math.round(calcData.grandTotal || 0);
          
          if (chargeIndex >= 0) {
            updatedCharges[chargeIndex] = {
              ...updatedCharges[chargeIndex],
              amount: roundedAmount,
              arrears: calcData.previousArrears || 0,
              total: roundedGrandTotal
            };
          } else {
            updatedCharges.push({
              type: 'ELECTRICITY',
              description: 'Electricity Bill',
              amount: roundedAmount,
              arrears: calcData.previousArrears || 0,
              total: roundedGrandTotal
            });
          }
          
          return {
            ...prev,
            chargeTypes: ['ELECTRICITY'],
            charges: updatedCharges,
            subtotal: roundedAmount,
            totalArrears: calcData.previousArrears || 0,
            grandTotal: roundedGrandTotal,
            calculationData: calcData
          };
        });
      } catch (err) {
        setInvoiceError(err.response?.data?.message || 'Failed to calculate charges');
        setInvoiceData(prev => prev ? { ...prev, calculationData: null } : null);
      } finally {
        setCalculating(false);
      }
    }, 600); // 600ms debounce delay

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
    };
  }, [pendingReading, invoiceProperty?._id]);

  const handleInvoiceFieldChange = (field, value) => {
    if (!invoiceData) return;
    
    if (field.startsWith('charge.')) {
      const [, chargeIndex, chargeField] = field.split('.');
      const updatedCharges = [...invoiceData.charges];
      let fieldValue = value;
      
      // Apply rounding to amount field for electricity charges
      if (chargeField === 'amount') {
        const numValue = Number(value) || 0;
        fieldValue = Math.round(numValue); // Round to nearest integer
      } else if (chargeField === 'arrears') {
        fieldValue = Number(value) || 0;
      } else {
        fieldValue = value;
      }
      
      updatedCharges[chargeIndex] = {
        ...updatedCharges[chargeIndex],
        [chargeField]: fieldValue
      };
      
      // Recalculate totals - only include ELECTRICITY charges
      const electricityCharges = updatedCharges.filter(c => c.type === 'ELECTRICITY');
      const subtotal = electricityCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
      const totalArrears = electricityCharges.reduce((sum, charge) => sum + (charge.arrears || 0), 0);
      // Round grand total to nearest integer
      const grandTotal = Math.round(subtotal + totalArrears);
      
      setInvoiceData({
        ...invoiceData,
        charges: updatedCharges,
        subtotal,
        totalArrears,
        grandTotal
      });
    } else {
      const updatedData = {
        ...invoiceData,
        [field]: field === 'periodFrom' || field === 'periodTo' || field === 'dueDate' || field === 'invoiceDate'
          ? (value ? new Date(value) : null)
          : field === 'grandTotal' || field === 'subtotal' || field === 'totalArrears'
          ? Number(value) || 0
          : value
      };
      
      // Regenerate invoice number if period changes (for new invoices only)
      if ((field === 'periodFrom' || field === 'periodTo') && !invoiceData._id && invoiceProperty) {
        const periodDate = field === 'periodFrom' ? new Date(value) : (updatedData.periodTo || new Date(value));
        const periodDayjs = dayjs(periodDate);
        const newInvoiceNumber = generateInvoiceNumber(
          invoiceProperty.srNo,
          periodDayjs.year(),
          periodDayjs.month() + 1,
          'ELECTRICITY'
        );
        updatedData.invoiceNumber = newInvoiceNumber;
      }
      
      setInvoiceData(updatedData);
    }
  };

  const handleSaveInvoice = async () => {
    // If viewing existing invoice, update it
    if (invoiceData?._id) {
      if (!invoiceData) {
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
        setSuccess('Invoice updated successfully');
        
        if (invoiceProperty?._id) {
          const invoiceResponse = await fetchInvoicesForProperty(invoiceProperty._id);
          setPropertyInvoices(prev => ({ ...prev, [invoiceProperty._id]: invoiceResponse.data?.data || [] }));
        }
        
        setTimeout(() => {
          handleCloseInvoiceDialog();
        }, 1500);
      } catch (err) {
        setInvoiceError(err.response?.data?.message || 'Failed to update invoice');
      } finally {
        setInvoiceLoading(false);
      }
      return;
    }

    // Create new invoice
    if (!invoiceProperty || !invoiceData) {
      setInvoiceError('Invoice data is incomplete');
      return;
    }

    // Validate current reading if provided
    if (currentReading && parseFloat(currentReading) < readingData.previousReading) {
      setInvoiceError('Current reading cannot be less than previous reading');
      return;
    }

    try {
      setInvoiceLoading(true);
      setInvoiceError('');
      
      const response = await createInvoice(invoiceProperty._id, {
        includeCAM: false,
        includeElectricity: true,
        includeRent: false,
        currentReading: currentReading ? parseFloat(currentReading) : undefined,
        periodFrom: invoiceData.periodFrom,
        periodTo: invoiceData.periodTo,
        dueDate: invoiceData.dueDate,
        charges: invoiceData.charges || []
      });

      const savedInvoice = response.data?.data || invoiceData;
      setInvoiceData(savedInvoice);
      // Update meter number if available from response
      const meterNo = savedInvoice?.electricityBill?.meterNo || 
                      savedInvoice?.property?.meterNumber || 
                      savedInvoice?.property?.electricityWaterMeterNo || 
                      readingData.meterNo;
      if (meterNo) {
        setReadingData(prev => ({ ...prev, meterNo }));
      }
      setSuccess('Invoice created successfully');
      
      if (invoiceProperty?._id) {
        const invoiceResponse = await fetchInvoicesForProperty(invoiceProperty._id);
        setPropertyInvoices(prev => ({ ...prev, [invoiceProperty._id]: invoiceResponse.data?.data || [] }));
      }
      
      setTimeout(() => {
        handleCloseInvoiceDialog();
      }, 1500);
    } catch (err) {
      setInvoiceError(err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleCloseInvoiceDialog = () => {
    setInvoiceDialogOpen(false);
    setInvoiceProperty(null);
    setInvoiceData(null);
    setInvoiceError('');
    setCurrentReading('');
    setPendingReading(null);
    setReadingData({ previousReading: 0, previousArrears: 0, meterNo: '' });
  };

  const generateElectricityVoucherPDF = () => {
    if (!invoiceProperty || !invoiceData) return;

    const property = invoiceProperty;
    const invoice = invoiceData;
    
    // Get electricity charge from invoice
    const electricityCharge = invoice.charges?.find(c => c.type === 'ELECTRICITY');
    const electricityBill = invoice.electricityBill || {};

    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const panelWidth = pageWidth / 3;
    const marginX = 6;
    const topMargin = 10;

    const copies = ['Bank Copy', 'Office Copy', 'Client Copy'];

    const formatDate = (value, format = 'D-MMM-YY') =>
      value ? dayjs(value).format(format) : '—';

    const formatFullDate = (value) =>
      value ? dayjs(value).format('MMMM D, YYYY') : '—';

    const formatMonthLabel = () => {
      if (electricityBill.month) return electricityBill.month.toUpperCase();
      if (invoice.periodTo) return dayjs(invoice.periodTo).format('MMMM-YY').toUpperCase();
      return dayjs().format('MMMM-YY').toUpperCase();
    };

    const formatAmount = (value) => {
      const num = Number(value) || 0;
      const formatted = Math.abs(num).toLocaleString('en-PK', { minimumFractionDigits: 0 });
      return num < 0 ? `(${formatted})` : formatted;
    };

    const formatRate = (value) => (Number(value) || 0).toFixed(2);

    const meterNo = electricityBill.meterNo || property.electricityWaterMeterNo || '—';
    const clientName = property.ownerName || property.tenantName || '—';
    const address = electricityBill.address || property.address || '—';
    const invoiceNumber = invoice.invoiceNumber || '—';
    const periodFrom = formatDate(invoice.periodFrom || electricityBill.fromDate);
    const periodTo = formatDate(invoice.periodTo || electricityBill.toDate);
    const readingDate = formatFullDate(invoice.periodTo || electricityBill.toDate);
    const dueDate = formatFullDate(invoice.dueDate || electricityBill.dueDate);
    const unitsConsumed = electricityBill.unitsConsumed || 0;
    const unitsCharged = electricityBill.unitsConsumedForDays || unitsConsumed;

    const totalBill = electricityCharge?.amount || electricityBill.totalBill || electricityBill.amount || 0;
    const arrears = electricityCharge?.arrears || electricityBill.arrears || 0;
    const amountReceived = electricityBill.receivedAmount || 0;
    const submittedInFreePeriod = totalBill + arrears;
    const payableWithinDueDate = totalBill + arrears - amountReceived;
    const payableAfterDueDate = electricityBill.withSurcharge || payableWithinDueDate;
    const latePaymentSurcharge = Math.max(payableAfterDueDate - payableWithinDueDate, 0);

    pdf.setDrawColor(170);
    pdf.setLineWidth(0.3);
    if (pdf.setLineDash) {
      pdf.setLineDash([1, 2], 0);
    }
    pdf.line(panelWidth, topMargin - 5, panelWidth, pageHeight - 15);
    pdf.line(panelWidth * 2, topMargin - 5, panelWidth * 2, pageHeight - 15);
    if (pdf.setLineDash) {
      pdf.setLineDash([], 0);
    }

    const drawInlineField = (label, value, startX, startY, labelWidth = 30) => {
      const valueWidth = panelWidth - marginX * 2 - labelWidth;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.text(label, startX, startY);
      pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(String(value || '—'), valueWidth);
      lines.forEach((line, idx) => {
        const lineY = startY + idx * 4.5;
        pdf.text(line, startX + labelWidth, lineY);
      });
      return startY + lines.length * 4.5 + 1.5;
    };

    const drawMeterTable = (startX, startY) => {
      const headers = ['Meter No.', 'Previous', 'Present', 'Unit Consumed', 'Units Charged', 'IESCO SLAB'];
      const values = [
        meterNo,
        formatAmount(electricityBill.prvReading),
        formatAmount(electricityBill.curReading),
        formatAmount(unitsConsumed),
        formatAmount(unitsCharged),
        electricityBill.iescoSlabs || '—'
      ];
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

    const drawComputationTable = (startX, startY, billMonthLabel) => {
      const rows = [
        {
          label: 'Share of IESCO Supply Cost Rate',
          value: `${formatRate(electricityBill.iescoUnitPrice || 0)}   ${formatAmount(electricityBill.electricityCost || 0)}`
        },
        { label: 'FC Surcharge', value: formatAmount(electricityBill.fcSurcharge || 0) },
        { label: 'Meter Rent', value: formatAmount(electricityBill.meterRent || 0) },
        { label: 'NJ Surcharge', value: formatAmount(electricityBill.njSurcharge || 0) },
        { label: 'Sales Tax', value: formatAmount(electricityBill.gst || 0) },
        { label: 'Electricity Duty', value: formatAmount(electricityBill.electricityDuty || 0) },
        { label: 'TV Fee', value: formatAmount(electricityBill.tvFee || 0) },
        { label: 'Fixed Charges', value: formatAmount(electricityBill.fixedCharges || 0) },
        { label: 'Charges for the Month', value: formatAmount(totalBill) },
        {
          label: `Amount Received in ${billMonthLabel.replace('-', ' ')}`,
          value: formatAmount(amountReceived ? -amountReceived : 0)
        },
        { label: '*Amount Submitted in Free Period', value: formatAmount(submittedInFreePeriod) },
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

    const drawPanel = (copyLabel, columnIndex) => {
      const startX = columnIndex * panelWidth + marginX;
      let cursorY = topMargin;

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.text(`(${copyLabel})`, startX + (panelWidth - marginX * 2) / 2, cursorY, { align: 'center' });
      cursorY += 5;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(178, 34, 34);
      pdf.text(
        `Taj Electricity Billing For The Month Of ${formatMonthLabel()}`,
        startX + (panelWidth - marginX * 2) / 2,
        cursorY,
        { align: 'center' }
      );
      pdf.setTextColor(0, 0, 0);
      cursorY += 6;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text('Statement of Electricity Charges', startX + (panelWidth - marginX * 2) / 2, cursorY, { align: 'center' });
      cursorY += 6;

      const inlineFields = [
        ['Meter ID', meterNo],
        ['Client', clientName],
        ['Address', address],
        ['Period From', periodFrom],
        ['Period To', periodTo],
        ['Invoice No.', invoiceNumber],
        ['Reading Date', readingDate],
        ['Due Date', dueDate]
      ];
      inlineFields.forEach(([label, value]) => {
        cursorY = drawInlineField(label, value, startX, cursorY);
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
      cursorY = drawComputationTable(startX, cursorY, formatMonthLabel());

      const panelFootnotes = [
        '1. The above mentioned charges are calculated based on proportionate share of user in total cost of electricity of the Project and do not include any profit element of Taj Residencia.',
        '2. Kindly make payment through cash, crossed cheque or bank drafts on our specified deposit slip at any Allied Bank Limited main Phase I Account No. Taj Residencia Limited Bank Limited, The Centaurus Mall Branch, Islamabad.',
        '3. Please deposit your bills before due date to avoid Late Payment Surcharge.',
        '4. Please share proof of payment to TAJ Official WhatsApp No.: 0345 77 68 442.'
      ];
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(5.2);
      let noteY = pageHeight - 24;
      panelFootnotes.forEach((line) => {
        const wrapped = pdf.splitTextToSize(line, panelWidth - 2 * marginX);
        wrapped.forEach((wrappedLine) => {
          pdf.text(wrappedLine, startX, noteY);
          noteY += 3.2;
        });
      });
    };

    copies.forEach((copy, index) => drawPanel(copy, index));

    const sanitizedName = (property.propertyName || property.plotNumber || property.srNo || 'electricity-property')
      .toString()
      .replace(/[^a-z0-9-_ ]/gi, '')
      .trim()
      .replace(/\s+/g, '_');

    pdf.save(`Electricity_Invoice_${sanitizedName || property._id}.pdf`);
  };

  const handleDownloadInvoice = () => {
    if (!invoiceProperty || !invoiceData) {
      setInvoiceError('Invoice data is not ready yet. Please wait a moment.');
      return;
    }
    generateElectricityVoucherPDF();
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
    setPaymentForm({
      amount: property.electricityAmount || 0,
      arrears: property.electricityArrears || 0,
      paymentDate: dayjs().format('YYYY-MM-DD'),
      periodFrom: dayjs().format('YYYY-MM-DD'),
      periodTo: dayjs().format('YYYY-MM-DD'),
      invoiceNumber: '',
      paymentMethod: 'Bank Transfer',
      bankName: '',
      reference: '',
      notes: ''
    });
    setPaymentAttachment(null);
    setPaymentDialog(true);
  };

  const handleElectricityPaymentMethodChange = (value) => {
    setPaymentForm((prev) => ({
      ...prev,
      paymentMethod: value,
      bankName: value === 'Cash' ? '' : prev.bankName
    }));
  };

  const handleElectricityAttachmentChange = (event) => {
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

      const formData = new FormData();
      Object.entries(paymentForm).forEach(([key, value]) => {
        formData.append(key, value ?? '');
      });
      if (paymentAttachment) {
        formData.append('attachment', paymentAttachment);
      }

      await addPaymentToPropertyElectricity(selectedProperty._id, formData);
      setSuccess('Payment recorded successfully');
      handleClosePaymentDialog();
      loadProperties();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record payment');
    }
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
          <title>Electricity Bill - ${viewingCharge.invoiceNumber || 'N/A'}</title>
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
            .charges-table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            .charges-table th, .charges-table td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            .charges-table th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .total-row {
              font-weight: bold;
              background-color: #f9f9f9;
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
            <h1>Electricity Bill</h1>
            <p><strong>Invoice Number:</strong> ${viewingCharge.invoiceNumber || 'N/A'}</p>
            <p><strong>Serial Number:</strong> ${viewingCharge.serialNumber || 'N/A'}</p>
          </div>

          <div class="section">
            <div class="section-title">Meter & Reading Details</div>
            <div class="field-row">
              <div class="field-label">Meter Number:</div>
              <div class="field-value">${viewingCharge.meterNo || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Property Type:</div>
              <div class="field-value">${viewingCharge.propertyType || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Previous Reading:</div>
              <div class="field-value">${viewingCharge.prvReading || 0}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Current Reading:</div>
              <div class="field-value">${viewingCharge.curReading || 0}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Units Consumed:</div>
              <div class="field-value">${viewingCharge.unitsConsumed || 0}</div>
            </div>
            <div class="field-row">
              <div class="field-label">IESCO Slabs:</div>
              <div class="field-value">${viewingCharge.iescoSlabs || 'N/A'}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Billing Period</div>
            <div class="field-row">
              <div class="field-label">From Date:</div>
              <div class="field-value">${viewingCharge.fromDate ? dayjs(viewingCharge.fromDate).format('DD-MMM-YYYY') : 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">To Date:</div>
              <div class="field-value">${viewingCharge.toDate ? dayjs(viewingCharge.toDate).format('DD-MMM-YYYY') : 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Month:</div>
              <div class="field-value">${viewingCharge.month || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Due Date:</div>
              <div class="field-value">${viewingCharge.dueDate ? dayjs(viewingCharge.dueDate).format('DD-MMM-YYYY') : 'N/A'}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Charges Breakdown</div>
            <table class="charges-table">
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Amount (PKR)</th>
              </tr>
              <tr>
                <td>IESCO Unit Price</td>
                <td style="text-align: right;">${formatUnitPrice(viewingCharge.iescoUnitPrice || 0)}</td>
              </tr>
              <tr>
                <td>Electricity Cost</td>
                <td style="text-align: right;">${formatCurrency(viewingCharge.electricityCost || 0)}</td>
              </tr>
              <tr>
                <td>F.C Surcharge (3.2 × Units)</td>
                <td style="text-align: right;">${formatCurrency(viewingCharge.fcSurcharge || 0)}</td>
              </tr>
              <tr>
                <td>Meter Rent</td>
                <td style="text-align: right;">${formatCurrency(viewingCharge.meterRent || 0)}</td>
              </tr>
              <tr>
                <td>NJ Surcharge (0.10 × Units)</td>
                <td style="text-align: right;">${formatCurrency(viewingCharge.njSurcharge || 0)}</td>
              </tr>
              <tr>
                <td>Fixed Charges</td>
                <td style="text-align: right;">${formatCurrency(viewingCharge.fixedCharges || 0)}</td>
              </tr>
              <tr>
                <td>GST (18%)</td>
                <td style="text-align: right;">${formatCurrency(viewingCharge.gst || 0)}</td>
              </tr>
              <tr>
                <td>Electricity Duty (1.5%)</td>
                <td style="text-align: right;">${formatCurrency(viewingCharge.electricityDuty || 0)}</td>
              </tr>
              <tr>
                <td>TV Fee</td>
                <td style="text-align: right;">${formatCurrency(viewingCharge.tvFee || 0)}</td>
              </tr>
              <tr class="total-row">
                <td><strong>Total Bill</strong></td>
                <td style="text-align: right;"><strong>${formatCurrency(viewingCharge.totalBill || 0)}</strong></td>
              </tr>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Financial Summary</div>
            <div class="field-row">
              <div class="field-label">Total Bill:</div>
              <div class="field-value"><strong>${formatCurrency(viewingCharge.totalBill || 0)}</strong></div>
            </div>
            <div class="field-row">
              <div class="field-label">Received Amount:</div>
              <div class="field-value">${formatCurrency(viewingCharge.receivedAmount || 0)}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Balance:</div>
              <div class="field-value">${formatCurrency(viewingCharge.balance || 0)}</div>
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

          <div class="section">
            <div class="section-title">Property & Owner Information</div>
            <div class="field-row">
              <div class="field-label">Owner:</div>
              <div class="field-value">${viewingCharge.owner || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Contact Number:</div>
              <div class="field-value">${viewingCharge.contactNo || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Address:</div>
              <div class="field-value">${viewingCharge.address || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Plot No:</div>
              <div class="field-value">${viewingCharge.plotNo || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Sector:</div>
              <div class="field-value">${viewingCharge.sector || 'N/A'}</div>
            </div>
          </div>

          <div class="footer">
            <p><strong>Generated from SGC ERP System - Taj Utilities Electricity Bills</strong></p>
            <p>Bill ID: ${viewingCharge._id || 'N/A'} | Printed: ${printDate}</p>
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
    pdf.text('Electricity Bill', pageWidth / 2, yPos, { align: 'center' });
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

    // Meter & Reading Details
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Meter & Reading Details', leftMargin, yPos);
    yPos += 6;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Meter Number:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(viewingCharge.meterNo || 'N/A'), leftMargin + 35, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Property Type:', rightMargin - 30, yPos, { align: 'right' });
    pdf.text(String(viewingCharge.propertyType || 'N/A'), rightMargin, yPos, { align: 'right' });
    yPos += 5;
    
    pdf.text('Previous Reading:', leftMargin, yPos);
    pdf.text(String(viewingCharge.prvReading || 0), leftMargin + 40, yPos);
    pdf.text('Current Reading:', rightMargin - 30, yPos, { align: 'right' });
    pdf.text(String(viewingCharge.curReading || 0), rightMargin, yPos, { align: 'right' });
    yPos += 5;
    
    pdf.text('Units Consumed:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(viewingCharge.unitsConsumed || 0), leftMargin + 35, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text('IESCO Slabs:', rightMargin - 30, yPos, { align: 'right' });
    pdf.text(String(viewingCharge.iescoSlabs || 'N/A'), rightMargin, yPos, { align: 'right' });
    yPos += 8;

    // Billing Period
    checkNewPage(15);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Billing Period', leftMargin, yPos);
    yPos += 6;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('From Date:', leftMargin, yPos);
    pdf.text(viewingCharge.fromDate ? dayjs(viewingCharge.fromDate).format('DD-MMM-YYYY') : 'N/A', leftMargin + 30, yPos);
    pdf.text('To Date:', rightMargin - 30, yPos, { align: 'right' });
    pdf.text(viewingCharge.toDate ? dayjs(viewingCharge.toDate).format('DD-MMM-YYYY') : 'N/A', rightMargin, yPos, { align: 'right' });
    yPos += 5;
    
    pdf.text('Month:', leftMargin, yPos);
    pdf.text(String(viewingCharge.month || 'N/A'), leftMargin + 25, yPos);
    pdf.text('Due Date:', rightMargin - 30, yPos, { align: 'right' });
    pdf.text(viewingCharge.dueDate ? dayjs(viewingCharge.dueDate).format('DD-MMM-YYYY') : 'N/A', rightMargin, yPos, { align: 'right' });
    yPos += 8;

    // Charges Breakdown
    checkNewPage(40);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Charges Breakdown', leftMargin, yPos);
    yPos += 6;
    
    // Table header
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.rect(leftMargin, yPos - 4, pageWidth - 2 * margin, 5);
    pdf.text('Description', leftMargin + 2, yPos);
    pdf.text('Amount (PKR)', rightMargin - 2, yPos, { align: 'right' });
    yPos += 6;
    
    // Charges rows
    pdf.setFont('helvetica', 'normal');
    const charges = [
      ['IESCO Unit Price', formatUnitPrice(viewingCharge.iescoUnitPrice || 0)],
      ['Electricity Cost', formatCurrency(viewingCharge.electricityCost || 0)],
      ['F.C Surcharge (3.2 × Units)', formatCurrency(viewingCharge.fcSurcharge || 0)],
      ['Meter Rent', formatCurrency(viewingCharge.meterRent || 0)],
      ['NJ Surcharge (0.10 × Units)', formatCurrency(viewingCharge.njSurcharge || 0)],
      ['Fixed Charges', formatCurrency(viewingCharge.fixedCharges || 0)],
      ['GST (18%)', formatCurrency(viewingCharge.gst || 0)],
      ['Electricity Duty (1.5%)', formatCurrency(viewingCharge.electricityDuty || 0)],
      ['TV Fee', formatCurrency(viewingCharge.tvFee || 0)]
    ];
    
    charges.forEach(([desc, amount]) => {
      checkNewPage(6);
      pdf.rect(leftMargin, yPos - 4, pageWidth - 2 * margin, 5);
      pdf.text(String(desc), leftMargin + 2, yPos);
      pdf.text(String(amount), rightMargin - 2, yPos, { align: 'right' });
      yPos += 6;
    });
    
    // Total row
    checkNewPage(6);
    pdf.setFont('helvetica', 'bold');
    pdf.rect(leftMargin, yPos - 4, pageWidth - 2 * margin, 5);
    pdf.text('Total Bill', leftMargin + 2, yPos);
    pdf.text(String(formatCurrency(viewingCharge.totalBill || 0)), rightMargin - 2, yPos, { align: 'right' });
    yPos += 8;

    // Financial Summary
    checkNewPage(25);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Financial Summary', leftMargin, yPos);
    yPos += 6;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Total Bill:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(formatCurrency(viewingCharge.totalBill || 0)), rightMargin, yPos, { align: 'right' });
    yPos += 5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.text('Received Amount:', leftMargin, yPos);
    pdf.text(String(formatCurrency(viewingCharge.receivedAmount || 0)), rightMargin, yPos, { align: 'right' });
    yPos += 5;
    
    pdf.text('Balance:', leftMargin, yPos);
    pdf.text(String(formatCurrency(viewingCharge.balance || 0)), rightMargin, yPos, { align: 'right' });
    yPos += 5;
    
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

    // Property Information
    checkNewPage(20);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Property & Owner Information', leftMargin, yPos);
    yPos += 6;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Owner:', leftMargin, yPos);
    pdf.text(String(viewingCharge.owner || 'N/A'), leftMargin + 25, yPos);
    yPos += 5;
    
    pdf.text('Contact Number:', leftMargin, yPos);
    pdf.text(String(viewingCharge.contactNo || 'N/A'), leftMargin + 40, yPos);
    yPos += 5;
    
    pdf.text('Address:', leftMargin, yPos);
    const addressLines = pdf.splitTextToSize(String(viewingCharge.address || 'N/A'), pageWidth - 2 * margin - 30);
    pdf.text(String(addressLines[0]), leftMargin + 30, yPos);
    if (addressLines.length > 1) {
      yPos += 5;
      pdf.text(String(addressLines[1]), leftMargin + 30, yPos);
    }
    yPos += 5;
    
    pdf.text('Plot No:', leftMargin, yPos);
    pdf.text(String(viewingCharge.plotNo || 'N/A'), leftMargin + 25, yPos);
    pdf.text('Sector:', rightMargin - 30, yPos, { align: 'right' });
    pdf.text(String(viewingCharge.sector || 'N/A'), rightMargin, yPos, { align: 'right' });

    // Footer
    yPos = pageHeight - 15;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Generated from SGC ERP System - Taj Utilities Electricity Bills', pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    pdf.text(`Bill ID: ${viewingCharge._id || 'N/A'} | Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });

    pdf.save(`Electricity-Bill-${viewingCharge.invoiceNumber || 'INV'}.pdf`);
  };

  const handleOpenDialog = (charge) => {
    if (charge) {
      setEditingCharge(charge);
      setFormData({
        invoiceNumber: charge.invoiceNumber || '',
        plotNo: charge.plotNo || '',
        rdaNo: charge.rdaNo || '',
        street: charge.street || '',
        sector: charge.sector || '',
        category: charge.category || '',
        address: charge.address || '',
        project: charge.project || '',
        owner: charge.owner || '',
        contactNo: charge.contactNo || '',
        status: charge.status || 'Active',
        fileSubmission: charge.fileSubmission ? dayjs(charge.fileSubmission).format('YYYY-MM-DD') : '',
        demarcationDate: charge.demarcationDate ? dayjs(charge.demarcationDate).format('YYYY-MM-DD') : '',
        constructionDate: charge.constructionDate ? dayjs(charge.constructionDate).format('YYYY-MM-DD') : '',
        familyStatus: charge.familyStatus || '',
        arrears: charge.arrears || 0,
        amount: charge.amount || 0,
        amountInWords: charge.amountInWords || ''
      });
    } else {
      setEditingCharge(null);
      setFormData(defaultForm);
    }
    setDialogOpen(true);
    setError('');
    setSuccess('');
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCharge(null);
    setFormData(defaultForm);
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
        await updateElectricity(editingCharge._id, payload);
        setSuccess('Electricity Bill updated successfully');
      } else {
        await createElectricity(payload);
        setSuccess('Electricity Bill created successfully');
      }
      handleCloseDialog();
      loadCharges();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save Electricity Bill');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Taj Utilities — Electricity Bills
          </Typography>
          <Typography color="text.secondary">
            Manage Electricity bills for properties.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="Search bills"
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
                  <TableCell align="right">Electricity Amount</TableCell>
                  <TableCell align="right">Total Payments</TableCell>
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
                  properties.map((property) => (
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
                            {formatCurrency(property.electricityAmount || 0)}
                          </Typography>
                          {property.electricityArrears > 0 && (
                            <Typography variant="caption" color="error.main" display="block">
                              Arrears: {formatCurrency(property.electricityArrears || 0)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={600}>
                            {formatCurrency(totalPayments(property.payments || []))}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(property.payments || []).length} payment(s)
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
                                      .filter(inv => inv.chargeTypes?.includes('ELECTRICITY'))
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
                                                onClick={async () => {
                                                  setInvoiceProperty(property);
                                                  setInvoiceData(invoice);
                                                  setInvoiceError('');
                                                  setCurrentReading('');
                                                  setInvoiceDialogOpen(true);
                                                  // For viewing existing invoice, fetch reading data
                                                  try {
                                                    const readingResponse = await getElectricityCalculation(property._id);
                                                    if (readingResponse.data?.success) {
                                                      setReadingData({
                                                        previousReading: readingResponse.data.data.previousReading || 0,
                                                        previousArrears: readingResponse.data.data.previousArrears || 0,
                                                        meterNo: readingResponse.data.data.meterNo || ''
                                                      });
                                                    }
                                                  } catch (err) {
                                                    console.error('Error fetching reading data:', err);
                                                  }
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
                                                    generateElectricityVoucherPDF();
                                                  }, 100);
                                                }}
                                              >
                                                <DownloadIcon fontSize="small" />
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
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={invoiceDialogOpen} onClose={handleCloseInvoiceDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Invoice Preview</DialogTitle>
        <DialogContent dividers>
          {invoiceLoading && (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          )}
          {calculating && (
            <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          )}
          {!invoiceLoading && invoiceError && (
            <Alert severity="error">{invoiceError}</Alert>
          )}
          {!invoiceLoading && !calculating && !invoiceError && invoiceProperty && invoiceData && (() => {
              const totalAmount = (invoiceData.subtotal || 0) + (invoiceData.totalArrears || 0);
              const calcData = invoiceData?.calculationData;
              const electricityCharge = invoiceData.charges?.find(c => c.type === 'ELECTRICITY') || invoiceData.charges?.[0];
              const unitsConsumed = calcData?.unitsConsumed || (currentReading ? Math.max(0, parseFloat(currentReading) - readingData.previousReading) : 0);
              
              return (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Property
                  </Typography>
                  <Typography variant="h6">{invoiceProperty.propertyName || invoiceProperty.propertyType || '—'}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {invoiceProperty.address || invoiceProperty.street || 'No address recorded'}
                  </Typography>
                </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Invoice Number"
                    value={invoiceData.invoiceNumber || ''}
                    fullWidth
                    size="small"
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Meter Number"
                    value={
                      readingData.meterNo || 
                      invoiceData?.electricityBill?.meterNo || 
                      invoiceProperty?.meterNumber || 
                      invoiceProperty?.electricityWaterMeterNo || 
                      ''
                    }
                    onChange={(e) => setReadingData(prev => ({ ...prev, meterNo: e.target.value }))}
                    fullWidth
                    size="small"
                    helperText={
                      (readingData.meterNo || invoiceData?.electricityBill?.meterNo || invoiceProperty?.meterNumber || invoiceProperty?.electricityWaterMeterNo) 
                        ? '' 
                        : 'No meter number found'
                    }
                  />
                </Grid>
                {!invoiceData._id && (
                  <>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Previous Reading"
                        type="number"
                        value={readingData.previousReading || 0}
                        onChange={(e) => {
                          const prevReading = parseFloat(e.target.value) || 0;
                          setReadingData(prev => ({ ...prev, previousReading: prevReading }));
                          // Recalculate units consumed if current reading exists
                          if (currentReading) {
                            const newUnitsConsumed = Math.max(0, parseFloat(currentReading) - prevReading);
                            // Trigger recalculation if needed
                            if (newUnitsConsumed >= 0) {
                              handleCurrentReadingChange(currentReading);
                            }
                          }
                        }}
                        fullWidth
                        size="small"
                        inputProps={{ min: 0, step: 1 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Current Reading"
                        type="number"
                        value={currentReading}
                        onChange={(e) => handleCurrentReadingChange(e.target.value)}
                        fullWidth
                        size="small"
                        error={currentReading && parseFloat(currentReading) < readingData.previousReading}
                        helperText={currentReading && parseFloat(currentReading) < readingData.previousReading 
                          ? 'Current reading cannot be less than previous reading' 
                          : unitsConsumed > 0 ? `Units Consumed: ${unitsConsumed}` : 'Enter current reading to auto-calculate'}
                        inputProps={{ min: readingData.previousReading || 0, step: 1 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Units Consumed"
                        type="number"
                        value={unitsConsumed}
                        onChange={(e) => {
                          const newUnits = parseFloat(e.target.value) || 0;
                          if (newUnits >= 0 && readingData.previousReading !== undefined) {
                            const newCurrentReading = readingData.previousReading + newUnits;
                            setCurrentReading(String(newCurrentReading));
                            handleCurrentReadingChange(String(newCurrentReading));
                          }
                        }}
                        fullWidth
                        size="small"
                        inputProps={{ min: 0, step: 1 }}
                        helperText="Auto-calculated from readings, or enter manually"
                      />
                    </Grid>
                  </>
                )}
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Period From"
                    type="date"
                    value={invoiceData.periodFrom ? dayjs(invoiceData.periodFrom).format('YYYY-MM-DD') : ''}
                    onChange={(e) => {
                      const newPeriodFrom = e.target.value;
                      const currentPeriodTo = invoiceData.periodTo 
                        ? dayjs(invoiceData.periodTo).format('YYYY-MM-DD')
                        : '';
                      handleInvoiceFieldChange('periodFrom', newPeriodFrom);
                      if (!currentPeriodTo) {
                        handleInvoiceFieldChange('periodTo', dayjs(newPeriodFrom).endOf('month').format('YYYY-MM-DD'));
                      }
                    }}
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
                {electricityCharge && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label={electricityCharge.description || 'Electricity Bill'}
                        type="number"
                        value={electricityCharge.amount || 0}
                        onChange={(e) => {
                          const chargeIndex = invoiceData.charges.findIndex(c => c.type === 'ELECTRICITY');
                          if (chargeIndex >= 0) {
                            handleInvoiceFieldChange(`charge.${chargeIndex}.amount`, e.target.value);
                          }
                        }}
                        fullWidth
                        size="small"
                        InputProps={{
                          startAdornment: <Typography sx={{ mr: 1 }}>PKR</Typography>
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label={`${electricityCharge.description || 'Electricity Bill'} Arrears`}
                        type="number"
                        value={electricityCharge.arrears || 0}
                        onChange={(e) => {
                          const chargeIndex = invoiceData.charges.findIndex(c => c.type === 'ELECTRICITY');
                          if (chargeIndex >= 0) {
                            handleInvoiceFieldChange(`charge.${chargeIndex}.arrears`, e.target.value);
                          }
                        }}
                        fullWidth
                        size="small"
                        InputProps={{
                          startAdornment: <Typography sx={{ mr: 1 }}>PKR</Typography>
                        }}
                      />
                    </Grid>
                  </>
                )}
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
                Download to view the tri-fold invoice (Bank, Office & Client copies) exactly as it will print.
              </Alert>
            </Stack>
            );
          })()}
        </DialogContent>
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
            disabled={invoiceLoading || calculating || !invoiceData}
          >
            {invoiceLoading ? (invoiceData?._id ? 'Updating...' : 'Creating...') : (invoiceData?._id ? 'Update Invoice' : 'Create Invoice')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <DialogTitle>
          {editingCharge ? 'Update Electricity Bill' : 'New Electricity Bill'}
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
            {editingCharge ? 'Update' : 'Create'} Bill
          </Button>
        </DialogActions>
      </Dialog>


      {/* View Electricity Bill Dialog */}
      <Dialog open={viewDialogOpen} onClose={handleCloseViewDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          View Electricity Bill Details
          <IconButton
            onClick={handleCloseViewDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {viewingCharge && (
            <Grid container spacing={3}>
              {/* Invoice & Basic Info */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                  Invoice Information
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Invoice Number</Typography>
                <Typography variant="body1" fontWeight={600}>{viewingCharge.invoiceNumber || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Serial Number</Typography>
                <Typography variant="body1">{viewingCharge.serialNumber || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Chip 
                  label={viewingCharge.status || 'Active'} 
                  size="small" 
                  color={
                    viewingCharge.status === 'Active' ? 'success' :
                    viewingCharge.status === 'Pending' ? 'warning' :
                    viewingCharge.status === 'Completed' ? 'info' : 'default'
                  }
                />
              </Grid>

              {/* Meter & Reading Details */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mt: 2 }}>
                  Meter & Reading Details
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">Meter Number</Typography>
                <Typography variant="body1" fontWeight={600}>{viewingCharge.meterNo || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">Property Type</Typography>
                <Typography variant="body1">{viewingCharge.propertyType || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">Previous Reading</Typography>
                <Typography variant="body1" fontWeight={600}>{viewingCharge.prvReading || 0}</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">Current Reading</Typography>
                <Typography variant="body1" fontWeight={600}>{viewingCharge.curReading || 0}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Units Consumed</Typography>
                <Typography variant="body1" fontWeight={600}>{viewingCharge.unitsConsumed || 0}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Units Consumed for Days</Typography>
                <Typography variant="body1">{viewingCharge.unitsConsumedForDays || 0}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">IESCO Slabs</Typography>
                <Typography variant="body1">{viewingCharge.iescoSlabs || '—'}</Typography>
              </Grid>

              {/* Billing Period */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mt: 2 }}>
                  Billing Period
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">From Date</Typography>
                <Typography variant="body1">
                  {viewingCharge.fromDate ? dayjs(viewingCharge.fromDate).format('DD-MMM-YYYY') : '—'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">To Date</Typography>
                <Typography variant="body1">
                  {viewingCharge.toDate ? dayjs(viewingCharge.toDate).format('DD-MMM-YYYY') : '—'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">Month</Typography>
                <Typography variant="body1">{viewingCharge.month || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">Due Date</Typography>
                <Typography variant="body1">
                  {viewingCharge.dueDate ? dayjs(viewingCharge.dueDate).format('DD-MMM-YYYY') : '—'}
                </Typography>
              </Grid>

              {/* Charges Breakdown */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mt: 2 }}>
                  Charges Breakdown
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">IESCO Unit Price</Typography>
                <Typography variant="body1">{formatUnitPrice(viewingCharge.iescoUnitPrice || 0)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Electricity Cost</Typography>
                <Typography variant="body1" fontWeight={600}>{formatCurrency(viewingCharge.electricityCost || 0)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">F.C Surcharge (3.2 × Units)</Typography>
                <Typography variant="body1">{formatCurrency(viewingCharge.fcSurcharge || 0)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Meter Rent</Typography>
                <Typography variant="body1">{formatCurrency(viewingCharge.meterRent || 0)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">NJ Surcharge (0.10 × Units)</Typography>
                <Typography variant="body1">{formatCurrency(viewingCharge.njSurcharge || 0)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">GST (18%)</Typography>
                <Typography variant="body1">{formatCurrency(viewingCharge.gst || 0)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Electricity Duty (1.5%)</Typography>
                <Typography variant="body1">{formatCurrency(viewingCharge.electricityDuty || 0)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">TV Fee</Typography>
                <Typography variant="body1">{formatCurrency(viewingCharge.tvFee || 0)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Fixed Charges</Typography>
                <Typography variant="body1">{formatCurrency(viewingCharge.fixedCharges || 0)}</Typography>
              </Grid>

              {/* Financial Summary */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mt: 2 }}>
                  Financial Summary
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Total Bill</Typography>
                <Typography variant="body1" fontWeight={600} fontSize="1.1rem">
                  {formatCurrency(viewingCharge.totalBill || 0)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">With Surcharge</Typography>
                <Typography variant="body1" fontWeight={600} fontSize="1.1rem">
                  {formatCurrency(viewingCharge.withSurcharge || 0)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Received Amount</Typography>
                <Typography variant="body1" color={viewingCharge.receivedAmount > 0 ? 'success.main' : 'text.secondary'}>
                  {formatCurrency(viewingCharge.receivedAmount || 0)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Balance</Typography>
                <Typography variant="body1" fontWeight={600} color={viewingCharge.balance > 0 ? 'error.main' : 'success.main'}>
                  {formatCurrency(viewingCharge.balance || 0)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Arrears</Typography>
                <Typography variant="body1" fontWeight={600} color={viewingCharge.arrears > 0 ? 'error.main' : 'text.secondary'}>
                  {formatCurrency(viewingCharge.arrears || 0)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Amount in Words</Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 0.5 }}>
                  {viewingCharge.amountInWords || '—'}
                </Typography>
              </Grid>

              {/* Property Details */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mt: 2 }}>
                  Property Details
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">Owner</Typography>
                <Typography variant="body1" fontWeight={600}>{viewingCharge.owner || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">Contact Number</Typography>
                <Typography variant="body1">{viewingCharge.contactNo || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Plot No</Typography>
                <Typography variant="body1">{viewingCharge.plotNo || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">RDA No</Typography>
                <Typography variant="body1">{viewingCharge.rdaNo || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Sector</Typography>
                <Typography variant="body1">{viewingCharge.sector || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Street</Typography>
                <Typography variant="body1">{viewingCharge.street || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Category</Typography>
                <Typography variant="body1">{viewingCharge.category || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Project</Typography>
                <Typography variant="body1">{viewingCharge.project || '—'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Full Address</Typography>
                <Typography variant="body1">{viewingCharge.address || '—'}</Typography>
              </Grid>
              {viewingCharge.familyStatus && (
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">Family Status</Typography>
                  <Typography variant="body1">{viewingCharge.familyStatus}</Typography>
                </Grid>
              )}

              {/* Additional Dates */}
              {(viewingCharge.fileSubmission || viewingCharge.demarcationDate || viewingCharge.constructionDate) && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mt: 2 }}>
                      Additional Dates
                    </Typography>
                  </Grid>
                  {viewingCharge.fileSubmission && (
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">File Submission</Typography>
                      <Typography variant="body1">
                        {dayjs(viewingCharge.fileSubmission).format('DD-MMM-YYYY')}
                      </Typography>
                    </Grid>
                  )}
                  {viewingCharge.demarcationDate && (
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Demarcation Date</Typography>
                      <Typography variant="body1">
                        {dayjs(viewingCharge.demarcationDate).format('DD-MMM-YYYY')}
                      </Typography>
                    </Grid>
                  )}
                  {viewingCharge.constructionDate && (
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Construction Date</Typography>
                      <Typography variant="body1">
                        {dayjs(viewingCharge.constructionDate).format('DD-MMM-YYYY')}
                      </Typography>
                    </Grid>
                  )}
                </>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseViewDialog}>Close</Button>
          {viewingCharge && (
            <>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrintBill}
              >
                Print
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadPDF}
              >
                Download PDF
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  handleCloseViewDialog();
                  handleOpenDialog(viewingCharge);
                }}
              >
                Edit
              </Button>
            </>
          )}
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
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
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
                onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Period From"
                type="date"
                fullWidth
                value={paymentForm.periodFrom}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, periodFrom: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Period To"
                type="date"
                fullWidth
                value={paymentForm.periodTo}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, periodTo: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
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
                  onChange={(e) => handleElectricityPaymentMethodChange(e.target.value)}
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
                <input type="file" hidden accept="image/*,.pdf" onChange={handleElectricityAttachmentChange} />
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

export default Electricity;

