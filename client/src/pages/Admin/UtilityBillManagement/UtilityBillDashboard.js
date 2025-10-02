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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';


import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Payment as PaymentIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import utilityBillService from '../../../services/utilityBillService';

const UtilityBillDashboard = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState({ byType: [], monthly: { monthlyTotal: 0, monthlyPaid: 0, monthlyBills: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentData, setPaymentData] = useState({
    paidAmount: 0,
    paymentMethod: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });

  const utilityTypes = ['Electricity', 'Water', 'Gas', 'Internet', 'Phone', 'Maintenance', 'Security', 'Cleaning', 'Other'];
  const statuses = ['Pending', 'Paid', 'Overdue', 'Partial'];
  const paymentMethods = ['Cash', 'Bank Transfer', 'Cheque', 'Online', 'Credit Card', 'Other'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [billsResponse, summaryResponse] = await Promise.all([
        utilityBillService.getUtilityBills({
          search: searchTerm,
          utilityType: filterType,
          status: filterStatus
        }),
        utilityBillService.getSummary()
      ]);
      
      setBills(billsResponse.data);
      setSummary(summaryResponse.data);
    } catch (err) {
      setError('Failed to fetch utility bills data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, filterType, filterStatus]);

  const handleMenuOpen = (event, bill) => {
    setAnchorEl(event.currentTarget);
    setSelectedBill(bill);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedBill(null);
  };

  const handleEdit = () => {
    navigate(`/admin/utility-bills/${selectedBill._id}/edit`);
    handleMenuClose();
  };

  const handleView = () => {
    navigate(`/admin/utility-bills/${selectedBill._id}`);
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this utility bill?')) {
      try {
        await utilityBillService.deleteUtilityBill(selectedBill._id);
        fetchData();
        handleMenuClose();
      } catch (err) {
        setError('Failed to delete utility bill');
        console.error('Error deleting bill:', err);
      }
    }
  };

  const handlePayment = () => {
    setPaymentData({
      paidAmount: selectedBill.amount - selectedBill.paidAmount,
      paymentMethod: '',
      paymentDate: new Date().toISOString().split('T')[0]
    });
    setPaymentDialog(true);
    handleMenuClose();
  };

  const handlePaymentSubmit = async () => {
    try {
      await utilityBillService.recordPayment(selectedBill._id, paymentData);
      setPaymentDialog(false);
      fetchData();
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-PK');
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header Skeleton */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="30%" height={40} />
          <Skeleton variant="rectangular" width={140} height={36} borderRadius={1} />
        </Box>

        {/* Summary Cards Skeleton */}
        <Grid container spacing={3} mb={3}>
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Skeleton variant="circular" width={24} height={24} sx={{ mr: 2 }} />
                    <Box flexGrow={1}>
                      <Skeleton variant="text" height={16} width="40%" />
                      <Skeleton variant="text" height={32} width="60%" sx={{ mt: 1 }} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Filters Skeleton */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
              <Skeleton variant="rectangular" width={200} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={150} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={150} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={80} height={56} borderRadius={1} />
            </Box>
          </CardContent>
        </Card>

        {/* Recent Bills Table Skeleton */}
        <Card>
          <CardContent>
            <Skeleton variant="text" width="25%" height={24} sx={{ mb: 2 }} />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[1, 2, 3, 4, 5].map((item) => (
                    <TableRow key={item}>
                      <TableCell><Skeleton variant="text" height={20} width="60%" /></TableCell>
                      <TableCell><Skeleton variant="rectangular" height={24} width={80} /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="50%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="40%" /></TableCell>
                      <TableCell><Skeleton variant="rectangular" height={24} width={60} /></TableCell>
                      <TableCell>
                        <Skeleton variant="circular" width={24} height={24} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Utility Bills Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/utility-bills/new')}
        >
          Add New Bill
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <ReceiptIcon color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Total Bills
                    </Typography>
                    <Typography variant="h4">
                      {summary.byType.reduce((total, item) => total + (item.total || 0), 0)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <WarningIcon color="warning" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Pending Bills
                    </Typography>
                    <Typography variant="h4" color="warning.main">
                      {summary.byType.reduce((total, item) => total + (item.pending || 0), 0)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <WarningIcon color="error" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Overdue Bills
                    </Typography>
                    <Typography variant="h4" color="error.main">
                      {summary.byType.reduce((total, item) => total + (item.overdue || 0), 0)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <CheckCircleIcon color="success" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Monthly Total
                    </Typography>
                    <Typography variant="h4" color="primary.main">
                      {formatCurrency(summary.monthly?.monthlyTotal || 0)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search Bills"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                placeholder="Search by bill ID, provider, account..."
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Utility Type</InputLabel>
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  label="Utility Type"
                >
                  <MenuItem value="">All Types</MenuItem>
                  {utilityTypes.map(type => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Status</MenuItem>
                  {statuses.map(status => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('');
                  setFilterStatus('');
                }}
              >
                Clear
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Bills Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Bill ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Paid</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bills.map((bill) => (
                  <TableRow key={bill._id}>
                    <TableCell>{bill.billId}</TableCell>
                    <TableCell>{bill.utilityType}</TableCell>
                    <TableCell>{bill.provider}</TableCell>
                    <TableCell>{formatCurrency(bill.amount)}</TableCell>
                    <TableCell>{formatCurrency(bill.paidAmount)}</TableCell>
                    <TableCell>
                      <Chip
                        label={bill.status}
                        color={getStatusColor(bill.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(bill.dueDate)}</TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/admin/utility-bills/${bill._id}`)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Bill">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/admin/utility-bills/${bill._id}/edit`)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Record Payment">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => {
                              setSelectedBill(bill);
                              setPaymentData({
                                paidAmount: bill.amount - bill.paidAmount,
                                paymentMethod: '',
                                paymentDate: new Date().toISOString().split('T')[0]
                              });
                              setPaymentDialog(true);
                            }}
                          >
                            <PaymentIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Bill">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this utility bill?')) {
                                utilityBillService.deleteUtilityBill(bill._id)
                                  .then(() => fetchData())
                                  .catch(err => setError('Failed to delete utility bill'));
                              }
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button onClick={handlePaymentSubmit} variant="contained">Record Payment</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UtilityBillDashboard;