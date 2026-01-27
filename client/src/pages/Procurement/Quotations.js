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
  ShoppingCart as POIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import procurementService from '../../services/procurementService';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';
import dayjs from 'dayjs';

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

  const handleView = async (quotation) => {
    try {
      // Fetch full quotation data with populated indent
      const response = await procurementService.getQuotationById(quotation._id);
      if (response.success) {
        setViewDialog({ open: true, data: response.data });
      } else {
        setViewDialog({ open: true, data: quotation });
      }
    } catch (err) {
      // If fetch fails, use the quotation data we have
      setViewDialog({ open: true, data: quotation });
    }
  };

  const formatDateForPrint = (date) => {
    if (!date) return '';
    return dayjs(date).format('DD/MM/YYYY');
  };

  const formatDateForQuotation = (date) => {
    if (!date) return '';
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const d = new Date(date);
    return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0.00';
    return parseFloat(num).toFixed(2);
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
      <Dialog 
        open={viewDialog.open} 
        onClose={() => setViewDialog({ open: false, data: null })} 
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: '90%',
            maxWidth: '210mm',
            maxHeight: '95vh',
            m: 2,
            '@media print': {
              boxShadow: 'none',
              maxWidth: '100%',
              margin: 0,
              height: '100%',
              width: '100%',
              maxHeight: '100%'
            }
          }
        }}
      >
        <DialogTitle sx={{ '@media print': { display: 'none' }, pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Quotation Details</Typography>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
              size="small"
            >
              Print
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'auto', '@media print': { p: 0, overflow: 'visible' } }}>
          {viewDialog.data && (
            <Box sx={{ width: '100%' }} className="print-content">
              {/* Print Content - Same as IndentPrintView */}
              <Paper
                sx={{
                  p: { xs: 3, sm: 3.5, md: 4 },
                  maxWidth: '210mm',
                  mx: 'auto',
                  backgroundColor: '#fff',
                  boxShadow: 'none',
                  width: '100%',
                  fontFamily: 'Arial, sans-serif',
                  '@media print': {
                    boxShadow: 'none',
                    p: 2.5,
                    maxWidth: '100%',
                    backgroundColor: '#fff',
                    mx: 0,
                    width: '100%',
                    pageBreakInside: 'avoid'
                  }
                }}
              >
                {/* Header Section - Company Name (Top Left) and Details (Top Right) */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  {/* Company Name - Top Left */}
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        color: '#666',
                        textTransform: 'uppercase'
                      }}
                    >
                      {viewDialog.data.vendor?.name || 'Vendor Name'}
                    </Typography>
                  </Box>
                  
                  {/* Company Details - Top Right */}
                  <Box sx={{ textAlign: 'right', flex: 1 }}>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.5 }}>
                      {viewDialog.data.vendor?.name || 'Vendor Name'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', mb: 0.3 }}>
                      Date: {formatDateForQuotation(viewDialog.data.quotationDate)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', mb: 0.3 }}>
                      Ref No: {viewDialog.data.quotationNumber || 'N/A'}
                    </Typography>
                    {viewDialog.data.vendor?.ntnNo && (
                      <Typography sx={{ fontSize: '0.85rem', mb: 0.3 }}>
                        NTN No: {viewDialog.data.vendor.ntnNo}
                      </Typography>
                    )}
                    {viewDialog.data.vendor?.gstNo && (
                      <Typography sx={{ fontSize: '0.85rem', mb: 0.3 }}>
                        GST No: {viewDialog.data.vendor.gstNo}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Quotation Title - Centered and Underlined */}
                <Typography
                  variant="h4"
                  align="center"
                  sx={{
                    fontSize: { xs: '1.8rem', print: '1.6rem' },
                    fontWeight: 700,
                    mb: 3,
                    textDecoration: 'underline',
                    textDecorationThickness: '2px'
                  }}
                >
                  Quotation
                </Typography>

                {/* Recipient - M/S: Taj Residencia Islamabad */}
                <Box sx={{ mb: 3 }}>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 500 }}>
                    M/S: Taj Residencia Islamabad
                  </Typography>
                </Box>

                {/* Quotation Number - Single Row (Centered) */}
                <Box sx={{ mb: 1.5, fontSize: '0.9rem', lineHeight: 1.8, textAlign: 'center' }}>
                  <Box>
                    <Typography component="span" fontWeight={600}>Quotation No.:</Typography>
                    <Typography component="span" sx={{ ml: 1, textTransform: 'uppercase' }}>
                      {viewDialog.data.quotationNumber || '___________'}
                    </Typography>
                  </Box>
                </Box>

                {/* Quotation Date, Expiry Date, Indent No. - Single Row */}
                <Box sx={{ mb: 1.5, fontSize: '0.9rem', lineHeight: 1.8 }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start' }}>
                    <Box sx={{ minWidth: '120px' }}>
                      <Typography component="span" fontWeight={600}>Quotation Date:</Typography>
                      <Typography component="span" sx={{ ml: 1 }}>
                        {formatDateForPrint(viewDialog.data.quotationDate)}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: '150px' }}>
                      <Typography component="span" fontWeight={600}>Expiry Date:</Typography>
                      <Typography component="span" sx={{ ml: 1 }}>
                        {viewDialog.data.expiryDate ? formatDateForPrint(viewDialog.data.expiryDate) : '___________'}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: '120px' }}>
                      <Typography component="span" fontWeight={600}>Indent No.:</Typography>
                      <Typography component="span" sx={{ ml: 1 }}>
                        {viewDialog.data.indent?.indentNumber || '___________'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Vendor and Department - Single Row */}
                <Box sx={{ mb: 3, fontSize: '0.9rem', lineHeight: 1.8 }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start' }}>
                    <Box sx={{ minWidth: '200px' }}>
                      <Typography component="span" fontWeight={600}>Vendor:</Typography>
                      <Typography component="span" sx={{ ml: 1, textTransform: 'uppercase' }}>
                        {viewDialog.data.vendor?.name || '___________'}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: '200px' }}>
                      <Typography component="span" fontWeight={600}>Department:</Typography>
                      <Typography component="span" sx={{ ml: 1, textTransform: 'uppercase' }}>
                        {viewDialog.data.indent?.department?.name || '___________'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Items Table */}
                <Box sx={{ mb: 3 }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      border: '1px solid #000',
                      fontSize: '0.9rem',
                      fontFamily: 'Arial, sans-serif'
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5', border: '1px solid #000' }}>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'left', fontWeight: 700, width: '8%' }}>
                          S/No
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '50%' }}>
                          Items Description
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 700, width: '12%' }}>
                          Qty.
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', fontWeight: 700, width: '15%' }}>
                          Unit Rate
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', fontWeight: 700, width: '15%' }}>
                          Total Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDialog.data.items && viewDialog.data.items.length > 0 ? (
                        viewDialog.data.items.map((item, index) => {
                          // Calculate total amount for this item (quantity * unitPrice)
                          const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
                          return (
                            <tr key={index} style={{ border: '1px solid #000' }}>
                              <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'left', verticalAlign: 'top' }}>
                                {index + 1}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                                {item.description || '___________'}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                                {item.quantity || '___'}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                                {formatNumber(item.unitPrice)}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                                {formatNumber(itemTotal)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>
                            No items
                          </td>
                        </tr>
                      )}
                      {/* Total Amount Row */}
                      {viewDialog.data.items && viewDialog.data.items.length > 0 && (
                        <tr style={{ borderTop: '2px solid #000', borderBottom: '1px solid #000' }}>
                          <td colSpan={3} style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>
                            Total Amount
                          </td>
                          <td style={{ border: '1px solid #000', padding: '10px 8px' }}></td>
                          <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', fontWeight: 700 }}>
                            {formatNumber(viewDialog.data.totalAmount || 0)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Box>

                {/* Terms and Conditions Section */}
                <Box sx={{ mb: 2, fontSize: '0.9rem', lineHeight: 2 }}>
                  <Typography sx={{ mb: 0.5 }}>
                    Above prices are CASH
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 0.5 }}>
                    <Typography component="span" sx={{ minWidth: '100px' }}>Delivery:</Typography>
                    <Typography component="span">
                      {viewDialog.data.deliveryTime || '2 to 3 days'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 0.5 }}>
                    <Typography component="span" sx={{ minWidth: '100px' }}>Payment:</Typography>
                    <Typography component="span">
                      {viewDialog.data.paymentTerms || 'Upon Delivery.'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 1 }}>
                    <Typography component="span" sx={{ minWidth: '100px' }}>Validity:</Typography>
                    <Typography component="span">
                      {viewDialog.data.validityDays ? `${viewDialog.data.validityDays}Days` : '30Days'}
                    </Typography>
                  </Box>
                  <Typography sx={{ mb: 2 }}>
                    For further Information, please feel free to contact us.
                  </Typography>
                </Box>

                {/* Contact Information */}
                <Box sx={{ mb: 3, fontSize: '0.9rem' }}>
                  <Typography sx={{ mb: 0.5 }}>With regards.</Typography>
                  <Typography sx={{ mb: 1, fontWeight: 600 }}>For {viewDialog.data.vendor?.name || 'Vendor Name'}</Typography>
                  {viewDialog.data.vendor?.email && (
                    <Typography sx={{ mb: 0.5, color: '#0066cc' }}>
                      Email: {viewDialog.data.vendor.email}
                    </Typography>
                  )}
                  {viewDialog.data.vendor?.website && (
                    <Typography sx={{ mb: 0.5, color: '#0066cc' }}>
                      {viewDialog.data.vendor.website}
                    </Typography>
                  )}
                </Box>

                {/* Footer - Address and Contact Numbers (Centered) */}
                <Box sx={{ textAlign: 'center', fontSize: '0.8rem', mt: 4, pt: 2, borderTop: '1px solid #ccc' }}>
                  <Typography>
                    {viewDialog.data.vendor?.address || 'Vendor Address'}
                    {viewDialog.data.vendor?.phone && (
                      <span>
                        {' '}Cell: {viewDialog.data.vendor.phone}
                        {viewDialog.data.vendor?.officePhone && ` | Office: ${viewDialog.data.vendor.officePhone}`}
                      </span>
                    )}
                  </Typography>
                </Box>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ '@media print': { display: 'none' } }}>
          <Button onClick={() => setViewDialog({ open: false, data: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Print Styles for Dialog */}
      <Box
        component="style"
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4;
                margin: 15mm;
              }
              body * {
                visibility: hidden;
              }
              .MuiDialog-container,
              .MuiDialog-container *,
              .MuiDialog-paper,
              .MuiDialog-paper *,
              .print-content,
              .print-content * {
                visibility: visible;
              }
              .MuiDialog-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: 100% !important;
                display: block !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
              }
              .MuiDialog-paper {
                box-shadow: none !important;
                margin: 0 !important;
                max-width: 100% !important;
                width: 100% !important;
                height: auto !important;
                max-height: none !important;
                position: relative !important;
                transform: none !important;
                overflow: visible !important;
              }
              .MuiDialogContent-root {
                overflow: visible !important;
                padding: 0 !important;
                height: auto !important;
                max-height: none !important;
                margin: 0 !important;
              }
              .MuiDialogTitle-root {
                display: none !important;
              }
              .MuiDialogActions-root {
                display: none !important;
              }
              .MuiBackdrop-root {
                display: none !important;
              }
              .MuiPaper-root {
                box-shadow: none !important;
              }
            }
          `
        }}
      />

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
