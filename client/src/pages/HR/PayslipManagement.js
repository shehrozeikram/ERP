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
  const [loading, setLoading] = useState(false);
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
      setPayslips(response.data.docs || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.totalDocs || 0
      }));
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error loading payslips',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load statistics
  const loadStats = async () => {
    try {
      const response = await payslipService.getPayslipStats({
        month: filters.month,
        year: filters.year
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Load data on mount and filter change
  useEffect(() => {
    loadPayslips();
    loadStats();
  }, [pagination.page, filters]);

  // Handle filter change
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle search
  const handleSearch = (event) => {
    handleFilterChange('search', event.target.value);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      month: '',
      year: new Date().getFullYear().toString(),
      employeeId: '',
      department: '',
      status: '',
      search: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteDialog.payslip) return;
    
    try {
      await payslipService.deletePayslip(deleteDialog.payslip._id);
      setSnackbar({
        open: true,
        message: 'Payslip deleted successfully',
        severity: 'success'
      });
      setDeleteDialog({ open: false, payslip: null });
      loadPayslips();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error deleting payslip',
        severity: 'error'
      });
    }
  };

  // Handle generate
  const handleGenerate = async (payslip) => {
    try {
      await payslipService.generatePayslip(payslip._id);
      setSnackbar({
        open: true,
        message: 'Payslip generated successfully',
        severity: 'success'
      });
      loadPayslips();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error generating payslip',
        severity: 'error'
      });
    }
  };

  // Handle approve
  const handleApprove = async (payslip) => {
    try {
      await payslipService.approvePayslip(payslip._id);
      setSnackbar({
        open: true,
        message: 'Payslip approved successfully',
        severity: 'success'
      });
      loadPayslips();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error approving payslip',
        severity: 'error'
      });
    }
  };

  // Handle mark as paid
  const handleMarkAsPaid = async (payslip) => {
    try {
      await payslipService.markPayslipAsPaid(payslip._id, {
        paymentMethod: 'bank_transfer',
        paymentDate: new Date()
      });
      setSnackbar({
        open: true,
        message: 'Payslip marked as paid successfully',
        severity: 'success'
      });
      loadPayslips();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error marking payslip as paid',
        severity: 'error'
      });
    }
  };

  // Format payslip data
  const formattedPayslips = payslips.map(formatPayslipData);

  return (
    <Container maxWidth="xl">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
          Payslip Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage employee payslips, generate new payslips, and track payment status
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
                    {stats.totalPayslips || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Payslips
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                  <Receipt sx={{ color: theme.palette.primary.main }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ color: theme.palette.success.main, fontWeight: 'bold' }}>
                    {formatPKR(stats.totalNetSalary || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Net Salary
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                  <AttachMoney sx={{ color: theme.palette.success.main }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ color: theme.palette.warning.main, fontWeight: 'bold' }}>
                    {stats.paidCount || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Paid Payslips
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                  <TrendingUp sx={{ color: theme.palette.warning.main }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ color: theme.palette.info.main, fontWeight: 'bold' }}>
                    {formatPKR(stats.averageSalary || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Average Salary
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1) }}>
                  <Assessment sx={{ color: theme.palette.info.main }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Status Workflow Guide */}
      <Card sx={{ mb: 3, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: theme.palette.info.main }}>
            📋 Payslip Status Workflow
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Chip label="Draft" color="default" variant="outlined" />
            <Typography variant="body2">→</Typography>
            <Chip label="Generated" color="info" variant="outlined" />
            <Typography variant="body2">→</Typography>
            <Chip label="Approved" color="warning" variant="outlined" />
            <Typography variant="body2">→</Typography>
            <Chip label="Paid" color="success" variant="outlined" />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            <strong>Draft:</strong> Initial creation, can be edited • 
            <strong>Generated:</strong> Ready for approval • 
            <strong>Approved:</strong> Ready for payment • 
            <strong>Paid:</strong> Payment completed
          </Typography>
        </CardContent>
      </Card>

      {/* Actions and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ color: theme.palette.primary.main }}>
              Payslips
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<FilterList />}
                onClick={() => setShowFilters(!showFilters)}
              >
                Filters
              </Button>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadPayslips}
                disabled={loading}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/hr/payslips/new')}
              >
                New Payslip
              </Button>
            </Box>
          </Box>

          {/* Search */}
          <TextField
            fullWidth
            placeholder="Search by employee name, ID, or payslip number..."
            value={filters.search}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
            sx={{ mb: 2 }}
          />

          {/* Filters */}
          {showFilters && (
            <Accordion expanded={showFilters} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1">Advanced Filters</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>Month</InputLabel>
                      <Select
                        value={filters.month}
                        onChange={(e) => handleFilterChange('month', e.target.value)}
                        label="Month"
                        sx={{
                          '& .MuiSelect-select': {
                            paddingRight: '32px', // Ensure space for dropdown icon
                          },
                          '& .MuiSelect-icon': {
                            right: '8px', // Position icon properly
                          }
                        }}
                      >
                        <MenuItem value="">All Months</MenuItem>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                          <MenuItem key={month} value={month}>
                            {new Date(2024, month - 1).toLocaleDateString('en-US', { month: 'long' })}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      label="Year"
                      value={filters.year}
                      onChange={(e) => handleFilterChange('year', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      label="Employee ID"
                      value={filters.employeeId}
                      onChange={(e) => handleFilterChange('employeeId', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={filters.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                        label="Status"
                        sx={{
                          '& .MuiSelect-select': {
                            paddingRight: '32px', // Ensure space for dropdown icon
                          },
                          '& .MuiSelect-icon': {
                            right: '8px', // Position icon properly
                          }
                        }}
                      >
                        <MenuItem value="">All Status</MenuItem>
                        <MenuItem value="draft">Draft</MenuItem>
                        <MenuItem value="generated">Generated</MenuItem>
                        <MenuItem value="approved">Approved</MenuItem>
                        <MenuItem value="paid">Paid</MenuItem>
                        <MenuItem value="cancelled">Cancelled</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </Box>
              </AccordionDetails>
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Payslips Table */}
      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Employee</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Payslip #</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Period</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Gross Salary</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Net Salary</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {formattedPayslips.map((payslip) => (
                    <TableRow key={payslip._id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                            <Person sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              {payslip.employeeName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {payslip.employeeId}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {payslip.payslipNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {payslip.period}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {payslip.formattedTotals.grossSalary}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                          {payslip.formattedTotals.netSalary}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={payslip.statusLabel}
                          color={payslip.statusColor}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/hr/payslips/${payslip._id}`)}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          
                          {payslip.status === 'draft' && (
                            <>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => navigate(`/hr/payslips/${payslip._id}/edit`)}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Generate">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleGenerate(payslip)}
                                >
                                  <TrendingUp fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => setDeleteDialog({ open: true, payslip })}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          
                          {payslip.status === 'generated' && (
                            <Tooltip title="Approve">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleApprove(payslip)}
                              >
                                <TrendingUp fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {payslip.status === 'approved' && (
                            <Tooltip title="Mark as Paid">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleMarkAsPaid(payslip)}
                              >
                                <AttachMoney fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          
          {formattedPayslips.length === 0 && !loading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No payslips found
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, payslip: null })}>
        <DialogTitle>Delete Payslip</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the payslip for {deleteDialog.payslip?.employeeName}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, payslip: null })}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
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