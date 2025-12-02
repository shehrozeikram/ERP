import React, { useState, useEffect, useMemo } from 'react';
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
  Tooltip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  Print as PrintIcon,
  Add as AddIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import {
  fetchReceipts,
  fetchInvoicesForProperty,
  createReceipt,
  deleteReceipt
} from '../../../services/propertyReceiptService';
import { fetchInvoicesForProperty as fetchPropertyInvoices } from '../../../services/propertyInvoiceService';
import api from '../../../services/api';
import pakistanBanks from '../../../constants/pakistanBanks';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const Receipts = () => {
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  
  const [receiptForm, setReceiptForm] = useState({
    receiptNumber: '',
    receiptDate: dayjs().format('YYYY-MM-DD'),
    amount: '',
    bankName: '',
    bankReference: '',
    description: '',
    paymentMethod: 'Bank Transfer'
  });

  const [allocations, setAllocations] = useState([]);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetchReceipts({ search });
      setReceipts(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  const loadProperties = async () => {
    try {
      const response = await api.get('/taj-utilities/properties');
      setProperties(response.data?.data || []);
    } catch (err) {
      console.error('Error loading properties:', err);
    }
  };

  useEffect(() => {
    loadReceipts();
    loadProperties();
  }, []);

  const handlePropertyChange = async (property) => {
    setSelectedProperty(property);
    if (!property?._id) {
      setInvoices([]);
      setAllocations([]);
      return;
    }

    try {
      setLoadingInvoices(true);
      const response = await fetchInvoicesForProperty(property._id);
      const invoiceList = response.data?.data || [];
      setInvoices(invoiceList);
      
      // Initialize allocations - filter only outstanding invoices
      const outstandingInvoices = invoiceList.filter(inv => (inv.balance || 0) > 0);
      
      setAllocations(outstandingInvoices.map(inv => {
        // Determine invoice type from chargeTypes
        let invoiceType = 'CAM';
        if (inv.chargeTypes?.includes('ELECTRICITY')) {
          invoiceType = 'ELECTRICITY';
        } else if (inv.chargeTypes?.includes('RENT')) {
          invoiceType = 'RENT';
        } else if (inv.chargeTypes?.includes('CAM')) {
          invoiceType = 'CAM';
        } else if (inv.chargeTypes?.length > 0) {
          invoiceType = inv.chargeTypes[0];
        }
        
        return {
          invoice: inv._id,
          invoiceNumber: inv.invoiceNumber,
          invoiceType,
          balance: inv.balance || 0,
          allocatedAmount: 0,
          remaining: inv.balance || 0
        };
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load invoices');
      setInvoices([]);
      setAllocations([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleAllocationChange = (index, value) => {
    const numValue = Number(value) || 0;
    const balance = allocations[index].balance;
    const newAllocated = Math.min(Math.max(0, numValue), balance);
    
    const updated = [...allocations];
    updated[index] = {
      ...updated[index],
      allocatedAmount: newAllocated,
      remaining: balance - newAllocated
    };
    setAllocations(updated);
  };

  const totals = useMemo(() => {
    const totalAllocated = allocations.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);
    const receiptAmount = Number(receiptForm.amount) || 0;
    return {
      totalAllocated,
      unallocated: receiptAmount - totalAllocated
    };
  }, [allocations, receiptForm.amount]);

  const handleOpenCreateDialog = () => {
    setCreateDialogOpen(true);
    setSelectedProperty(null);
    setInvoices([]);
    setAllocations([]);
    setReceiptForm({
      receiptNumber: '',
      receiptDate: dayjs().format('YYYY-MM-DD'),
      amount: '',
      bankName: '',
      bankReference: '',
      description: '',
      paymentMethod: 'Bank Transfer'
    });
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setSelectedProperty(null);
    setInvoices([]);
    setAllocations([]);
    setError('');
  };

  const handleSaveReceipt = async () => {
    if (!selectedProperty) {
      setError('Please select a property');
      return;
    }

    if (!receiptForm.amount || Number(receiptForm.amount) <= 0) {
      setError('Please enter a valid receipt amount');
      return;
    }

    const validAllocations = allocations.filter(a => a.allocatedAmount > 0);
    if (validAllocations.length === 0) {
      setError('Please allocate at least one invoice');
      return;
    }

    if (totals.totalAllocated > Number(receiptForm.amount)) {
      setError('Total allocated amount cannot exceed receipt amount');
      return;
    }

    try {
      setError('');
      setLoading(true);
      
      await createReceipt({
        property: selectedProperty._id,
        receiptDate: receiptForm.receiptDate,
        amount: Number(receiptForm.amount),
        bankName: receiptForm.bankName,
        bankReference: receiptForm.bankReference,
        description: receiptForm.description,
        paymentMethod: receiptForm.paymentMethod,
        allocations: validAllocations
      });

      setSuccess('Receipt created successfully');
      handleCloseCreateDialog();
      loadReceipts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create receipt');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReceipt = async (receipt) => {
    if (!window.confirm(`Delete receipt ${receipt.receiptNumber}?`)) return;

    try {
      setError('');
      await deleteReceipt(receipt._id);
      setSuccess('Receipt deleted successfully');
      loadReceipts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete receipt');
    }
  };

  const getInvoiceDescription = (invoice) => {
    if (invoice.periodFrom && invoice.periodTo) {
      const from = dayjs(invoice.periodFrom).format('DD-MMM-YYYY');
      const to = dayjs(invoice.periodTo).format('DD-MMM-YYYY');
      const type = invoice.chargeTypes?.join(', ') || 'Invoice';
      return `${type} From ${from} To ${to}`;
    }
    return invoice.description || invoice.invoiceNumber || 'Invoice';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Taj Utilities — Receipts
          </Typography>
          <Typography color="text.secondary">
            Create and manage payment receipts with invoice allocation.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
          >
            Create Receipt
          </Button>
          <TextField
            size="small"
            placeholder="Search receipts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Tooltip title="Refresh">
            <IconButton onClick={loadReceipts} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

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

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Receipt Number</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Property</TableCell>
                  <TableCell>Bank</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Allocated</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">No receipts found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((receipt) => (
                    <TableRow key={receipt._id} hover>
                      <TableCell>{receipt.receiptNumber}</TableCell>
                      <TableCell>
                        {dayjs(receipt.receiptDate).format('DD MMM YYYY')}
                      </TableCell>
                      <TableCell>
                        {receipt.property?.propertyName || receipt.property?.plotNumber || 'N/A'}
                      </TableCell>
                      <TableCell>{receipt.bankName || 'N/A'}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>
                          {formatCurrency(receipt.amount || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(receipt.totalAllocated || 0)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={receipt.status || 'Draft'}
                          size="small"
                          color={receipt.status === 'Posted' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteReceipt(receipt)}
                            >
                              <DeleteIcon fontSize="small" />
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
        </CardContent>
      </Card>

      {/* Create Receipt Dialog */}
      <Dialog open={createDialogOpen} onClose={handleCloseCreateDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Pay Invoices</Typography>
            <IconButton onClick={handleCloseCreateDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                options={properties}
                getOptionLabel={(option) => 
                  `${option.propertyName || option.plotNumber || ''} - ${option.ownerName || ''}`
                }
                value={selectedProperty}
                onChange={(e, newValue) => handlePropertyChange(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Select Property" size="small" required />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Date"
                type="date"
                value={receiptForm.receiptDate}
                onChange={(e) => setReceiptForm({ ...receiptForm, receiptDate: e.target.value })}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Amount"
                type="number"
                value={receiptForm.amount}
                onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
                fullWidth
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={receiptForm.description}
                onChange={(e) => setReceiptForm({ ...receiptForm, description: e.target.value })}
                fullWidth
                size="small"
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Bank</InputLabel>
                <Select
                  value={receiptForm.bankName}
                  label="Bank"
                  onChange={(e) => setReceiptForm({ ...receiptForm, bankName: e.target.value })}
                >
                  {pakistanBanks.map((bank) => (
                    <MenuItem key={bank} value={bank}>
                      {bank}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Bank Reference"
                value={receiptForm.bankReference}
                onChange={(e) => setReceiptForm({ ...receiptForm, bankReference: e.target.value })}
                fullWidth
                size="small"
              />
            </Grid>
          </Grid>

          {loadingInvoices ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : allocations.length > 0 ? (
            <>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>Nature</TableCell>
                      <TableCell align="right">Balance</TableCell>
                      <TableCell align="right">Pay</TableCell>
                      <TableCell align="right">Remaining</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allocations.map((alloc, index) => {
                      const invoice = invoices.find(inv => inv._id === alloc.invoice);
                      return (
                        <TableRow key={alloc.invoice}>
                          <TableCell>{alloc.invoiceType}</TableCell>
                          <TableCell>{getInvoiceDescription(invoice || {})}</TableCell>
                          <TableCell align="right">{formatCurrency(alloc.balance)}</TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              value={alloc.allocatedAmount || ''}
                              onChange={(e) => handleAllocationChange(index, e.target.value)}
                              size="small"
                              inputProps={{ min: 0, max: alloc.balance, step: 1 }}
                              sx={{ width: 120 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography color={alloc.remaining > 0 ? 'error.main' : 'success.main'}>
                              {formatCurrency(alloc.remaining)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Total Allocated:
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {formatCurrency(totals.totalAllocated)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Un-Allocated Receipt:
                  </Typography>
                  <Typography 
                    variant="h6" 
                    fontWeight={600}
                    color={totals.unallocated < 0 ? 'error.main' : totals.unallocated > 0 ? 'warning.main' : 'success.main'}
                  >
                    {formatCurrency(totals.unallocated)}
                  </Typography>
                </Stack>
              </Box>
            </>
          ) : selectedProperty ? (
            <Alert severity="info">No outstanding invoices found for this property.</Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog}>Close</Button>
          <Button onClick={handleCloseCreateDialog}>Refresh</Button>
          <Button
            variant="contained"
            onClick={handleSaveReceipt}
            disabled={loading || !selectedProperty || totals.totalAllocated <= 0}
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Receipts;
