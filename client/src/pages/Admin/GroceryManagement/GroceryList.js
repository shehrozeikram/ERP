import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  Skeleton
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import groceryService from '../../../services/groceryService';

const GroceryList = () => {
  const navigate = useNavigate();
  const [groceries, setGroceries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, grocery: null });

  const fetchGroceries = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      
      const response = await groceryService.getGroceries(params);
      setGroceries(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch grocery items');
      console.error('Error fetching groceries:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchGroceries();
  }, [fetchGroceries]);

  const handleDelete = async () => {
    try {
      await groceryService.deleteGrocery(deleteDialog.grocery._id);
      setDeleteDialog({ open: false, grocery: null });
      fetchGroceries();
    } catch (err) {
      setError('Failed to delete grocery item');
      console.error('Error deleting grocery:', err);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Available': 'success',
      'Low Stock': 'warning',
      'Out of Stock': 'error',
      'Expired': 'default'
    };
    return colors[status] || 'default';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const categories = ['Vegetables', 'Fruits', 'Dairy', 'Meat', 'Grains', 'Beverages', 'Snacks', 'Cleaning', 'Other'];
  const statuses = ['Available', 'Low Stock', 'Out of Stock', 'Expired'];

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="25%" height={40} />
          <Skeleton variant="rectangular" width={120} height={36} borderRadius={1} />
        </Box>

        <Card>
          <CardContent>
            <Box display="flex" gap={2} mb={3} flexWrap="wrap">
              <Skeleton variant="rectangular" width={200} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={150} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={120} height={56} borderRadius={1} />
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[1, 2, 3, 4, 5, 6, 7].map((item) => (
                    <TableRow key={item}>
                      <TableCell><Skeleton variant="text" height={20} width="60%" /></TableCell>
                      <TableCell><Skeleton variant="rectangular" height={24} width={80} /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="45%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="35%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="40%" /></TableCell>
                      <TableCell>
                        <Skeleton variant="rectangular" height={24} width={90} />
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" justifyContent="center" gap={1}>
                          <Skeleton variant="circular" width={32} height={32} />
                          <Skeleton variant="circular" width={32} height={32} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Grocery Management
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<WarningIcon />}
            onClick={() => navigate('/admin/groceries/stock-alerts')}
          >
            Stock Alerts
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/groceries/new')}
          >
            Add Item
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map(category => (
                    <MenuItem key={category} value={category}>{category}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Status</MenuItem>
                  {statuses.map(status => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Item ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Current Stock</TableCell>
                  <TableCell>Unit Price</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Supplier</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groceries.map((grocery) => (
                  <TableRow key={grocery._id}>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {grocery.itemId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {grocery.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={grocery.category} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {grocery.currentStock} {grocery.unit}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatCurrency(grocery.unitPrice)}</TableCell>
                    <TableCell>
                      <Chip
                        label={grocery.status}
                        color={getStatusColor(grocery.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color={grocery.supplier ? 'text.primary' : 'text.secondary'}>
                        {grocery.supplier || 'No Supplier'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/admin/groceries/${grocery._id}`)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteDialog({ open: true, grocery })}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, grocery: null })}>
        <DialogTitle>Delete Grocery Item</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete item {deleteDialog.grocery?.itemId}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, grocery: null })}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GroceryList;
