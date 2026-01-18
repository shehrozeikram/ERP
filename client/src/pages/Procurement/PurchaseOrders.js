import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  Avatar,
  alpha,
  useTheme,
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
  CircularProgress,
  Stack,
  Divider
} from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CheckCircle as ApproveIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';

const PurchaseOrders = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [vendors, setVendors] = useState([]);
  
  // Pagination and filters
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  
  // Dialog states
  const [formDialog, setFormDialog] = useState({ open: false, mode: 'create', data: null });
  const [viewDialog, setViewDialog] = useState({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });
  
  // Form data
  const [formData, setFormData] = useState({
    vendor: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    status: 'Draft',
    priority: 'Medium',
    items: [{ description: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 0, discount: 0 }],
    shippingCost: 0,
    paymentTerms: '',
    notes: '',
    internalNotes: ''
  });

  // Load data on component mount
  useEffect(() => {
    loadPurchaseOrders();
    loadStatistics();
    loadVendors();
  }, [page, rowsPerPage, search, statusFilter, priorityFilter]);

  const loadPurchaseOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search,
        status: statusFilter,
        priority: priorityFilter
      };

      const response = await api.get('/procurement/purchase-orders', { params });
      
      if (response.data.success) {
        setPurchaseOrders(response.data.data.purchaseOrders);
        setTotalItems(response.data.data.pagination.totalItems);
      }
    } catch (err) {
      setError('Failed to load purchase orders');
      console.error('Error loading purchase orders:', err);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter, priorityFilter]);

  const loadStatistics = async () => {
    try {
      const response = await api.get('/procurement/purchase-orders/statistics');
      if (response.data.success) {
        setStatistics(response.data.data);
      }
    } catch (err) {
      console.error('Error loading statistics:', err);
    }
  };

  const loadVendors = async () => {
    try {
      const response = await api.get('/procurement/vendors', { params: { limit: 1000 } });
      if (response.data.success) {
        setVendors(response.data.data.vendors);
      }
    } catch (err) {
      console.error('Error loading vendors:', err);
    }
  };

  const handleCreate = () => {
    setFormData({
      vendor: '',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: '',
      status: 'Draft',
      priority: 'Medium',
      items: [{ description: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 0, discount: 0 }],
      shippingCost: 0,
      paymentTerms: '',
      notes: '',
      internalNotes: ''
    });
    setFormDialog({ open: true, mode: 'create', data: null });
  };

  const handleEdit = (order) => {
    setFormData({
      ...order,
      vendor: order.vendor._id,
      orderDate: new Date(order.orderDate).toISOString().split('T')[0],
      expectedDeliveryDate: new Date(order.expectedDeliveryDate).toISOString().split('T')[0]
    });
    setFormDialog({ open: true, mode: 'edit', data: order });
  };

  const handleView = (order) => {
    setViewDialog({ open: true, data: order });
  };

  const handleDelete = (id) => {
    setDeleteDialog({ open: true, id });
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/procurement/purchase-orders/${deleteDialog.id}`);
      setSuccess('Purchase order deleted successfully');
      setDeleteDialog({ open: false, id: null });
      loadPurchaseOrders();
      loadStatistics();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete purchase order');
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      if (formDialog.mode === 'create') {
        await api.post('/procurement/purchase-orders', formData);
        setSuccess('Purchase order created successfully');
      } else {
        await api.put(`/procurement/purchase-orders/${formDialog.data._id}`, formData);
        setSuccess('Purchase order updated successfully');
      }
      
      setFormDialog({ open: false, mode: 'create', data: null });
      loadPurchaseOrders();
      loadStatistics();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/procurement/purchase-orders/${id}/approve`);
      setSuccess('Purchase order approved successfully');
      loadPurchaseOrders();
      loadStatistics();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve purchase order');
    }
  };

  const handleSendToAudit = async (id) => {
    try {
      await api.put(`/procurement/purchase-orders/${id}/send-to-audit`);
      setSuccess('Purchase order sent to audit successfully. It will appear in the Pre-Audit page.');
      loadPurchaseOrders();
      loadStatistics();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send purchase order to audit');
    }
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 0, discount: 0 }]
    }));
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index, field, value) => {
    const items = [...formData.items];
    items[index][field] = value;
    setFormData(prev => ({ ...prev, items }));
  };

  const calculateTotal = () => {
    const subtotal = formData.items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unitPrice - (item.discount || 0);
      return sum + itemSubtotal;
    }, 0);
    
    const tax = formData.items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unitPrice - (item.discount || 0);
      return sum + (itemSubtotal * (item.taxRate || 0) / 100);
    }, 0);
    
    return subtotal + tax + (formData.shippingCost || 0);
  };

  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'default',
      'Pending Approval': 'warning',
      'Pending Audit': 'warning',
      'Pending Finance': 'info',
      'Send to CEO Office': 'info',
      'Forwarded to CEO': 'primary',
      'Approved': 'success',
      'Ordered': 'info',
      'Partially Received': 'secondary',
      'Received': 'success',
      'Cancelled': 'error',
      'Rejected': 'error',
      'Returned from Audit': 'error',
      'Returned from CEO Office': 'warning',
      'Returned from CEO Secretariat': 'error'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'Low': 'info',
      'Medium': 'default',
      'High': 'warning',
      'Urgent': 'error'
    };
    return colors[priority] || 'default';
  };

  // Statistics cards
  const stats = [
    {
      title: 'Total Orders',
      value: statistics?.totalOrders || 0,
      color: theme.palette.primary.main,
      bgColor: alpha(theme.palette.primary.main, 0.1)
    },
    {
      title: 'Total Value',
      value: formatPKR(statistics?.totalValue || 0),
      color: theme.palette.success.main,
      bgColor: alpha(theme.palette.success.main, 0.1)
    },
    {
      title: 'Pending Approval',
      value: statistics?.byStatus?.find(s => s._id === 'Pending Approval')?.count || 0,
      color: theme.palette.warning.main,
      bgColor: alpha(theme.palette.warning.main, 0.1)
    },
    {
      title: 'Approved',
      value: statistics?.byStatus?.find(s => s._id === 'Approved')?.count || 0,
      color: theme.palette.info.main,
      bgColor: alpha(theme.palette.info.main, 0.1)
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 56, height: 56 }}>
              <ShoppingCartIcon fontSize="large" />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                Purchase Orders
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Manage procurement purchase orders
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => {
                loadPurchaseOrders();
                loadStatistics();
              }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
            >
              New Purchase Order
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: stat.bgColor, color: stat.color, width: 48, height: 48 }}>
                    <ShoppingCartIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      {stat.title}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      {stat.value}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search orders..."
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
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="Draft">Draft</MenuItem>
              <MenuItem value="Pending Approval">Pending Approval</MenuItem>
              <MenuItem value="Pending Audit">Pending Audit</MenuItem>
              <MenuItem value="Pending Finance">Pending Finance</MenuItem>
              <MenuItem value="Approved">Approved</MenuItem>
              <MenuItem value="Ordered">Ordered</MenuItem>
              <MenuItem value="Partially Received">Partially Received</MenuItem>
              <MenuItem value="Received">Received</MenuItem>
              <MenuItem value="Returned from Audit">Returned from Audit</MenuItem>
              <MenuItem value="Send to CEO Office">Send to CEO Office</MenuItem>
              <MenuItem value="Forwarded to CEO">Forwarded to CEO</MenuItem>
              <MenuItem value="Rejected">Rejected</MenuItem>
              <MenuItem value="Returned from CEO Office">Returned from CEO Office</MenuItem>
              <MenuItem value="Returned from CEO Secretariat">Returned from CEO Secretariat</MenuItem>
              <MenuItem value="Cancelled">Cancelled</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              size="small"
              label="Priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <MenuItem value="">All Priorities</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Urgent">Urgent</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Purchase Orders Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Order Number</strong></TableCell>
                <TableCell><strong>Vendor</strong></TableCell>
                <TableCell><strong>Order Date</strong></TableCell>
                <TableCell><strong>Expected Delivery</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Priority</strong></TableCell>
                <TableCell align="right"><strong>Total Amount</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : purchaseOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="textSecondary">
                      No purchase orders found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                purchaseOrders.map((order) => (
                  <TableRow key={order._id} hover>
                    <TableCell>{order.orderNumber}</TableCell>
                    <TableCell>{order.vendor?.name || 'N/A'}</TableCell>
                    <TableCell>{formatDate(order.orderDate)}</TableCell>
                    <TableCell>{formatDate(order.expectedDeliveryDate)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={order.status} 
                        color={getStatusColor(order.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={order.priority} 
                        color={getPriorityColor(order.priority)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">{formatPKR(order.totalAmount)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => handleView(order)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {(order.status === 'Draft' || order.status === 'Returned from Audit' || order.status === 'Returned from CEO Secretariat') && (
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEdit(order)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(order.status === 'Draft' || order.status === 'Returned from Audit' || order.status === 'Returned from CEO Secretariat') && (
                        <Tooltip title="Send to Audit">
                          <IconButton size="small" color="primary" onClick={() => handleSendToAudit(order._id)}>
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {order.status === 'Pending Approval' && (
                        <Tooltip title="Approve">
                          <IconButton size="small" color="success" onClick={() => handleApprove(order._id)}>
                            <ApproveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {order.status === 'Draft' && (
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDelete(order._id)}>
                            <DeleteIcon fontSize="small" />
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
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={formDialog.open} 
        onClose={() => setFormDialog({ open: false, mode: 'create', data: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {formDialog.mode === 'create' ? 'Create Purchase Order' : 'Edit Purchase Order'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Vendor"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                required
              >
                {vendors.map((vendor) => (
                  <MenuItem key={vendor._id} value={vendor._id}>
                    {vendor.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <MenuItem value="Low">Low</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Urgent">Urgent</MenuItem>
              </TextField>
            </Grid>
            {formDialog.mode === 'edit' && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  select
                  label="Status"
                  value={formData.status || 'Draft'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <MenuItem value="Draft">Draft</MenuItem>
                  <MenuItem value="Pending Audit">Pending Audit</MenuItem>
                  <MenuItem value="Pending Finance">Pending Finance</MenuItem>
                  <MenuItem value="Send to CEO Office">Send to CEO Office</MenuItem>
                  <MenuItem value="Forwarded to CEO">Forwarded to CEO</MenuItem>
                  <MenuItem value="Approved">Approved</MenuItem>
                  <MenuItem value="Ordered">Ordered</MenuItem>
                  <MenuItem value="Partially Received">Partially Received</MenuItem>
                  <MenuItem value="Received">Received</MenuItem>
                  <MenuItem value="Rejected">Rejected</MenuItem>
                  <MenuItem value="Returned from Audit">Returned from Audit</MenuItem>
                  <MenuItem value="Returned from CEO Office">Returned from CEO Office</MenuItem>
                  <MenuItem value="Returned from CEO Secretariat">Returned from CEO Secretariat</MenuItem>
                  <MenuItem value="Cancelled">Cancelled</MenuItem>
                </TextField>
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Order Date"
                value={formData.orderDate}
                onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Expected Delivery Date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Items</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={addItem}>
                  Add Item
                </Button>
              </Box>
              {formData.items.map((item, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Description"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Quantity"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                        required
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Unit"
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Unit Price"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))}
                        required
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Tax %"
                        value={item.taxRate}
                        onChange={(e) => updateItem(index, 'taxRate', parseFloat(e.target.value))}
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Discount"
                        value={item.discount}
                        onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value))}
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <IconButton 
                        color="error" 
                        onClick={() => removeItem(index)}
                        disabled={formData.items.length === 1}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Shipping Cost"
                value={formData.shippingCost}
                onChange={(e) => setFormData({ ...formData, shippingCost: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Payment Terms"
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                <Typography variant="h6" align="right">
                  Total: {formatPKR(calculateTotal())}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormDialog({ open: false, mode: 'create', data: null })}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSubmit}
            disabled={!formData.vendor || !formData.expectedDeliveryDate || formData.items.length === 0}
          >
            {formDialog.mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog 
        open={viewDialog.open} 
        onClose={() => setViewDialog({ open: false, data: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Purchase Order Details</DialogTitle>
        <DialogContent>
          {viewDialog.data && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Order Number</Typography>
                <Typography variant="body1" fontWeight="bold">{viewDialog.data.orderNumber}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Vendor</Typography>
                <Typography variant="body1" fontWeight="bold">{viewDialog.data.vendor?.name}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Status</Typography>
                <Chip label={viewDialog.data.status} color={getStatusColor(viewDialog.data.status)} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Priority</Typography>
                <Chip label={viewDialog.data.priority} color={getPriorityColor(viewDialog.data.priority)} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Order Date</Typography>
                <Typography variant="body1">{formatDate(viewDialog.data.orderDate)}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Expected Delivery</Typography>
                <Typography variant="body1">{formatDate(viewDialog.data.expectedDeliveryDate)}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>Items</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewDialog.data.items?.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell align="right">{item.quantity} {item.unit}</TableCell>
                          <TableCell align="right">{formatPKR(item.unitPrice)}</TableCell>
                          <TableCell align="right">{formatPKR(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
              <Grid item xs={12} align="right">
                <Typography variant="h6">
                  Total Amount: {formatPKR(viewDialog.data.totalAmount)}
                </Typography>
              </Grid>
              {viewDialog.data.notes && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Notes</Typography>
                  <Typography variant="body1">{viewDialog.data.notes}</Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog({ open: false, data: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialog.open} 
        onClose={() => setDeleteDialog({ open: false, id: null })}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this purchase order? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, id: null })}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PurchaseOrders;
