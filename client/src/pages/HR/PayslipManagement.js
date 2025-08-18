import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  Avatar,
  LinearProgress,
  CardHeader,
  CardActions,
  Badge,
  Stack,
  Container,
  useTheme,
  alpha
} from '@mui/material';
import {
  Add,
  Search,
  FilterList,
  Refresh,
  Visibility,
  Edit,
  Delete,
  Download,
  ExpandMore,
  AttachMoney,
  Receipt,
  TrendingUp,
  People,
  Assessment,
  CalendarToday,
  Business,
  Person
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import payslipService, { formatPayslipData } from '../../services/payslipService';
import { formatPKR } from '../../utils/currency';

const PayslipManagement = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  
  // State
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [stats, setStats] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [filters, setFilters] = useState({
    month: '',
    year: new Date().getFullYear().toString(),
    employeeId: '',
    department: '',
    status: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  });
  const [showFilters, setShowFilters] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, payslip: null });

  // Load payslips
  const loadPayslips = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      };
      
      const response = await payslipService.getPayslips(params);
      
      // Ensure we always set an array
      const payslipsArray = response?.data?.docs || [];
      
      // Additional safety check
      if (!Array.isArray(payslipsArray)) {
        console.error('Invalid payslips response format:', response);
        setPayslips([]);
        setSnackbar({
          open: true,
          message: 'Invalid response format from server',
          severity: 'error'
        });
        return;
      }
      
      setPayslips(payslipsArray);
      setPagination(prev => ({ ...prev, total: response?.data?.totalDocs || 0 }));
    } catch (error) {
      console.error('Error loading payslips:', error);
      setPayslips([]); // Ensure we set empty array on error
      setSnackbar({
        open: true,
        message: 'Failed to load payslips',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const response = await payslipService.getPayslipStats();
      setStats(response.data || {});
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  useEffect(() => {
    loadPayslips();
    loadStats();
  }, [pagination.page, pagination.limit]);

  // Separate effect for filters to avoid infinite re-renders
  useEffect(() => {
    if (pagination.page === 1) {
      loadPayslips();
    } else {
      // Reset to first page when filters change
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [filters.month, filters.year, filters.employeeId, filters.department, filters.status, filters.search]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handlePageChange = (event, newPage) => {
    setPagination(prev => ({ ...prev, page: newPage + 1 }));
  };

  const handleRowsPerPageChange = (event) => {
    setPagination(prev => ({ 
      ...prev, 
      limit: parseInt(event.target.value, 10),
      page: 1 
    }));
  };

  const handleDelete = async (payslipId) => {
    try {
      await payslipService.deletePayslip(payslipId);
      setSnackbar({
        open: true,
        message: 'Payslip deleted successfully',
        severity: 'success'
      });
      loadPayslips();
      setDeleteDialog({ open: false, payslip: null });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to delete payslip',
        severity: 'error'
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'error';
      case 'paid': return 'info';
      default: return 'default';
    }
  };

  const getStatusChip = (status) => (
    <Chip
      label={status.charAt(0).toUpperCase() + status.slice(1)}
      color={getStatusColor(status)}
      size="small"
      variant="outlined"
    />
  );

  // Show loading state while initial data is being fetched
  if (loading || !Array.isArray(payslips) || payslips === undefined || payslips === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
          Payslip Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage employee payslips, approvals, and payments
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
          }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 56, height: 56 }}>
                  <Receipt />
                </Avatar>
                <Box>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 600 }}>
                    {stats.totalPayslips || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Payslips
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
          }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: theme.palette.success.main, width: 56, height: 56 }}>
                  <TrendingUp />
                </Avatar>
                <Box>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 600 }}>
                    {stats.approvedCount || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Approved
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
          }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: theme.palette.warning.main, width: 56, height: 56 }}>
                  <Assessment />
                </Avatar>
                <Box>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 600 }}>
                    {stats.generatedCount || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Generated
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
          }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: theme.palette.info.main, width: 56, height: 56 }}>
                  <AttachMoney />
                </Avatar>
                <Box>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 600 }}>
                    {formatPKR(stats.totalNetSalary || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Net Salary
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Card */}
      <Card sx={{ boxShadow: theme.shadows[4], borderRadius: 2 }}>
        <CardHeader
          title="Payslip Records"
          action={
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<FilterList />}
                onClick={() => setShowFilters(!showFilters)}
                sx={{ borderRadius: 2 }}
              >
                Filters
              </Button>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadPayslips}
                sx={{ borderRadius: 2 }}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/hr/payslips/new')}
                sx={{ borderRadius: 2 }}
              >
                Add Payslip
              </Button>
            </Stack>
          }
        />

        {/* Filters Section */}
        {showFilters && (
          <Accordion expanded={showFilters} sx={{ border: 'none', boxShadow: 'none' }}>
            <AccordionDetails>
              <Grid container spacing={3} sx={{ px: 3, pb: 2 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Month</InputLabel>
                    <Select
                      value={filters.month}
                      label="Month"
                      onChange={(e) => handleFilterChange('month', e.target.value)}
                    >
                      <MenuItem value="">All Months</MenuItem>
                      <MenuItem value="01">January</MenuItem>
                      <MenuItem value="02">February</MenuItem>
                      <MenuItem value="03">March</MenuItem>
                      <MenuItem value="04">April</MenuItem>
                      <MenuItem value="05">May</MenuItem>
                      <MenuItem value="06">June</MenuItem>
                      <MenuItem value="07">July</MenuItem>
                      <MenuItem value="08">August</MenuItem>
                      <MenuItem value="09">September</MenuItem>
                      <MenuItem value="10">October</MenuItem>
                      <MenuItem value="11">November</MenuItem>
                      <MenuItem value="12">December</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Year"
                    value={filters.year}
                    onChange={(e) => handleFilterChange('year', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filters.status}
                      label="Status"
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                      <MenuItem value="">All Statuses</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="approved">Approved</MenuItem>
                      <MenuItem value="rejected">Rejected</MenuItem>
                      <MenuItem value="paid">Paid</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Table Section */}
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ p: 3 }}>
              <LinearProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                      <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Pay Period</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Basic Salary</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Allowances</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Deductions</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Net Pay</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!Array.isArray(payslips) || payslips === null || payslips === undefined ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Loading payslips...
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : payslips.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              No payslips found
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      payslips.map((payslip) => (
                        <TableRow key={payslip._id} hover>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <Avatar sx={{ width: 32, height: 32, bgcolor: theme.palette.primary.main }}>
                                <Person />
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {payslip.employee?.firstName} {payslip.employee?.lastName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {payslip.employee?.employeeId}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {payslip.payPeriodMonth} {payslip.payPeriodYear}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {formatPKR(payslip.basicSalary || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="success.main">
                              +{formatPKR(payslip.totalAllowances || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="error.main">
                              -{formatPKR(payslip.totalDeductions || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                              {formatPKR(payslip.netPay || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {getStatusChip(payslip.status)}
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  onClick={() => navigate(`/hr/payslips/${payslip._id}`)}
                                  sx={{ color: theme.palette.primary.main }}
                                >
                                  <Visibility />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => navigate(`/hr/payslips/${payslip._id}/edit`)}
                                  sx={{ color: theme.palette.info.main }}
                                >
                                  <Edit />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Download">
                                <IconButton
                                  size="small"
                                  onClick={() => {/* Download logic */}}
                                  sx={{ color: theme.palette.success.main }}
                                >
                                  <Download />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => setDeleteDialog({ open: true, payslip })}
                                  sx={{ color: theme.palette.error.main }}
                                >
                                  <Delete />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Grid container justifyContent="space-between" alignItems="center">
                  <Grid item>
                    <Typography variant="body2" color="text.secondary">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                    </Typography>
                  </Grid>
                  <Grid item>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={pagination.page * pagination.limit >= pagination.total}
                      >
                        Next
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, payslip: null })}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this payslip? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, payslip: null })}>
            Cancel
          </Button>
          <Button 
            onClick={() => handleDelete(deleteDialog.payslip?._id)} 
            color="error" 
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PayslipManagement;
