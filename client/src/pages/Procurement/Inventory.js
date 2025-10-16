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
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  TrendingUp as AddStockIcon,
  TrendingDown as RemoveStockIcon,
  SwapHoriz as AdjustIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';

const Inventory = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [items, setItems] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [vendors, setVendors] = useState([]);
  
  // Pagination and filters
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Dialog states
  const [formDialog, setFormDialog] = useState({ open: false, mode: 'create', data: null });
  const [viewDialog, setViewDialog] = useState({ open: false, data: null, tab: 0 });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });
  const [stockDialog, setStockDialog] = useState({ open: false, type: '', item: null });
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Other',
    unit: 'pcs',
    quantity: 0,
    minQuantity: 10,
    maxQuantity: 1000,
    unitPrice: 0,
    supplier: '',
    location: { warehouse: '', shelf: '', bin: '' },
    notes: ''
  });

  // Stock form data
  const [stockFormData, setStockFormData] = useState({
    quantity: 0,
    reference: '',
    notes: ''
  });

  // Load data on component mount
  useEffect(() => {
    loadInventory();
    loadStatistics();
    loadVendors();
  }, [page, rowsPerPage, search, categoryFilter, statusFilter]);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search,
        category: categoryFilter,
        status: statusFilter
      };

      const response = await api.get('/procurement/inventory', { params });
      
      if (response.data.success) {
        setItems(response.data.data.items);
        setTotalItems(response.data.data.pagination.totalItems);
      }
    } catch (err) {
      setError('Failed to load inventory');
      console.error('Error loading inventory:', err);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, categoryFilter, statusFilter]);

  const loadStatistics = async () => {
    try {
      const response = await api.get('/procurement/inventory/statistics');
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
      name: '',
      description: '',
      category: 'Other',
      unit: 'pcs',
      quantity: 0,
      minQuantity: 10,
      maxQuantity: 1000,
      unitPrice: 0,
      supplier: '',
      location: { warehouse: '', shelf: '', bin: '' },
      notes: ''
    });
    setFormDialog({ open: true, mode: 'create', data: null });
  };

  const handleEdit = (item) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      minQuantity: item.minQuantity,
      maxQuantity: item.maxQuantity,
      unitPrice: item.unitPrice,
      supplier: item.supplier?._id || '',
      location: item.location || { warehouse: '', shelf: '', bin: '' },
      notes: item.notes || ''
    });
    setFormDialog({ open: true, mode: 'edit', data: item });
  };

  const handleView = (item) => {
    setViewDialog({ open: true, data: item, tab: 0 });
  };

  const handleDelete = (id) => {
    setDeleteDialog({ open: true, id });
  };

  const handleStockAction = (type, item) => {
    setStockFormData({ quantity: 0, reference: '', notes: '' });
    setStockDialog({ open: true, type, item });
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/procurement/inventory/${deleteDialog.id}`);
      setSuccess('Inventory item deleted successfully');
      setDeleteDialog({ open: false, id: null });
      loadInventory();
      loadStatistics();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete item');
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      if (formDialog.mode === 'create') {
        await api.post('/procurement/inventory', formData);
        setSuccess('Inventory item created successfully');
      } else {
        await api.put(`/procurement/inventory/${formDialog.data._id}`, formData);
        setSuccess('Inventory item updated successfully');
      }
      
      setFormDialog({ open: false, mode: 'create', data: null });
      loadInventory();
      loadStatistics();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const handleStockSubmit = async () => {
    try {
      setLoading(true);
      const endpoint = `/procurement/inventory/${stockDialog.item._id}/${stockDialog.type}-stock`;
      await api.post(endpoint, stockFormData);
      
      setSuccess(`Stock ${stockDialog.type === 'add' ? 'added' : stockDialog.type === 'remove' ? 'removed' : 'adjusted'} successfully`);
      setStockDialog({ open: false, type: '', item: null });
      loadInventory();
      loadStatistics();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update stock');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'In Stock': 'success',
      'Low Stock': 'warning',
      'Out of Stock': 'error',
      'Discontinued': 'default'
    };
    return colors[status] || 'default';
  };

  // Statistics cards
  const stats = [
    {
      title: 'Total Items',
      value: statistics?.totalItems || 0,
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
      title: 'In Stock',
      value: statistics?.inStock || 0,
      color: theme.palette.success.main,
      bgColor: alpha(theme.palette.success.main, 0.1)
    },
    {
      title: 'Low Stock',
      value: statistics?.lowStock || 0,
      color: theme.palette.warning.main,
      bgColor: alpha(theme.palette.warning.main, 0.1)
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 56, height: 56 }}>
              <InventoryIcon fontSize="large" />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                Inventory
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Track and manage inventory items
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => {
                loadInventory();
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
              Add Item
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
                    <InventoryIcon />
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
              placeholder="Search items..."
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
              label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="">All Categories</MenuItem>
              <MenuItem value="Raw Materials">Raw Materials</MenuItem>
              <MenuItem value="Finished Goods">Finished Goods</MenuItem>
              <MenuItem value="Office Supplies">Office Supplies</MenuItem>
              <MenuItem value="Equipment">Equipment</MenuItem>
              <MenuItem value="Consumables">Consumables</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </TextField>
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
              <MenuItem value="In Stock">In Stock</MenuItem>
              <MenuItem value="Low Stock">Low Stock</MenuItem>
              <MenuItem value="Out of Stock">Out of Stock</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Inventory Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Item Code</strong></TableCell>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Category</strong></TableCell>
                <TableCell align="right"><strong>Quantity</strong></TableCell>
                <TableCell align="right"><strong>Unit Price</strong></TableCell>
                <TableCell align="right"><strong>Total Value</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
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
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="textSecondary">
                      No inventory items found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item._id} hover>
                    <TableCell>{item.itemCode}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell align="right">{item.quantity} {item.unit}</TableCell>
                    <TableCell align="right">{formatPKR(item.unitPrice)}</TableCell>
                    <TableCell align="right">{formatPKR(item.totalValue)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={item.status} 
                        color={getStatusColor(item.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => handleView(item)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEdit(item)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Add Stock">
                        <IconButton size="small" color="success" onClick={() => handleStockAction('add', item)}>
                          <AddStockIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove Stock">
                        <IconButton size="small" color="warning" onClick={() => handleStockAction('remove', item)}>
                          <RemoveStockIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(item._id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
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
          {formDialog.mode === 'create' ? 'Add New Item' : 'Edit Item'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Item Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                <MenuItem value="Raw Materials">Raw Materials</MenuItem>
                <MenuItem value="Finished Goods">Finished Goods</MenuItem>
                <MenuItem value="Office Supplies">Office Supplies</MenuItem>
                <MenuItem value="Equipment">Equipment</MenuItem>
                <MenuItem value="Consumables">Consumables</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Quantity"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Unit Price"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Min Quantity"
                value={formData.minQuantity}
                onChange={(e) => setFormData({ ...formData, minQuantity: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Quantity"
                value={formData.maxQuantity}
                onChange={(e) => setFormData({ ...formData, maxQuantity: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Supplier"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {vendors.map((vendor) => (
                  <MenuItem key={vendor._id} value={vendor._id}>
                    {vendor.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Warehouse"
                value={formData.location.warehouse}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  location: { ...formData.location, warehouse: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Shelf"
                value={formData.location.shelf}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  location: { ...formData.location, shelf: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Bin"
                value={formData.location.bin}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  location: { ...formData.location, bin: e.target.value }
                })}
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormDialog({ open: false, mode: 'create', data: null })}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSubmit}
            disabled={!formData.name || !formData.category || !formData.unit}
          >
            {formDialog.mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog 
        open={viewDialog.open} 
        onClose={() => setViewDialog({ open: false, data: null, tab: 0 })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Inventory Item Details</DialogTitle>
        <DialogContent>
          {viewDialog.data && (
            <Box>
              <Tabs value={viewDialog.tab} onChange={(e, v) => setViewDialog({ ...viewDialog, tab: v })}>
                <Tab label="Details" />
                <Tab label="Transactions" />
              </Tabs>
              
              {viewDialog.tab === 0 && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">Item Code</Typography>
                    <Typography variant="body1" fontWeight="bold">{viewDialog.data.itemCode}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">Name</Typography>
                    <Typography variant="body1" fontWeight="bold">{viewDialog.data.name}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">Category</Typography>
                    <Typography variant="body1">{viewDialog.data.category}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">Status</Typography>
                    <Chip label={viewDialog.data.status} color={getStatusColor(viewDialog.data.status)} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">Quantity</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {viewDialog.data.quantity} {viewDialog.data.unit}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">Unit Price</Typography>
                    <Typography variant="body1">{formatPKR(viewDialog.data.unitPrice)}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">Total Value</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {formatPKR(viewDialog.data.totalValue)}
                    </Typography>
                  </Grid>
                  {viewDialog.data.supplier && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Supplier</Typography>
                      <Typography variant="body1">{viewDialog.data.supplier.name}</Typography>
                    </Grid>
                  )}
                </Grid>
              )}

              {viewDialog.tab === 1 && (
                <List>
                  {viewDialog.data.transactions && viewDialog.data.transactions.length > 0 ? (
                    viewDialog.data.transactions.slice(0, 10).reverse().map((trans, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={`${trans.type}: ${trans.quantity} ${viewDialog.data.unit}`}
                          secondary={`${formatDate(trans.date)} - ${trans.notes || trans.reference || 'No notes'}`}
                        />
                      </ListItem>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      No transactions yet
                    </Typography>
                  )}
                </List>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog({ open: false, data: null, tab: 0 })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Stock Action Dialog */}
      <Dialog 
        open={stockDialog.open} 
        onClose={() => setStockDialog({ open: false, type: '', item: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {stockDialog.type === 'add' ? 'Add Stock' : stockDialog.type === 'remove' ? 'Remove Stock' : 'Adjust Stock'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Quantity"
                value={stockFormData.quantity}
                onChange={(e) => setStockFormData({ ...stockFormData, quantity: parseFloat(e.target.value) })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reference"
                value={stockFormData.reference}
                onChange={(e) => setStockFormData({ ...stockFormData, reference: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Notes"
                value={stockFormData.notes}
                onChange={(e) => setStockFormData({ ...stockFormData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStockDialog({ open: false, type: '', item: null })}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleStockSubmit}
            disabled={!stockFormData.quantity || stockFormData.quantity <= 0}
          >
            Confirm
          </Button>
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
            Are you sure you want to delete this item? You can only delete items with zero stock.
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

export default Inventory;
