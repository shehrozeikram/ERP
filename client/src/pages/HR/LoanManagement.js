import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  Chip,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  Fab
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Payment as PaymentIcon,
  AccountBalance as DisburseIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  TrendingUp as StatsIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { loanService } from '../../services/loanService';
import { formatPKR } from '../../utils/currency';

const LoanManagement = () => {
  const navigate = useNavigate();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalLoans, setTotalLoans] = useState(0);
  const [filters, setFilters] = useState({
    status: '',
    loanType: '',
    search: '',
    startDate: '',
    endDate: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, loanId: null });
  const [paymentDialog, setPaymentDialog] = useState({ open: false, loan: null });
  const [paymentData, setPaymentData] = useState({ amount: '', paymentMethod: 'Salary Deduction' });

  useEffect(() => {
    fetchLoans();
    fetchStats();
  }, [page, rowsPerPage, filters]);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...filters
      };
      
      const response = await loanService.getLoans(params);
      setLoans(response.docs || response);
      setTotalLoans(response.totalDocs || response.length || 0);
    } catch (error) {
      setError(error.message || 'Failed to fetch loans');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await loanService.getLoanStatistics();
      setStats(response);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const handleDeleteLoan = async () => {
    try {
      await loanService.deleteLoan(deleteDialog.loanId);
      setDeleteDialog({ open: false, loanId: null });
      fetchLoans();
    } catch (error) {
      setError(error.message || 'Failed to delete loan');
    }
  };

  const handleProcessPayment = async () => {
    try {
      if (!paymentData.amount || paymentData.amount <= 0) {
        setError('Please enter a valid payment amount');
        return;
      }

      await loanService.processPayment(paymentDialog.loan._id, paymentData);
      setPaymentDialog({ open: false, loan: null });
      setPaymentData({ amount: '', paymentMethod: 'Salary Deduction' });
      fetchLoans();
      fetchStats();
    } catch (error) {
      setError(error.message || 'Failed to process payment');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': 'warning',
      'Approved': 'info',
      'Rejected': 'error',
      'Disbursed': 'success',
      'Active': 'secondary',
      'Completed': 'success',
      'Defaulted': 'error'
    };
    return colors[status] || 'default';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-PK');
  };

  const renderStatsCards = () => {
    if (!stats) return null;

    const cards = [
      {
        title: 'Total Loans',
        value: stats.overall?.totalLoans || 0,
        color: '#2196f3',
        icon: '📊'
      },
      {
        title: 'Total Amount',
        value: formatPKR(stats.overall?.totalAmount || 0),
        color: '#4caf50',
        icon: '💰'
      },
      {
        title: 'Outstanding',
        value: formatPKR(stats.overall?.totalOutstanding || 0),
        color: '#ff9800',
        icon: '📈'
      },
      {
        title: 'Total Paid',
        value: formatPKR(stats.overall?.totalPaid || 0),
        color: '#9c27b0',
        icon: '✅'
      }
    ];

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {cards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${card.color}15, ${card.color}25)`,
              border: `1px solid ${card.color}30`
            }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" component="div" sx={{ color: card.color }}>
                      {card.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.title}
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: card.color }}>
                    {card.icon}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  const renderFilters = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm={6} md={2}>
          <TextField
            fullWidth
            label="Search"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder="Search by purpose or guarantor"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
              <MenuItem value="Approved">Approved</MenuItem>
              <MenuItem value="Rejected">Rejected</MenuItem>
              <MenuItem value="Disbursed">Disbursed</MenuItem>
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Completed">Completed</MenuItem>
              <MenuItem value="Defaulted">Defaulted</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth>
            <InputLabel>Loan Type</InputLabel>
            <Select
              value={filters.loanType}
              label="Loan Type"
              onChange={(e) => handleFilterChange('loanType', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {loanService.getLoanTypeOptions().map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <TextField
            fullWidth
            type="date"
            label="Start Date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <TextField
            fullWidth
            type="date"
            label="End Date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => {
              setFilters({
                status: '',
                loanType: '',
                search: '',
                startDate: '',
                endDate: ''
              });
              setPage(0);
            }}
          >
            Clear
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Loan Management
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<StatsIcon />}
            onClick={() => navigate('/hr/loans/statistics')}
            sx={{ mr: 1 }}
          >
            Statistics
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/hr/loans/new')}
          >
            New Loan Application
          </Button>
        </Box>
      </Box>

      {renderStatsCards()}

      <Paper sx={{ mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" p={2}>
          <Typography variant="h6">Loan Applications</Typography>
          <Box>
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              <FilterIcon />
            </IconButton>
            <IconButton onClick={fetchLoans}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>
        
        {showFilters && renderFilters()}

        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Loan Type</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Monthly EMI</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Application Date</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : loans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No loans found
                  </TableCell>
                </TableRow>
              ) : (
                loans.map((loan) => (
                  <TableRow key={loan._id}>
                    <TableCell>
                      <Typography variant="body2">
                        {loan.employee?.firstName} {loan.employee?.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {loan.employee?.employeeId}
                      </Typography>
                    </TableCell>
                    <TableCell>{loan.loanType}</TableCell>
                                      <TableCell>{formatPKR(loan.loanAmount)}</TableCell>
                  <TableCell>{formatPKR(loan.monthlyInstallment)}</TableCell>
                    <TableCell>
                      <Chip
                        label={loan.status}
                        color={getStatusColor(loan.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(loan.applicationDate)}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Box sx={{ width: '100%', mr: 1 }}>
                          <Box
                            sx={{
                              width: '100%',
                              height: 8,
                              bgcolor: 'grey.200',
                              borderRadius: 1,
                              overflow: 'hidden'
                            }}
                          >
                            <Box
                              sx={{
                                width: `${loan.progressPercentage || 0}%`,
                                height: '100%',
                                bgcolor: 'primary.main',
                                transition: 'width 0.3s ease'
                              }}
                            />
                          </Box>
                        </Box>
                        <Typography variant="caption">
                          {loan.progressPercentage || 0}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/hr/loans/${loan._id}`)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        
                        {loan.status === 'Pending' && (
                          <>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/hr/loans/${loan._id}/edit`)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteDialog({ open: true, loanId: loan._id })}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        
                        {loan.status === 'Approved' && (
                          <Tooltip title="Disburse">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => navigate(`/hr/loans/${loan._id}/disburse`)}
                            >
                              <DisburseIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {['Active', 'Disbursed'].includes(loan.status) && (
                          <Tooltip title="Process Payment">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => setPaymentDialog({ open: true, loan })}
                            >
                              <PaymentIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalLoans}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, loanId: null })}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this loan application? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, loanId: null })}>
            Cancel
          </Button>
          <Button onClick={handleDeleteLoan} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Process Payment Dialog */}
      <Dialog open={paymentDialog.open} onClose={() => setPaymentDialog({ open: false, loan: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Process Loan Payment</DialogTitle>
        <DialogContent>
          {paymentDialog.loan && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {paymentDialog.loan.employee?.firstName} {paymentDialog.loan.employee?.lastName}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Loan Type: {paymentDialog.loan.loanType}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Outstanding Balance: {formatPKR(paymentDialog.loan.outstandingBalance)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Monthly EMI: {formatPKR(paymentDialog.loan.monthlyInstallment)}
              </Typography>
            </Box>
          )}
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Payment Amount"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                placeholder="Enter payment amount"
                helperText={`Maximum: ${formatPKR(paymentDialog.loan?.outstandingBalance || 0)}`}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentData.paymentMethod}
                  label="Payment Method"
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                >
                  <MenuItem value="Salary Deduction">Salary Deduction</MenuItem>
                  <MenuItem value="Direct Payment">Direct Payment</MenuItem>
                  <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                  <MenuItem value="Cash">Cash</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog({ open: false, loan: null })}>
            Cancel
          </Button>
          <Button onClick={handleProcessPayment} color="primary" variant="contained">
            Process Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LoanManagement; 