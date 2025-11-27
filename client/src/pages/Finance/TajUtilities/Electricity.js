import React, { useEffect, useMemo, useState } from 'react';
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
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  GroupWork as GroupWorkIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Payment as PaymentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router-dom';
import {
  fetchElectricity,
  createElectricity,
  updateElectricity,
  deleteElectricity,
  bulkCreateElectricityBills,
  addPaymentToPropertyElectricity,
  deletePaymentFromElectricityBill
} from '../../../services/electricityService';
import api from '../../../services/api';

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

const Electricity = () => {
  const navigate = useNavigate();
  const [charges, setCharges] = useState([]);
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
    reference: '',
    notes: ''
  });
  
  // Bulk Create state
  const [bulkCreateDialogOpen, setBulkCreateDialogOpen] = useState(false);
  const [bulkCreateLoading, setBulkCreateLoading] = useState(false);
  const [bulkCreateForm, setBulkCreateForm] = useState({
    month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    year: new Date().getFullYear(),
    fromDate: '',
    toDate: '',
    dueDate: ''
  });
  const [bulkCreateProperties, setBulkCreateProperties] = useState([]);

  const loadCharges = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetchElectricity({ search });
      setCharges(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load Electricity Bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCharges();
    loadProperties();
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

  const toggleRowExpansion = (propertyId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(propertyId)) {
      newExpanded.delete(propertyId);
    } else {
      newExpanded.add(propertyId);
    }
    setExpandedRows(newExpanded);
  };

  const totalPayments = (payments) => {
    return payments?.reduce((sum, p) => sum + (p.totalAmount || p.amount || 0), 0) || 0;
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
      reference: '',
      notes: ''
    });
    setPaymentDialog(true);
  };

  const handlePaymentSave = async () => {
    try {
      setError('');
      if (!selectedProperty) return;
      
      await addPaymentToPropertyElectricity(selectedProperty._id, paymentForm);
      setSuccess('Payment recorded successfully');
      setPaymentDialog(false);
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
      // Find the bill ID from the payment
      const billId = payment.chargeId;
      const paymentId = payment._id;

      if (!billId || !paymentId) {
        setError('Payment information is incomplete');
        return;
      }

      await deletePaymentFromElectricityBill(billId, paymentId);
      setSuccess('Payment deleted successfully');
      loadProperties();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete payment');
    }
  };

  const handleOpenViewDialog = (charge) => {
    setViewingCharge(charge);
    setViewDialogOpen(true);
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

  const handleDeleteCharge = async (id) => {
    if (!window.confirm('Delete this Electricity Bill record?')) return;
    try {
      await deleteElectricity(id);
      setSuccess('Electricity Bill deleted successfully');
      loadCharges();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete Electricity Bill');
    }
  };

  const handleOpenBulkCreate = async () => {
    try {
      setBulkCreateLoading(true);
      // Fetch current overview to get properties
      const response = await api.get('/taj-utilities/electricity/current-overview');
      const overview = response.data.data;
      setProperties(overview?.properties || []);
      
      // Initialize properties with empty current reading
      const properties = (overview.properties || []).map(prop => ({
        propertyId: prop._id,
        propertyName: prop.propertyName || prop.address,
        meterNo: prop.electricityWaterMeterNo || '',
        address: prop.address,
        owner: prop.ownerName,
        currentReading: '',
        previousReading: prop.waterElectricityLastReading || 0
      }));
      
      setBulkCreateProperties(properties);
      setBulkCreateDialogOpen(true);
    } catch (err) {
      setError('Failed to load properties for bulk create');
    } finally {
      setBulkCreateLoading(false);
    }
  };

  const handleBulkCreate = async () => {
    try {
      setBulkCreateLoading(true);
      setError('');
      
      const month = parseInt(bulkCreateForm.month);
      const year = bulkCreateForm.year;
      
      // Validate all properties have current reading
      const invalidProperties = bulkCreateProperties.filter(p => !p.currentReading || p.currentReading === '');
      if (invalidProperties.length > 0) {
        setError(`Please enter current reading for all properties. ${invalidProperties.length} properties missing readings.`);
        setBulkCreateLoading(false);
        return;
      }

      // Prepare properties data
      const propertiesData = bulkCreateProperties.map(prop => ({
        propertyId: prop.propertyId,
        currentReading: parseFloat(prop.currentReading) || 0
      }));

      const payload = {
        month,
        year,
        properties: propertiesData,
        fromDate: bulkCreateForm.fromDate || undefined,
        toDate: bulkCreateForm.toDate || undefined,
        dueDate: bulkCreateForm.dueDate || undefined
      };

      const response = await bulkCreateElectricityBills(payload);
      
      setBulkCreateDialogOpen(false);
      setBulkCreateForm({
        month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
        year: new Date().getFullYear(),
        fromDate: '',
        toDate: '',
        dueDate: ''
      });
      setBulkCreateProperties([]);
      
      // Refresh data
      loadCharges();
      loadProperties();
      
      const summary = response.data.data;
      let message = `✅ Successfully created ${summary.created} electricity bills for ${months.find(m => m.value === bulkCreateForm.month)?.label} ${bulkCreateForm.year}!\n\n`;
      message += `📊 Summary:\n`;
      message += `• Total Properties: ${summary.totalProperties}\n`;
      message += `• Created: ${summary.created}\n`;
      if (summary.skipped > 0) {
        message += `• Skipped: ${summary.skipped}\n`;
      }
      if (summary.errors > 0) {
        message += `• Errors: ${summary.errors}\n`;
      }
      
      setSuccess(message);
      setTimeout(() => setSuccess(''), 10000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create bulk electricity bills');
    } finally {
      setBulkCreateLoading(false);
    }
  };

  const filteredCharges = useMemo(() => {
    if (!search) return charges;
    try {
      // Escape special regex characters in search string
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escapedSearch, 'i');
      return charges.filter(
        (charge) =>
          pattern.test(charge.invoiceNumber || '') ||
          pattern.test(charge.plotNo || '') ||
          pattern.test(charge.owner || '') ||
          pattern.test(charge.project || '')
      );
    } catch (error) {
      console.error('Error filtering charges:', error);
      return charges;
    }
  }, [charges, search]);

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
          <Button variant="outlined" startIcon={<GroupWorkIcon />} onClick={handleOpenBulkCreate} disabled={bulkCreateLoading}>
            Bulk Create
          </Button>
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
                                Payment History
                              </Typography>
                              {property.payments && property.payments.length > 0 ? (
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Date</TableCell>
                                      <TableCell>Period</TableCell>
                                      <TableCell>Invoice #</TableCell>
                                      <TableCell>Amount</TableCell>
                                      <TableCell>Status</TableCell>
                                      <TableCell>Method</TableCell>
                                      <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {property.payments.map((payment, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell>
                                          {dayjs(payment.paymentDate).format('MMM D, YYYY')}
                                        </TableCell>
                                        <TableCell>
                                          {payment.periodFrom && payment.periodTo ? (
                                            `${dayjs(payment.periodFrom).format('MMM D')} - ${dayjs(payment.periodTo).format('MMM D, YYYY')}`
                                          ) : (
                                            'N/A'
                                          )}
                                        </TableCell>
                                        <TableCell>{payment.invoiceNumber || 'N/A'}</TableCell>
                                        <TableCell>{formatCurrency(payment.totalAmount || payment.amount || 0)}</TableCell>
                                        <TableCell>
                                          {(() => {
                                            const { color, label } = getPaymentStatusConfig(payment.status || 'unpaid');
                                            return (
                                              <Chip
                                                label={label}
                                                color={color}
                                                size="small"
                                              />
                                            );
                                          })()}
                                        </TableCell>
                                        <TableCell>{payment.paymentMethod || 'N/A'}</TableCell>
                                        <TableCell align="right">
                                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                                            <Tooltip title="View Details">
                                              <IconButton
                                                size="small"
                                                color="primary"
                                              >
                                                <ViewIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete Payment">
                                              <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => handleDeletePayment(property, payment)}
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
                                  No payments recorded yet
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

      {/* Bulk Create Electricity Bills Dialog */}
      <Dialog open={bulkCreateDialogOpen} onClose={() => setBulkCreateDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Bulk Create Electricity Bills for All Properties</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  value={bulkCreateForm.month}
                  onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, month: e.target.value })}
                  label="Month"
                >
                  {months.map((month) => (
                    <MenuItem key={month.value} value={month.value}>
                      {month.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Year"
                value={bulkCreateForm.year}
                onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, year: parseInt(e.target.value) })}
                inputProps={{ min: 2020, max: 2030 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="From Date (Optional)"
                value={bulkCreateForm.fromDate}
                onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, fromDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="To Date (Optional)"
                value={bulkCreateForm.toDate}
                onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, toDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="Due Date (Optional)"
                value={bulkCreateForm.dueDate}
                onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Enter current meter reading for each property. Previous reading will be fetched from last bill automatically.
                All charges will be calculated based on units consumed and electricity slabs.
              </Alert>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                Properties ({bulkCreateProperties.length})
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Property</TableCell>
                      <TableCell>Meter No</TableCell>
                      <TableCell>Previous Reading</TableCell>
                      <TableCell>Current Reading *</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bulkCreateProperties.map((prop, index) => (
                      <TableRow key={prop.propertyId}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {prop.propertyName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {prop.address}
                          </Typography>
                        </TableCell>
                        <TableCell>{prop.meterNo || '—'}</TableCell>
                        <TableCell>{prop.previousReading || 0}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={prop.currentReading}
                            onChange={(e) => {
                              const updated = [...bulkCreateProperties];
                              updated[index].currentReading = e.target.value;
                              setBulkCreateProperties(updated);
                            }}
                            placeholder="Enter reading"
                            inputProps={{ min: 0, step: 0.01 }}
                            fullWidth
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkCreateDialogOpen(false)} disabled={bulkCreateLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkCreate}
            variant="contained"
            disabled={bulkCreateLoading}
            startIcon={bulkCreateLoading ? <CircularProgress size={20} /> : <GroupWorkIcon />}
          >
            {bulkCreateLoading ? `Creating... (${bulkCreateProperties.length} properties)` : `Create All Bills (${bulkCreateProperties.length} properties)`}
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
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Record Payment
          <IconButton
            onClick={() => setPaymentDialog(false)}
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
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  label="Payment Method"
                >
                  <MenuItem value="Cash">Cash</MenuItem>
                  <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                  <MenuItem value="Cheque">Cheque</MenuItem>
                  <MenuItem value="Online">Online</MenuItem>
                </Select>
              </FormControl>
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
          <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handlePaymentSave}>
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Electricity;

