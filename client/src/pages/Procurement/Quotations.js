import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Tooltip,
  Chip,
  Alert,
  Stack,
  Divider,
  Grid
} from '@mui/material';
import {
  Description as QuotationIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CheckCircle as ApproveIcon,
  ShoppingCart as POIcon
} from '@mui/icons-material';
import procurementService from '../../services/procurementService';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';

const Quotations = () => {
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [quotations, setQuotations] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  
  // Pagination and filters
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Dialog states
  const [formDialog, setFormDialog] = useState({ open: false, mode: 'create', data: null, requisition: null });
  const [viewDialog, setViewDialog] = useState({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });
  
  // Form data
  const [formData, setFormData] = useState({
    indent: '',
    vendor: '',
    quotationDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    status: 'Received',
    items: [],
    validityDays: 30,
    deliveryTime: '',
    paymentTerms: '',
    notes: ''
  });

  // Load data on component mount
  useEffect(() => {
    loadQuotations();
    loadVendors();
    loadRequisitions();
  }, [page, rowsPerPage, search, statusFilter]);

  const loadQuotations = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
        status: statusFilter || undefined
      };
      
      const response = await procurementService.getQuotations(params);
      if (response.success) {
        setQuotations(response.data?.quotations || []);
        setTotalItems(response.data?.pagination?.totalItems || 0);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load quotations');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter]);

  const loadVendors = async () => {
    try {
      const response = await procurementService.getVendors({ limit: 1000 });
      if (response.success) {
        setVendors(response.data?.vendors || []);
      }
    } catch (err) {
      console.error('Failed to load vendors:', err);
    }
  };

  const loadRequisitions = async () => {
    try {
      const response = await procurementService.getRequisitions({ limit: 1000, status: 'Approved' });
      if (response.success) {
        setRequisitions(response.data?.indents || []);
      }
    } catch (err) {
      console.error('Failed to load requisitions:', err);
    }
  };

  const handleCreate = (requisition) => {
    if (requisition) {
      setFormData({
        indent: requisition._id,
        vendor: '',
        quotationDate: new Date().toISOString().split('T')[0],
        expiryDate: '',
        status: 'Received',
        items: requisition.items.map(item => ({
          description: item.itemName,
          quantity: item.quantity,
          unit: item.unit || 'Piece',
          unitPrice: 0,
          taxRate: 0,
          discount: 0,
          amount: 0
        })),
        validityDays: 30,
        deliveryTime: '',
        paymentTerms: '',
        notes: ''
      });
      setFormDialog({ open: true, mode: 'create', data: null, requisition });
    } else {
      setFormData({
        indent: '',
        vendor: '',
        quotationDate: new Date().toISOString().split('T')[0],
        expiryDate: '',
        status: 'Received',
        items: [{ description: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 0, discount: 0, amount: 0 }],
        validityDays: 30,
        deliveryTime: '',
        paymentTerms: '',
        notes: ''
      });
      setFormDialog({ open: true, mode: 'create', data: null, requisition: null });
    }
  };

  const handleEdit = (quotation) => {
    setFormData({
      indent: quotation.indent?._id || quotation.indent || '',
      vendor: quotation.vendor?._id || quotation.vendor || '',
      quotationDate: new Date(quotation.quotationDate).toISOString().split('T')[0],
      expiryDate: quotation.expiryDate ? new Date(quotation.expiryDate).toISOString().split('T')[0] : '',
      status: quotation.status,
      items: quotation.items || [],
      validityDays: quotation.validityDays || 30,
      deliveryTime: quotation.deliveryTime || '',
      paymentTerms: quotation.paymentTerms || '',
      notes: quotation.notes || ''
    });
    setFormDialog({ open: true, mode: 'edit', data: quotation, requisition: null });
  };

  const handleView = (quotation) => {
    setViewDialog({ open: true, data: quotation });
  };

  const handleDelete = (id) => {
    setDeleteDialog({ open: true, id });
  };

  const handleFinalize = async (id) => {
    try {
      const response = await procurementService.updateQuotation(id, { status: 'Finalized' });
      setSuccess(response.data?.message || 'Quotation finalized successfully and Purchase Order created automatically');
      loadQuotations();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to finalize quotation');
    }
  };

  const handleCreatePO = async (id) => {
    try {
      await procurementService.createPOFromQuotation(id);
      setSuccess('Purchase Order created from quotation');
      loadQuotations();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create Purchase Order');
    }
  };

  const confirmDelete = async () => {
    try {
      // Note: Delete endpoint might not exist, adjust as needed
      setError('Delete functionality not yet implemented');
      setDeleteDialog({ open: false, id: null });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete quotation');
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Calculate amounts for items
      const items = formData.items.map(item => {
        const subtotal = item.quantity * item.unitPrice;
        const discountAmount = item.discount || 0;
        const afterDiscount = subtotal - discountAmount;
        const taxAmount = (afterDiscount * (item.taxRate || 0)) / 100;
        const amount = afterDiscount + taxAmount;
        
        return {
          ...item,
          amount
        };
      });

      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const discountAmount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
      const taxAmount = items.reduce((sum, item) => {
        const afterDiscount = (item.quantity * item.unitPrice) - (item.discount || 0);
        return sum + (afterDiscount * (item.taxRate || 0) / 100);
      }, 0);
      const totalAmount = subtotal - discountAmount + taxAmount;

      const quotationData = {
        ...formData,
        items,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount
      };

      if (formDialog.mode === 'create') {
        await procurementService.createQuotation(quotationData);
        setSuccess('Quotation created successfully');
      } else {
        await procurementService.updateQuotation(formDialog.data._id, quotationData);
        setSuccess('Quotation updated successfully');
      }
      
      setFormDialog({ open: false, mode: 'create', data: null, requisition: null });
      loadQuotations();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save quotation');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 0, discount: 0, amount: 0 }]
    });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    // Recalculate amount
    const item = newItems[index];
    const subtotal = item.quantity * item.unitPrice;
    const discountAmount = item.discount || 0;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * (item.taxRate || 0)) / 100;
    newItems[index].amount = afterDiscount + taxAmount;
    
    setFormData({ ...formData, items: newItems });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Received': 'info',
      'Shortlisted': 'warning',
      'Finalized': 'success',
      'Rejected': 'error'
    };
    return colors[status] || 'default';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Quotations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage vendor quotations
          </Typography>
        </Box>
        <Button 
          variant="outlined" 
          startIcon={<RefreshIcon />} 
          onClick={loadQuotations}
          sx={{ mr: 2 }}
        >
          Refresh
        </Button>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => handleCreate(null)}
        >
          New Quotation
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search quotations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
            sx={{ flexGrow: 1 }}
          />
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Received">Received</MenuItem>
            <MenuItem value="Shortlisted">Shortlisted</MenuItem>
            <MenuItem value="Finalized">Finalized</MenuItem>
            <MenuItem value="Rejected">Rejected</MenuItem>
          </TextField>
        </Stack>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Quote #</strong></TableCell>
                <TableCell><strong>Requisition</strong></TableCell>
                <TableCell><strong>Vendor</strong></TableCell>
                <TableCell><strong>Amount</strong></TableCell>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography>Loading...</Typography>
                  </TableCell>
                </TableRow>
              ) : quotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary">No quotations found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                quotations.map((quote) => (
                  <TableRow key={quote._id} hover>
                    <TableCell>{quote.quotationNumber}</TableCell>
                    <TableCell>{quote.indent?.indentNumber || '-'}</TableCell>
                    <TableCell>{quote.vendor?.name || '-'}</TableCell>
                    <TableCell>{formatPKR(quote.totalAmount)}</TableCell>
                    <TableCell>{formatDate(quote.quotationDate)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={quote.status} 
                        color={getStatusColor(quote.status)} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => handleView(quote)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {quote.status !== 'Finalized' && quote.status !== 'Rejected' && (
                        <>
                          <Tooltip title="Finalize">
                            <IconButton 
                              size="small" 
                              color="success" 
                              onClick={() => handleFinalize(quote._id)}
                            >
                              <ApproveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => handleEdit(quote)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {quote.status === 'Finalized' && (
                        <Tooltip title="Create PO">
                          <IconButton 
                            size="small" 
                            color="primary" 
                            onClick={() => handleCreatePO(quote._id)}
                          >
                            <POIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalItems}
          page={page}
          onPageChange={(e, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* FORM DIALOG */}
      <Dialog open={formDialog.open} onClose={() => setFormDialog({ open: false, mode: 'create', data: null, requisition: null })} maxWidth="md" fullWidth>
        <DialogTitle>
          {formDialog.mode === 'create' ? 'Create Quotation' : 'Edit Quotation'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              fullWidth
              label="Requisition"
              value={formData.indent}
              onChange={(e) => setFormData({ ...formData, indent: e.target.value })}
            >
              {requisitions.map(req => (
                <MenuItem key={req._id} value={req._id}>
                  {req.indentNumber} - {req.title}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="Vendor"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              required
            >
              {vendors.map(v => (
                <MenuItem key={v._id} value={v._id}>{v.name}</MenuItem>
              ))}
            </TextField>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Quotation Date"
                  value={formData.quotationDate}
                  onChange={(e) => setFormData({ ...formData, quotationDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Expiry Date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            <TextField
              select
              fullWidth
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <MenuItem value="Received">Received</MenuItem>
              <MenuItem value="Shortlisted">Shortlisted</MenuItem>
              <MenuItem value="Finalized">Finalized</MenuItem>
              <MenuItem value="Rejected">Rejected</MenuItem>
            </TextField>
            
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Items</Typography>
              <Button size="small" onClick={addItem}>Add Item</Button>
            </Box>
            
            {formData.items.map((item, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={5}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Description"
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Quantity"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Unit"
                      value={item.unit}
                      onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Unit Price"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    />
                  </Grid>
                  <Grid item xs={6} md={1}>
                    <IconButton size="small" color="error" onClick={() => removeItem(idx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Tax Rate %"
                      value={item.taxRate}
                      onChange={(e) => updateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Discount"
                      value={item.discount}
                      onChange={(e) => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Amount: {formatPKR(item.amount)}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            ))}
            
            <TextField
              fullWidth
              type="number"
              label="Validity Days"
              value={formData.validityDays}
              onChange={(e) => setFormData({ ...formData, validityDays: parseInt(e.target.value) || 30 })}
            />
            <TextField
              fullWidth
              label="Delivery Time"
              value={formData.deliveryTime}
              onChange={(e) => setFormData({ ...formData, deliveryTime: e.target.value })}
            />
            <TextField
              fullWidth
              label="Payment Terms"
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormDialog({ open: false, mode: 'create', data: null, requisition: null })}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {formDialog.mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* VIEW DIALOG */}
      <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, data: null })} maxWidth="md" fullWidth>
        <DialogTitle>Quotation Details</DialogTitle>
        <DialogContent>
          {viewDialog.data && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Quotation #</Typography>
                  <Typography variant="body1">{viewDialog.data.quotationNumber}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip 
                    label={viewDialog.data.status} 
                    color={getStatusColor(viewDialog.data.status)} 
                    size="small" 
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Requisition</Typography>
                  <Typography variant="body1">{viewDialog.data.indent?.indentNumber || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Vendor</Typography>
                  <Typography variant="body1">{viewDialog.data.vendor?.name || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Quotation Date</Typography>
                  <Typography variant="body1">{formatDate(viewDialog.data.quotationDate)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Expiry Date</Typography>
                  <Typography variant="body1">{viewDialog.data.expiryDate ? formatDate(viewDialog.data.expiryDate) : '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Delivery Time</Typography>
                  <Typography variant="body1">{viewDialog.data.deliveryTime || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Payment Terms</Typography>
                  <Typography variant="body1">{viewDialog.data.paymentTerms || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Validity Days</Typography>
                  <Typography variant="body1">{viewDialog.data.validityDays || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Total Amount</Typography>
                  <Typography variant="body1" fontWeight="bold">{formatPKR(viewDialog.data.totalAmount)}</Typography>
                </Grid>
                {viewDialog.data.notes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewDialog.data.notes}</Typography>
                  </Grid>
                )}
                {viewDialog.data.items && viewDialog.data.items.length > 0 && (
                  <>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Items</Typography>
                    </Grid>
                    {viewDialog.data.items.map((item, idx) => (
                      <Grid item xs={12} key={idx}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="body2"><strong>{item.description}</strong></Typography>
                          <Typography variant="body2">Quantity: {item.quantity} {item.unit}</Typography>
                          <Typography variant="body2">Unit Price: {formatPKR(item.unitPrice)}</Typography>
                          <Typography variant="body2">Amount: {formatPKR(item.amount)}</Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog({ open: false, data: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, id: null })}>
        <DialogTitle>Delete Quotation</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this quotation? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, id: null })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Quotations;
