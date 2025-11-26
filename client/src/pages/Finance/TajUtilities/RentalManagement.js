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
  MenuItem,
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
  Divider,
  FormControl,
  InputLabel,
  Select,
  Collapse,
  Tooltip,
  Menu
} from '@mui/material';
import {
  Close as CloseIcon,
  Home as HomeIcon,
  Payment as PaymentIcon,
  Print as PrintIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
  Description as DescriptionIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Receipt as ReceiptIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  FiberManualRecord as StatusIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router-dom';
import {
  fetchProperties,
  addPayment,
  fetchInvoice,
  updatePaymentStatus
} from '../../../services/tajRentalManagementService';

const paymentMethods = ['Cash', 'Bank Transfer', 'Cheque', 'Online'];
const paymentStatuses = ['Draft', 'Unpaid', 'Pending Approval', 'Approved', 'Rejected', 'Cancelled'];

const defaultSummary = {
  totalProperties: 0,
  statusBreakdown: {
    available: 0,
    rented: 0,
    reserved: 0,
    underMaintenance: 0,
    pending: 0
  },
  rent: {
    expectedTotal: 0,
    securityDepositTotal: 0,
    expectedAverage: 0
  }
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const RentalManagement = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [paymentDetailsDialog, setPaymentDetailsDialog] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invoiceData, setInvoiceData] = useState(null);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [statusMenuContext, setStatusMenuContext] = useState(null);
  const unpaidPayments =
    selectedProperty?.payments?.filter((payment) => payment.status === 'Unpaid') || [];
  const [rentalSummary, setRentalSummary] = useState(defaultSummary);

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetchProperties();
      setProperties(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSave = async () => {
    try {
      setError('');
      if (!selectedProperty) return;
      await addPayment(selectedProperty._id, paymentForm);
      setSuccess('Payment recorded successfully');
      setPaymentDialog(false);
      resetPaymentForm();
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record payment');
    }
  };

  const openPaymentDialog = (property) => {
    setSelectedProperty(property);
    resetPaymentForm();
    setPaymentDialog(true);
  };

  const handleViewInvoice = async (property, payment) => {
    try {
      const res = await fetchInvoice(property._id, payment._id);
      setInvoiceData(res.data?.data);
      setSelectedProperty(property);
      setInvoiceDialog(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load invoice');
    }
  };

  const handleViewPaymentDetails = (property, payment) => {
    setSelectedProperty(property);
    setSelectedPayment(payment);
    setPaymentDetailsDialog(true);
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (!invoiceData || !selectedProperty) return;

    const pdf = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const leftMargin = margin;
    const rightMargin = pageWidth - margin;

    const copies = ['Bank Copy', 'Office Copy', 'Client Copy'];
    const currentDate = new Date();
    const invoiceDate = dayjs(invoiceData.invoicingDate || invoiceData.periodFrom);
    const dueDate = dayjs(invoiceData.dueDate || invoiceData.periodTo);
    const periodFrom = dayjs(invoiceData.periodFrom);
    const periodTo = dayjs(invoiceData.periodTo);
    const billMonth = invoiceDate.format('MMMM YYYY');
    const currentAmount = selectedPayment?.amount || invoiceData.totalAmount || 0;
    const arrearsAmount = selectedPayment?.arrears || 0;
    const totalAmount = selectedPayment?.totalAmount || (currentAmount + arrearsAmount);
    const formattedCurrentAmount = currentAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedArrears = arrearsAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedTotalAmount = totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    copies.forEach((copyLabel, copyIndex) => {
      if (copyIndex > 0) {
        pdf.addPage();
      }

      let yPos = margin;

      // Header Section - Logo Area (left side)
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('TAJ', leftMargin, yPos + 5);
      pdf.setFontSize(12);
      pdf.text('RESIDENCIA', leftMargin, yPos + 10);

      // Document Title (center)
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Rent Invoice', pageWidth / 2, yPos + 8, { align: 'center' });

      // Invoice Generation Date & Time (right side)
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const dateTimeStr = dayjs(currentDate).format('dddd, MMMM D, YYYY, h:mm:ss A');
      pdf.text(dateTimeStr, rightMargin, yPos + 5, { align: 'right' });

      // Copy Label
      pdf.setFontSize(10);
      pdf.text(`(${copyLabel})`, rightMargin, yPos + 10, { align: 'right' });

      yPos += 18;

      // Client Details Section
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Client Name:', leftMargin, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.text(invoiceData.tenantName || selectedProperty.tenantName || 'N/A', leftMargin + 30, yPos);
      
      yPos += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Client Location/Address:', leftMargin, yPos);
      pdf.setFont('helvetica', 'normal');
      const addressLines = pdf.splitTextToSize(invoiceData.address || selectedProperty.fullAddress || 'N/A', 80);
      pdf.text(addressLines[0], leftMargin + 45, yPos);
      if (addressLines.length > 1) {
        yPos += 5;
        pdf.text(addressLines[1], leftMargin + 45, yPos);
      }

      yPos += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Unit:', leftMargin, yPos);
      pdf.setFont('helvetica', 'normal');
      const unitInfo = selectedProperty.unit ? `(${selectedProperty.unit})` : '';
      pdf.text(unitInfo, leftMargin + 15, yPos);

      yPos += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Unit Address:', leftMargin, yPos);
      pdf.setFont('helvetica', 'normal');
      const unitAddress = [
        selectedProperty.floor && `Floor: ${selectedProperty.floor}`,
        selectedProperty.unit && `Unit: ${selectedProperty.unit}`,
        selectedProperty.block && `Block: ${selectedProperty.block}`,
        selectedProperty.street && `Street: ${selectedProperty.street}`,
        selectedProperty.sector && `Sector: ${selectedProperty.sector}`
      ].filter(Boolean).join(', ') || invoiceData.address || 'N/A';
      pdf.text(unitAddress, leftMargin + 30, yPos);

      yPos += 12;

      // Invoice Details Table
      const tableStartY = yPos;
      const col1X = leftMargin;
      const col2X = leftMargin + 50;
      const col3X = leftMargin + 100;
      const col4X = leftMargin + 140;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      
      // Table Header
      pdf.rect(col1X, yPos - 3, 180, 6);
      pdf.text('Invoice Number', col1X + 2, yPos);
      pdf.text('Bill Month', col2X + 2, yPos);
      pdf.text('Invoice Date', col3X + 2, yPos);
      pdf.text('Due Date', col4X + 2, yPos);
      
      yPos += 6;
      pdf.setFont('helvetica', 'normal');
      pdf.rect(col1X, yPos - 3, 180, 6);
      pdf.text(invoiceData.invoiceNumber || 'N/A', col1X + 2, yPos);
      pdf.text(billMonth, col2X + 2, yPos);
      pdf.text(invoiceDate.format('DD-MMM-YYYY'), col3X + 2, yPos);
      pdf.text(dueDate.format('DD-MMM-YYYY'), col4X + 2, yPos);

      yPos += 6;
      pdf.rect(col1X, yPos - 3, 90, 6);
      pdf.text('Period From', col1X + 2, yPos);
      pdf.text(periodFrom.format('DD-MMM-YYYY'), col1X + 25, yPos);
      pdf.rect(col1X + 90, yPos - 3, 90, 6);
      pdf.text('Period To', col1X + 92, yPos);
      pdf.text(periodTo.format('DD-MMM-YYYY'), col1X + 115, yPos);

      yPos += 10;

      // Rent Details Table
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Rent From ' + periodFrom.format('DD-MMM-YYYY') + ' To ' + periodTo.format('DD-MMM-YYYY'), leftMargin, yPos);
      yPos += 6;

      // Detailed Charges Table
      const tableCols = [
        { x: col1X, width: 50, label: 'Description' },
        { x: col1X + 50, width: 20, label: 'Quantity' },
        { x: col1X + 70, width: 25, label: 'Rate' },
        { x: col1X + 95, width: 25, label: 'Charges' },
        { x: col1X + 120, width: 20, label: 'Sales Tax %' },
        { x: col1X + 140, width: 25, label: 'Sales Tax' }
      ];

      // Table Header
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      tableCols.forEach(col => {
        pdf.rect(col.x, yPos - 3, col.width, 5);
        pdf.text(col.label, col.x + 1, yPos);
      });
      yPos += 5;

      // Table Row
      pdf.setFont('helvetica', 'normal');
      pdf.rect(tableCols[0].x, yPos - 3, tableCols[0].width, 5);
      pdf.text('Rent', tableCols[0].x + 1, yPos);
      pdf.rect(tableCols[1].x, yPos - 3, tableCols[1].width, 5);
      pdf.text('1', tableCols[1].x + 1, yPos);
      pdf.rect(tableCols[2].x, yPos - 3, tableCols[2].width, 5);
      pdf.text(formattedCurrentAmount, tableCols[2].x + 1, yPos);
      pdf.rect(tableCols[3].x, yPos - 3, tableCols[3].width, 5);
      pdf.text(formattedCurrentAmount, tableCols[3].x + 1, yPos);
      pdf.rect(tableCols[4].x, yPos - 3, tableCols[4].width, 5);
      pdf.text('0%', tableCols[4].x + 1, yPos);
      pdf.rect(tableCols[5].x, yPos - 3, tableCols[5].width, 5);
      pdf.text('0', tableCols[5].x + 1, yPos);

      yPos += 8;

      // Summary Section
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Charges For The Month Inc Sales Tax:', leftMargin + 100, yPos);
      pdf.setFont('helvetica', 'bold');
      pdf.text(formattedCurrentAmount, rightMargin, yPos, { align: 'right' });
      yPos += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.text('Payment:', leftMargin + 100, yPos);
      pdf.text('0.00', rightMargin, yPos, { align: 'right' });
      yPos += 5;
      pdf.text('Current Invoice Balance:', leftMargin + 100, yPos);
      pdf.setFont('helvetica', 'bold');
      pdf.text(formattedCurrentAmount, rightMargin, yPos, { align: 'right' });
      yPos += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.text('Arrears:', leftMargin + 100, yPos);
      pdf.text(formattedArrears, rightMargin, yPos, { align: 'right' });
      yPos += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Payable within Due Date Inc Sales Tax:', leftMargin + 50, yPos);
      pdf.text(formattedTotalAmount, rightMargin, yPos, { align: 'right' });
      yPos += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.text('Late Payment Surcharge:', leftMargin + 100, yPos);
      pdf.text('0.00', rightMargin, yPos, { align: 'right' });
      yPos += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Payable After Due Date:', leftMargin + 80, yPos);
      pdf.text(formattedTotalAmount, rightMargin, yPos, { align: 'right' });

      yPos += 10;

      // Payment Instructions
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Payment Instructions:', leftMargin, yPos);
      yPos += 6;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const paymentInstructions = [
        'Accepted Payment Methods: Banking channels only (cheque, online transfer, or deposit slip). Cash payments are not accepted.',
        'Deposit Instructions: Deposits can be made through cash, crossed cheque, or bank drafts on a specified deposit slip at any Allied Bank Limited branch in Pakistan.',
        'Bank Account Title: Taj Residencia, Allied Bank Limited',
        'Bank Branch: The Centaurus Mall Branch, Islamabad. (0917)',
        'Bank Account No: PK68ABPA0010035700420129'
      ];
      paymentInstructions.forEach(instruction => {
        const lines = pdf.splitTextToSize(instruction, pageWidth - 2 * margin);
        lines.forEach(line => {
          pdf.text(line, leftMargin, yPos);
          yPos += 4;
        });
        yPos += 2;
      });

      yPos += 3;

      // Important Notes
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Important Notes:', leftMargin, yPos);
      yPos += 6;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const notes = [
        'Payment must be made on or before the due date to avoid penalties or discontinuation of service.',
        'After payment, an email or WhatsApp copy of the deposit slip or online transfer proof should be sent to the Accounts Department for record verification.',
        'TAJ Official WhatsApp No.: 03457788442',
        'A late payment surcharge may apply if the amount is not received by the specified due date.',
        'Any returned or dishonored cheques will attract service charges.'
      ];
      notes.forEach(note => {
        const lines = pdf.splitTextToSize(note, pageWidth - 2 * margin);
        lines.forEach(line => {
          pdf.text(line, leftMargin, yPos);
          yPos += 4;
        });
        yPos += 2;
      });
    });

    pdf.save(`Rent-Invoice-${invoiceData.invoiceNumber || 'INV'}.pdf`);
  };

  const resetPaymentForm = () => {
    setPaymentForm({
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
    return payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  };

  const getPaymentStatusConfig = (status) => {
    const normalized = status || 'Approved';
    switch (normalized) {
      case 'Draft':
        return { color: 'default', label: 'Draft', iconColor: 'text.secondary' };
      case 'Unpaid':
        return { color: 'info', label: 'Unpaid', iconColor: 'info.main' };
      case 'Pending Approval':
        return { color: 'warning', label: 'Pending Approval', iconColor: 'warning.main' };
      case 'Rejected':
        return { color: 'error', label: 'Rejected', iconColor: 'error.main' };
      case 'Cancelled':
        return { color: 'default', label: 'Cancelled', iconColor: 'text.secondary' };
      case 'Approved':
      default:
        return { color: 'success', label: 'Approved', iconColor: 'success.main' };
    }
  };

  const handleOpenStatusMenu = (event, property, payment) => {
    setStatusMenuAnchor(event.currentTarget);
    setStatusMenuContext({ propertyId: property._id, paymentId: payment._id });
  };

  const handleCloseStatusMenu = () => {
    setStatusMenuAnchor(null);
    setStatusMenuContext(null);
  };

  const handleChangePaymentStatus = async (status) => {
    if (!statusMenuContext) return;
    try {
      await updatePaymentStatus(statusMenuContext.propertyId, statusMenuContext.paymentId, status);
      setProperties((prev) =>
        prev.map((property) => {
          if (property._id !== statusMenuContext.propertyId) return property;
          return {
            ...property,
            payments: property.payments.map((payment) =>
              payment._id === statusMenuContext.paymentId ? { ...payment, status } : payment
            )
          };
        })
      );
      if (selectedProperty && selectedProperty._id === statusMenuContext.propertyId) {
        setSelectedProperty((prev) => ({
          ...prev,
          payments: prev.payments.map((payment) =>
            payment._id === statusMenuContext.paymentId ? { ...payment, status } : payment
          )
        }));
      }
      if (selectedPayment && selectedPayment._id === statusMenuContext.paymentId) {
        setSelectedPayment((prev) => ({ ...prev, status }));
      }
      setSuccess('Payment status updated');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update payment status');
    } finally {
      handleCloseStatusMenu();
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Rental Management
          </Typography>
          <Typography color="text.secondary">
            Manage your rental properties, agreements, and payments
          </Typography>
        </Box>
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

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600}>
            Personal Rent Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Live snapshot of Taj properties marked as Personal Rent.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" mt={2}>
            <Chip label={`Total: ${rentalSummary.totalProperties}`} color="primary" />
            <Chip label={`Available: ${rentalSummary.statusBreakdown?.available || 0}`} color="success" />
            <Chip label={`Rented: ${rentalSummary.statusBreakdown?.rented || 0}`} color="error" />
            <Chip label={`Reserved: ${rentalSummary.statusBreakdown?.reserved || 0}`} color="warning" />
            <Chip label={`Under Maintenance: ${rentalSummary.statusBreakdown?.underMaintenance || 0}`} />
            <Chip label={`Expected Rent: ${formatCurrency(rentalSummary.rent?.expectedTotal || 0)}`} />
            <Chip label={`Avg Rent: ${formatCurrency(rentalSummary.rent?.expectedAverage || 0)}`} />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={50}></TableCell>
                  <TableCell>Property Code</TableCell>
                  <TableCell>Property Details</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell>Agreement</TableCell>
                  <TableCell>Tenant</TableCell>
                  <TableCell>Total Payments</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {properties.map((property) => (
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
                      <TableCell>
                        <Typography fontWeight={600}>{property.propertyCode}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={600}>{property.propertyName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {property.propertyType} • {property.area?.value} {property.area?.unit}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{property.fullAddress}</Typography>
                        {property.sector && (
                          <Typography variant="caption" color="text.secondary">
                            Sector {property.sector} {property.block && `• Block ${property.block}`}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {property.rentalAgreement ? (
                          <Typography variant="body2">
                            {property.rentalAgreement.agreementNumber}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">No Agreement</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {property.tenantName ? (
                          <>
                            <Typography variant="body2">{property.tenantName}</Typography>
                            {property.tenantPhone && (
                              <Typography variant="caption" color="text.secondary">
                                {property.tenantPhone}
                              </Typography>
                            )}
                          </>
                        ) : (
                          <Typography variant="body2" color="text.secondary">No Tenant</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={600}>
                          {formatCurrency(totalPayments(property.payments))}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {property.payments?.length || 0} payment(s)
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={property.status}
                          size="small"
                          color={
                            property.status === 'Available' ? 'success' :
                            property.status === 'Rented' ? 'error' :
                            property.status === 'Under Maintenance' ? 'warning' : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => navigate(`/finance/taj-utilities-charges/rental-management/${property._id}`)}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Add Payment">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => openPaymentDialog(property)}
                            >
                              <PaymentIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={9} sx={{ py: 0, border: 0 }}>
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
                                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                                      <TableCell>
                                        {(() => {
                                          const { color, label, iconColor } = getPaymentStatusConfig(payment.status);
                                          return (
                                            <Chip
                                              label={label}
                                              color={color === 'default' ? undefined : color}
                                              variant={color === 'default' ? 'outlined' : 'filled'}
                                              size="small"
                                              icon={
                                                <StatusIcon
                                                  fontSize="small"
                                                  sx={{ color: iconColor }}
                                                />
                                              }
                                            />
                                          );
                                        })()}
                                      </TableCell>
                                      <TableCell>{payment.paymentMethod}</TableCell>
                                      <TableCell align="right">
                                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                          <Tooltip title="Change Status">
                                            <IconButton
                                              size="small"
                                              color="primary"
                                              onClick={(event) => handleOpenStatusMenu(event, property, payment)}
                                            >
                                              <StatusIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                          <Tooltip title="View Details">
                                            <IconButton
                                              size="small"
                                              color="primary"
                                              onClick={() => handleViewPaymentDetails(property, payment)}
                                            >
                                              <VisibilityIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                          <Tooltip title="Print Invoice">
                                            <IconButton
                                              size="small"
                                              onClick={() => handleViewInvoice(property, payment)}
                                            >
                                              <PrintIcon fontSize="small" />
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
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>


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
                Property: {selectedProperty?.propertyName} ({selectedProperty?.propertyCode})
              </Typography>
            </Grid>
            {unpaidPayments.length > 0 && (
              <Grid item xs={12}>
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'warning.light',
                    borderRadius: 1,
                    p: 2,
                    backgroundColor: 'warning.50'
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" color="warning.dark">
                      Existing Unpaid Payments
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {unpaidPayments.length} record{unpaidPayments.length > 1 ? 's' : ''}
                    </Typography>
                  </Stack>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Invoice</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {unpaidPayments.map((payment) => (
                        <TableRow key={payment._id}>
                          <TableCell>{dayjs(payment.paymentDate).format('DD MMM, YYYY')}</TableCell>
                          <TableCell>{payment.invoiceNumber || 'N/A'}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(payment.totalAmount || payment.amount || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Typography variant="caption" color="text.secondary">
                    Clear the listed unpaid payments before adding another if needed.
                  </Typography>
                </Box>
              </Grid>
            )}
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
                <Typography variant="caption" color="text.secondary">
                  Current Amount: {formatCurrency(paymentForm.amount || 0)} + Arrears: {formatCurrency(paymentForm.arrears || 0)}
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
                  {paymentMethods.map(method => (
                    <MenuItem key={method} value={method}>{method}</MenuItem>
                  ))}
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

      {/* Payment Details Dialog */}
      {selectedProperty && selectedPayment && (
        <Dialog open={paymentDetailsDialog} onClose={() => setPaymentDetailsDialog(false)} maxWidth="lg" fullWidth>
          <DialogTitle sx={{ 
            borderBottom: '1px solid #e0e0e0',
            py: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}>
            <ReceiptIcon color="primary" sx={{ fontSize: 28 }} />
            <Box>
              <Typography variant="h5" fontWeight={600}>
                Payment Details
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Invoice: {selectedPayment.invoiceNumber || 'N/A'}
              </Typography>
            </Box>
            <IconButton
              onClick={() => setPaymentDetailsDialog(false)}
              sx={{ 
                position: 'absolute', 
                right: 8, 
                top: 8
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {/* Payment Details Section */}
              <Grid item xs={12}>
                <Card elevation={1} sx={{ borderRadius: 1 }}>
                  <Box sx={{ 
                    p: 2,
                    borderBottom: '1px solid #e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                  }}>
                    <MoneyIcon color="primary" />
                    <Typography variant="h6" fontWeight={600}>
                      Payment Information
                    </Typography>
                  </Box>
                  <CardContent sx={{ p: 3 }}>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Payment Date
                        </Typography>
                        <Typography variant="body1" fontWeight={600}>
                          {dayjs(selectedPayment.paymentDate).format('MMMM D, YYYY')}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Amount
                        </Typography>
                        <Typography variant="h6" fontWeight={600} color="primary">
                          {formatCurrency(selectedPayment.amount)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Status
                        </Typography>
                        {(() => {
                          const { color, label, iconColor } = getPaymentStatusConfig(selectedPayment.status);
                          return (
                            <Chip
                              label={label}
                              color={color === 'default' ? undefined : color}
                              variant={color === 'default' ? 'outlined' : 'filled'}
                              size="small"
                              icon={<StatusIcon fontSize="small" sx={{ color: iconColor }} />}
                            />
                          );
                        })()}
                      </Grid>
                      {selectedPayment.arrears > 0 && (
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Arrears
                          </Typography>
                          <Typography variant="body1" fontWeight={600} color="error">
                            {formatCurrency(selectedPayment.arrears)}
                          </Typography>
                        </Grid>
                      )}
                      {(selectedPayment.arrears > 0 || selectedPayment.totalAmount) && (
                        <Grid item xs={12}>
                          <Box sx={{ 
                            p: 2, 
                            borderRadius: 1, 
                            backgroundColor: '#e8f5e9',
                            borderLeft: '3px solid #4caf50'
                          }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Total Payment Amount
                            </Typography>
                            <Typography variant="h6" fontWeight={700} color="primary">
                              {formatCurrency(selectedPayment.totalAmount || (selectedPayment.amount + (selectedPayment.arrears || 0)))}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Period From
                        </Typography>
                        <Typography variant="body1" fontWeight={600}>
                          {selectedPayment.periodFrom ? dayjs(selectedPayment.periodFrom).format('MMMM D, YYYY') : 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Period To
                        </Typography>
                        <Typography variant="body1" fontWeight={600}>
                          {selectedPayment.periodTo ? dayjs(selectedPayment.periodTo).format('MMMM D, YYYY') : 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Invoice Number
                        </Typography>
                        <Typography variant="body1" fontWeight={600}>
                          {selectedPayment.invoiceNumber || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Payment Method
                        </Typography>
                        <Chip 
                          label={selectedPayment.paymentMethod} 
                          size="small" 
                          color="primary"
                          variant="outlined"
                        />
                      </Grid>
                      {selectedPayment.reference && (
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Reference/Transaction ID
                          </Typography>
                          <Typography variant="body1" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                            {selectedPayment.reference}
                          </Typography>
                        </Grid>
                      )}
                      {selectedPayment.notes && (
                        <Grid item xs={12}>
                          <Box sx={{ 
                            p: 2, 
                            borderRadius: 1, 
                            backgroundColor: '#f5f5f5',
                            borderLeft: '3px solid #1976d2'
                          }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Notes
                            </Typography>
                            <Typography variant="body1">
                              {selectedPayment.notes}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Property Details Section */}
              <Grid item xs={12} md={6}>
                <Card elevation={1} sx={{ borderRadius: 1, height: '100%' }}>
                  <Box sx={{ 
                    p: 2,
                    borderBottom: '1px solid #e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                  }}>
                    <HomeIcon color="primary" />
                    <Typography variant="h6" fontWeight={600}>
                      Property Details
                    </Typography>
                  </Box>
                  <CardContent sx={{ p: 3 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Property Code
                        </Typography>
                        <Typography variant="body1" fontWeight={600}>
                          {selectedProperty.propertyCode}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Property Name
                        </Typography>
                        <Typography variant="body1" fontWeight={600}>
                          {selectedProperty.propertyName}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Property Type
                        </Typography>
                        <Typography variant="body1" fontWeight={600}>
                          {selectedProperty.propertyType}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Status
                        </Typography>
                        <Chip
                          label={selectedProperty.status}
                          size="small"
                          color={
                            selectedProperty.status === 'Available' ? 'success' :
                            selectedProperty.status === 'Rented' ? 'error' :
                            selectedProperty.status === 'Under Maintenance' ? 'warning' : 'default'
                          }
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Address
                        </Typography>
                        <Typography variant="body1" fontWeight={600}>
                          {selectedProperty.fullAddress}
                        </Typography>
                        {(selectedProperty.street || selectedProperty.sector || selectedProperty.block) && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {[selectedProperty.street, selectedProperty.sector, selectedProperty.block].filter(Boolean).join(' • ')}
                            {selectedProperty.floor && ` • Floor: ${selectedProperty.floor}`}
                            {selectedProperty.unit && ` • Unit: ${selectedProperty.unit}`}
                          </Typography>
                        )}
                      </Grid>
                      {selectedProperty.area && selectedProperty.area.value > 0 && (
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Area
                          </Typography>
                          <Typography variant="body1" fontWeight={600}>
                            {selectedProperty.area.value} {selectedProperty.area.unit}
                          </Typography>
                        </Grid>
                      )}
                      {selectedProperty.bedrooms > 0 && (
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Bedrooms
                          </Typography>
                          <Typography variant="body1" fontWeight={600}>
                            {selectedProperty.bedrooms}
                          </Typography>
                        </Grid>
                      )}
                      {selectedProperty.bathrooms > 0 && (
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Bathrooms
                          </Typography>
                          <Typography variant="body1" fontWeight={600}>
                            {selectedProperty.bathrooms}
                          </Typography>
                        </Grid>
                      )}
                      {selectedProperty.expectedRent > 0 && (
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Expected Rent
                          </Typography>
                          <Typography variant="body1" fontWeight={600} color="primary">
                            {formatCurrency(selectedProperty.expectedRent)}
                          </Typography>
                        </Grid>
                      )}
                      {selectedProperty.securityDeposit > 0 && (
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Security Deposit
                          </Typography>
                          <Typography variant="body1" fontWeight={600} color="primary">
                            {formatCurrency(selectedProperty.securityDeposit)}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Tenant Details Section */}
              {selectedProperty.tenantName && (
                <Grid item xs={12} md={6}>
                  <Card elevation={1} sx={{ borderRadius: 1, height: '100%' }}>
                    <Box sx={{ 
                      p: 2,
                      borderBottom: '1px solid #e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5
                    }}>
                      <PersonIcon color="primary" />
                      <Typography variant="h6" fontWeight={600}>
                        Tenant Details
                      </Typography>
                    </Box>
                    <CardContent sx={{ p: 3 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Tenant Name
                          </Typography>
                          <Typography variant="body1" fontWeight={600}>
                            {selectedProperty.tenantName}
                          </Typography>
                        </Grid>
                        {selectedProperty.tenantPhone && (
                          <Grid item xs={12} md={6}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Phone
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                              {selectedProperty.tenantPhone}
                            </Typography>
                          </Grid>
                        )}
                        {selectedProperty.tenantEmail && (
                          <Grid item xs={12} md={6}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Email
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                              {selectedProperty.tenantEmail}
                            </Typography>
                          </Grid>
                        )}
                        {selectedProperty.tenantCNIC && (
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              CNIC
                            </Typography>
                            <Typography variant="body1" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                              {selectedProperty.tenantCNIC}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Agreement Details Section */}
              {selectedProperty.rentalAgreement && (
                <Grid item xs={12} md={selectedProperty.tenantName ? 6 : 12}>
                  <Card elevation={1} sx={{ borderRadius: 1, height: '100%' }}>
                    <Box sx={{ 
                      p: 2,
                      borderBottom: '1px solid #e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5
                    }}>
                      <DescriptionIcon color="primary" />
                      <Typography variant="h6" fontWeight={600}>
                        Rental Agreement Details
                      </Typography>
                    </Box>
                    <CardContent sx={{ p: 3 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Agreement Number
                          </Typography>
                          <Typography variant="body1" fontWeight={600}>
                            {selectedProperty.rentalAgreement.agreementNumber || 'N/A'}
                          </Typography>
                        </Grid>
                        {selectedProperty.rentalAgreement.propertyName && (
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Property Name (Agreement)
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                              {selectedProperty.rentalAgreement.propertyName}
                            </Typography>
                          </Grid>
                        )}
                        {selectedProperty.rentalAgreement.monthlyRent && (
                          <Grid item xs={12} md={6}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Monthly Rent
                            </Typography>
                            <Typography variant="body1" fontWeight={600} color="primary">
                              {formatCurrency(selectedProperty.rentalAgreement.monthlyRent)}
                            </Typography>
                          </Grid>
                        )}
                        {selectedProperty.rentalAgreement.startDate && (
                          <Grid item xs={12} md={6}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Start Date
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                              {dayjs(selectedProperty.rentalAgreement.startDate).format('MMMM D, YYYY')}
                            </Typography>
                          </Grid>
                        )}
                        {selectedProperty.rentalAgreement.endDate && (
                          <Grid item xs={12} md={6}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              End Date
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                              {dayjs(selectedProperty.rentalAgreement.endDate).format('MMMM D, YYYY')}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2.5, borderTop: '1px solid #e0e0e0' }}>
            <Button 
              onClick={() => setPaymentDetailsDialog(false)}
              variant="outlined"
            >
              Close
            </Button>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => {
                setPaymentDetailsDialog(false);
                handleViewInvoice(selectedProperty, selectedPayment);
              }}
            >
              View Invoice
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Invoice Print Dialog */}
      {invoiceData && (
        <Dialog open={invoiceDialog} onClose={() => setInvoiceDialog(false)} maxWidth="lg" fullWidth>
          <DialogTitle sx={{ '@media print': { display: 'none' } }}>
            Invoice - {invoiceData.invoiceNumber}
            <Stack direction="row" spacing={1} sx={{ position: 'absolute', right: 8, top: 8 }}>
              <Button startIcon={<DownloadIcon />} onClick={handleDownloadPDF} variant="outlined">
                Download PDF
              </Button>
              <Button startIcon={<PrintIcon />} onClick={handlePrintInvoice} variant="outlined">
                Print
              </Button>
              <IconButton onClick={() => setInvoiceDialog(false)}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Box id="invoice-print" sx={{ '@media print': { display: 'block' } }}>
              {/* Triplicate Copies */}
              {['Bank Copy', 'Office Copy', 'Client Copy'].map((copyLabel, copyIndex) => (
                <Paper
                  key={copyIndex}
                  sx={{
                    p: 3,
                    mb: copyIndex < 2 ? 3 : 0,
                    border: '1px solid #ddd',
                    pageBreakAfter: copyIndex < 2 ? 'always' : 'auto',
                    '@media print': {
                      pageBreakAfter: copyIndex < 2 ? 'always' : 'auto',
                      mb: copyIndex < 2 ? 0 : 0
                    }
                  }}
                >
                  {/* Header Section */}
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Typography variant="h5" fontWeight={700} color="primary">
                      TAJ RESIDENCIA
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      LIVE YOUR DREAMS
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      ({copyLabel})
                    </Typography>
                    <Typography variant="h6" fontWeight={700} color="error" sx={{ mt: 1 }}>
                      {invoiceData.propertyType.toUpperCase()} CHARGES
                    </Typography>
                  </Box>

                  {/* Property and Tenant Details */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={6}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ border: 0, py: 0.5, fontWeight: 600, width: '40%' }}>
                              Property Type:
                            </TableCell>
                            <TableCell sx={{ border: 0, py: 0.5 }}>
                              {invoiceData.propertyType}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ border: 0, py: 0.5, fontWeight: 600 }}>
                              Tenant Name:
                            </TableCell>
                            <TableCell sx={{ border: 0, py: 0.5 }}>
                              {invoiceData.tenantName}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ border: 0, py: 0.5, fontWeight: 600 }}>
                              Address:
                            </TableCell>
                            <TableCell sx={{ border: 0, py: 0.5 }}>
                              {invoiceData.address}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ border: 0, py: 0.5, fontWeight: 600, width: '40%' }}>
                              Period From:
                            </TableCell>
                            <TableCell sx={{ border: 0, py: 0.5 }}>
                              {dayjs(invoiceData.periodFrom).format('D-MMM-YY')}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ border: 0, py: 0.5, fontWeight: 600 }}>
                              Period To:
                            </TableCell>
                            <TableCell sx={{ border: 0, py: 0.5 }}>
                              {dayjs(invoiceData.periodTo).format('D-MMM-YY')}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ border: 0, py: 0.5, fontWeight: 600 }}>
                              Invoice No.:
                            </TableCell>
                            <TableCell sx={{ border: 0, py: 0.5 }}>
                              {invoiceData.invoiceNumber}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ border: 0, py: 0.5, fontWeight: 600 }}>
                              Invoicing Date:
                            </TableCell>
                            <TableCell sx={{ border: 0, py: 0.5 }}>
                              {dayjs(invoiceData.invoicingDate).format('MMMM D, YYYY')}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ border: 0, py: 0.5, fontWeight: 600 }}>
                              Due Date:
                            </TableCell>
                            <TableCell sx={{ border: 0, py: 0.5 }}>
                              {dayjs(invoiceData.dueDate).format('MMMM D, YYYY')}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Grid>
                  </Grid>

                  {/* Rent Details Section */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" align="center" sx={{ mb: 1, fontWeight: 600 }}>
                      (In Rupees)
                    </Typography>
                    <Typography variant="subtitle2" align="center" sx={{ mb: 2, fontWeight: 700 }}>
                      RENT DETAILS
                    </Typography>
                    <Table size="small" sx={{ mb: 2 }}>
                      <TableBody>
                        {invoiceData.charges.map((charge, idx) => (
                          <TableRow key={idx}>
                            <TableCell sx={{ border: 0, py: 0.5 }}>
                              {charge.description}
                            </TableCell>
                            <TableCell align="right" sx={{ border: 0, py: 0.5 }}>
                              {formatCurrency(charge.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell sx={{ borderTop: '1px solid #ddd', py: 1, fontWeight: 700 }}>
                            Total Due Amount
                          </TableCell>
                          <TableCell align="right" sx={{ borderTop: '1px solid #ddd', py: 1, fontWeight: 700 }}>
                            {formatCurrency(invoiceData.totalAmount)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Box>

                  {/* Payment Instructions */}
                  <Box sx={{ fontSize: '0.875rem', mt: 4 }}>
                    <Typography variant="body2" paragraph sx={{ mb: 1.5 }}>
                      1. The above mentioned charges are calculated based on proportionate share of user in total cost of electricity of the Project and do not include any profit element of TAJ Residencia.
                    </Typography>
                    <Typography variant="body2" paragraph sx={{ mb: 1.5 }}>
                      2. Please make your deposits through cash, crossed cheque or bank drafts on our specified deposit slip at any Allied Bank Limited branch in Pakistan to Account Title: <strong>Taj Residencia, Allied Bank Limited, The Centaurus Mall Branch, Islamabad. (0917) Bank Account No: PK68ABPA0010035700420129.</strong>
                    </Typography>
                    <Typography variant="body2" paragraph sx={{ mb: 1.5 }}>
                      3. Please deposit your dues before due date to avoid Late Payment Surcharge.
                    </Typography>
                    <Typography variant="body2">
                      4. Please share proof of payment to TAJ Official Whats App No.: <strong>0345 77 88 442:</strong>
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          </DialogContent>
        </Dialog>
      )}

      <Menu
        anchorEl={statusMenuAnchor}
        open={Boolean(statusMenuAnchor)}
        onClose={handleCloseStatusMenu}
      >
        {paymentStatuses.map((status) => {
          const { label, iconColor } = getPaymentStatusConfig(status);
          return (
            <MenuItem key={status} onClick={() => handleChangePaymentStatus(status)}>
              <StatusIcon fontSize="small" sx={{ mr: 1, color: iconColor }} />
              {label}
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};

export default RentalManagement;
