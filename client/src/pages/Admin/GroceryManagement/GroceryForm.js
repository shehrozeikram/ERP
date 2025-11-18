import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  Skeleton
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import groceryService from '../../../services/groceryService';

const GroceryForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    itemId: '',
    name: '',
    category: 'Other',
    unit: 'pieces',
    currentStock: 0,
    minStockLevel: 5,
    maxStockLevel: 100,
    unitPrice: 0,
    supplier: '',
    expiryDate: '',
    description: '',
    barcode: '',
    location: 'Main Storage'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const categories = ['Vegetables', 'Fruits', 'Dairy', 'Meat', 'Grains', 'Beverages', 'Snacks', 'Cleaning', 'Other'];
  const units = ['kg', 'pieces', 'liters', 'packets', 'boxes', 'bottles'];

  useEffect(() => {
    if (isEdit) {
      fetchGrocery();
    }
  }, [id, isEdit]);

  const fetchGrocery = async () => {
    try {
      setLoading(true);
      const response = await groceryService.getGrocery(id);
      const grocery = response.data;
      
      setFormData({
        itemId: grocery.itemId || '',
        name: grocery.name || '',
        category: grocery.category || 'Other',
        unit: grocery.unit || 'pieces',
        currentStock: grocery.currentStock || 0,
        minStockLevel: grocery.minStockLevel || 5,
        maxStockLevel: grocery.maxStockLevel || 100,
        unitPrice: grocery.unitPrice || 0,
        supplier: grocery.supplier || '',
        expiryDate: grocery.expiryDate ? new Date(grocery.expiryDate).toISOString().split('T')[0] : '',
        description: grocery.description || '',
        barcode: grocery.barcode || '',
        location: grocery.location || 'Main Storage'
      });
    } catch (err) {
      setError('Failed to fetch grocery item details');
      console.error('Error fetching grocery:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const submitData = {
        ...formData,
        currentStock: parseFloat(formData.currentStock),
        minStockLevel: parseFloat(formData.minStockLevel),
        maxStockLevel: parseFloat(formData.maxStockLevel),
        unitPrice: parseFloat(formData.unitPrice),
        supplier: formData.supplier || null
      };

      if (!isEdit) {
        delete submitData.itemId;
        if (!submitData.barcode) {
          delete submitData.barcode;
        }
      }

      if (isEdit) {
        await groceryService.updateGrocery(id, submitData);
        setSuccess('Grocery item updated successfully!');
      } else {
        await groceryService.createGrocery(submitData);
        setSuccess('Grocery item created successfully!');
      }

      setTimeout(() => {
        navigate('/admin/groceries');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save grocery item');
      console.error('Error saving grocery:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return (
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="25%" height={40} />
          <Skeleton variant="rectangular" width={80} height={36} borderRadius={1} />
        </Box>

        <Card>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="40%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="25%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="50%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="35%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="45%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="40%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="30%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="35%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12}>
                <Skeleton variant="text" height={20} width="30%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={80} width="100%" />
              </Grid>
              <Grid item xs={12}>
                <Box display="flex" gap={2} sx={{ mt: 3 }}>
                  <Skeleton variant="rectangular" width={120} height={36} borderRadius={1} />
                  <Skeleton variant="rectangular" width={80} height={36} borderRadius={1} />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Grocery Item' : 'Add New Grocery Item'}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/admin/groceries')}
        >
          Back to Groceries
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {isEdit && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Item ID"
                      name="itemId"
                      value={formData.itemId}
                      onChange={handleChange}
                      required
                      placeholder="e.g., GR001"
                      InputProps={{ readOnly: true }}
                      helperText="Auto-generated for new items"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Barcode"
                      name="barcode"
                      value={formData.barcode}
                      onChange={handleChange}
                      placeholder="Optional barcode"
                    />
                  </Grid>
                </>
              )}
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Item Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Fresh Tomatoes"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    label="Category"
                    required
                  >
                    {categories.map(category => (
                      <MenuItem key={category} value={category}>{category}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    label="Unit"
                    required
                  >
                    {units.map(unit => (
                      <MenuItem key={unit} value={unit}>{unit}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Current Stock"
                  name="currentStock"
                  type="number"
                  value={formData.currentStock}
                  onChange={handleChange}
                  required
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Unit Price"
                  name="unitPrice"
                  type="number"
                  value={formData.unitPrice}
                  onChange={handleChange}
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Min Stock Level"
                  name="minStockLevel"
                  type="number"
                  value={formData.minStockLevel}
                  onChange={handleChange}
                  required
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Max Stock Level"
                  name="maxStockLevel"
                  type="number"
                  value={formData.maxStockLevel}
                  onChange={handleChange}
                  required
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Storage Location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., Main Storage"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Supplier"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleChange}
                  placeholder="e.g., ABC Suppliers"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Expiry Date"
                  name="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={handleChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  multiline
                  rows={3}
                  placeholder="Additional details about the item..."
                />
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" gap={2}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    size="large"
                  >
                    {loading ? 'Saving...' : (isEdit ? 'Update Item' : 'Create Item')}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/admin/groceries')}
                    size="large"
                  >
                    Cancel
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default GroceryForm;
