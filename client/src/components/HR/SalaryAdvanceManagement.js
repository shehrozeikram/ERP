import React, { useState, useEffect, useCallback } from 'react';
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
  Stack,
  Autocomplete,
  Tooltip,
  Checkbox
} from '@mui/material';
import {
  Add as AddIcon,
  GroupAdd as GroupAddIcon,
  Delete as DeleteIcon,
  AttachMoney as MoneyIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import api from '../../services/authService';

const months = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const SalaryAdvanceManagement = ({ employees = [] }) => {
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterStatus, setFilterStatus] = useState('');

  // Single Advance Modal
  const [openSingleModal, setOpenSingleModal] = useState(false);
  const [singleForm, setSingleForm] = useState({
    employee: '',
    amount: '',
    payrollMonth: new Date().getMonth() + 1,
    payrollYear: currentYear,
    paymentMethod: 'Bank Transfer',
    reason: ''
  });

  // Bulk Advance Modal
  const [openBulkModal, setOpenBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    selectedEmployees: [],
    amount: '',
    payrollMonth: new Date().getMonth() + 1,
    payrollYear: currentYear,
    paymentMethod: 'Bank Transfer',
    reason: 'Bulk Advance'
  });

  const fetchAdvances = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (filterMonth) params.set('month', filterMonth);
      if (filterYear) params.set('year', filterYear);
      if (filterStatus) params.set('status', filterStatus);

      const res = await api.get(`/hr/salary-advances?${params.toString()}`);
      if (res.data.success) {
        setAdvances(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching advances:', err);
      setError('Failed to fetch salary advances.');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, filterStatus]);

  useEffect(() => {
    fetchAdvances();
  }, [fetchAdvances]);

  const handleSingleSubmit = async () => {
    try {
      setError('');
      if (!singleForm.employee || !singleForm.amount || Number(singleForm.amount) <= 0) {
        setError('Please select an employee and enter a valid positive amount.');
        return;
      }

      const res = await api.post('/hr/salary-advances', singleForm);
      if (res.data.success) {
        setSuccess('Salary advance issued successfully!');
        setOpenSingleModal(false);
        setSingleForm({
          employee: '',
          amount: '',
          payrollMonth: new Date().getMonth() + 1,
          payrollYear: currentYear,
          paymentMethod: 'Bank Transfer',
          reason: ''
        });
        fetchAdvances();
      }
    } catch (err) {
      console.error('Error issuing single advance:', err);
      setError(err.response?.data?.message || 'Failed to issue salary advance');
    }
  };

  const handleBulkSubmit = async () => {
    try {
      setError('');
      if (bulkForm.selectedEmployees.length === 0 || !bulkForm.amount || Number(bulkForm.amount) <= 0) {
        setError('Please select at least one employee and enter a valid positive amount.');
        return;
      }

      const payload = {
        employees: bulkForm.selectedEmployees.map(e => e._id),
        amount: Number(bulkForm.amount),
        payrollMonth: bulkForm.payrollMonth,
        payrollYear: bulkForm.payrollYear,
        paymentMethod: bulkForm.paymentMethod,
        reason: bulkForm.reason
      };

      const res = await api.post('/hr/salary-advances/bulk', payload);
      if (res.data.success) {
        setSuccess(`Salary advance issued to ${res.data.count} employees!`);
        setOpenBulkModal(false);
        setBulkForm({
          selectedEmployees: [],
          amount: '',
          payrollMonth: new Date().getMonth() + 1,
          payrollYear: currentYear,
          paymentMethod: 'Bank Transfer',
          reason: 'Bulk Advance'
        });
        fetchAdvances();
      }
    } catch (err) {
      console.error('Error issuing bulk advance:', err);
      setError(err.response?.data?.message || 'Failed to issue bulk advance');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to cancel/delete this advance?')) return;
    try {
      setError('');
      const res = await api.delete(`/hr/salary-advances/${id}`);
      if (res.data.success) {
        setSuccess('Salary advance cancelled successfully!');
        fetchAdvances();
      }
    } catch (err) {
      console.error('Error deleting advance:', err);
      setError(err.response?.data?.message || 'Failed to delete advance');
    }
  };

  const totalAmount = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
  const unadjustedAmount = advances.filter(a => a.status === 'Unadjusted').reduce((sum, a) => sum + (a.amount || 0), 0);

  return (
    <Box sx={{ mt: 3, mb: 4 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: 'background.paper', boxShadow: 2 }}>
            <CardContent>
              <Typography color="text.secondary" variant="subtitle2" gutterBottom>
                Total Advances ({months.find(m => m.value === Number(filterMonth))?.label} {filterYear})
              </Typography>
              <Typography variant="h5" color="primary.main" fontWeight="bold">
                Rs. {totalAmount.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {advances.length} total entries
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: 'background.paper', boxShadow: 2 }}>
            <CardContent>
              <Typography color="text.secondary" variant="subtitle2" gutterBottom>
                Unadjusted (Pending Payroll)
              </Typography>
              <Typography variant="h5" color="warning.main" fontWeight="bold">
                Rs. {unadjustedAmount.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                To be deducted in upcoming payroll
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: 'background.paper', boxShadow: 2 }}>
            <CardContent>
              <Typography color="text.secondary" variant="subtitle2" gutterBottom>
                Adjusted (Paid via Payroll)
              </Typography>
              <Typography variant="h5" color="success.main" fontWeight="bold">
                Rs. {(totalAmount - unadjustedAmount).toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Fully settled in payslips
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Header & Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center" justifyContent="space-between">
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Target Month</InputLabel>
                <Select
                  value={filterMonth}
                  label="Target Month"
                  onChange={(e) => setFilterMonth(e.target.value)}
                >
                  {months.map(m => (
                    <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>Year</InputLabel>
                <Select
                  value={filterYear}
                  label="Year"
                  onChange={(e) => setFilterYear(e.target.value)}
                >
                  {years.map(y => (
                    <MenuItem key={y} value={y}>{y}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="Unadjusted">Unadjusted</MenuItem>
                  <MenuItem value="Adjusted">Adjusted</MenuItem>
                </Select>
              </FormControl>

              <IconButton onClick={fetchAdvances} color="primary" title="Refresh">
                <RefreshIcon />
              </IconButton>
            </Stack>
          </Grid>

          <Grid item xs={12} md={6} sx={{ textAlign: { md: 'right' } }}>
            <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setOpenSingleModal(true)}
              >
                Give Advance (Single)
              </Button>
              <Button
                variant="contained"
                startIcon={<GroupAddIcon />}
                onClick={() => setOpenBulkModal(true)}
              >
                Give Advance (Bulk)
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: 'grey.100' }}>
            <TableRow>
              <TableCell><b>Employee</b></TableCell>
              <TableCell><b>Employee ID</b></TableCell>
              <TableCell><b>Amount (Rs.)</b></TableCell>
              <TableCell><b>Target Payroll</b></TableCell>
              <TableCell><b>Payment Method</b></TableCell>
              <TableCell><b>Reason</b></TableCell>
              <TableCell><b>Status</b></TableCell>
              <TableCell align="center"><b>Actions</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  <CircularProgress size={30} />
                </TableCell>
              </TableRow>
            ) : advances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary">
                    No salary advances found for the selected month/filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              advances.map((adv) => {
                const empName = adv.employee
                  ? `${adv.employee.firstName || ''} ${adv.employee.lastName || ''}`.trim()
                  : 'N/A';
                return (
                  <TableRow key={adv._id} hover>
                    <TableCell><b>{empName}</b></TableCell>
                    <TableCell>{adv.employee?.employeeId || 'N/A'}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      Rs. {adv.amount?.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {months.find(m => m.value === adv.payrollMonth)?.label} {adv.payrollYear}
                    </TableCell>
                    <TableCell>{adv.paymentMethod}</TableCell>
                    <TableCell>{adv.reason || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={adv.status}
                        size="small"
                        color={adv.status === 'Adjusted' ? 'success' : 'warning'}
                        variant={adv.status === 'Adjusted' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {adv.status === 'Unadjusted' ? (
                        <Tooltip title="Cancel Advance">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(adv._id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Applied
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Single Advance Modal */}
      <Dialog open={openSingleModal} onClose={() => setOpenSingleModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Issue Single Salary Advance</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Autocomplete
              options={employees}
              getOptionLabel={(option) => `${option.firstName || ''} ${option.lastName || ''} (${option.employeeId || ''})`}
              onChange={(_, value) => setSingleForm(prev => ({ ...prev, employee: value ? value._id : '' }))}
              renderInput={(params) => (
                <TextField {...params} label="Select Employee" required size="small" />
              )}
            />

            <TextField
              label="Advance Amount (Rs.)"
              type="number"
              size="small"
              fullWidth
              required
              value={singleForm.amount}
              onChange={(e) => setSingleForm(prev => ({ ...prev, amount: e.target.value }))}
            />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Target Payroll Month</InputLabel>
                  <Select
                    value={singleForm.payrollMonth}
                    label="Target Payroll Month"
                    onChange={(e) => setSingleForm(prev => ({ ...prev, payrollMonth: e.target.value }))}
                  >
                    {months.map(m => (
                      <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payroll Year</InputLabel>
                  <Select
                    value={singleForm.payrollYear}
                    label="Payroll Year"
                    onChange={(e) => setSingleForm(prev => ({ ...prev, payrollYear: e.target.value }))}
                  >
                    {years.map(y => (
                      <MenuItem key={y} value={y}>{y}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <FormControl fullWidth size="small">
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={singleForm.paymentMethod}
                label="Payment Method"
                onChange={(e) => setSingleForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
              >
                <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                <MenuItem value="Cash">Cash</MenuItem>
                <MenuItem value="Cheque">Cheque</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Reason / Notes"
              multiline
              rows={2}
              size="small"
              fullWidth
              value={singleForm.reason}
              onChange={(e) => setSingleForm(prev => ({ ...prev, reason: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSingleModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSingleSubmit}>
            Issue Advance
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Advance Modal */}
      <Dialog open={openBulkModal} onClose={() => setOpenBulkModal(false)} maxWidth="md" fullWidth>
        <DialogTitle>Issue Bulk Salary Advances</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Autocomplete
              multiple
              options={employees}
              disableCloseOnSelect
              getOptionLabel={(option) => `${option.firstName || ''} ${option.lastName || ''} (${option.employeeId || ''})`}
              value={bulkForm.selectedEmployees}
              onChange={(_, value) => setBulkForm(prev => ({ ...prev, selectedEmployees: value }))}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox checked={selected} style={{ marginRight: 8 }} />
                  {option.firstName} {option.lastName} ({option.employeeId})
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Multiple Employees"
                  placeholder="Choose employees..."
                  size="small"
                  helperText={`${bulkForm.selectedEmployees.length} employee(s) selected`}
                />
              )}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Advance Amount Per Employee (Rs.)"
                  type="number"
                  size="small"
                  fullWidth
                  required
                  value={bulkForm.amount}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, amount: e.target.value }))}
                  helperText={
                    bulkForm.amount && bulkForm.selectedEmployees.length > 0
                      ? `Total Bulk Outflow: Rs. ${(Number(bulkForm.amount) * bulkForm.selectedEmployees.length).toLocaleString()}`
                      : ''
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Method</InputLabel>
                  <Select
                    value={bulkForm.paymentMethod}
                    label="Payment Method"
                    onChange={(e) => setBulkForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  >
                    <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                    <MenuItem value="Cash">Cash</MenuItem>
                    <MenuItem value="Cheque">Cheque</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Target Payroll Month</InputLabel>
                  <Select
                    value={bulkForm.payrollMonth}
                    label="Target Payroll Month"
                    onChange={(e) => setBulkForm(prev => ({ ...prev, payrollMonth: e.target.value }))}
                  >
                    {months.map(m => (
                      <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payroll Year</InputLabel>
                  <Select
                    value={bulkForm.payrollYear}
                    label="Payroll Year"
                    onChange={(e) => setBulkForm(prev => ({ ...prev, payrollYear: e.target.value }))}
                  >
                    {years.map(y => (
                      <MenuItem key={y} value={y}>{y}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <TextField
              label="Reason / Notes"
              multiline
              rows={2}
              size="small"
              fullWidth
              value={bulkForm.reason}
              onChange={(e) => setBulkForm(prev => ({ ...prev, reason: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBulkModal(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleBulkSubmit}
            disabled={bulkForm.selectedEmployees.length === 0}
          >
            Issue Bulk Advance ({bulkForm.selectedEmployees.length})
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SalaryAdvanceManagement;
