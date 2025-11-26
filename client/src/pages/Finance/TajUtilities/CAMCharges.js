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
  Collapse,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  ExpandMore as ExpandMoreIcon,
  GroupWork as GroupWorkIcon,
  Print as PrintIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import {
  fetchCAMCharges,
  createCAMCharge,
  updateCAMCharge,
  deleteCAMCharge,
  bulkCreateCAMCharges
} from '../../../services/camChargesService';
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
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingCharge, setViewingCharge] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [editingCharge, setEditingCharge] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  
  // General CAM Charges state
  const [currentOverview, setCurrentOverview] = useState(null);
  const [currentOverviewLoading, setCurrentOverviewLoading] = useState(false);
  const [generalCAMChargesExpanded, setGeneralCAMChargesExpanded] = useState(false);
  const [generalCAMChargesPage, setGeneralCAMChargesPage] = useState(0);
  const [generalCAMChargesRowsPerPage, setGeneralCAMChargesRowsPerPage] = useState(10);
  
  // Bulk Create state
  const [bulkCreateDialogOpen, setBulkCreateDialogOpen] = useState(false);
  const [bulkCreateLoading, setBulkCreateLoading] = useState(false);
  const [bulkCreateForm, setBulkCreateForm] = useState({
    month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    year: new Date().getFullYear()
  });

  const loadCharges = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetchCAMCharges({ search });
      setCharges(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load CAM Charges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCharges();
    fetchCurrentOverview();
  }, []);

  useEffect(() => {
    if (generalCAMChargesExpanded) {
      fetchCurrentOverview();
    }
  }, [generalCAMChargesExpanded]);

  const fetchCurrentOverview = async () => {
    try {
      setCurrentOverviewLoading(true);
      const response = await api.get('/taj-utilities/cam-charges/current-overview');
      setCurrentOverview(response.data.data);
    } catch (error) {
      console.error('Error fetching current overview:', error);
      setError('Failed to load current CAM charges overview');
    } finally {
      setCurrentOverviewLoading(false);
    }
  };

  const toggleGeneralCAMChargesExpansion = () => {
    setGeneralCAMChargesExpanded(!generalCAMChargesExpanded);
  };

  const handleGeneralCAMChargesPageChange = (newPage) => {
    setGeneralCAMChargesPage(newPage);
  };

  const handleGeneralCAMChargesRowsPerPageChange = (newRowsPerPage) => {
    setGeneralCAMChargesRowsPerPage(parseInt(newRowsPerPage, 10));
    setGeneralCAMChargesPage(0);
  };

  const getPaginatedGeneralCAMChargesProperties = () => {
    if (!currentOverview) {
      return {
        paginatedProperties: [],
        currentPage: generalCAMChargesPage,
        currentRowsPerPage: generalCAMChargesRowsPerPage,
        totalProperties: 0,
        totalPages: 0
      };
    }
    
    const propertiesToShow = currentOverview.properties || [];
    const startIndex = generalCAMChargesPage * generalCAMChargesRowsPerPage;
    const endIndex = startIndex + generalCAMChargesRowsPerPage;
    
    return {
      paginatedProperties: propertiesToShow.slice(startIndex, endIndex),
      currentPage: generalCAMChargesPage,
      currentRowsPerPage: generalCAMChargesRowsPerPage,
      totalProperties: propertiesToShow.length,
      totalPages: Math.ceil(propertiesToShow.length / generalCAMChargesRowsPerPage)
    };
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

  const handleDeleteCharge = async (id) => {
    if (!window.confirm('Delete this CAM Charge record?')) return;
    try {
      await deleteCAMCharge(id);
      setSuccess('CAM Charge deleted successfully');
      loadCharges();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete CAM Charge');
    }
  };

  const handleBulkCreate = async () => {
    try {
      setBulkCreateLoading(true);
      setError('');
      
      const month = parseInt(bulkCreateForm.month);
      const year = bulkCreateForm.year;
      
      // Check if charges already exist for this month
      const monthYear = `${year}-${String(month).padStart(2, '0')}`;
      const existingCharges = charges.filter(
        c => c.invoiceNumber?.startsWith(`CAM-${monthYear}`)
      );

      let forceRegenerate = false;
      
      if (existingCharges.length > 0) {
        const confirmMessage = `${existingCharges.length} CAM charges already exist for ${months.find(m => m.value === bulkCreateForm.month)?.label} ${bulkCreateForm.year}.\n\nDo you want to regenerate all charges (overwrite existing)?`;
        
        if (!window.confirm(confirmMessage)) {
          setBulkCreateLoading(false);
          return;
        }
        
        forceRegenerate = true;
      } else {
        const totalProperties = currentOverview?.totalProperties || 0;
        const confirmMessage = `Create CAM charges for all ${totalProperties} properties for ${months.find(m => m.value === bulkCreateForm.month)?.label} ${bulkCreateForm.year}?`;
        if (!window.confirm(confirmMessage)) {
          setBulkCreateLoading(false);
          return;
        }
      }

      const response = await bulkCreateCAMCharges({
        month,
        year,
        forceRegenerate
      });
      
      setBulkCreateDialogOpen(false);
      setBulkCreateForm({
        month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
        year: new Date().getFullYear()
      });
      
      // Refresh data
      loadCharges();
      fetchCurrentOverview();
      
      const summary = response.data.data;
      let message = `✅ Successfully created ${summary.created} CAM charges for ${months.find(m => m.value === bulkCreateForm.month)?.label} ${bulkCreateForm.year}!\n\n`;
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
      setError(err.response?.data?.message || 'Failed to create bulk CAM charges');
    } finally {
      setBulkCreateLoading(false);
    }
  };

  const filteredCharges = useMemo(() => {
    if (!search) return charges;
    const pattern = new RegExp(search, 'i');
    return charges.filter(
      (charge) =>
        pattern.test(charge.invoiceNumber || '') ||
        pattern.test(charge.plotNo || '') ||
        pattern.test(charge.owner || '') ||
        pattern.test(charge.project || '')
    );
  }, [charges, search]);

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
          <Button variant="outlined" startIcon={<GroupWorkIcon />} onClick={() => setBulkCreateDialogOpen(true)}>
            Bulk Create
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            New Charge
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

      {/* General CAM Charges Overview Card */}
      <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
        <CardContent>
          <Typography variant="h6" color="primary.main" sx={{ mb: 2, fontWeight: 600 }}>
            📋 General CAM Charges
          </Typography>
          
          <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Property Overview</TableCell>
                    <TableCell>Total Properties</TableCell>
                    <TableCell>Active Properties</TableCell>
                    <TableCell>Total Amount</TableCell>
                    <TableCell>Total Arrears</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow hover sx={{ bgcolor: 'background.paper' }}>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2">
                          Current Properties
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          General
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {currentOverviewLoading ? (
                          <CircularProgress size={16} />
                        ) : (
                          `${currentOverview?.totalProperties || 0} Properties`
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {currentOverviewLoading ? (
                        <CircularProgress size={16} />
                      ) : (
                        `${currentOverview?.totalActiveProperties || 0} Active`
                      )}
                    </TableCell>
                    <TableCell>
                      {currentOverviewLoading ? (
                        <CircularProgress size={16} />
                      ) : (
                        formatCurrency(currentOverview?.totalAmount || 0)
                      )}
                    </TableCell>
                    <TableCell>
                      {currentOverviewLoading ? (
                        <CircularProgress size={16} />
                      ) : (
                        <Typography color={currentOverview?.totalArrears > 0 ? 'error.main' : 'text.secondary'}>
                          {formatCurrency(currentOverview?.totalArrears || 0)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={generalCAMChargesExpanded ? "Hide Details" : "View Details"}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={toggleGeneralCAMChargesExpansion}
                        >
                          {generalCAMChargesExpanded ? <ExpandMoreIcon /> : <ViewIcon />}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
          
          {/* Expanded Property Details for General CAM Charges */}
          <Collapse in={generalCAMChargesExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Typography variant="h6" gutterBottom component="div">
                Property Details - Current CAM Charges
                <Chip 
                  label="↑ Sorted by Serial Number" 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                  sx={{ ml: 2, fontSize: '0.75rem', height: 24 }}
                />
              </Typography>
              
              {/* Property Details Pagination Info */}
              {(() => {
                const paginationInfo = getPaginatedGeneralCAMChargesProperties();
                return (
                  <Box sx={{ 
                    mb: 2, 
                    p: 2, 
                    bgcolor: 'grey.50', 
                    borderRadius: 2, 
                    border: '1px solid',
                    borderColor: 'grey.200'
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 600 }}>
                          🏠 Property List
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Showing {paginationInfo.currentPage * paginationInfo.currentRowsPerPage + 1}-{Math.min((paginationInfo.currentPage + 1) * paginationInfo.currentRowsPerPage, paginationInfo.totalProperties)} of {paginationInfo.totalProperties} properties
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="textSecondary">
                          Page {paginationInfo.currentPage + 1} of {paginationInfo.totalPages || 1}
                        </Typography>
                        {paginationInfo.totalPages > 1 && (
                          <Chip 
                            label={`${paginationInfo.totalPages} pages`} 
                            size="small" 
                            color="primary" 
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })()}

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Sr. No</TableCell>
                    <TableCell>Property</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Owner</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">CAM Amount</TableCell>
                    <TableCell align="right">Arrears</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const paginationInfo = getPaginatedGeneralCAMChargesProperties();
                    if (paginationInfo.paginatedProperties.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" color="textSecondary">
                                {currentOverviewLoading ? 'Loading properties...' : 'No properties found'}
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    return paginationInfo.paginatedProperties.map((property) => {
                      return (
                        <TableRow key={property._id}>
                          <TableCell>{property.srNo || '—'}</TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="subtitle2">
                                {property.propertyName || property.propertyType || '—'}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {property.plotNumber || '—'} / {property.rdaNumber || '—'}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{property.address || '—'}</Typography>
                            <Typography variant="caption" color="textSecondary">
                              {property.street || '—'} • Sector {property.sector || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{property.ownerName || '—'}</Typography>
                            <Typography variant="caption" color="textSecondary">
                              {property.contactNumber || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={property.status || 'Pending'}
                              color={
                                property.status === 'Active' || property.status === 'active' ? 'success' :
                                property.status === 'Pending' || property.status === 'pending' ? 'warning' :
                                property.status === 'Completed' || property.status === 'completed' ? 'info' : 'default'
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography fontWeight={600}>
                              {formatCurrency(property.camAmount || 0)}
                            </Typography>
                            {!property.hasCAMCharge && (
                              <Typography variant="caption" color="textSecondary" display="block">
                                No charge
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography color={property.camArrears > 0 ? 'error.main' : 'text.secondary'}>
                              {formatCurrency(property.camArrears || 0)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>

              {/* General CAM Charges Property Details Pagination Controls */}
              {(() => {
                const paginationInfo = getPaginatedGeneralCAMChargesProperties();
                if (paginationInfo.totalPages <= 1) return null;
                
                return (
                  <Box sx={{ 
                    mt: 2, 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" color="textSecondary">
                        Properties per page:
                      </Typography>
                      <FormControl size="small" sx={{ minWidth: 80 }}>
                        <Select
                          value={paginationInfo.currentRowsPerPage}
                          onChange={(e) => handleGeneralCAMChargesRowsPerPageChange(e.target.value)}
                          sx={{ height: 32 }}
                        >
                          <MenuItem value={5}>5</MenuItem>
                          <MenuItem value={10}>10</MenuItem>
                          <MenuItem value={25}>25</MenuItem>
                          <MenuItem value={50}>50</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Button
                        size="small"
                        onClick={() => handleGeneralCAMChargesPageChange(paginationInfo.currentPage - 1)}
                        disabled={paginationInfo.currentPage === 0}
                        variant="outlined"
                      >
                        Previous
                      </Button>
                      
                      <Typography variant="body2" sx={{ px: 2 }}>
                        {paginationInfo.currentPage + 1} of {paginationInfo.totalPages}
                      </Typography>
                      
                      <Button
                        size="small"
                        onClick={() => handleGeneralCAMChargesPageChange(paginationInfo.currentPage + 1)}
                        disabled={paginationInfo.currentPage >= paginationInfo.totalPages - 1}
                        variant="outlined"
                      >
                        Next
                      </Button>
                    </Box>
                  </Box>
                );
              })()}
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Sr. No</TableCell>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Plot / RDA</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Arrears</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCharges.map((charge) => (
                  <TableRow key={charge._id} hover>
                    <TableCell>{charge.serialNumber || '—'}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{charge.invoiceNumber || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{charge.plotNo || '—'}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        RDA: {charge.rdaNo || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography>{charge.address || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Street {charge.street || '—'} • Sector {charge.sector || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{charge.owner}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {charge.contactNo || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>{charge.project || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        label={charge.status || 'Active'}
                        size="small"
                        color={
                          charge.status === 'Active' ? 'success' :
                          charge.status === 'Pending' ? 'warning' :
                          charge.status === 'Completed' ? 'info' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={600}>{formatCurrency(charge.amount)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography color={charge.arrears > 0 ? 'error.main' : 'text.secondary'}>
                        {formatCurrency(charge.arrears)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleOpenViewDialog(charge)}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenDialog(charge)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDeleteCharge(charge._id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredCharges.length && !loading && (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Typography color="text.secondary">No CAM charges found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

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

      {/* Bulk Create CAM Charges Dialog */}
      <Dialog open={bulkCreateDialogOpen} onClose={() => setBulkCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk Create CAM Charges for All Properties</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
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
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Year"
                value={bulkCreateForm.year}
                onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, year: parseInt(e.target.value) })}
                inputProps={{ min: 2020, max: 2030 }}
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                <Typography variant="body2">
                  Selected Period: <strong>{months.find(m => m.value === bulkCreateForm.month)?.label} {bulkCreateForm.year}</strong>
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info">
                This will create CAM charge records for <strong>ALL {currentOverview?.totalProperties || 0} properties</strong> for {months.find(m => m.value === bulkCreateForm.month)?.label} {bulkCreateForm.year}. 
                Charges will be automatically calculated based on property size and charges slabs.
              </Alert>
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
            {bulkCreateLoading ? `Creating... (${currentOverview?.totalProperties || 0} properties)` : `Create All Charges (${currentOverview?.totalProperties || 0} properties)`}
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
    </Box>
  );
};

export default CAMCharges;

