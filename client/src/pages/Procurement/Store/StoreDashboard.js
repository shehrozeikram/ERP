import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  TableRow,
  TextField
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
  AttachMoney as AttachMoneyIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  CalendarMonth as CalendarIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as PassIcon,
  Cancel as RejectIcon,
  Print as PrintIcon,
  LocalShipping as CreateGRNIcon
} from '@mui/icons-material';
import api from '../../../services/api';
import dayjs from 'dayjs';
import PODocumentView from './PODocumentView';

const StoreDashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupedData, setGroupedData] = useState([]);
  const [summary, setSummary] = useState({ totalCount: 0, totalAmount: 0 });
  const [viewDialog, setViewDialog] = useState({ open: false, data: null });
  const [expandedMonths, setExpandedMonths] = useState({});
  const [qaDialog, setQaDialog] = useState({ open: false, po: null, action: null, remarks: '' });
  const [qaSubmitting, setQaSubmitting] = useState(false);

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

  const getQaStatusColor = (status) => {
    const colors = { Pending: 'warning', Passed: 'success', Rejected: 'error' };
    return colors[status || 'Pending'] || 'default';
  };

  const openQaDialog = (po, action) => {
    setQaDialog({ open: true, po, action, remarks: '' });
  };

  const handleQaSubmit = async () => {
    if (!qaDialog.po || !qaDialog.action) return;
    try {
      setQaSubmitting(true);
      await api.post(`/procurement/store/po/${qaDialog.po._id}/qa-check`, {
        status: qaDialog.action,
        remarks: qaDialog.remarks || undefined
      });
      setQaDialog({ open: false, po: null, action: null, remarks: '' });
      await loadDashboardData();
      if (viewDialog.open && viewDialog.data && viewDialog.data._id === qaDialog.po._id) {
        const res = await api.get(`/procurement/purchase-orders/${qaDialog.po._id}`);
        if (res.data?.success) setViewDialog({ open: true, data: res.data.data });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'QA check failed');
    } finally {
      setQaSubmitting(false);
    }
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
                      <TableCell><strong>QA Status</strong></TableCell>
                      <TableCell><strong>Priority</strong></TableCell>
                      <TableCell align="right"><strong>Total Amount</strong></TableCell>
                      <TableCell align="center"><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthGroup.purchaseOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
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
                              label={po.qaStatus || 'Pending'}
                              color={getQaStatusColor(po.qaStatus)}
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
                            {po.qaStatus === 'Passed' && (
                              <Tooltip title="Create GRN">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => navigate(`/procurement/store/goods-receive?createFromPo=${po._id}`)}
                                >
                                  <CreateGRNIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6">Purchase Order Details</Typography>
              {viewDialog.data && (
                <Chip
                  label={`QA: ${viewDialog.data.qaStatus || 'Pending'}`}
                  color={getQaStatusColor(viewDialog.data.qaStatus)}
                  size="small"
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>
                Print
              </Button>
              {viewDialog.data && viewDialog.data.qaStatus === 'Passed' && (
                <Button size="small" variant="contained" startIcon={<CreateGRNIcon />} onClick={() => { handleCloseView(); navigate(`/procurement/store/goods-receive?createFromPo=${viewDialog.data._id}`); }}>
                  Create GRN
                </Button>
              )}
              {viewDialog.data && (viewDialog.data.qaStatus || 'Pending') === 'Pending' && (
                <>
                  <Button size="small" color="success" variant="outlined" startIcon={<PassIcon />} onClick={() => openQaDialog(viewDialog.data, 'Passed')}>
                    Pass QA
                  </Button>
                  <Button size="small" color="error" variant="outlined" startIcon={<RejectIcon />} onClick={() => openQaDialog(viewDialog.data, 'Rejected')}>
                    Reject QA
                  </Button>
                </>
              )}
              <IconButton onClick={handleCloseView} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'auto', '@media print': { p: 0, overflow: 'visible' } }}>
          {viewDialog.data && (
            <Box sx={{ width: '100%' }} className="print-content">
              <PODocumentView data={viewDialog.data} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ '@media print': { display: 'none' } }}>
          <Button onClick={handleCloseView}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* QA Check confirmation dialog */}
      <Dialog open={qaDialog.open} onClose={() => setQaDialog({ open: false, po: null, action: null, remarks: '' })} maxWidth="xs" fullWidth>
        <DialogTitle>
          Quality Assurance – {qaDialog.action === 'Passed' ? 'Pass' : 'Reject'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {qaDialog.po?.orderNumber && `PO ${qaDialog.po.orderNumber}`}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Remarks (optional)"
            value={qaDialog.remarks}
            onChange={(e) => setQaDialog((prev) => ({ ...prev, remarks: e.target.value }))}
            placeholder={qaDialog.action === 'Rejected' ? 'Reason for rejection...' : 'Optional notes...'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQaDialog({ open: false, po: null, action: null, remarks: '' })}>Cancel</Button>
          <Button
            variant="contained"
            color={qaDialog.action === 'Passed' ? 'success' : 'error'}
            onClick={handleQaSubmit}
            disabled={qaSubmitting}
          >
            {qaSubmitting ? 'Submitting...' : (qaDialog.action === 'Passed' ? 'Pass QA' : 'Reject QA')}
          </Button>
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
