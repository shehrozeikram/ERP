import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Skeleton,
  Stack,
  Chip,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import salesService from '../../services/salesService';

const STATUS_OPTIONS = ['draft', 'pending', 'approved', 'fulfilled', 'completed', 'cancelled'];
const STAGE_OPTIONS = ['lead', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const PAYMENT_OPTIONS = ['unpaid', 'partial', 'paid', 'refunded'];

const statusColor = (status) => {
  const map = {
    draft: 'default',
    pending: 'warning',
    approved: 'info',
    fulfilled: 'success',
    completed: 'success',
    cancelled: 'error'
  };
  return map[status] || 'default';
};

const stageColor = (stage) => {
  const map = {
    lead: 'default',
    proposal: 'info',
    negotiation: 'warning',
    closed_won: 'success',
    closed_lost: 'error'
  };
  return map[stage] || 'default';
};

const buildEmptyOrder = () => ({
  customer: '',
  status: 'pending',
  stage: 'proposal',
  paymentStatus: 'unpaid',
  orderDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  notes: '',
  items: [
    { description: '', unitPrice: 0, quantity: 1, discount: 0 }
  ]
});

const SalesOrders = () => {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [formData, setFormData] = useState(buildEmptyOrder());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    stage: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 0,
    rowsPerPage: 10,
    totalCount: 0
  });

  const loadCustomers = useCallback(async () => {
    try {
      const response = await salesService.getCustomers({ limit: 500 });
      setCustomers(response.data.data.customers || []);
    } catch (err) {
      console.error('Failed to load customers', err);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page + 1,
        limit: pagination.rowsPerPage,
        ...filters
      };
      const response = await salesService.getOrders(params);
      setOrders(response.data.data.orders || []);
      setPagination((prev) => ({
        ...prev,
        totalCount: response.data.data.pagination?.totalCount || 0
      }));
    } catch (err) {
      console.error('Failed to load sales orders', err);
      setError(err.response?.data?.message || 'Failed to load sales orders');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.rowsPerPage]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handlePageChange = (_event, newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleRowsPerPageChange = (event) => {
    setPagination({
      page: 0,
      rowsPerPage: parseInt(event.target.value, 10),
      totalCount: pagination.totalCount
    });
  };

  const handleOpenDialog = (order = null) => {
    if (order) {
      setEditingOrder(order);
      setFormData({
        customer: order.customer?._id || order.customer,
        status: order.status,
        stage: order.stage,
        paymentStatus: order.paymentStatus,
        orderDate: order.orderDate ? order.orderDate.split('T')[0] : buildEmptyOrder().orderDate,
        dueDate: order.dueDate ? order.dueDate.split('T')[0] : '',
        notes: order.notes || '',
        items: order.items?.map((item) => ({
          description: item.productName || item.description || '',
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          discount: item.discount || 0
        })) || buildEmptyOrder().items
      });
    } else {
      setEditingOrder(null);
      setFormData(buildEmptyOrder());
    }
    setDialogOpen(true);
    setError('');
    setSuccess('');
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingOrder(null);
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', unitPrice: 0, quantity: 1, discount: 0 }]
    }));
  };

  const removeItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  const orderSubtotal = useMemo(() => formData.items.reduce((acc, item) => {
    const quantity = Number(item.quantity || 0);
    const price = Number(item.unitPrice || 0);
    const discount = Number(item.discount || 0);
    return acc + (quantity * price - discount);
  }, 0), [formData.items]);

  const handleSubmit = async () => {
    try {
      if (!formData.customer) {
        setError('Customer is required');
        return;
      }

      if (!formData.items.length) {
        setError('Add at least one line item');
        return;
      }

      const payload = {
        ...formData,
        items: formData.items.map((item) => ({
          productName: item.description || 'Custom Item',
          unitPrice: Number(item.unitPrice || 0),
          quantity: Number(item.quantity || 0),
          discount: Number(item.discount || 0)
        }))
      };

      if (editingOrder?._id) {
        await salesService.updateOrder(editingOrder._id, payload);
        setSuccess('Sales order updated successfully');
      } else {
        await salesService.createOrder(payload);
        setSuccess('Sales order created successfully');
      }

      handleCloseDialog();
      loadOrders();
    } catch (err) {
      console.error('Failed to save sales order', err);
      setError(err.response?.data?.message || 'Failed to save sales order');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Delete this sales order?')) return;
    try {
      await salesService.deleteOrder(orderId);
      setSuccess('Sales order deleted successfully');
      loadOrders();
    } catch (err) {
      console.error('Failed to delete order', err);
      setError(err.response?.data?.message || 'Failed to delete order');
    }
  };

  const LoadingSkeleton = () => (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="text" width={260} height={48} />
      <Skeleton variant="text" width={320} height={24} sx={{ mb: 3 }} />
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          {[4, 4, 4].map((size, idx) => (
            <Grid item xs={12} md={size} key={idx}>
              <Skeleton variant="rounded" height={48} />
            </Grid>
          ))}
        </Grid>
      </Paper>
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              {Array.from({ length: 6 }).map((_, idx) => (
                <TableCell key={idx}>
                  <Skeleton variant="text" />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: 6 }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {Array.from({ length: 6 }).map((__, cellIdx) => (
                  <TableCell key={cellIdx}>
                    <Skeleton variant="text" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );

  if (loading && orders.length === 0) {
    return <LoadingSkeleton />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Sales Orders
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor opportunities and closed deals in one place.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={loadOrders}>
            Refresh
          </Button>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => handleOpenDialog()}>
            New Order
          </Button>
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

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              label="Search"
              value={filters.search}
              onChange={handleFilterChange('search')}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={filters.status}
                onChange={handleFilterChange('status')}
              >
                <MenuItem value="">All</MenuItem>
                {STATUS_OPTIONS.map((status) => (
                  <MenuItem key={status} value={status}>{status.replace('_', ' ')}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Stage</InputLabel>
              <Select
                label="Stage"
                value={filters.stage}
                onChange={handleFilterChange('stage')}
              >
                <MenuItem value="">All</MenuItem>
                {STAGE_OPTIONS.map((stage) => (
                  <MenuItem key={stage} value={stage}>{stage.replace('_', ' ')}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Order #</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Stage</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Payment</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order._id} hover>
                <TableCell>
                  <Typography variant="subtitle2">{order.orderNumber}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : ''}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{order.customer?.name || 'N/A'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {order.customer?.company}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={order.stage?.replace('_', ' ') || 'N/A'}
                    size="small"
                    color={stageColor(order.stage)}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={order.status?.replace('_', ' ') || 'N/A'}
                    size="small"
                    color={statusColor(order.status)}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2">
                    PKR {Number(order.totalAmount || 0).toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Tax: PKR {Number(order.taxAmount || 0).toLocaleString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={order.paymentStatus || 'unpaid'}
                    size="small"
                    color={order.paymentStatus === 'paid' ? 'success' : order.paymentStatus === 'unpaid' ? 'warning' : 'info'}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpenDialog(order)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton onClick={() => handleDeleteOrder(order._id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No sales orders found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={pagination.totalCount}
          page={pagination.page}
          onPageChange={handlePageChange}
          rowsPerPage={pagination.rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </Paper>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingOrder ? 'Edit Sales Order' : 'Create Sales Order'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Customer</InputLabel>
                <Select
                  label="Customer"
                  value={formData.customer}
                  onChange={(event) => setFormData((prev) => ({ ...prev, customer: event.target.value }))}
                >
                  {customers.map((customer) => (
                    <MenuItem key={customer._id} value={customer._id}>
                      {customer.name} {customer.company ? `(${customer.company})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <MenuItem key={status} value={status}>{status.replace('_', ' ')}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Stage</InputLabel>
                <Select
                  label="Stage"
                  value={formData.stage}
                  onChange={(event) => setFormData((prev) => ({ ...prev, stage: event.target.value }))}
                >
                  {STAGE_OPTIONS.map((stage) => (
                    <MenuItem key={stage} value={stage}>{stage.replace('_', ' ')}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Order Date"
                type="date"
                fullWidth
                value={formData.orderDate}
                onChange={(event) => setFormData((prev) => ({ ...prev, orderDate: event.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Due Date"
                type="date"
                fullWidth
                value={formData.dueDate}
                onChange={(event) => setFormData((prev) => ({ ...prev, dueDate: event.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Payment Status</InputLabel>
                <Select
                  label="Payment Status"
                  value={formData.paymentStatus}
                  onChange={(event) => setFormData((prev) => ({ ...prev, paymentStatus: event.target.value }))}
                >
                  {PAYMENT_OPTIONS.map((status) => (
                    <MenuItem key={status} value={status}>{status.replace('_', ' ')}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Order Notes"
                fullWidth
                multiline
                minRows={2}
                value={formData.notes}
                onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mt: 1 }}>Line Items</Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                {formData.items.map((item, index) => (
                  <Paper key={`item-${index}`} variant="outlined" sx={{ p: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Description"
                          fullWidth
                          value={item.description}
                          onChange={(event) => handleItemChange(index, 'description', event.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          label="Unit Price"
                          type="number"
                          fullWidth
                          value={item.unitPrice}
                          onChange={(event) => handleItemChange(index, 'unitPrice', event.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <TextField
                          label="Quantity"
                          type="number"
                          fullWidth
                          value={item.quantity}
                          onChange={(event) => handleItemChange(index, 'quantity', event.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <TextField
                          label="Discount"
                          type="number"
                          fullWidth
                          value={item.discount}
                          onChange={(event) => handleItemChange(index, 'discount', event.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={1}>
                        <Button
                          color="error"
                          onClick={() => removeItem(index)}
                          disabled={formData.items.length === 1}
                        >
                          Remove
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
              </Stack>
              <Button sx={{ mt: 2 }} onClick={addItem}>
                Add Line Item
              </Button>
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1">
                Estimated Subtotal: PKR {orderSubtotal.toLocaleString()}
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingOrder ? 'Update Order' : 'Save Order'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SalesOrders;

