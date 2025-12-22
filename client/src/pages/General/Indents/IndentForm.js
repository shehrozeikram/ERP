import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Divider,
  Chip
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import indentService from '../../../services/indentService';
import dayjs from 'dayjs';

const IndentForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { departments, fetchDepartments } = useData();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: '',
    items: [],
    requiredDate: '',
    priority: 'Medium',
    category: 'Other',
    referenceNo: '',
    amount: 0,
    notes: ''
  });

  // Load indent data if editing
  useEffect(() => {
    const loadData = async () => {
      if (isEdit) {
        try {
          setLoadingData(true);
          const response = await indentService.getIndentById(id);
          const indent = response.data;
          
          setFormData({
            title: indent.title || '',
            description: indent.description || '',
            department: indent.department?._id || '',
            items: indent.items || [],
            requiredDate: indent.requiredDate ? dayjs(indent.requiredDate).format('YYYY-MM-DD') : '',
            priority: indent.priority || 'Medium',
            category: indent.category || 'Other',
            referenceNo: indent.referenceNo || '',
            amount: indent.amount || 0,
            notes: indent.notes || ''
          });
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to load indent');
        } finally {
          setLoadingData(false);
        }
      }
      
      // Load departments
      if (departments.length === 0) {
        await fetchDepartments();
      }
    };

    loadData();
  }, [id, isEdit, fetchDepartments, departments.length]);

  // Handle form field changes
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle item changes
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      items: updatedItems
    }));
  };

  // Add new item
  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          itemName: '',
          description: '',
          quantity: 1,
          unit: 'Piece',
          estimatedCost: 0,
          priority: 'Medium',
          remarks: ''
        }
      ]
    }));
  };

  // Remove item
  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Calculate total estimated cost
  const totalEstimatedCost = formData.items.reduce((sum, item) => {
    return sum + ((item.estimatedCost || 0) * (item.quantity || 0));
  }, 0);

  // Validate form
  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return false;
    }
    if (!formData.department) {
      setError('Department is required');
      return false;
    }
    if (formData.items.length === 0) {
      setError('At least one item is required');
      return false;
    }
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.itemName.trim()) {
        setError(`Item ${i + 1}: Item name is required`);
        return false;
      }
      if (!item.quantity || item.quantity < 1) {
        setError(`Item ${i + 1}: Quantity must be at least 1`);
        return false;
      }
    }
    return true;
  };

  // Handle submit
  const handleSubmit = async (submitForApproval = false) => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const indentData = {
        ...formData,
        department: formData.department,
        requiredDate: formData.requiredDate || undefined,
        status: submitForApproval ? 'Submitted' : 'Draft'
      };

      let response;
      if (isEdit) {
        response = await indentService.updateIndent(id, indentData);
      } else {
        response = await indentService.createIndent(indentData);
      }

      // If submitting for approval, submit it
      if (submitForApproval && response.data?._id) {
        await indentService.submitIndent(response.data._id);
      }

      setSnackbar({
        open: true,
        message: submitForApproval 
          ? 'Indent submitted for approval successfully' 
          : isEdit 
            ? 'Indent updated successfully' 
            : 'Indent created successfully',
        severity: 'success'
      });

      setTimeout(() => {
        navigate('/general/indents');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save indent');
      console.error('Error saving indent:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          {isEdit ? 'Edit Indent' : 'Create New Indent'}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<CancelIcon />}
          onClick={() => navigate('/general/indents')}
        >
          Cancel
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Basic Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Title"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    multiline
                    rows={3}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Department</InputLabel>
                    <Select
                      value={formData.department}
                      label="Department"
                      onChange={(e) => handleChange('department', e.target.value)}
                    >
                      {departments.map((dept) => (
                        <MenuItem key={dept._id} value={dept._id}>
                          {dept.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Required Date"
                    type="date"
                    value={formData.requiredDate}
                    onChange={(e) => handleChange('requiredDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={formData.priority}
                      label="Priority"
                      onChange={(e) => handleChange('priority', e.target.value)}
                    >
                      <MenuItem value="Low">Low</MenuItem>
                      <MenuItem value="Medium">Medium</MenuItem>
                      <MenuItem value="High">High</MenuItem>
                      <MenuItem value="Urgent">Urgent</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={formData.category}
                      label="Category"
                      onChange={(e) => handleChange('category', e.target.value)}
                    >
                      <MenuItem value="Office Supplies">Office Supplies</MenuItem>
                      <MenuItem value="IT Equipment">IT Equipment</MenuItem>
                      <MenuItem value="Furniture">Furniture</MenuItem>
                      <MenuItem value="Maintenance">Maintenance</MenuItem>
                      <MenuItem value="Raw Materials">Raw Materials</MenuItem>
                      <MenuItem value="Services">Services</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Reference No"
                    value={formData.referenceNo}
                    onChange={(e) => handleChange('referenceNo', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Amount"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notes"
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Summary Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Summary
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Items
                  </Typography>
                  <Typography variant="h6">
                    {formData.items.length}
                  </Typography>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Estimated Cost
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {new Intl.NumberFormat('en-PK', {
                      style: 'currency',
                      currency: 'PKR',
                      maximumFractionDigits: 0
                    }).format(totalEstimatedCost)}
                  </Typography>
                </Box>
                {formData.amount > 0 && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Amount
                      </Typography>
                      <Typography variant="h6">
                        {new Intl.NumberFormat('en-PK', {
                          style: 'currency',
                          currency: 'PKR',
                          maximumFractionDigits: 0
                        }).format(formData.amount)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Remaining Amount
                      </Typography>
                      <Typography 
                        variant="h6" 
                        color={formData.amount - totalEstimatedCost < 0 ? 'error' : 'success'}
                      >
                        {new Intl.NumberFormat('en-PK', {
                          style: 'currency',
                          currency: 'PKR',
                          maximumFractionDigits: 0
                        }).format(formData.amount - totalEstimatedCost)}
                      </Typography>
                    </Box>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Items Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Items
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddItem}
                >
                  Add Item
                </Button>
              </Stack>

              {formData.items.length === 0 ? (
                <Alert severity="info">
                  No items added. Click "Add Item" to add items to this indent.
                </Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Item Name</strong></TableCell>
                        <TableCell><strong>Description</strong></TableCell>
                        <TableCell align="right"><strong>Quantity</strong></TableCell>
                        <TableCell><strong>Unit</strong></TableCell>
                        <TableCell align="right"><strong>Est. Cost</strong></TableCell>
                        <TableCell><strong>Priority</strong></TableCell>
                        <TableCell align="right"><strong>Total</strong></TableCell>
                        <TableCell align="center"><strong>Actions</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {formData.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <TextField
                              size="small"
                              value={item.itemName}
                              onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                              placeholder="Item name"
                              required
                              fullWidth
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={item.description || ''}
                              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                              placeholder="Description"
                              fullWidth
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                              inputProps={{ min: 1 }}
                              sx={{ width: 80 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={item.unit}
                              onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                              sx={{ width: 100 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.estimatedCost}
                              onChange={(e) => handleItemChange(index, 'estimatedCost', parseFloat(e.target.value) || 0)}
                              inputProps={{ min: 0, step: 0.01 }}
                              sx={{ width: 120 }}
                            />
                          </TableCell>
                          <TableCell>
                            <FormControl size="small" sx={{ minWidth: 100 }}>
                              <Select
                                value={item.priority || 'Medium'}
                                onChange={(e) => handleItemChange(index, 'priority', e.target.value)}
                              >
                                <MenuItem value="Low">Low</MenuItem>
                                <MenuItem value="Medium">Medium</MenuItem>
                                <MenuItem value="High">High</MenuItem>
                                <MenuItem value="Urgent">Urgent</MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={600}>
                              {new Intl.NumberFormat('en-PK', {
                                style: 'currency',
                                currency: 'PKR',
                                maximumFractionDigits: 0
                              }).format((item.estimatedCost || 0) * (item.quantity || 0))}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              variant="outlined"
              onClick={() => navigate('/general/indents')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => handleSubmit(false)}
              disabled={loading}
            >
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Save Draft'}
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<SendIcon />}
              onClick={() => handleSubmit(true)}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </Stack>
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};

export default IndentForm;

