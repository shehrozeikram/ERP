import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Alert,
  Skeleton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton
} from '@mui/material';
import {
  Edit as EditIcon,
  Payment as PaymentIcon,
  ArrowBack as ArrowBackIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  AccountBalance as AccountIcon,
  LocationOn as LocationIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import utilityBillService from '../../../services/utilityBillService';
import { getImageUrl, handleImageError } from '../../../utils/imageService';

const UtilityBillDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    paidAmount: 0,
    paymentMethod: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const paymentMethods = ['Cash', 'Bank Transfer', 'Cheque', 'Online', 'Credit Card', 'Other'];

  useEffect(() => {
    fetchBill();
  }, [id]);

  const fetchBill = async () => {
    try {
      setLoading(true);
      const response = await utilityBillService.getUtilityBill(id);
      setBill(response.data);
    } catch (err) {
      setError('Failed to fetch utility bill details');
      console.error('Error fetching bill:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = () => {
    setPaymentData({
      paidAmount: bill.amount - bill.paidAmount,
      paymentMethod: '',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setPaymentDialog(true);
  };

  const handlePaymentSubmit = async () => {
    try {
      await utilityBillService.recordPayment(bill._id, paymentData);
      setPaymentDialog(false);
      fetchBill();
    } catch (err) {
      setError('Failed to record payment');
      console.error('Error recording payment:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'success';
      case 'Pending': return 'warning';
      case 'Overdue': return 'error';
      case 'Partial': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Paid': return <CheckCircleIcon />;
      case 'Pending': return <WarningIcon />;
      case 'Overdue': return <WarningIcon />;
      case 'Partial': return <InfoIcon />;
      default: return <InfoIcon />;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handlePrint = () => {
    if (!bill) return;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Get the current date and time for the print header
    const printDate = new Date().toLocaleString();
    
    // Create the print content HTML with comprehensive styling
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Utility Bill - ${bill?.billNumber || 'N/A'}</title>
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
              font-size: 24px;
              font-weight: bold;
            }
            .header .subtitle {
              color: #333;
              font-size: 16px;
              margin-bottom: 8px;
              font-weight: bold;
            }
            .print-date {
              color: #666;
              font-size: 12px;
            }
            .section {
              margin-bottom: 25px;
              page-break-inside: avoid;
              border: 1px solid #ccc;
              padding: 15px;
            }
            .section-title {
              background-color: #e0e0e0;
              padding: 10px 15px;
              margin: -15px -15px 15px -15px;
              border-bottom: 2px solid #000;
              font-weight: bold;
              font-size: 16px;
              color: #000;
              text-transform: uppercase;
            }
            .field-row {
              display: flex;
              margin-bottom: 8px;
              border-bottom: 1px dotted #999;
              padding-bottom: 5px;
              min-height: 20px;
            }
            .field-label {
              font-weight: bold;
              min-width: 180px;
              color: #000;
              font-size: 13px;
            }
            .field-value {
              flex: 1;
              color: #000;
              font-size: 13px;
              word-wrap: break-word;
            }
            .status-chip {
              display: inline-block;
              padding: 3px 8px;
              border: 1px solid #000;
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
              background-color: #f0f0f0;
            }
            .status-paid { background-color: #e8f5e8; }
            .status-pending { background-color: #fff3cd; }
            .status-overdue { background-color: #f8d7da; }
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 2px solid #000;
              text-align: center;
              color: #333;
              font-size: 11px;
            }
            .important-info {
              background-color: #fff3cd;
              border: 1px solid #ffeaa7;
              padding: 10px;
              margin: 10px 0;
              font-weight: bold;
            }
            .record-id {
              font-family: monospace;
              background-color: #f8f9fa;
              padding: 2px 5px;
              border: 1px solid #ccc;
            }
            .bill-image {
              max-width: 300px;
              max-height: 200px;
              border: 1px solid #ccc;
              margin: 10px 0;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
              .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>UTILITY BILL</h1>
            <div class="subtitle">Bill Number: ${bill?.billNumber || 'N/A'}</div>
            <div class="print-date">Printed on: ${printDate}</div>
          </div>

          <!-- Bill Summary -->
          <div class="section">
            <div class="section-title">📋 Bill Summary</div>
            <div class="field-row">
              <div class="field-label">Bill ID:</div>
              <div class="field-value"><span class="record-id">${bill?._id || 'N/A'}</span></div>
            </div>
            <div class="field-row">
              <div class="field-label">Status:</div>
              <div class="field-value">
                <span class="status-chip status-${bill?.status?.toLowerCase() || 'pending'}">${bill?.status || 'N/A'}</span>
              </div>
            </div>
            <div class="field-row">
              <div class="field-label">Bill Number:</div>
              <div class="field-value">${bill?.billNumber || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Utility Type:</div>
              <div class="field-value">${bill?.utilityType || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Total Amount:</div>
              <div class="field-value">${bill?.amount ? formatCurrency(bill.amount) : 'N/A'}</div>
            </div>
          </div>

          <!-- Bill Details -->
          <div class="section">
            <div class="section-title">💡 Bill Details</div>
            <div class="field-row">
              <div class="field-label">Provider:</div>
              <div class="field-value">${bill?.provider || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Account Number:</div>
              <div class="field-value">${bill?.accountNumber || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Location:</div>
              <div class="field-value">${bill?.location || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Bill Date:</div>
              <div class="field-value">${bill?.billDate ? formatDate(bill.billDate) : 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Due Date:</div>
              <div class="field-value">${bill?.dueDate ? formatDate(bill.dueDate) : 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Description:</div>
              <div class="field-value">${bill?.description || 'N/A'}</div>
            </div>
          </div>

          <!-- Reading Information -->
          ${bill?.previousReading !== undefined ? `
          <div class="section">
            <div class="section-title">📊 Reading Information</div>
            <div class="field-row">
              <div class="field-label">Previous Reading:</div>
              <div class="field-value">${bill.previousReading || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Current Reading:</div>
              <div class="field-value">${bill.currentReading || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Units Consumed:</div>
              <div class="field-value">${bill.unitsConsumed || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Rate Per Unit:</div>
              <div class="field-value">${bill.ratePerUnit ? formatCurrency(bill.ratePerUnit) : 'N/A'}</div>
            </div>
          </div>
          ` : ''}

          <!-- Payment Information -->
          <div class="section">
            <div class="section-title">💳 Payment Information</div>
            <div class="field-row">
              <div class="field-label">Total Amount:</div>
              <div class="field-value">${bill?.amount ? formatCurrency(bill.amount) : 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Paid Amount:</div>
              <div class="field-value">${bill?.paidAmount ? formatCurrency(bill.paidAmount) : 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Remaining Amount:</div>
              <div class="field-value">${bill?.amount && bill?.paidAmount ? formatCurrency(bill.amount - bill.paidAmount) : 'N/A'}</div>
            </div>
            ${bill?.paymentMethod ? `
            <div class="field-row">
              <div class="field-label">Payment Method:</div>
              <div class="field-value">${bill.paymentMethod}</div>
            </div>
            ` : ''}
            ${bill?.paymentDate ? `
            <div class="field-row">
              <div class="field-label">Payment Date:</div>
              <div class="field-value">${formatDate(bill.paymentDate)}</div>
            </div>
            ` : ''}
          </div>

          <!-- Tax Information -->
          ${bill?.taxes && (bill.taxes.gst > 0 || bill.taxes.other > 0) ? `
          <div class="section">
            <div class="section-title">💰 Tax Breakdown</div>
            ${bill.taxes.gst > 0 ? `
            <div class="field-row">
              <div class="field-label">GST:</div>
              <div class="field-value">${formatCurrency(bill.taxes.gst)}</div>
            </div>
            ` : ''}
            ${bill.taxes.other > 0 ? `
            <div class="field-row">
              <div class="field-label">Other Taxes:</div>
              <div class="field-value">${formatCurrency(bill.taxes.other)}</div>
            </div>
            ` : ''}
          </div>
          ` : ''}

          <!-- Bill Image -->
          ${bill?.billImage ? `
          <div class="section">
            <div class="section-title">📷 Bill Image</div>
            <div class="field-row">
              <div class="field-label">Image:</div>
              <div class="field-value">
                <img src="${getImageUrl(bill.billImage)}" alt="Bill Image" class="bill-image" />
              </div>
            </div>
          </div>
          ` : ''}

          <!-- System Information -->
          <div class="section">
            <div class="section-title">ℹ️ System Information</div>
            <div class="field-row">
              <div class="field-label">Created Date:</div>
              <div class="field-value">${bill?.createdAt ? new Date(bill.createdAt).toLocaleString() : 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Last Updated:</div>
              <div class="field-value">${bill?.updatedAt ? new Date(bill.updatedAt).toLocaleString() : 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Record Version:</div>
              <div class="field-value">${bill?.__v || '0'}</div>
            </div>
          </div>

          <!-- Additional Information -->
          <div class="section">
            <div class="section-title">📝 Additional Information</div>
            <div class="important-info">
              This document contains all available information for Utility Bill ${bill?.billNumber || bill?._id || 'N/A'}
            </div>
            <div class="field-row">
              <div class="field-label">Total Fields:</div>
              <div class="field-value">${Object.keys(bill || {}).length} data fields</div>
            </div>
            <div class="field-row">
              <div class="field-label">Document Status:</div>
              <div class="field-value">Complete - All available data included</div>
            </div>
          </div>

          <div class="footer">
            <p><strong>Generated from SGC ERP System - Utility Bill Management Module</strong></p>
            <p>Bill ID: <span class="record-id">${bill?._id || 'N/A'}</span> | Printed: ${printDate}</p>
            <p>This is a complete record printout containing all available information</p>
          </div>
        </body>
      </html>
    `;

    // Write the content to the new window
    printWindow.document.write(printContent);
    printWindow.document.close();

    // Wait for content to load, then trigger print
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header Skeleton */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Skeleton variant="rectangular" width={100} height={36} borderRadius={1} />
            <Skeleton variant="text" width="40%" height={40} />
          </Box>
          <Box display="flex" gap={1}>
            <Skeleton variant="rectangular" width={100} height={36} borderRadius={1} />
            <Skeleton variant="rectangular" width={120} height={36} borderRadius={1} />
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Main Bill Info Skeleton */}
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Skeleton variant="text" width="30%" height={28} sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Skeleton variant="circular" width={24} height={24} />
                      <Box flexGrow={1}>
                        <Skeleton variant="text" height={16} width="30%" />
                        <Skeleton variant="text" height={20} width="50%" />
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Skeleton variant="circular" width={24} height={24} />
                      <Box flexGrow={1}>
                        <Skeleton variant="text" height={16} width="25%" />
                        <Skeleton variant="rectangular" height={24} width={80} />
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Skeleton variant="circular" width={24} height={24} />
                      <Box flexGrow={1}>
                        <Skeleton variant="text" height={16} width="35%" />
                        <Skeleton variant="text" height={20} width="60%" />
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Skeleton variant="circular" width={24} height={24} />
                      <Box flexGrow={1}>
                        <Skeleton variant="text" height={16} width="30%" />
                        <Skeleton variant="text" height={20} width="55%" />
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Payments History Skeleton */}
            <Card>
              <CardContent>
                <Skeleton variant="text" width="25%" height={28} sx={{ mb: 2 }} />
                {[1, 2, 3].map((item) => (
                  <Grid container key={item} sx={{ mb: 2 }}>
                    <Grid item xs={3}>
                      <Skeleton variant="text" height={16} width="80%" />
                      <Skeleton variant="text" height={14} width="60%" />
                    </Grid>
                    <Grid item xs={3}>
                      <Skeleton variant="text" height={16} width="70%" />
                    </Grid>
                    <Grid item xs={3}>
                      <Skeleton variant="rectangular" height={24} width={60} />
                    </Grid>
                    <Grid item xs={3}>
                      <Skeleton variant="text" height={16} width="50%" />
                    </Grid>
                  </Grid>
                ))}
              </CardContent>
            </Card>
          </Grid>

          {/* Side Panel Skeleton */}
          <Grid item xs={12} md={4}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Skeleton variant="text" width="40%" height={28} sx={{ mb: 2 }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Skeleton variant="text" height={48} width="80%" sx={{ mx: 'auto', mb: 1 }} />
                  <Skeleton variant="rectangular" height={24} width={100} sx={{ mx: 'auto' }} />
                </Box>
              </CardContent>
            </Card>

            {/* Bill Summary Skeleton */}
            <Card>
              <CardContent>
                <Skeleton variant="text" width="35%" height={28} sx={{ mb: 2 }} />
                <Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Skeleton variant="text" height={16} width="40%" />
                    <Skeleton variant="text" height={16} width="30%" />
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Skeleton variant="text" height={16} width="35%" />
                    <Skeleton variant="text" height={16} width="25%" />
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Skeleton variant="text" height={20} width="30%" />
                    <Skeleton variant="text" height={20} width="40%" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/utility-bills')}
        >
          Back to Bills
        </Button>
      </Box>
    );
  }

  if (!bill) {
    return (
      <Box>
        <Typography variant="h6" color="textSecondary">
          Utility bill not found
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/utility-bills')}
          sx={{ mt: 2 }}
        >
          Back to Bills
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Utility Bill Details
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
          >
            Print
          </Button>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/utility-bills')}
          >
            Back to Bills
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/admin/utility-bills/${bill._id}/edit`)}
          >
            Edit Bill
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Bill Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Bill Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Bill ID
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bill.billId}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Utility Type
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bill.utilityType}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Provider
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bill.provider}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Account Number
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bill.accountNumber || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Bill Date
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {formatDate(bill.billDate)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Due Date
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {formatDate(bill.dueDate)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Location
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bill.location}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Status
                  </Typography>
                  <Chip
                    label={bill.status}
                    color={getStatusColor(bill.status)}
                    size="small"
                    icon={getStatusIcon(bill.status)}
                  />
                </Grid>
                {bill.description && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">
                      Description
                    </Typography>
                    <Typography variant="body1">
                      {bill.description}
                    </Typography>
                  </Grid>
                )}
                {bill.notes && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">
                      Notes
                    </Typography>
                    <Typography variant="body1">
                      {bill.notes}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Bill Image Section */}
          {bill.billImage && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Bill Image
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    component="img"
                    src={getImageUrl(bill.billImage)}
                    alt="Bill Image"
                    sx={{
                      width: 200,
                      height: 200,
                      objectFit: 'cover',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      cursor: 'pointer'
                    }}
                    onError={(e) => handleImageError(e)}
                    onClick={() => setImageModalOpen(true)}
                  />
                  <Box>
                    <Button
                      variant="outlined"
                      startIcon={<ViewIcon />}
                      onClick={() => setImageModalOpen(true)}
                    >
                      View Full Image
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Reading Information */}
          {bill.previousReading !== undefined && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Reading Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="textSecondary">
                      Previous Reading
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {bill.previousReading}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="textSecondary">
                      Current Reading
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {bill.currentReading}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="textSecondary">
                      Units Consumed
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      {bill.units}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Rate Per Unit
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {formatCurrency(bill.ratePerUnit)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Payment Information */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Total Amount
                </Typography>
                <Typography variant="h5" color="primary.main" fontWeight="bold">
                  {formatCurrency(bill.amount)}
                </Typography>
              </Box>
              
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Paid Amount
                </Typography>
                <Typography variant="h6" color="success.main" fontWeight="bold">
                  {formatCurrency(bill.paidAmount)}
                </Typography>
              </Box>
              
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Remaining Amount
                </Typography>
                <Typography variant="h6" color="error.main" fontWeight="bold">
                  {formatCurrency(bill.amount - bill.paidAmount)}
                </Typography>
              </Box>

              {bill.paymentMethod && (
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">
                    Payment Method
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bill.paymentMethod}
                  </Typography>
                </Box>
              )}

              {bill.paymentDate && (
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">
                    Payment Date
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {formatDate(bill.paymentDate)}
                  </Typography>
                </Box>
              )}

              {bill.status !== 'Paid' && (
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  onClick={handlePayment}
                  sx={{ mt: 2 }}
                >
                  Record Payment
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Tax Information */}
          {(bill.taxes?.gst > 0 || bill.taxes?.other > 0) && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Tax Breakdown
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <List dense>
                  {bill.taxes.gst > 0 && (
                    <ListItem>
                      <ListItemText
                        primary="GST"
                        secondary={formatCurrency(bill.taxes.gst)}
                      />
                    </ListItem>
                  )}
                  {bill.taxes.other > 0 && (
                    <ListItem>
                      <ListItemText
                        primary="Other Taxes"
                        secondary={formatCurrency(bill.taxes.other)}
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Payment Amount"
                type="number"
                value={paymentData.paidAmount}
                onChange={(e) => setPaymentData({ ...paymentData, paidAmount: parseFloat(e.target.value) })}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
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
                fullWidth
                label="Payment Date"
                type="date"
                value={paymentData.paymentDate}
                onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button onClick={handlePaymentSubmit} variant="contained">Record Payment</Button>
        </DialogActions>
      </Dialog>

      {/* Image Modal */}
      <Dialog
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'transparent',
            boxShadow: 'none'
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: 'white'
        }}>
          <Typography variant="h6">Bill Image</Typography>
          <IconButton
            onClick={() => setImageModalOpen(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <Box
            component="img"
            src={getImageUrl(bill?.billImage)}
            alt="Bill Image"
            sx={{
              width: '100%',
              height: 'auto',
              maxHeight: '80vh',
              objectFit: 'contain',
              display: 'block'
            }}
            onError={(e) => handleImageError(e)}
          />
        </DialogContent>
        <DialogActions sx={{
          backgroundColor: 'rgba(0,0,0,0.8)',
          justifyContent: 'center'
        }}>
          <Button
            onClick={() => setImageModalOpen(false)}
            variant="contained"
            color="primary"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UtilityBillDetails;