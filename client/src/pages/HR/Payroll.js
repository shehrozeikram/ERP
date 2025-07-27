import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
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
  Payment as PaymentIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { formatPKR } from '../../utils/currency';
import api from '../../services/authService';

const Payroll = () => {
  const navigate = useNavigate();
  const [payrolls, setPayrolls] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [filters, setFilters] = useState({
    status: '',
    employeeId: '',
    startDate: '',
    endDate: '',
    payPeriodType: ''
  });
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    fetchPayrolls();
    fetchStats();
    fetchEmployees();
  }, [page, rowsPerPage, filters]);

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        ...filters
      });

      const response = await api.get(`/payroll?${params}`);
      setPayrolls(response.data.data || []);
      setTotalItems(response.data.pagination?.totalItems || 0);
    } catch (error) {
      console.error('Error fetching payrolls:', error);
      setError('Failed to load payrolls');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/payroll/stats');
      setStats(response.data.data || {});
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/hr/employees');
      setEmployees(response.data.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      employeeId: '',
      startDate: '',
      endDate: '',
      payPeriodType: ''
    });
    setPage(0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'default';
      case 'approved': return 'warning';
      case 'paid': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'approved': return 'Approved';
      case 'paid': return 'Paid';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const formatCurrency = formatPKR;

  const handleApprove = async (payrollId) => {
    try {
      await api.patch(`/payroll/${payrollId}/approve`);
      fetchPayrolls();
      fetchStats();
    } catch (error) {
      console.error('Error approving payroll:', error);
      setError('Failed to approve payroll');
    }
  };

  const handleMarkAsPaid = async (payrollId) => {
    try {
      await api.patch(`/payroll/${payrollId}/mark-paid`);
      fetchPayrolls();
      fetchStats();
    } catch (error) {
      console.error('Error marking payroll as paid:', error);
      setError('Failed to mark payroll as paid');
    }
  };

  const handleDelete = async (payrollId) => {
    if (window.confirm('Are you sure you want to delete this payroll?')) {
      try {
        await api.delete(`/payroll/${payrollId}`);
        fetchPayrolls();
        fetchStats();
      } catch (error) {
        console.error('Error deleting payroll:', error);
        setError('Failed to delete payroll');
      }
    }
  };

  if (loading && payrolls.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Payroll Management
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setFilterDialogOpen(true)}
            sx={{ mr: 2 }}
          >
            Filters
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/hr/payroll/add')}
          >
            Create Payroll
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AccountBalanceIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Payrolls
                  </Typography>
                  <Typography variant="h4">
                    {stats.totalPayrolls || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Gross Pay
                  </Typography>
                  <Typography variant="h4">
                    {formatCurrency(stats.totalGrossPay)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ReceiptIcon sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Net Pay
                  </Typography>
                  <Typography variant="h4">
                    {formatCurrency(stats.totalNetPay)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PeopleIcon sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Avg Net Pay
                  </Typography>
                  <Typography variant="h4">
                    {formatCurrency(stats.averageNetPay)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Payroll Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Pay Period</TableCell>
                                 <TableCell>Basic Salary</TableCell>
                 <TableCell>Gross Pay</TableCell>
                 <TableCell>Leave Deduction</TableCell>
                 <TableCell>Net Pay</TableCell>
                 <TableCell>Status</TableCell>
                 <TableCell>Created</TableCell>
                 <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payrolls.map((payroll) => (
                <TableRow key={payroll._id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2">
                        {payroll.employee?.firstName} {payroll.employee?.lastName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {payroll.employee?.employeeId}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {format(new Date(payroll.payPeriod.startDate), 'MMM dd')} - {format(new Date(payroll.payPeriod.endDate), 'MMM dd, yyyy')}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {payroll.payPeriod.type}
                      </Typography>
                    </Box>
                  </TableCell>
                                     <TableCell>{formatCurrency(payroll.basicSalary)}</TableCell>
                   <TableCell>{formatCurrency(payroll.calculations.grossPay)}</TableCell>
                   <TableCell>{formatCurrency(payroll.leaveDeductions?.leaveDeductionAmount || 0)}</TableCell>
                   <TableCell>{formatCurrency(payroll.calculations.netPay)}</TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(payroll.status)}
                      color={getStatusColor(payroll.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {format(new Date(payroll.createdAt), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/hr/payroll/${payroll._id}`)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/hr/payroll/${payroll._id}/edit`)}
                          disabled={payroll.status === 'paid'}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      {payroll.status === 'draft' && (
                        <Tooltip title="Approve">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleApprove(payroll._id)}
                          >
                            <ApproveIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {payroll.status === 'approved' && (
                        <Tooltip title="Mark as Paid">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleMarkAsPaid(payroll._id)}
                          >
                            <PaymentIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(payroll._id)}
                          disabled={payroll.status === 'paid'}
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
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={totalItems}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Filter Dialog */}
      <Dialog open={filterDialogOpen} onClose={() => setFilterDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Filter Payrolls</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Employee</InputLabel>
                <Select
                  value={filters.employeeId}
                  onChange={(e) => handleFilterChange('employeeId', e.target.value)}
                  label="Employee"
                >
                  <MenuItem value="">All Employees</MenuItem>
                  {employees.map((employee) => (
                    <MenuItem key={employee._id} value={employee._id}>
                      {employee.firstName} {employee.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Start Date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="End Date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Pay Period Type</InputLabel>
                <Select
                  value={filters.payPeriodType}
                  onChange={(e) => handleFilterChange('payPeriodType', e.target.value)}
                  label="Pay Period Type"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="bi-weekly">Bi-weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={clearFilters}>Clear Filters</Button>
          <Button onClick={() => setFilterDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => navigate('/hr/payroll/add')}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default Payroll; 