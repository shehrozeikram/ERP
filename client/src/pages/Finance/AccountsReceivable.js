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
  ListItemText
} from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Payment as PaymentIcon,
  Download as DownloadIcon,
  ReceiptLong as CreditNoteIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  History as HistoryIcon,
  Print as PrintIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import toast from 'react-hot-toast';

const AccountsReceivable = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [creditNoteDialog, setCreditNoteDialog] = useState({ open: false, invoice: null, amount: '', reason: '' });
  const [emailDialog, setEmailDialog] = useState({ open: false, invoice: null });
  const [emailSending, setEmailSending] = useState(false);
  const [editData, setEditData] = useState({
    invoiceNumber: '',
    totalAmount: 0,
    invoiceDate: '',
    dueDate: ''
  });
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'bank_transfer',
    reference: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);

  const [filters, setFilters] = useState({
    status: '',
    customer: '',
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
    totalInvoices: 0
  });

  useEffect(() => {
    api.get('/finance/accounts', { params: { type: 'current_asset', limit: 100 } })
      .then(res => {
        const all = res.data.data || res.data.accounts || [];
        setBankAccounts(all.filter(a => ['1001','1002'].includes(a.accountNumber) || a.name?.toLowerCase().includes('bank') || a.name?.toLowerCase().includes('cash')));
      })
      .catch(() => setBankAccounts([]));
  }, []);

  useEffect(() => {
    fetchAccountsReceivable();
  }, [filters, pagination.currentPage]);

  const fetchAccountsReceivable = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.customer) params.append('customer', filters.customer);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.search) params.append('search', filters.search);
      params.append('page', pagination.currentPage);
      params.append('limit', pagination.limit);

      const response = await api.get(`/finance/accounts-receivable?${params}`);
      if (response.data.success) {
        setInvoices(response.data.data.invoices || []);
        setPagination(prev => ({
          ...prev,
          ...response.data.data.pagination
        }));
        setSummary(response.data.data.summary || summary);
      }
    } catch (error) {
      console.error('Error fetching accounts receivable:', error);
      setError('Failed to fetch accounts receivable data');
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

  const handleViewInvoice = async (invoice) => {
    try {
      setLoading(true);
      const response = await api.get(`/finance/accounts-receivable/${invoice._id}`);
      if (response.data.success) {
        setSelectedInvoice(response.data.data);
        setViewDialogOpen(true);
      }
    } catch (error) {
      console.error('Error fetching invoice details:', error);
      toast.error('Failed to fetch invoice details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPayment = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      amount:        Math.round((invoice.totalAmount - (invoice.paidAmount || 0)) * 100) / 100,
      paymentMethod: 'bank_transfer',
      reference:     '',
      paymentDate:   new Date().toISOString().split('T')[0],
      bankAccountId: ''
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
      const response = await api.post(`/finance/accounts-receivable/${selectedInvoice._id}/payment`, paymentData);
      if (response.data.success) {
        toast.success('Payment recorded successfully');
        setPaymentDialogOpen(false);
        fetchAccountsReceivable();
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error(error.response?.data?.message || 'Failed to record payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleOpenEdit = (invoice) => {
    setSelectedInvoice(invoice);
    setEditData({
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount,
      invoiceDate: new Date(invoice.invoiceDate).toISOString().split('T')[0],
      dueDate: new Date(invoice.dueDate).toISOString().split('T')[0]
    });
    setEditDialogOpen(true);
  };

  const handleUpdateInvoice = async () => {
    try {
      const response = await api.put(`/finance/accounts-receivable/${selectedInvoice._id}`, editData);
      if (response.data.success) {
        toast.success('Invoice updated successfully');
        setEditDialogOpen(false);
        fetchAccountsReceivable();
      }
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error(error.response?.data?.message || 'Failed to update invoice');
    }
  };

  const getStatusColor = (status) => {
    const colorMap = {
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
      'pending': <WarningIcon />,
      'paid': <CheckCircleIcon />,
      'overdue': <WarningIcon />,
      'partial': <TrendingUpIcon />,
      'cancelled': <AccountBalanceIcon />
    };
    return iconMap[status] || <AccountBalanceIcon />;
  };

  const calculateAge = (date) => {
    const today = new Date();
    const invoiceDate = new Date(date);
    const diffTime = Math.abs(today - invoiceDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getAgingColor = (days) => {
    if (days <= 30) return 'success';
    if (days <= 60) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading Accounts Receivable...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.success.main }}>
              <BusinessIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                Accounts Receivable
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Manage customer invoices and payments
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="outlined" size="small" color="warning"
              onClick={() => navigate('/finance/credit-notes')} sx={{ fontSize: 12 }}>
              Credit Notes
            </Button>
            <Button variant="outlined" size="small" color="success"
              onClick={() => navigate('/finance/customer-payments')} sx={{ fontSize: 12 }}>
              Payments
            </Button>
            <Button variant="outlined" size="small"
              onClick={() => navigate('/finance/customer-statement')} sx={{ fontSize: 12 }}>
              Statements
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchAccountsReceivable}
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
              onClick={() => navigate('/finance/accounts-receivable/new')}
            >
              New Invoice
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
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Customer"
              value={filters.customer}
              onChange={handleFilterChange('customer')}
              placeholder="Search customers"
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Search"
              value={filters.search}
              onChange={handleFilterChange('search')}
              placeholder="Search invoices"
              size="small"
            />
          </Grid>
        </Grid>
      </Paper>

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
                    {summary.totalInvoices} invoices
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <BusinessIcon />
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
                    Total Invoices
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {summary.totalInvoices}
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

      {/* Accounts Receivable Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Invoice Details
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Customer</TableCell>
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
                {invoices.map((invoice) => {
                  const days = calculateAge(invoice.invoiceDate);
                  const outstanding = invoice.totalAmount - (invoice.paidAmount || 0);
                  return (
                    <TableRow key={invoice._id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {invoice.invoiceNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {invoice.customerName || 'Unknown Customer'}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {invoice.customerEmail}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(invoice.invoiceDate)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(invoice.dueDate)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatPKR(invoice.totalAmount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                          {formatPKR(invoice.paidAmount || 0)}
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
                          label={invoice.status?.toUpperCase() || 'UNKNOWN'} 
                          size="small" 
                          color={getStatusColor(invoice.status)}
                          icon={getStatusIcon(invoice.status)}
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
                              onClick={() => handleViewInvoice(invoice)}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Record Payment">
                            <IconButton 
                              size="small" 
                              color="success"
                              onClick={() => handleOpenPayment(invoice)}
                              disabled={invoice.status === 'paid'}
                            >
                              <PaymentIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Invoice">
                            <IconButton 
                              size="small"
                              onClick={() => handleOpenEdit(invoice)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          {invoice.status !== 'paid' && !invoice.invoiceNumber?.startsWith('CN-') && (
                            <Tooltip title="Issue Credit Note">
                              <IconButton size="small" color="warning"
                                onClick={() => setCreditNoteDialog({ open: true, invoice, amount: invoice.totalAmount, reason: '' })}>
                                <CreditNoteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Print / Download Invoice">
                            <IconButton size="small" color="default"
                              onClick={() => navigate(`/finance/invoice-print/${invoice._id}`)}>
                              <PrintIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Send Invoice by Email">
                            <IconButton size="small" color="info"
                              onClick={() => setEmailDialog({ open: true, invoice })}>
                              <EmailIcon fontSize="small" />
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

          {invoices.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="textSecondary">
                No invoices found
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Create your first invoice to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/finance/accounts-receivable/new')}
              >
                Create First Invoice
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

      {/* Invoice Details Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Invoice Details: {selectedInvoice?.invoiceNumber}
          <IconButton onClick={() => setViewDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedInvoice && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">Customer Information</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{selectedInvoice.customerName}</Typography>
                <Typography variant="body2">{selectedInvoice.customerEmail}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">Invoice Status</Typography>
                <Chip 
                  label={selectedInvoice.status?.toUpperCase()} 
                  color={getStatusColor(selectedInvoice.status)}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="textSecondary">Invoice Date</Typography>
                <Typography variant="body2">{formatDate(selectedInvoice.invoiceDate)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="textSecondary">Due Date</Typography>
                <Typography variant="body2">{formatDate(selectedInvoice.dueDate)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="textSecondary">Amount</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{formatPKR(selectedInvoice.totalAmount)}</Typography>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HistoryIcon /> Payment History
                </Typography>
                {selectedInvoice.payments && selectedInvoice.payments.length > 0 ? (
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
                      {selectedInvoice.payments.map((payment, index) => (
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
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button 
            variant="contained" 
            color="success" 
            onClick={() => {
              setViewDialogOpen(false);
              handleOpenPayment(selectedInvoice);
            }}
            disabled={selectedInvoice?.status === 'paid'}
          >
            Record Payment
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
        <DialogTitle>
          Register Receipt — {selectedInvoice?.invoiceNumber}
          <Typography variant="body2" color="text.secondary">Customer: {selectedInvoice?.customer?.name || selectedInvoice?.customerName}</Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Invoice Total: <strong>{selectedInvoice ? formatPKR(selectedInvoice.totalAmount) : 0}</strong> &nbsp;|&nbsp;
                Received: <strong>{formatPKR(selectedInvoice?.paidAmount || 0)}</strong> &nbsp;|&nbsp;
                Outstanding: <strong style={{ color: '#2e7d32' }}>{selectedInvoice ? formatPKR(selectedInvoice.totalAmount - (selectedInvoice.paidAmount || 0)) : 0}</strong>
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Receipt Amount (PKR)" type="number"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) })}
                size="small" inputProps={{ min: 0, step: 0.01 }} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Method</InputLabel>
                <Select value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                  label="Payment Method">
                  <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  <MenuItem value="check">Cheque</MenuItem>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Deposit To Account</InputLabel>
                <Select value={paymentData.bankAccountId || ''}
                  onChange={(e) => setPaymentData({ ...paymentData, bankAccountId: e.target.value })}
                  label="Deposit To Account">
                  <MenuItem value="">— Auto (default bank) —</MenuItem>
                  {bankAccounts.map(a => (
                    <MenuItem key={a._id} value={a._id}>{a.accountNumber} — {a.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Receipt Date" type="date"
                value={paymentData.paymentDate}
                onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                InputLabelProps={{ shrink: true }} size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Reference / Receipt # / Cheque #"
                value={paymentData.reference}
                onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                size="small" />
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
            {processingPayment ? 'Processing...' : 'Confirm Receipt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Invoice: {selectedInvoice?.invoiceNumber}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Invoice Number"
                value={editData.invoiceNumber}
                onChange={(e) => setEditData({ ...editData, invoiceNumber: e.target.value })}
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
                label="Invoice Date"
                type="date"
                value={editData.invoiceDate}
                onChange={(e) => setEditData({ ...editData, invoiceDate: e.target.value })}
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
            onClick={handleUpdateInvoice}
          >
            Update Invoice
          </Button>
        </DialogActions>
      </Dialog>
      {/* Credit Note Dialog */}
      <Dialog open={creditNoteDialog.open} onClose={() => setCreditNoteDialog({ open: false, invoice: null, amount: '', reason: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>
          Issue Credit Note
          <Typography variant="body2" color="text.secondary">Invoice: {creditNoteDialog.invoice?.invoiceNumber}</Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            A Credit Note reduces the amount owed by the customer. It posts a reversal journal entry (DR Revenue / CR AR).
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth label="Credit Note Amount (PKR)" type="number"
                value={creditNoteDialog.amount}
                onChange={e => setCreditNoteDialog(p => ({ ...p, amount: e.target.value }))}
                inputProps={{ min: 0.01, max: creditNoteDialog.invoice?.totalAmount, step: 0.01 }}
                helperText={`Max: PKR ${Number(creditNoteDialog.invoice?.totalAmount || 0).toLocaleString()}`}
                size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Reason" multiline rows={2}
                value={creditNoteDialog.reason}
                onChange={e => setCreditNoteDialog(p => ({ ...p, reason: e.target.value }))}
                placeholder="e.g. Goods returned, pricing error, service issue…"
                size="small" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreditNoteDialog({ open: false, invoice: null, amount: '', reason: '' })}>Cancel</Button>
          <Button variant="contained" color="warning"
            onClick={async () => {
              try {
                const res = await api.post(`/finance/accounts-receivable/${creditNoteDialog.invoice._id}/credit-note`, {
                  amount: Number(creditNoteDialog.amount),
                  reason: creditNoteDialog.reason
                });
                if (res.data.success) {
                  setCreditNoteDialog({ open: false, invoice: null, amount: '', reason: '' });
                  fetchAccountsReceivable();
                }
              } catch (err) {
                alert(err.response?.data?.message || 'Failed to create credit note');
              }
            }}
            disabled={!creditNoteDialog.amount || creditNoteDialog.amount <= 0}
          >
            Issue Credit Note
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Email Invoice Dialog ─────────────────────────────────────────── */}
      <Dialog open={emailDialog.open} onClose={() => setEmailDialog({ open: false, invoice: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Send Invoice by Email</DialogTitle>
        <DialogContent>
          {emailDialog.invoice && (
            <Box pt={1}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Send invoice <strong>{emailDialog.invoice.invoiceNumber}</strong> to:
              </Typography>
              <Typography variant="body1" fontWeight={600} color="primary.main">
                {emailDialog.invoice.customer?.name} &lt;{emailDialog.invoice.customer?.email}&gt;
              </Typography>
              {!emailDialog.invoice.customer?.email && (
                <Alert severity="warning" sx={{ mt: 1 }}>This customer has no email address on file.</Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialog({ open: false, invoice: null })}>Cancel</Button>
          <Button
            variant="contained"
            color="info"
            disabled={emailSending || !emailDialog.invoice?.customer?.email}
            startIcon={<EmailIcon />}
            onClick={async () => {
              setEmailSending(true);
              try {
                await api.post(`/finance/accounts-receivable/${emailDialog.invoice._id}/send-email`);
                toast.success('Invoice emailed successfully!');
                setEmailDialog({ open: false, invoice: null });
              } catch (e) {
                toast.error(e.response?.data?.message || 'Failed to send email');
              } finally {
                setEmailSending(false);
              }
            }}
          >
            {emailSending ? 'Sending…' : 'Send Email'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccountsReceivable;
