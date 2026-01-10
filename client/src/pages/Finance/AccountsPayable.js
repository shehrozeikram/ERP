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
  Pagination
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
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import paymentSettlementService from '../../services/paymentSettlementService';
import toast from 'react-hot-toast';

const AccountsPayable = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

      const response = await api.get(`/finance/accounts-payable?${params}`);
      if (response.data.success) {
        // Combine bills and payment settlements
        const allItems = response.data.data.bills || [];
        setBills(allItems);
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
              onClick={() => console.log('Export functionality')}
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
                  const isPaymentSettlement = bill.type === 'payment_settlement';
                  const billDate = bill.billDate || bill.date || bill.createdAt;
                  const days = calculateAge(billDate);
                  const outstanding = isPaymentSettlement 
                    ? (bill.grandTotal || bill.amount || 0)
                    : (bill.totalAmount - (bill.paidAmount || 0));
                  
                  return (
                    <TableRow key={bill._id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {isPaymentSettlement && (
                            <Chip 
                              label="Payment Settlement" 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: '20px' }}
                            />
                          )}
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                            {bill.billNumber || bill.referenceNumber || bill._id}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {isPaymentSettlement 
                              ? (bill.vendor?.name || bill.toWhomPaid || 'N/A')
                              : (bill.vendorName || 'Unknown Vendor')}
                          </Typography>
                          {!isPaymentSettlement && bill.vendorEmail && (
                            <Typography variant="caption" color="textSecondary">
                              {bill.vendorEmail}
                            </Typography>
                          )}
                          {isPaymentSettlement && (
                            <Typography variant="caption" color="textSecondary" display="block">
                              From: {typeof bill.fromDepartment === 'string' ? bill.fromDepartment : (bill.fromDepartment?.name || 'N/A')}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(billDate)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(bill.dueDate || billDate)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatPKR(isPaymentSettlement ? (bill.grandTotal || bill.amount || 0) : bill.totalAmount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                          {formatPKR(isPaymentSettlement ? 0 : (bill.paidAmount || 0))}
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
                          label={isPaymentSettlement 
                            ? (bill.workflowStatus || 'PENDING')
                            : (bill.status?.toUpperCase() || 'UNKNOWN')} 
                          size="small" 
                          color={isPaymentSettlement ? 'info' : getStatusColor(bill.status)}
                          icon={isPaymentSettlement ? null : getStatusIcon(bill.status)}
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
                              onClick={async () => {
                                if (isPaymentSettlement) {
                                  try {
                                    const response = await paymentSettlementService.getPaymentSettlement(bill._id);
                                    // Open payment settlement in new tab
                                    window.open(`/general/ceo-secretariat/payments?settlementId=${bill._id}`, '_blank');
                                  } catch (error) {
                                    toast.error('Failed to load payment settlement details');
                                  }
                                } else {
                                  // Handle regular bill view
                                  console.log('View bill:', bill._id);
                                }
                              }}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          {!isPaymentSettlement && (
                            <>
                              <Tooltip title="Make Payment">
                                <IconButton size="small" color="success">
                                  <PaymentIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit Bill">
                                <IconButton size="small">
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
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
    </Box>
  );
};

export default AccountsPayable;
