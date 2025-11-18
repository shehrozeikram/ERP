import React, { useCallback, useEffect, useState } from 'react';
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
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import salesService from '../../services/salesService';

const statusOptions = ['active', 'inactive', 'discontinued'];

const SalesProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    unitPrice: '',
    costPrice: '',
    stockQuantity: '',
    status: 'active',
    description: ''
  });
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 0,
    rowsPerPage: 10,
    totalCount: 0
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page + 1,
        limit: pagination.rowsPerPage,
        ...filters
      };
      const response = await salesService.getProducts(params);
      setProducts(response.data.data.products || []);
      setPagination((prev) => ({
        ...prev,
        totalCount: response.data.data.pagination?.totalCount || 0
      }));
    } catch (err) {
      console.error('Failed to load products', err);
      setError(err.response?.data?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.rowsPerPage]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
    setPagination((prev) => ({
      ...prev,
      rowsPerPage: parseInt(event.target.value, 10),
      page: 0
    }));
  };

  const handleOpenDialog = (product = null) => {
    setEditingProduct(product);
    setFormData(product ? {
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      unitPrice: product.unitPrice,
      costPrice: product.costPrice || '',
      stockQuantity: product.stockQuantity || '',
      status: product.status || 'active',
      description: product.description || ''
    } : {
      name: '',
      sku: '',
      category: '',
      unitPrice: '',
      costPrice: '',
      stockQuantity: '',
      status: 'active',
      description: ''
    });
    setDialogOpen(true);
    setError('');
    setSuccess('');
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = async () => {
    try {
      if (!formData.name || !formData.sku || !formData.unitPrice) {
        setError('Name, SKU and price are required');
        return;
      }

      const payload = {
        ...formData,
        unitPrice: Number(formData.unitPrice),
        costPrice: Number(formData.costPrice || 0),
        stockQuantity: Number(formData.stockQuantity || 0)
      };

      if (editingProduct?._id) {
        await salesService.updateProduct(editingProduct._id, payload);
        setSuccess('Product updated successfully');
      } else {
        await salesService.createProduct(payload);
        setSuccess('Product created successfully');
      }

      handleCloseDialog();
      fetchProducts();
    } catch (err) {
      console.error('Failed to save product', err);
      setError(err.response?.data?.message || 'Failed to save product');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await salesService.deleteProduct(productId);
      setSuccess('Product deleted successfully');
      fetchProducts();
    } catch (err) {
      console.error('Failed to delete product', err);
      setError(err.response?.data?.message || 'Failed to delete product');
    }
  };

  const LoadingSkeleton = () => (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="text" width={220} height={48} />
      <Skeleton variant="text" width={320} height={24} sx={{ mb: 3 }} />
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          {[6, 6].map((size, idx) => (
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
              {Array.from({ length: 5 }).map((_, idx) => (
                <TableCell key={idx}>
                  <Skeleton variant="text" />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: 6 }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {Array.from({ length: 5 }).map((__, cellIdx) => (
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

  if (loading && products.length === 0) {
    return <LoadingSkeleton />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Sales Products
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Maintain the sales catalog with pricing and stock levels.
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => handleOpenDialog()}>
          New Product
        </Button>
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
          <Grid item xs={12} md={6}>
            <TextField
              label="Search"
              value={filters.search}
              onChange={handleFilterChange('search')}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={filters.status}
                onChange={handleFilterChange('status')}
              >
                <MenuItem value="">All</MenuItem>
                {statusOptions.map((status) => (
                  <MenuItem key={status} value={status}>{status}</MenuItem>
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
              <TableCell>Product</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Stock</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product._id} hover>
                <TableCell>
                  <Typography variant="subtitle2">{product.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {product.category || 'General'}
                  </Typography>
                </TableCell>
                <TableCell>{product.sku}</TableCell>
                <TableCell>
                  PKR {Number(product.unitPrice || 0).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{product.stockQuantity} units</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Reorder at {product.reorderLevel || 10}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={product.status}
                    size="small"
                    color={product.status === 'active' ? 'success' : product.status === 'inactive' ? 'default' : 'warning'}
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpenDialog(product)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton onClick={() => handleDeleteProduct(product._id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No products found.
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProduct ? 'Edit Product' : 'New Product'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Name"
                fullWidth
                required
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="SKU"
                fullWidth
                required
                value={formData.sku}
                onChange={(event) => setFormData((prev) => ({ ...prev, sku: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Category"
                fullWidth
                value={formData.category}
                onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Unit Price"
                type="number"
                fullWidth
                required
                value={formData.unitPrice}
                onChange={(event) => setFormData((prev) => ({ ...prev, unitPrice: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Cost Price"
                type="number"
                fullWidth
                value={formData.costPrice}
                onChange={(event) => setFormData((prev) => ({ ...prev, costPrice: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Stock Qty"
                type="number"
                fullWidth
                value={formData.stockQuantity}
                onChange={(event) => setFormData((prev) => ({ ...prev, stockQuantity: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))}
                >
                  {statusOptions.map((status) => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                minRows={2}
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingProduct ? 'Update Product' : 'Create Product'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SalesProducts;

