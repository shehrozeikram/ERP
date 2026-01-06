import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePagination } from '../../../hooks/usePagination';
import TablePaginationWrapper from '../../../components/TablePaginationWrapper';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Stack,
  MenuItem,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Skeleton,
  Collapse
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { fetchAllDeposits, updateDeposit, deleteDeposit } from '../../../services/tajResidentsService';

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Online', 'Other'];

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0
  }).format(amount || 0);
};

const Deposits = () => {
  const [loading, setLoading] = useState(false);
  const [deposits, setDeposits] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedMonths, setExpandedMonths] = useState([]);

  // Pagination
  const pagination = usePagination({
    defaultRowsPerPage: 50,
    resetDependencies: [search, startDate, endDate]
  });

  // Edit dialog state
  const [editDialog, setEditDialog] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    bank: '',
    referenceNumberExternal: '',
    description: ''
  });

  // Load deposits
  const loadDeposits = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = pagination.getApiParams();
      if (search) params.search = search;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await fetchAllDeposits(params);
      setDeposits(response.data?.data?.deposits || []);
      if (response.data?.pagination) {
        pagination.setTotal(response.data.pagination.total);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load deposits');
    } finally {
      setLoading(false);
    }
  }, [search, startDate, endDate, pagination.page, pagination.rowsPerPage]);

  useEffect(() => {
    loadDeposits();
  }, [loadDeposits]);

  // Handle edit
  const handleEdit = useCallback((deposit) => {
    setEditingDeposit(deposit);
    setEditForm({
      amount: deposit.amount || '',
      paymentMethod: deposit.paymentMethod || 'Cash',
      bank: deposit.bank || '',
      referenceNumberExternal: deposit.referenceNumberExternal || '',
      description: deposit.description || ''
    });
    setEditDialog(true);
  }, []);

  // Handle update
  const handleUpdate = useCallback(async () => {
    if (!editingDeposit) return;

    try {
      setLoading(true);
      setError('');
      await updateDeposit(editingDeposit.resident._id, editingDeposit._id, editForm);
      setSuccess('Deposit updated successfully');
      setEditDialog(false);
      setEditingDeposit(null);
      setEditForm({
        amount: '',
        paymentMethod: 'Cash',
        bank: '',
        referenceNumberExternal: '',
        description: ''
      });
      loadDeposits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update deposit');
    } finally {
      setLoading(false);
    }
  }, [editingDeposit, editForm, loadDeposits]);

  // Handle delete
  const handleDelete = useCallback(async (deposit) => {
    if (!window.confirm(`Are you sure you want to delete this deposit of ${formatCurrency(deposit.amount)}? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await deleteDeposit(deposit.resident._id, deposit._id);
      setSuccess('Deposit deleted successfully');
      loadDeposits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete deposit');
    } finally {
      setLoading(false);
    }
  }, [loadDeposits]);

  // Filter deposits
  const filteredDeposits = useMemo(() => {
    return deposits.filter((deposit) => {
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        !search ||
        deposit.resident?.name?.toLowerCase().includes(searchLower) ||
        deposit.resident?.residentId?.toLowerCase().includes(searchLower) ||
        deposit.referenceNumberExternal?.toLowerCase().includes(searchLower) ||
        deposit.description?.toLowerCase().includes(searchLower);
      return matchesSearch;
    });
  }, [deposits, search]);

  // Group deposits by month
  const depositsByMonth = useMemo(() => {
    const grouped = {};
    filteredDeposits.forEach((deposit) => {
      const depositDate = deposit.createdAt ? dayjs(deposit.createdAt) : dayjs();
      const monthKey = depositDate.format('YYYY-MM');
      const monthLabel = depositDate.format('MMMM YYYY');
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          label: monthLabel,
          deposits: [],
          totalAmount: 0,
          totalRemaining: 0,
          totalUsed: 0
        };
      }
      
      grouped[monthKey].deposits.push(deposit);
      grouped[monthKey].totalAmount += deposit.amount || 0;
      grouped[monthKey].totalRemaining += deposit.remainingAmount || 0;
      grouped[monthKey].totalUsed += deposit.totalUsed || 0;
    });
    
    // Sort months in descending order (newest first)
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }));
  }, [filteredDeposits]);

  const toggleMonth = useCallback((monthKey) => {
    setExpandedMonths(prev => {
      if (prev.includes(monthKey)) {
        return prev.filter(key => key !== monthKey);
      } else {
        return [...prev, monthKey];
      }
    });
  }, []);

  // Expand all months by default on initial load
  useEffect(() => {
    if (depositsByMonth.length > 0 && expandedMonths.length === 0) {
      const allMonths = depositsByMonth.map(m => m.key);
      setExpandedMonths(allMonths);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositsByMonth.length]);

  // Render bank field
  const renderBankField = useCallback((form, setForm) => {
    if (form.paymentMethod === 'Cash') return null;
    return (
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Bank Name"
          value={form.bank || ''}
          onChange={(e) => setForm({ ...form, bank: e.target.value })}
          required={form.paymentMethod !== 'Cash'}
        />
      </Grid>
    );
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Deposits
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search by resident name, transaction number, or description"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadDeposits}
                disabled={loading}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : depositsByMonth.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No deposits found
              </Typography>
            </Box>
          ) : (
            depositsByMonth.map((monthGroup) => (
              <Box key={monthGroup.key} sx={{ mb: 3 }}>
                <Card variant="outlined" sx={{ mb: 1 }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ cursor: 'pointer' }}
                      onClick={() => toggleMonth(monthGroup.key)}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <IconButton 
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMonth(monthGroup.key);
                          }}
                        >
                          {expandedMonths.includes(monthGroup.key) ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                        <Typography variant="h6" fontWeight={600}>
                          {monthGroup.label}
                        </Typography>
                        <Chip
                          label={`${monthGroup.deposits.length} deposit${monthGroup.deposits.length !== 1 ? 's' : ''}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Stack>
                      <Stack direction="row" spacing={3}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Total Amount
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {formatCurrency(monthGroup.totalAmount)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Remaining
                          </Typography>
                          <Typography variant="body2" fontWeight={600} color="success.main">
                            {formatCurrency(monthGroup.totalRemaining)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Used
                          </Typography>
                          <Typography variant="body2" fontWeight={600} color="text.secondary">
                            {formatCurrency(monthGroup.totalUsed)}
                          </Typography>
                        </Box>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
                <Collapse in={expandedMonths.includes(monthGroup.key)}>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Date</strong></TableCell>
                          <TableCell><strong>Resident</strong></TableCell>
                          <TableCell><strong>Resident ID</strong></TableCell>
                          <TableCell align="right"><strong>Amount</strong></TableCell>
                          <TableCell align="right"><strong>Remaining</strong></TableCell>
                          <TableCell><strong>Payment Method</strong></TableCell>
                          <TableCell><strong>Bank</strong></TableCell>
                          <TableCell><strong>Transaction Number</strong></TableCell>
                          <TableCell><strong>Description</strong></TableCell>
                          <TableCell align="right"><strong>Actions</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {monthGroup.deposits.map((deposit) => (
                          <TableRow key={deposit._id} hover>
                            <TableCell>{dayjs(deposit.createdAt).format('DD MMM YYYY HH:mm')}</TableCell>
                            <TableCell>{deposit.resident?.name || '-'}</TableCell>
                            <TableCell>{deposit.resident?.residentId || '-'}</TableCell>
                            <TableCell align="right">{formatCurrency(deposit.amount)}</TableCell>
                            <TableCell align="right">
                              <Typography
                                variant="body2"
                                color={deposit.remainingAmount > 0 ? 'success.main' : 'text.secondary'}
                                fontWeight="bold"
                              >
                                {formatCurrency(deposit.remainingAmount)}
                              </Typography>
                            </TableCell>
                            <TableCell>{deposit.paymentMethod || '-'}</TableCell>
                            <TableCell>{deposit.bank || '-'}</TableCell>
                            <TableCell>{deposit.referenceNumberExternal || '-'}</TableCell>
                            <TableCell>{deposit.description || '-'}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Tooltip title="Edit Deposit">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleEdit(deposit)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete Deposit">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDelete(deposit)}
                                    disabled={loading}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Box>
            ))
          )}
          {!loading && depositsByMonth.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <TablePaginationWrapper
                component="div"
                count={pagination.total}
                page={pagination.page}
                onPageChange={pagination.handleChangePage}
                rowsPerPage={pagination.rowsPerPage}
                onRowsPerPageChange={pagination.handleChangeRowsPerPage}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onClose={() => {
        setEditDialog(false);
        setEditingDeposit(null);
        setEditForm({
          amount: '',
          paymentMethod: 'Cash',
          bank: '',
          referenceNumberExternal: '',
          description: ''
        });
      }} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit Deposit - {editingDeposit?.resident?.name}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Alert severity="info">
                Current Balance: {formatCurrency(editingDeposit?.resident?.balance || 0)}
              </Alert>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={editForm.paymentMethod}
                  label="Payment Method"
                  onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value, bank: e.target.value === 'Cash' ? '' : editForm.bank })}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <MenuItem key={method} value={method}>
                      {method}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {renderBankField(editForm, setEditForm)}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Transaction Number"
                value={editForm.referenceNumberExternal}
                onChange={(e) => setEditForm({ ...editForm, referenceNumberExternal: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialog(false);
            setEditingDeposit(null);
            setEditForm({
              amount: '',
              paymentMethod: 'Cash',
              bank: '',
              referenceNumberExternal: '',
              description: ''
            });
          }}>Cancel</Button>
          <Button onClick={handleUpdate} variant="contained" disabled={loading || !editForm.amount || !editForm.referenceNumberExternal}>
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Deposits;

