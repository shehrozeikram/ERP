import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Divider
} from '@mui/material';
import { formatPKR } from '../utils/currency';
import api from '../services/api';

const ArrearsDialog = ({ open, onClose, employee, onSuccess, editData = null }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    month: '',
    year: new Date().getFullYear(),
    amount: '',
    description: '',
    status: 'Pending',
    type: 'Salary Adjustment'
  });

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const statusOptions = [
    { value: 'Pending', label: 'Pending', color: 'warning' },
    { value: 'Paid', label: 'Paid', color: 'success' },
    { value: 'Overdue', label: 'Overdue', color: 'error' },
    { value: 'Cancelled', label: 'Cancelled', color: 'default' }
  ];

  const typeOptions = [
    'Salary Adjustment',
    'Bonus Payment',
    'Overtime Payment',
    'Allowance Adjustment',
    'Deduction Reversal',
    'Other'
  ];

  useEffect(() => {
    if (open) {
      if (editData) {
        // Populate form with edit data
        setFormData({
          month: editData.monthName || '',
          year: editData.year || new Date().getFullYear(),
          amount: editData.amount || '',
          description: editData.description || '',
          status: editData.status || 'Pending',
          type: editData.type || 'Salary Adjustment'
        });
      } else {
        // Reset form when dialog opens for new arrears
        setFormData({
          month: '',
          year: new Date().getFullYear(),
          amount: '',
          description: '',
          status: 'Pending',
          type: 'Salary Adjustment'
        });
      }
      setError('');
    }
  }, [open, editData]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      // Validation
      if (!formData.month || !formData.amount || !formData.description) {
        setError('Please fill in all required fields');
        return;
      }

      if (parseFloat(formData.amount) <= 0) {
        setError('Amount must be greater than 0');
        return;
      }

      const arrearsData = {
        employeeId: employee._id,
        month: months.indexOf(formData.month) + 1,
        year: formData.year,
        monthName: formData.month,
        amount: parseFloat(formData.amount),
        description: formData.description,
        status: formData.status,
        type: formData.type
      };

      // Call the appropriate API endpoint
      if (editData) {
        // Update existing arrears
        const response = await api.put(`/hr/arrears/${editData._id}`, arrearsData);
        onSuccess('Arrears updated successfully');
      } else {
        // Add new arrears
        const response = await api.post('/hr/arrears', arrearsData);
        onSuccess('Arrears added successfully');
      }
      
      setLoading(false);
      onClose();

    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.message || 'Failed to add arrears');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h6">{editData ? 'Edit Arrears' : 'Add New Arrears'}</Typography>
          <Typography variant="body2" color="textSecondary">
            Employee: {employee?.firstName} {employee?.lastName} ({employee?.employeeId})
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Month</InputLabel>
                <Select
                  value={formData.month}
                  onChange={(e) => handleInputChange('month', e.target.value)}
                  label="Month"
                >
                  {months.map((month, index) => (
                    <MenuItem key={index} value={month}>
                      {month}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Year"
                type="number"
                value={formData.year}
                onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
                inputProps={{ min: 2020, max: 2030 }}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Amount (PKR)"
                type="number"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="0.00"
                required
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>₨</Typography>
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  label="Type"
                >
                  {typeOptions.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  label="Status"
                >
                  {statusOptions.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={status.label} color={status.color} size="small" />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>


            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter detailed description of the arrears..."
                required
              />
            </Grid>

            {/* Preview Section */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Preview
              </Typography>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Month/Year:</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {formData.month} {formData.year}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Amount:</Typography>
                    <Typography variant="body1" fontWeight="medium" color="warning.main">
                      {formData.amount ? formatPKR(parseFloat(formData.amount)) : '₨0'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Type:</Typography>
                    <Typography variant="body1">{formData.type}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Status:</Typography>
                    <Chip
                      label={formData.status}
                      color={
                        formData.status === 'Paid' ? 'success' :
                        formData.status === 'Pending' ? 'warning' :
                        formData.status === 'Overdue' ? 'error' : 'default'
                      }
                      size="small"
                    />
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? (editData ? 'Updating...' : 'Adding...') : (editData ? 'Update Arrears' : 'Add Arrears')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

export default ArrearsDialog;
