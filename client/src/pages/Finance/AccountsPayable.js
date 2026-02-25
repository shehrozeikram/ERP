import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  alpha,
  useTheme,
  Avatar,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  Stack
} from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  ShoppingCart as ShoppingCartIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Payment as PaymentIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import toast from 'react-hot-toast';
import ComparativeStatementView from '../../components/Procurement/ComparativeStatementView';
import QuotationDetailView from '../../components/Procurement/QuotationDetailView';

const AccountsPayable = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBill, setSelectedBill] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    billNumber: '',
    totalAmount: 0,
    billDate: '',
    dueDate: ''
  });
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'bank_transfer',
    reference: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [posForBilling, setPosForBilling] = useState([]);
  const [loadingPosForBilling, setLoadingPosForBilling] = useState(false);
  const [createFromPoDialog, setCreateFromPoDialog] = useState({ open: false, po: null, billNumber: '', creating: false });
  const [billViewTab, setBillViewTab] = useState(0);

  const [filters, setFilters] = useState({
    status: '',
    vendor: '',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    search: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 20
  });
  const [summary, setSummary] = useState({
    totalOutstanding: 0,
    totalOverdue: 0,
    totalPaid: 0,
    totalBills: 0
  });

  useEffect(() => {
    fetchAccountsPayable();
  }, [filters, pagination.currentPage]);

  const fetchPosForBilling = async () => {
    try {
      setLoadingPosForBilling(true);
      const res = await api.get('/finance/accounts-payable/pos-for-billing');
      if (res.data?.success) setPosForBilling(res.data.data || []);
    } catch (e) {
      setPosForBilling([]);
    } finally {
      setLoadingPosForBilling(false);
    }
  };
  useEffect(() => { fetchPosForBilling(); }, [viewDialogOpen]);

  const fetchAccountsPayable = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.vendor) params.append('vendor', filters.vendor);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.search) params.append('search', filters.search);
      params.append('page', pagination.currentPage);
      params.append('limit', pagination.limit);
      params.append('_t', new Date().getTime());

      const response = await api.get(`/finance/accounts-payable?${params}`, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (response.data.success) {
        setBills(response.data.data.bills || []);
        setPagination(prev => ({
          ...prev,
          ...response.data.data.pagination
        }));
        setSummary(response.data.data.summary || summary);
      }
    } catch (error) {
      console.error('Error fetching accounts payable:', error);
      setError('Failed to fetch accounts payable data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field) => (event) => {
    setFilters(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (event, page) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handleViewBill = async (bill) => {
    try {
      setLoading(true);
      setBillViewTab(0);
      const response = await api.get(`/finance/accounts-payable/${bill._id}`);
      if (response.data.success) {
        setSelectedBill(response.data.data);
        setViewDialogOpen(true);
      }
    } catch (error) {
      console.error('Error fetching bill details:', error);
      toast.error('Failed to fetch bill details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPayment = (bill) => {
    setSelectedBill(bill);
    setPaymentData({
      amount: bill.totalAmount - (bill.paidAmount || 0),
      paymentMethod: 'bank_transfer',
      reference: '',
      paymentDate: new Date().toISOString().split('T')[0]
    });
    setPaymentDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (paymentData.amount <= 0) {
      toast.error('Payment amount must be greater than zero');
      return;
    }

    try {
      setProcessingPayment(true);
      const response = await api.post(`/finance/accounts-payable/${selectedBill._id}/payment`, paymentData);
      if (response.data.success) {
        toast.success('Payment recorded successfully');
        setPaymentDialogOpen(false);
        fetchAccountsPayable();
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error(error.response?.data?.message || 'Failed to record payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleOpenEdit = (bill) => {
    setSelectedBill(bill);
    setEditData({
      billNumber: bill.billNumber,
      totalAmount: bill.totalAmount,
      billDate: new Date(bill.billDate).toISOString().split('T')[0],
      dueDate: new Date(bill.dueDate).toISOString().split('T')[0]
    });
    setEditDialogOpen(true);
  };

  const handleUpdateBill = async () => {
    try {
      const response = await api.put(`/finance/accounts-payable/${selectedBill._id}`, editData);
      if (response.data.success) {
        toast.success('Bill updated successfully');
        setEditDialogOpen(false);
        fetchAccountsPayable();
      }
    } catch (error) {
      console.error('Error updating bill:', error);
      toast.error(error.response?.data?.message || 'Failed to update bill');
    }
  };

  const handleCreateBillFromPo = async (po) => {
    setCreateFromPoDialog({ open: true, po, billNumber: `BILL-PO-${po.orderNumber}`, creating: false });
  };

  const handleConfirmCreateFromPo = async () => {
    const { po } = createFromPoDialog;
    if (!po?._id) return;
    try {
      setCreateFromPoDialog(prev => ({ ...prev, creating: true }));
      const res = await api.post('/finance/accounts-payable/create-from-po', {
        purchaseOrderId: po._id,
        billNumber: createFromPoDialog.billNumber || undefined
      });
      if (res.data?.success) {
        toast.success('Bill created from purchase order');
        setCreateFromPoDialog({ open: false, po: null, billNumber: '', creating: false });
        fetchAccountsPayable();
        fetchPosForBilling();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create bill');
    } finally {
      setCreateFromPoDialog(prev => ({ ...prev, creating: false }));
    }
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'draft': 'default',
      'received': 'info',
      'approved': 'success',
      'pending': 'warning',
      'paid': 'success',
      'overdue': 'error',
      'partial': 'info',
      'cancelled': 'default'
    };
    return colorMap[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      'draft': <AccountBalanceIcon />,
      'received': <AccountBalanceIcon />,
      'approved': <CheckCircleIcon />,
      'pending': <WarningIcon />,
      'paid': <CheckCircleIcon />,
      'overdue': <WarningIcon />,
      'partial': <TrendingDownIcon />,
      'cancelled': <AccountBalanceIcon />
    };
    return iconMap[status] || <AccountBalanceIcon />;
  };

  const calculateAge = (date) => {
    const today = new Date();
    const billDate = new Date(date);
    const diffTime = Math.abs(today - billDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getAgingColor = (days) => {
    if (days <= 30) return 'success';
    if (days <= 60) return 'warning';
    return 'error';
  };

  const formatGRNDate = (d) => {
    if (!d) return '';
    const x = new Date(d);
    const days = String(x.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days}-${months[x.getMonth()]}-${x.getFullYear()}`;
  };
  const formatGRNNumber = (n) => (n == null || n === '') ? '' : Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDateForPrint = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading Accounts Payable...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.error.main }}>
              <ShoppingCartIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.error.main }}>
                Accounts Payable
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Manage vendor bills and payments
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchAccountsPayable}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => toast.success('Export functionality coming soon')}
            >
              Export
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/finance/accounts-payable/new')}
            >
              New Bill
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              type="date"
              label="Start Date"
              value={filters.startDate}
              onChange={handleFilterChange('startDate')}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              type="date"
              label="End Date"
              value={filters.endDate}
              onChange={handleFilterChange('endDate')}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                onChange={handleFilterChange('status')}
                label="Status"
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="received">Received</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Vendor"
              value={filters.vendor}
              onChange={handleFilterChange('vendor')}
              placeholder="Search vendors"
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Search"
              value={filters.search}
              onChange={handleFilterChange('search')}
              placeholder="Search bills"
              size="small"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* POs for Billing */}
      {posForBilling.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShoppingCartIcon /> POs for Billing (Create Bill from Purchase Order)
            </Typography>
            {loadingPosForBilling ? (
              <LinearProgress sx={{ mb: 2 }} />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>PO Number</strong></TableCell>
                      <TableCell><strong>Vendor</strong></TableCell>
                      <TableCell><strong>Indent</strong></TableCell>
                      <TableCell align="right"><strong>Amount</strong></TableCell>
                      <TableCell align="center"><strong>Action</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {posForBilling.map((po) => (
                      <TableRow key={po._id}>
                        <TableCell>{po.orderNumber}</TableCell>
                        <TableCell>{po.vendor?.name || 'N/A'}</TableCell>
                        <TableCell>{po.indent?.indentNumber || 'N/A'}</TableCell>
                        <TableCell align="right">{formatPKR(po.totalAmount)}</TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => handleCreateBillFromPo(po)}
                          >
                            Create Bill
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Outstanding
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                    {formatPKR(summary.totalOutstanding)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {summary.totalBills} bills
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <ShoppingCartIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Overdue Amount
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                    {formatPKR(summary.totalOverdue)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <WarningIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Paid
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    {formatPKR(summary.totalPaid)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <CheckCircleIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Bills
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {summary.totalBills}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                  <AccountBalanceIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Accounts Payable Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Bill Details
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Bill #</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Paid</TableCell>
                  <TableCell align="right">Outstanding</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Aging</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bills.map((bill) => {
                  const days = calculateAge(bill.billDate);
                  const outstanding = bill.totalAmount - (bill.paidAmount || 0);
                  return (
                    <TableRow key={bill._id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {bill.billNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {bill.vendorName || 'Unknown Vendor'}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {bill.vendorEmail}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(bill.billDate)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(bill.dueDate)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatPKR(bill.totalAmount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                          {formatPKR(bill.paidAmount || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 'bold',
                            color: outstanding > 0 ? 'warning.main' : 'success.main'
                          }}
                        >
                          {formatPKR(outstanding)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={bill.status?.toUpperCase() || 'UNKNOWN'} 
                          size="small" 
                          color={getStatusColor(bill.status)}
                          icon={getStatusIcon(bill.status)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={`${days} days`}
                          size="small" 
                          color={getAgingColor(days)}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="View Details">
                            <IconButton 
                              size="small" 
                              onClick={() => handleViewBill(bill)}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Make Payment">
                            <IconButton 
                              size="small" 
                              color="success"
                              onClick={() => handleOpenPayment(bill)}
                              disabled={bill.status === 'paid'}
                            >
                              <PaymentIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Bill">
                            <IconButton 
                              size="small"
                              onClick={() => handleOpenEdit(bill)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {bills.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="textSecondary">
                No bills found
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Create your first bill to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/finance/accounts-payable/new')}
              >
                Create First Bill
              </Button>
            </Box>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={pagination.totalPages}
                page={pagination.currentPage}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Bill Details Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)}
        maxWidth={selectedBill?.referenceType === 'purchase_order' ? 'lg' : 'md'}
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Bill Details: {selectedBill?.billNumber}
          <IconButton onClick={() => setViewDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedBill && (
            <>
              <Grid container spacing={3} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Vendor Information</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{selectedBill.vendorName}</Typography>
                  <Typography variant="body2">{selectedBill.vendorEmail}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Bill Status</Typography>
                  <Chip 
                    label={selectedBill.status?.toUpperCase()} 
                    color={getStatusColor(selectedBill.status)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="textSecondary">Bill Date</Typography>
                  <Typography variant="body2">{formatDate(selectedBill.billDate)}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="textSecondary">Due Date</Typography>
                  <Typography variant="body2">{formatDate(selectedBill.dueDate)}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="textSecondary">Amount</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{formatPKR(selectedBill.totalAmount)}</Typography>
                </Grid>
              </Grid>

              {/* PO-linked documents tabs */}
              {selectedBill.referenceType === 'purchase_order' && selectedBill.poDetail && (
                <>
                  <Tabs
                    value={billViewTab}
                    onChange={(_, v) => setBillViewTab(v)}
                    sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
                  >
                    <Tab label="Indent" />
                    <Tab label={`Quotations (${selectedBill.poDetail.quotations?.length || 0})`} />
                    <Tab label="Comparative Statement" />
                    <Tab label="Purchase Order" />
                    <Tab label={selectedBill.poDetail.grns?.length > 0 ? `GRN(s) (${selectedBill.poDetail.grns.length})` : 'GRN(s)'} />
                    <Tab label="Payment History" />
                  </Tabs>
                  {billViewTab === 0 && selectedBill.poDetail.indent && (
                    <Box sx={{ p: 2, overflowX: 'auto' }} className="print-content">
                      <Paper sx={{ p: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none' }}>
                        <Typography variant="h5" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: 1 }}>
                          Purchase Request Form
                        </Typography>
                        {selectedBill.poDetail.indent.title && (
                          <Typography variant="h6" fontWeight={600} align="center" sx={{ mb: 2 }}>{selectedBill.poDetail.indent.title}</Typography>
                        )}
                        <Box sx={{ mb: 1.5, fontSize: '0.9rem', textAlign: 'center' }}>
                          <Typography component="span" fontWeight={600}>ERP Ref:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>{selectedBill.poDetail.indent.erpRef || 'PR #' + (selectedBill.poDetail.indent.indentNumber?.split('-').pop() || '')}</Typography>
                        </Box>
                        <Box sx={{ mb: 1.5, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <Box><Typography component="span" fontWeight={600}>Date:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(selectedBill.poDetail.indent.requestedDate)}</Typography></Box>
                          <Box><Typography component="span" fontWeight={600}>Required Date:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(selectedBill.poDetail.indent.requiredDate) || '—'}</Typography></Box>
                          <Box><Typography component="span" fontWeight={600}>Indent No.:</Typography><Typography component="span" sx={{ ml: 1 }}>{selectedBill.poDetail.indent.indentNumber || '—'}</Typography></Box>
                        </Box>
                        <Box sx={{ mb: 3, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <Box><Typography component="span" fontWeight={600}>Department:</Typography><Typography component="span" sx={{ ml: 1 }}>{selectedBill.poDetail.indent.department?.name || selectedBill.poDetail.indent.department || '—'}</Typography></Box>
                          <Box><Typography component="span" fontWeight={600}>Originator:</Typography><Typography component="span" sx={{ ml: 1 }}>{selectedBill.poDetail.indent.requestedBy?.firstName && selectedBill.poDetail.indent.requestedBy?.lastName ? `${selectedBill.poDetail.indent.requestedBy.firstName} ${selectedBill.poDetail.indent.requestedBy.lastName}` : selectedBill.poDetail.indent.requestedBy?.name || '—'}</Typography></Box>
                        </Box>
                        <Box sx={{ mb: 3 }}>
                          <Table size="small" sx={{ border: '1px solid', borderColor: 'divider' }}>
                            <TableHead>
                              <TableRow sx={{ bgcolor: 'grey.100' }}>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>S#</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Item Name</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Description</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Brand</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Unit</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="center">Qty</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Purpose</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Est. Cost</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(selectedBill.poDetail.indent.items || []).map((item, idx) => (
                                <TableRow key={idx}>
                                  <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="center">{idx + 1}</TableCell>
                                  <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.itemName || '—'}</TableCell>
                                  <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.description || '—'}</TableCell>
                                  <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.brand || '—'}</TableCell>
                                  <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.unit || '—'}</TableCell>
                                  <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="center">{item.quantity ?? '—'}</TableCell>
                                  <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.purpose || '—'}</TableCell>
                                  <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{item.estimatedCost != null ? Number(item.estimatedCost).toFixed(2) : '—'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                        {selectedBill.poDetail.indent.justification && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Justification:</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>{selectedBill.poDetail.indent.justification}</Typography>
                          </Box>
                        )}
                      </Paper>
                    </Box>
                  )}
                  {billViewTab === 1 && (
                    <Box sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                      {(!selectedBill.poDetail.quotations || selectedBill.poDetail.quotations.length === 0) ? (
                        <Typography color="textSecondary">No quotations.</Typography>
                      ) : (
                        <Stack spacing={4}>
                          {selectedBill.poDetail.quotations.map((q) => (
                            <QuotationDetailView
                              key={q._id}
                              quotation={{ ...q, indent: selectedBill.poDetail.indent || q.indent }}
                              formatNumber={(n) => formatPKR(n)}
                              formatDateForPrint={(d) => formatDate(d)}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>
                  )}
                  {billViewTab === 2 && selectedBill.poDetail.indent && (
                    <Box sx={{ p: 2, overflowX: 'auto' }}>
                      <ComparativeStatementView
                        requisition={selectedBill.poDetail.indent}
                        quotations={selectedBill.poDetail.quotations || []}
                        approvalAuthority={selectedBill.poDetail.indent?.comparativeStatementApprovals || {}}
                        note={selectedBill.poDetail.indent?.notes ?? ''}
                        readOnly
                        formatNumber={(n) => formatPKR(n)}
                        loadingQuotations={false}
                        showPrintButton={false}
                      />
                    </Box>
                  )}
                  {billViewTab === 3 && selectedBill.poDetail.po && (
                    <Box sx={{ p: 2, overflowX: 'auto' }} className="print-content">
                      <Paper sx={{ p: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', fontFamily: 'Arial, sans-serif' }}>
                        <Typography variant="h4" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: 3 }}>Purchase Order</Typography>
                        <Box sx={{ mb: 2.5 }}>
                          <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>Residencia</Typography>
                          <Typography variant="body2">1st Avenue 18 4 Islamabad</Typography>
                          <Typography variant="body2">1. Het Sne 1-8. Islamabad.</Typography>
                        </Box>
                        <Divider sx={{ my: 2.5 }} />
                        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap' }}>
                          <Box sx={{ width: { xs: '100%', md: '45%' }, fontSize: '0.9rem' }}>
                            <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>{selectedBill.poDetail.po.vendor?.name || 'Vendor Name'}</Typography>
                            <Typography variant="body2" sx={{ mb: 2 }}>{typeof selectedBill.poDetail.po.vendor?.address === 'string' ? selectedBill.poDetail.po.vendor.address : (selectedBill.poDetail.po.vendor?.address ? Object.values(selectedBill.poDetail.po.vendor.address).filter(Boolean).join(', ') : 'Vendor Address')}</Typography>
                            <Box>
                              <Typography component="span" fontWeight={600}>Indent Details: </Typography>
                              <Typography component="span">Indent# {selectedBill.poDetail.po.indent?.indentNumber || selectedBill.poDetail.indent?.indentNumber || 'N/A'} Dated. {formatDateForPrint(selectedBill.poDetail.po.indent?.requestedDate || selectedBill.poDetail.indent?.requestedDate) || 'N/A'}.
                                {selectedBill.poDetail.po.indent?.title && ` ${selectedBill.poDetail.po.indent.title}.`}
                                {selectedBill.poDetail.indent?.requestedBy && ` End User. ${selectedBill.poDetail.indent.requestedBy.firstName || ''} ${selectedBill.poDetail.indent.requestedBy.lastName || selectedBill.poDetail.indent.requestedBy.name || ''}`}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ width: { xs: '100%', md: '50%' }, fontSize: '0.9rem' }}>
                            <Box sx={{ display: 'flex', mb: 0.5 }}><Typography component="span" sx={{ minWidth: 140, fontWeight: 600 }}>P.O No.:</Typography><Typography component="span">{selectedBill.poDetail.po.orderNumber || 'N/A'}</Typography></Box>
                            <Box sx={{ display: 'flex', mb: 0.5 }}><Typography component="span" sx={{ minWidth: 140, fontWeight: 600 }}>Date:</Typography><Typography component="span">{formatDateForPrint(selectedBill.poDetail.po.orderDate)}</Typography></Box>
                            <Box sx={{ display: 'flex', mb: 0.5 }}><Typography component="span" sx={{ minWidth: 140, fontWeight: 600 }}>Delivery Date:</Typography><Typography component="span">{formatDateForPrint(selectedBill.poDetail.po.expectedDeliveryDate) || '—'}</Typography></Box>
                            <Box sx={{ display: 'flex', mb: 0.5 }}><Typography component="span" sx={{ minWidth: 140, fontWeight: 600 }}>Delivery Address:</Typography><Typography component="span">{selectedBill.poDetail.po.deliveryAddress || '—'}</Typography></Box>
                          </Box>
                        </Box>
                        <TableContainer sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: 'grey.100' }}>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Sr</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Product</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Description</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Specification</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Brand</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Qty Unit</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Rate</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Amount</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(selectedBill.poDetail.po.items || []).map((item, idx) => {
                                const indentItem = selectedBill.poDetail.indent?.items?.[idx];
                                return (
                                  <TableRow key={idx}>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="center">{idx + 1}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.productCode || indentItem?.itemCode || item.description?.split(' ')[0] || '—'}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.description || indentItem?.itemName || '—'}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.specification || indentItem?.description || indentItem?.specification || '—'}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.brand || indentItem?.brand || '—'}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="center">{item.quantity} {item.unit || 'pcs'}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{formatPKR(item.unitPrice)}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{formatPKR((item.quantity || 0) * (item.unitPrice || 0))}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                          <Typography variant="body1" fontWeight="bold">Total: {formatPKR(selectedBill.poDetail.po.totalAmount)}</Typography>
                        </Box>
                      </Paper>
                    </Box>
                  )}
                  {billViewTab === 4 && (
                    <Box sx={{ p: 2, overflowX: 'auto' }} className="print-content">
                      {(!selectedBill.poDetail.grns || selectedBill.poDetail.grns.length === 0) ? (
                        <Typography color="textSecondary" sx={{ py: 4, textAlign: 'center' }}>No GRN(s) attached to this Purchase Order.</Typography>
                      ) : (
                        selectedBill.poDetail.grns.map((grn) => (
                          <Paper key={grn._id} sx={{ p: 4, mb: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="overline" color="textSecondary" sx={{ display: 'block', mb: 1 }}>Attached GRN (copy)</Typography>
                            <Grid container sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', pb: 2 }} alignItems="center">
                              <Grid item xs={4}><Typography variant="h6" fontWeight="bold">Taj Residencia</Typography><Typography variant="body2" color="textSecondary">Head Office</Typography></Grid>
                              <Grid item xs={4} sx={{ textAlign: 'center' }}><Typography variant="h5" fontWeight="bold">Goods Received Note</Typography></Grid>
                              <Grid item xs={4} />
                            </Grid>
                            <Grid container spacing={3} sx={{ mb: 2 }}>
                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" color="textSecondary">No.</Typography>
                                <Typography variant="body1" fontWeight="bold">{grn.receiveNumber || grn._id}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Supplier</Typography>
                                <Typography variant="body2">{[grn.supplier?.supplierId, grn.supplierName || grn.supplier?.name].filter(Boolean).join(' ') || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Address</Typography>
                                <Typography variant="body2">{grn.supplierAddress || grn.supplier?.address || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Narration</Typography>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{grn.narration || '—'}</Typography>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" color="textSecondary">Date</Typography>
                                <Typography variant="body2">{formatGRNDate(grn.receiveDate)}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Currency</Typography>
                                <Typography variant="body2">{grn.currency || 'Rupees'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>P.R No.</Typography>
                                <Typography variant="body2">{grn.prNumber || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>P.O No.</Typography>
                                <Typography variant="body2">{grn.poNumber || selectedBill.poDetail.po?.orderNumber || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Store</Typography>
                                <Typography variant="body2">{grn.store || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Gate Pass No.</Typography>
                                <Typography variant="body2">{grn.gatePassNo || '—'}</Typography>
                              </Grid>
                            </Grid>
                            <TableContainer sx={{ mb: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>S. No</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Product Code</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Description</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Unit</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Quantity</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Rate</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Value Excl. ST</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(grn.items || []).map((item, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{idx + 1}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.itemCode || '—'}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.itemName || '—'}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.unit || '—'}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{formatGRNNumber(item.quantity)}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{formatGRNNumber(item.unitPrice)}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{formatGRNNumber(item.valueExcludingSalesTax ?? (item.quantity * item.unitPrice))}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                              <Grid container spacing={1} sx={{ maxWidth: 320 }}>
                                <Grid item xs={6}><Typography variant="body2">Discount</Typography></Grid>
                                <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2">{formatGRNNumber(grn.discount)}</Typography></Grid>
                                <Grid item xs={6}><Typography variant="body2">Other Charges</Typography></Grid>
                                <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2">{formatGRNNumber(grn.otherCharges)}</Typography></Grid>
                                <Grid item xs={6}><Typography variant="body2" fontWeight="bold">Net Amount</Typography></Grid>
                                <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2" fontWeight="bold">{formatGRNNumber(grn.netAmount)}</Typography></Grid>
                                <Grid item xs={6}><Typography variant="body2" fontWeight="bold">Total</Typography></Grid>
                                <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2" fontWeight="bold">{formatGRNNumber(grn.total ?? grn.netAmount)}</Typography></Grid>
                              </Grid>
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="caption" color="textSecondary">Observation</Typography>
                            <Typography variant="body2" sx={{ minHeight: 24 }}>{grn.observation || ' '}</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 3 }}>
                              <Box>
                                <Typography variant="caption" color="textSecondary">Prepared By</Typography>
                                <Typography variant="body2" fontWeight="medium">{grn.preparedByName || (grn.receivedBy?.firstName && grn.receivedBy?.lastName ? `${grn.receivedBy.firstName} ${grn.receivedBy.lastName}` : '—')}</Typography>
                              </Box>
                              <Box sx={{ width: 120, height: 40, border: '1px dashed', borderColor: 'divider' }} />
                            </Box>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}
                  {billViewTab === 5 && (
                    <Box sx={{ p: 2 }}>
                      <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HistoryIcon /> Payment History
                      </Typography>
                      {selectedBill.payments && selectedBill.payments.length > 0 ? (
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: 'grey.100' }}>
                                <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Method</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Reference</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }} align="right">Amount</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {selectedBill.payments.map((payment, index) => (
                                <TableRow key={index}>
                                  <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                                  <TableCell>{payment.paymentMethod?.replace('_', ' ')}</TableCell>
                                  <TableCell>{payment.reference || '—'}</TableCell>
                                  <TableCell align="right">{formatPKR(payment.amount)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Typography variant="body2" color="textSecondary">No payments recorded yet</Typography>
                      )}
                    </Box>
                  )}
                  <Divider sx={{ my: 2 }} />
                </>
              )}

              {/* Payment History - always shown below for all bills */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HistoryIcon /> Payment History
                </Typography>
                {selectedBill.payments && selectedBill.payments.length > 0 ? (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Method</TableCell>
                          <TableCell>Reference</TableCell>
                          <TableCell align="right">Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedBill.payments.map((payment, index) => (
                          <TableRow key={index}>
                            <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                            <TableCell>{payment.paymentMethod?.replace('_', ' ')}</TableCell>
                            <TableCell>{payment.reference || '-'}</TableCell>
                            <TableCell align="right">{formatPKR(payment.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                  <Typography variant="body2" color="textSecondary">No payments recorded yet</Typography>
                )}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button 
            variant="contained" 
            color="success" 
            onClick={() => {
              setViewDialogOpen(false);
              handleOpenPayment(selectedBill);
            }}
            disabled={selectedBill?.status === 'paid'}
          >
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Bill from PO Dialog */}
      <Dialog open={createFromPoDialog.open} onClose={() => setCreateFromPoDialog({ open: false, po: null, billNumber: '', creating: false })} maxWidth="sm" fullWidth>
        <DialogTitle>Create Bill from Purchase Order</DialogTitle>
        <DialogContent>
          {createFromPoDialog.po && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                PO: <strong>{createFromPoDialog.po.orderNumber}</strong> | Vendor: {createFromPoDialog.po.vendor?.name} | Amount: {formatPKR(createFromPoDialog.po.totalAmount)}
              </Typography>
              <TextField
                fullWidth
                label="Bill Number"
                value={createFromPoDialog.billNumber}
                onChange={(e) => setCreateFromPoDialog(prev => ({ ...prev, billNumber: e.target.value }))}
                size="small"
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateFromPoDialog({ open: false, po: null, billNumber: '', creating: false })}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmCreateFromPo} disabled={createFromPoDialog.creating}>
            {createFromPoDialog.creating ? 'Creating...' : 'Create Bill'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog 
        open={paymentDialogOpen} 
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Payment: {selectedBill?.billNumber}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Outstanding Balance: <strong>{selectedBill ? formatPKR(selectedBill.totalAmount - (selectedBill.paidAmount || 0)) : 0}</strong>
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Payment Amount"
                type="number"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) })}
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                  label="Payment Method"
                >
                  <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  <MenuItem value="check">Check</MenuItem>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
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
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reference / Transaction #"
                value={paymentData.reference}
                onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                size="small"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="success" 
            onClick={handleRecordPayment}
            disabled={processingPayment}
          >
            {processingPayment ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Bill Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Bill: {selectedBill?.billNumber}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Bill Number"
                value={editData.billNumber}
                onChange={(e) => setEditData({ ...editData, billNumber: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Total Amount"
                type="number"
                value={editData.totalAmount}
                onChange={(e) => setEditData({ ...editData, totalAmount: parseFloat(e.target.value) })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Bill Date"
                type="date"
                value={editData.billDate}
                onChange={(e) => setEditData({ ...editData, billDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Due Date"
                type="date"
                value={editData.dueDate}
                onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleUpdateBill}
          >
            Update Bill
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccountsPayable;
