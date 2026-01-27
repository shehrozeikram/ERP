import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Divider,
  useTheme,
  alpha,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
  AttachMoney as AttachMoneyIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  CalendarMonth as CalendarIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import api from '../../../services/api';
import dayjs from 'dayjs';

const StoreDashboard = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupedData, setGroupedData] = useState([]);
  const [summary, setSummary] = useState({ totalCount: 0, totalAmount: 0 });
  const [viewDialog, setViewDialog] = useState({ open: false, data: null });
  const [expandedMonths, setExpandedMonths] = useState({});

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/procurement/store/dashboard');
      if (response.data.success) {
        setGroupedData(response.data.data.groupedByMonth);
        setSummary(response.data.data.summary);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load store dashboard data');
      console.error('Error loading store dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPKR = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return dayjs(date).format('DD-MMM-YYYY');
  };

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

  const formatDateForPrint = (date) => {
    if (!date) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(date);
    return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num || 0);
  };

  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'default',
      'Pending Approval': 'warning',
      'Pending Audit': 'warning',
      'Pending Finance': 'info',
      'Send to CEO Office': 'info',
      'Forwarded to CEO': 'primary',
      'Approved': 'success',
      'Sent to Store': 'info',
      'Ordered': 'info',
      'Partially Received': 'secondary',
      'Received': 'success',
      'Cancelled': 'error',
      'Rejected': 'error',
      'Returned from Audit': 'error',
      'Returned from CEO Office': 'warning',
      'Returned from CEO Secretariat': 'error'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'Low': 'info',
      'Medium': 'default',
      'High': 'warning',
      'Urgent': 'error'
    };
    return colors[priority] || 'default';
  };

  const handleAccordionChange = (monthYear) => (event, isExpanded) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthYear]: isExpanded
    }));
  };

  const handleView = async (po) => {
    try {
      // Fetch full PO data with populated fields
      const response = await api.get(`/procurement/purchase-orders/${po._id}`);
      if (response.data.success) {
        setViewDialog({ open: true, data: response.data.data });
      } else {
        setViewDialog({ open: true, data: po });
      }
    } catch (err) {
      setViewDialog({ open: true, data: po });
    }
  };

  const handleCloseView = () => {
    setViewDialog({ open: false, data: null });
  };


  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}
            >
              <InventoryIcon fontSize="large" />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                Store Dashboard
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Purchase Orders sent to Store - Organized by Month/Year
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)` }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Total Purchase Orders
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                    {summary.totalCount}
                  </Typography>
                </Box>
                <ShoppingCartIcon sx={{ fontSize: 48, color: theme.palette.primary.main, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)` }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Total Value
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                    {formatPKR(summary.totalAmount)}
                  </Typography>
                </Box>
                <AttachMoneyIcon sx={{ fontSize: 48, color: theme.palette.success.main, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)` }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Active Months
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.info.main }}>
                    {groupedData.length}
                  </Typography>
                </Box>
                <CalendarIcon sx={{ fontSize: 48, color: theme.palette.info.main, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Grouped by Month/Year */}
      {groupedData.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <InventoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="textSecondary">
            No Purchase Orders sent to Store yet
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Purchase Orders with status "Sent to Store" will appear here
          </Typography>
        </Paper>
      ) : (
        groupedData.map((monthGroup) => (
          <Accordion
            key={monthGroup.monthYear}
            expanded={expandedMonths[monthGroup.monthYear] !== undefined ? expandedMonths[monthGroup.monthYear] : true}
            onChange={handleAccordionChange(monthGroup.monthYear)}
            sx={{ mb: 2 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', mr: 2 }}>
                <CalendarIcon sx={{ color: theme.palette.primary.main }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.primary.main, flexGrow: 1 }}>
                  {monthGroup.monthYearLabel}
                </Typography>
                <Chip
                  label={`${monthGroup.count} PO${monthGroup.count !== 1 ? 's' : ''}`}
                  color="primary"
                  size="small"
                  sx={{ mr: 1 }}
                />
                <Chip
                  label={formatPKR(monthGroup.totalAmount)}
                  color="success"
                  size="small"
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                      <TableCell><strong>Order Number</strong></TableCell>
                      <TableCell><strong>Vendor</strong></TableCell>
                      <TableCell><strong>Order Date</strong></TableCell>
                      <TableCell><strong>Expected Delivery</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell><strong>Priority</strong></TableCell>
                      <TableCell align="right"><strong>Total Amount</strong></TableCell>
                      <TableCell align="center"><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthGroup.purchaseOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Typography variant="body2" color="textSecondary">
                            No purchase orders found for this month
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      monthGroup.purchaseOrders.map((po) => (
                        <TableRow key={po._id} hover>
                          <TableCell>{po.orderNumber || 'N/A'}</TableCell>
                          <TableCell>{po.vendor?.name || 'Unknown Vendor'}</TableCell>
                          <TableCell>{formatDate(po.orderDate)}</TableCell>
                          <TableCell>{formatDate(po.expectedDeliveryDate)}</TableCell>
                          <TableCell>
                            <Chip
                              label={po.status}
                              color={getStatusColor(po.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={po.priority || 'Medium'}
                              color={getPriorityColor(po.priority || 'Medium')}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">{formatPKR(po.totalAmount || 0)}</TableCell>
                          <TableCell align="center">
                            <Tooltip title="View">
                              <IconButton size="small" onClick={() => handleView(po)}>
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        ))
      )}

      {/* View Dialog */}
      <Dialog 
        open={viewDialog.open} 
        onClose={handleCloseView}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: '90%',
            maxWidth: '210mm',
            maxHeight: '95vh',
            m: 2,
            '@media print': {
              boxShadow: 'none',
              maxWidth: '100%',
              margin: 0,
              height: '100%',
              width: '100%',
              maxHeight: '100%'
            }
          }
        }}
      >
        <DialogTitle sx={{ '@media print': { display: 'none' }, pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Purchase Order Details</Typography>
            <IconButton onClick={handleCloseView} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'auto', '@media print': { p: 0, overflow: 'visible' } }}>
          {viewDialog.data && (
            <Box sx={{ width: '100%' }} className="print-content">
              <Paper
                sx={{
                  p: { xs: 3, sm: 3.5, md: 4 },
                  maxWidth: '210mm',
                  mx: 'auto',
                  backgroundColor: '#fff',
                  boxShadow: 'none',
                  width: '100%',
                  fontFamily: 'Arial, sans-serif',
                  '@media print': {
                    boxShadow: 'none',
                    p: 2.5,
                    maxWidth: '100%',
                    backgroundColor: '#fff',
                    mx: 0,
                    width: '100%',
                    pageBreakInside: 'avoid'
                  }
                }}
              >
                {/* Title - Centered */}
                <Typography
                  variant="h4"
                  fontWeight={700}
                  align="center"
                  sx={{
                    textTransform: 'uppercase',
                    mb: 3,
                    fontSize: { xs: '1.8rem', print: '1.6rem' },
                    letterSpacing: 1
                  }}
                >
                  Purchase Order
                </Typography>

                {/* Buyer Information - First Row */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 1, fontSize: '1.1rem' }}>
                    Residencia
                  </Typography>
                  <Typography sx={{ fontSize: '0.9rem', mb: 0.5 }}>
                    1st Avenue 18 4 Islamabad
                  </Typography>
                  <Typography sx={{ fontSize: '0.9rem' }}>
                    1. Het Sne 1-8. Islamabad.
                  </Typography>
                </Box>

                {/* Divider */}
                <Divider sx={{ my: 2.5, borderWidth: 1, borderColor: '#ccc' }} />

                {/* Vendor and PO Details - Second Row in Columns */}
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', gap: 3 }}>
                  {/* Left Column - Vendor Info */}
                  <Box sx={{ width: '45%', fontSize: '0.9rem' }}>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 1, fontSize: '1.1rem' }}>
                      {viewDialog.data.vendor?.name || 'Vendor Name'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.6, mb: 2 }}>
                      {viewDialog.data.vendor?.address || 'Vendor Address'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', lineHeight: 1.6 }}>
                      <Typography component="span" sx={{ fontWeight: 600, mr: 1 }}>Indent Details:</Typography>
                      <Typography component="span">
                        Indent# {viewDialog.data.indent?.indentNumber || 'N/A'} Dated. {viewDialog.data.indent?.requestedDate ? formatDateForPrint(viewDialog.data.indent.requestedDate) : 'N/A'}.
                        {viewDialog.data.indent?.title && ` ${viewDialog.data.indent.title}.`}
                        {viewDialog.data.indent?.requestedBy && ` End User. ${viewDialog.data.indent.requestedBy.firstName} ${viewDialog.data.indent.requestedBy.lastName}`}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Right Column - PO Details */}
                  <Box sx={{ width: '50%', fontSize: '0.9rem', lineHeight: 2 }}>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>P.O No.:</Typography>
                      <Typography component="span">
                        {viewDialog.data.orderNumber ? 
                          (viewDialog.data.orderNumber.startsWith('P') && !viewDialog.data.orderNumber.includes('-')
                            ? viewDialog.data.orderNumber
                            : 'P' + (viewDialog.data.orderNumber.match(/\d+$/)?.[0] || viewDialog.data.orderNumber.split('-').pop() || '').padStart(9, '0'))
                          : 'N/A'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Date:</Typography>
                      <Typography component="span">{formatDateForPrint(viewDialog.data.orderDate)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Delivery Date:</Typography>
                      <Typography component="span">{viewDialog.data.expectedDeliveryDate ? formatDateForPrint(viewDialog.data.expectedDeliveryDate) : '___________'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Delivery Address:</Typography>
                      <Typography component="span">{viewDialog.data.shippingAddress ? 
                        `${viewDialog.data.shippingAddress.street || ''} ${viewDialog.data.shippingAddress.city || ''}`.trim() || '___________' 
                        : '___________'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Cost Center:</Typography>
                      <Typography component="span">{viewDialog.data.indent?.department?.name || '___________'}</Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Items Table */}
                <Box sx={{ mb: 3 }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      border: '1px solid #000',
                      fontSize: '0.85rem',
                      fontFamily: 'Arial, sans-serif'
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5', border: '1px solid #000' }}>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '5%' }}>
                          Sr no
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '11%' }}>
                          Product
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '23%' }}>
                          Description
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '14%' }}>
                          Specification
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '10%' }}>
                          Brand
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '8%' }}>
                          Quantity Unit
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '9%' }}>
                          Rate
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '10%' }}>
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDialog.data.items && viewDialog.data.items.length > 0 ? (
                        viewDialog.data.items.map((item, index) => (
                          <tr key={index}>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{index + 1}</td>
                            <td style={{ border: '1px solid #000', padding: '8px' }}>{item.product || item.description?.split(' ')[0] || '-'}</td>
                            <td style={{ border: '1px solid #000', padding: '8px' }}>{item.description || '-'}</td>
                            <td style={{ border: '1px solid #000', padding: '8px' }}>{item.specification || '-'}</td>
                            <td style={{ border: '1px solid #000', padding: '8px' }}>{item.brand || '-'}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{item.quantity} {item.unit || 'pcs'}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatNumber(item.unitPrice || 0)}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatNumber(item.amount || 0)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
                            No items
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Box>

                {/* Financial Summary - Right Aligned */}
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Box sx={{ width: '300px', fontSize: '0.9rem' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography component="span" fontWeight={600}>Total (Rupees):</Typography>
                      <Typography component="span">{formatNumber(viewDialog.data.totalAmount || 0)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography component="span" fontWeight={600}>Net Total:</Typography>
                      <Typography component="span">{formatNumber(viewDialog.data.totalAmount || 0)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography component="span" fontWeight={600}>Freight Charges:</Typography>
                      <Typography component="span">{formatNumber(viewDialog.data.shippingCost || 0)}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
                      Rupees {numberToWords(viewDialog.data.totalAmount || 0)}
                    </Typography>
                  </Box>
                </Box>

                {/* Terms & Conditions */}
                <Box sx={{ mb: 3, border: '1px solid #ccc', p: 2, fontSize: '0.9rem' }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, textDecoration: 'underline' }}>
                    TERMS & CONDITIONS
                  </Typography>
                  <Box sx={{ lineHeight: 1.8 }}>
                    <Typography sx={{ mb: 1, fontWeight: 600 }}>Main Terms & Conditions</Typography>
                    <Box sx={{ mb: 1 }}>
                      <Typography component="span" fontWeight={600}>Payment Terms:</Typography>
                      <Typography component="span" sx={{ ml: 1 }}>
                        {viewDialog.data.paymentTerms || '100% Advance Payment'}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <Typography component="span" fontWeight={600}>Delivery Terms:</Typography>
                      <Typography component="span" sx={{ ml: 1 }}>
                        At-Site Delivery
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <Typography component="span" fontWeight={600}>Delivery Time.</Typography>
                      <Typography component="span" sx={{ ml: 1 }}>
                        Delivery within: {viewDialog.data.quotation?.deliveryTime || '03 days'} of confirmed PO & Payment
                      </Typography>
                    </Box>
                    <Typography sx={{ mb: 1 }}>
                      Rates Are Exclusive Of all The Taxes
                    </Typography>
                    {viewDialog.data.vendor?.cnic && (
                      <Typography sx={{ mb: 1 }}>
                        CNIC {viewDialog.data.vendor.cnic}
                      </Typography>
                    )}
                    {viewDialog.data.vendor?.payeeName && (
                      <Typography>
                        Payee Name: {viewDialog.data.vendor.payeeName}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Approval/Signature Section */}
                <Box sx={{ mt: 4 }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.85rem',
                      fontFamily: 'Arial, sans-serif'
                    }}
                  >
                    <tbody>
                      <tr>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '14%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 } }}></Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>Prepared By</Typography>
                        </td>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '14%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 } }}></Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>Manager Procurement</Typography>
                        </td>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '14%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 } }}></Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>Director Procurement</Typography>
                        </td>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '14%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 } }}></Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>Internal Auditor</Typography>
                        </td>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '14%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 } }}></Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>Director Finance</Typography>
                        </td>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '15%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 } }}></Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>Senior Executive Director</Typography>
                        </td>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '15%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 } }}></Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>President</Typography>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Box>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ '@media print': { display: 'none' } }}>
          <Button onClick={handleCloseView}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Print Styles for Dialog */}
      <Box
        component="style"
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4;
                margin: 15mm;
              }
              body * {
                visibility: hidden;
              }
              .MuiDialog-container,
              .MuiDialog-container *,
              .MuiDialog-paper,
              .MuiDialog-paper *,
              .print-content,
              .print-content * {
                visibility: visible;
              }
              .MuiDialog-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: 100% !important;
                display: block !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
              }
              .MuiDialog-paper {
                box-shadow: none !important;
                margin: 0 !important;
                max-width: 100% !important;
                width: 100% !important;
                height: auto !important;
                max-height: none !important;
                position: relative !important;
                transform: none !important;
                overflow: visible !important;
              }
              .MuiDialogContent-root {
                overflow: visible !important;
                padding: 0 !important;
                height: auto !important;
                max-height: none !important;
                margin: 0 !important;
              }
              .MuiDialogTitle-root {
                display: none !important;
              }
              .MuiDialogActions-root {
                display: none !important;
              }
              .MuiBackdrop-root {
                display: none !important;
              }
              .MuiPaper-root {
                box-shadow: none !important;
              }
            }
          `
        }}
      />
    </Box>
  );
};

export default StoreDashboard;
