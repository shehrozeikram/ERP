import React, { useEffect, useState, useCallback } from 'react';
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
  Tooltip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { fetchAllInvoices, deleteInvoice } from '../../../services/propertyInvoiceService';
import { useInvoiceCreation } from '../../../hooks/useInvoiceCreation';
import { generateGeneralInvoicePDF } from '../../../utils/invoicePDFGenerators';
import { fetchChargeTypes, deleteChargeType, createChargeType } from '../../../services/chargeTypeService';
import { fetchSectors } from '../../../services/tajSectorsService';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const getPaymentStatusConfig = (status) => {
  const normalized = (status || 'unpaid').toLowerCase();
  switch (normalized) {
    case 'paid':
      return { color: 'success', label: 'Paid' };
    case 'partial_paid':
    case 'partial':
      return { color: 'warning', label: 'Partial Paid' };
    case 'unpaid':
    default:
      return { color: 'error', label: 'Unpaid' };
  }
};

const OpenInvoices = () => {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');

  const {
    invoiceDialogOpen,
    invoiceProperty,
    invoiceData,
    invoiceLoading,
    invoiceError,
    invoiceWasSaved,
    handleCreateInvoice,
    handleEditInvoice,
    handleInvoiceFieldChange,
    handleSaveInvoice,
    handleCloseInvoiceDialog,
    addCharge,
    removeCharge,
    setInvoiceError
  } = useInvoiceCreation({
    defaultChargeType: 'OTHER',
    defaultInvoiceType: 'GEN',
    includeCAM: false,
    includeElectricity: false,
    includeRent: false
  });

  const pagination = usePagination({
    defaultRowsPerPage: 50,
    resetDependencies: [statusFilter, paymentStatusFilter, search]
  });

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page: pagination.page + 1,
        limit: pagination.rowsPerPage,
        openInvoices: 'true' // Only fetch open invoices (without properties)
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (paymentStatusFilter !== 'all') params.paymentStatus = paymentStatusFilter;
      if (search) params.search = search;
      
      const response = await fetchAllInvoices(params);
      const invoicesData = response.data?.data || [];
      
      setInvoices(invoicesData);
      if (response.data?.pagination) {
        pagination.setTotal(response.data.pagination.total || 0);
      } else {
        pagination.setTotal(invoicesData.length);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.rowsPerPage, statusFilter, paymentStatusFilter, search, pagination.setTotal]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleDownloadInvoice = async () => {
    if (!invoiceData) {
      setInvoiceError('Invoice data is not ready yet. Please wait a moment.');
      return;
    }
    if (!invoiceData._id) {
      setInvoiceError('Please create the invoice first before downloading.');
      return;
    }
    await generateGeneralInvoicePDF(invoiceData, invoiceProperty);
  };

  const handleDeleteInvoice = async (invoice) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await deleteInvoice(invoice._id);
      setSuccess('Invoice deleted successfully');
      loadInvoices(true);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete invoice');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChargeType = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the charge type "${name}"?`)) {
      return;
    }
    
    try {
      await deleteChargeType(id);
      setSuccess(`Charge type "${name}" deleted successfully`);
      await loadChargeTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to delete charge type "${name}"`);
      setTimeout(() => setError(''), 5000);
    }
  };

  // Refresh invoices when one is saved
  useEffect(() => {
    if (invoiceWasSaved) {
      setTimeout(() => {
        loadInvoices(true);
      }, 500);
    }
  }, [invoiceWasSaved]);

  const [chargeTypes, setChargeTypes] = useState([]);
  const [showAddChargeTypeDialog, setShowAddChargeTypeDialog] = useState(false);
  const [newChargeType, setNewChargeType] = useState('');
  const [chargeIndexForNewType, setChargeIndexForNewType] = useState(null);
  const [sectors, setSectors] = useState([]);
  const [sectorsLoading, setSectorsLoading] = useState(false);
  
  // Load charge types from API
  const loadChargeTypes = useCallback(async () => {
    try {
      const response = await fetchChargeTypes({ isActive: 'true' });
      const types = response.data?.data || [];
      setChargeTypes(types);
    } catch (err) {
      console.error('Failed to load charge types:', err);
      // Fallback to default types if API fails
      setChargeTypes([
        { name: 'OTHER', isSystem: true },
        { name: 'MAINTENANCE', isSystem: true }
      ]);
    }
  }, []);

  // Load sectors from API
  const loadSectors = useCallback(async () => {
    try {
      setSectorsLoading(true);
      const response = await fetchSectors({ isActive: 'true' });
      setSectors(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load sectors:', err);
    } finally {
      setSectorsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChargeTypes();
    loadSectors();
  }, [loadChargeTypes, loadSectors]);

  return (
    <Box>
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5">Open Invoices</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => loadInvoices(true)}
                disabled={loading}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleCreateInvoice(null)}
              >
                Create Invoice
              </Button>
            </Stack>
          </Stack>

          {error && (
            <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Search Invoices"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by invoice number, customer name..."
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="Issued">Issued</MenuItem>
                  <MenuItem value="Paid">Paid</MenuItem>
                  <MenuItem value="Cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Status</InputLabel>
                <Select
                  value={paymentStatusFilter}
                  label="Payment Status"
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                  <MenuItem value="partial_paid">Partial Paid</MenuItem>
                  <MenuItem value="unpaid">Unpaid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                <TableRow>
                  <TableCell>Customer/Property</TableCell>
                  <TableCell>Invoice #</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center">
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center">
                        <Typography color="text.secondary" sx={{ mb: 2 }}>
                          No open invoices found. Create one to get started.
                        </Typography>
                        <Button
                          variant="outlined"
                          startIcon={<AddIcon />}
                          onClick={() => handleCreateInvoice(null)}
                        >
                          Create Open Invoice
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((invoice) => {
                      const { color, label } = getPaymentStatusConfig(invoice.paymentStatus);
                      return (
                        <TableRow key={invoice._id}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {invoice.customerName || 'N/A'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {invoice.customerEmail || invoice.customerPhone || invoice.customerAddress || 'No contact info'}
                            </Typography>
                          </TableCell>
                          <TableCell>{invoice.invoiceNumber || 'N/A'}</TableCell>
                          <TableCell>
                            {invoice.invoiceDate ? dayjs(invoice.invoiceDate).format('MMM D, YYYY') : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {invoice.periodFrom && invoice.periodTo ? (
                              `${dayjs(invoice.periodFrom).format('MMM D')} - ${dayjs(invoice.periodTo).format('MMM D, YYYY')}`
                            ) : (
                              'N/A'
                            )}
                          </TableCell>
                          <TableCell>
                            {invoice.dueDate ? dayjs(invoice.dueDate).format('MMM D, YYYY') : 'N/A'}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(invoice.grandTotal || 0)}</TableCell>
                          <TableCell align="right">{formatCurrency(invoice.totalPaid || 0)}</TableCell>
                          <TableCell align="right">{formatCurrency(invoice.balance || 0)}</TableCell>
                          <TableCell>
                            <Chip label={label} color={color} size="small" />
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Tooltip title="View Invoice">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleEditInvoice(null, invoice)}
                                >
                                  <ViewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Download Invoice">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={async () => {
                                    await generateGeneralInvoicePDF(invoice, null);
                                  }}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete Invoice">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteInvoice(invoice)}
                                  disabled={loading}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
          
          <TablePaginationWrapper
            page={pagination.page}
            rowsPerPage={pagination.rowsPerPage}
            total={pagination.total || 0}
            onPageChange={pagination.handleChangePage}
            onRowsPerPageChange={pagination.handleChangeRowsPerPage}
          />
        </CardContent>
      </Card>

      {/* Invoice Dialog */}
      <Dialog
        open={invoiceDialogOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            if (invoiceLoading) return;
          }
          handleCloseInvoiceDialog();
        }}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={invoiceLoading}
      >
        <DialogTitle>{invoiceData?._id ? 'Edit Invoice' : 'Create Invoice'}</DialogTitle>
        <DialogContent dividers>
          {invoiceLoading && (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          )}
          {invoiceError && <Alert severity="error" sx={{ mb: 2 }}>{invoiceError}</Alert>}
          {!invoiceLoading && invoiceData && (
            <Stack spacing={2}>
              {invoiceProperty ? (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Property</Typography>
                  <Typography variant="h6">
                    {invoiceProperty.propertyName || invoiceProperty.address || 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {invoiceProperty.address || 'No address'}
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Customer Details</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Customer Name"
                        value={invoiceData.customerName || ''}
                        onChange={(e) => handleInvoiceFieldChange('customerName', e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Customer Email"
                        type="email"
                        value={invoiceData.customerEmail || ''}
                        onChange={(e) => handleInvoiceFieldChange('customerEmail', e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Customer Phone"
                        value={invoiceData.customerPhone || ''}
                        onChange={(e) => handleInvoiceFieldChange('customerPhone', e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Customer Address"
                        value={invoiceData.customerAddress || ''}
                        onChange={(e) => handleInvoiceFieldChange('customerAddress', e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Sector</InputLabel>
                        <Select
                          value={invoiceData.sector || ''}
                          label="Sector"
                          onChange={(e) => handleInvoiceFieldChange('sector', e.target.value)}
                          disabled={sectorsLoading}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {sectors.map((sector) => (
                            <MenuItem key={sector._id || sector.name} value={sector.name}>
                              {sector.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Box>
              )}

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Invoice Number"
                    value={invoiceData.invoiceNumber || ''}
                    fullWidth
                    size="small"
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Invoice Date"
                    type="date"
                    value={invoiceData.invoiceDate ? dayjs(invoiceData.invoiceDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')}
                    onChange={(e) => handleInvoiceFieldChange('invoiceDate', e.target.value)}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Period From"
                    type="date"
                    value={invoiceData.periodFrom ? dayjs(invoiceData.periodFrom).format('YYYY-MM-DD') : ''}
                    onChange={(e) => handleInvoiceFieldChange('periodFrom', e.target.value ? new Date(e.target.value) : null)}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Period To"
                    type="date"
                    value={invoiceData.periodTo ? dayjs(invoiceData.periodTo).format('YYYY-MM-DD') : ''}
                    onChange={(e) => {
                      const newPeriodTo = e.target.value ? new Date(e.target.value) : null;
                      handleInvoiceFieldChange('periodTo', newPeriodTo);
                      if (newPeriodTo) {
                        handleInvoiceFieldChange('dueDate', dayjs(newPeriodTo).add(15, 'day').toDate());
                      }
                    }}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Due Date"
                    type="date"
                    value={invoiceData.dueDate ? dayjs(invoiceData.dueDate).format('YYYY-MM-DD') : ''}
                    onChange={(e) => handleInvoiceFieldChange('dueDate', e.target.value ? new Date(e.target.value) : null)}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="subtitle2">Charges</Typography>
                    <Button size="small" startIcon={<AddIcon />} onClick={addCharge}>
                      Add Charge
                    </Button>
                  </Stack>
                </Grid>

                {invoiceData.charges?.map((charge, index) => (
                  <React.Fragment key={index}>
                    <Grid item xs={12} sm={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Charge Type</InputLabel>
                        <Select
                          value={charge.type || 'OTHER'}
                          label="Charge Type"
                          onChange={(e) => {
                            if (e.target.value === '__ADD_NEW__') {
                              setChargeIndexForNewType(index);
                              setShowAddChargeTypeDialog(true);
                            } else {
                              handleInvoiceFieldChange(`charge.${index}.type`, e.target.value);
                            }
                          }}
                          MenuProps={{
                            PaperProps: {
                              sx: {
                                '& .MuiMenuItem-root': {
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }
                              }
                            }
                          }}
                        >
                          {chargeTypes.map((ct) => (
                            <MenuItem 
                              key={ct._id || ct.name} 
                              value={ct.name}
                              sx={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                '&:hover .delete-icon': {
                                  visibility: 'visible'
                                }
                              }}
                            >
                              <span>{ct.name}</span>
                              {!ct.isSystem && (
                                <IconButton
                                  size="small"
                                  className="delete-icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleDeleteChargeType(ct._id, ct.name);
                                  }}
                                  sx={{ 
                                    ml: 1,
                                    visibility: 'hidden',
                                    '&:hover': {
                                      visibility: 'visible'
                                    }
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              )}
                            </MenuItem>
                          ))}
                          <MenuItem value="__ADD_NEW__">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AddIcon fontSize="small" />
                              Add New
                            </Box>
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Description"
                        value={charge.description || ''}
                        onChange={(e) => handleInvoiceFieldChange(`charge.${index}.description`, e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <TextField
                        label="Amount"
                        type="number"
                        value={charge.amount || 0}
                        onChange={(e) => handleInvoiceFieldChange(`charge.${index}.amount`, e.target.value)}
                        fullWidth
                        size="small"
                        InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>PKR</Typography> }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <TextField
                        label="Arrears"
                        type="number"
                        value={charge.arrears || 0}
                        onChange={(e) => handleInvoiceFieldChange(`charge.${index}.arrears`, e.target.value)}
                        fullWidth
                        size="small"
                        InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>PKR</Typography> }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={1}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeCharge(index)}
                        disabled={invoiceData.charges.length <= 1}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Grid>
                  </React.Fragment>
                ))}

                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Total Amount"
                    value={formatCurrency(invoiceData.grandTotal || 0)}
                    fullWidth
                    size="small"
                    InputProps={{ readOnly: true }}
                    sx={{
                      '& .MuiInputBase-input': {
                        fontWeight: 600,
                        fontSize: '1.1rem'
                      }
                    }}
                  />
                </Grid>
              </Grid>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseInvoiceDialog}>Close</Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadInvoice}
            disabled={invoiceLoading || !invoiceData || !invoiceData._id}
          >
            Download
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveInvoice}
            disabled={invoiceLoading || !invoiceData}
          >
            {invoiceLoading ? (invoiceData?._id ? 'Updating...' : 'Creating...') : (invoiceData?._id ? 'Update Invoice' : 'Create Invoice')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Charge Type Dialog */}
      <Dialog
        open={showAddChargeTypeDialog}
        onClose={() => {
          setShowAddChargeTypeDialog(false);
          setNewChargeType('');
          setChargeIndexForNewType(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Charge Type</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Charge Type Name"
            value={newChargeType}
            onChange={(e) => setNewChargeType(e.target.value.toUpperCase().trim())}
            fullWidth
            size="small"
            placeholder="e.g., GROUND_BOOKING, BILLBOARD"
            sx={{ mt: 1 }}
            helperText="Enter a name for the new charge type (will be converted to uppercase)"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowAddChargeTypeDialog(false);
            setNewChargeType('');
            setChargeIndexForNewType(null);
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (newChargeType && newChargeType.trim() !== '') {
                try {
                  const trimmed = newChargeType.trim().toUpperCase();
                  await createChargeType({ name: trimmed });
                  setSuccess(`Charge type "${trimmed}" created successfully`);
                  await loadChargeTypes();
                  // Update the charge type for the charge that triggered the dialog
                  if (chargeIndexForNewType !== null && invoiceData?.charges?.[chargeIndexForNewType]) {
                    handleInvoiceFieldChange(`charge.${chargeIndexForNewType}.type`, trimmed);
                  }
                  setShowAddChargeTypeDialog(false);
                  setNewChargeType('');
                  setChargeIndexForNewType(null);
                  setTimeout(() => setSuccess(''), 3000);
                } catch (err) {
                  setError(err.response?.data?.message || `Failed to create charge type "${newChargeType}"`);
                  setTimeout(() => setError(''), 5000);
                }
              }
            }}
            disabled={!newChargeType || newChargeType.trim() === ''}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OpenInvoices;
