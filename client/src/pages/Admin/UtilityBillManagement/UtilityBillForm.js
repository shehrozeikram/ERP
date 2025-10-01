import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Avatar,
  IconButton
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import utilityBillService from '../../../services/utilityBillService';
import { getImageUrl, handleImageError } from '../../../utils/imageService';

const UtilityBillForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const defaultType = searchParams.get('type') || 'Electricity';

  const [formData, setFormData] = useState({
    utilityType: defaultType,
    provider: '',
    accountNumber: '',
    billDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    amount: 0,
    paidAmount: 0,
    description: '',
    location: 'Main Office',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (isEdit) {
      fetchBill();
    }
  }, [id, isEdit]);

  const fetchBill = async () => {
    try {
      setLoading(true);
      const response = await utilityBillService.getUtilityBill(id);
      const bill = response.data;
      
      setFormData({
        utilityType: bill.utilityType || defaultType,
        provider: bill.provider || '',
        accountNumber: bill.accountNumber || '',
        billDate: bill.billDate ? new Date(bill.billDate).toISOString().split('T')[0] : '',
        dueDate: bill.dueDate ? new Date(bill.dueDate).toISOString().split('T')[0] : '',
        amount: bill.amount || 0,
        paidAmount: bill.paidAmount || 0,
        description: bill.description || '',
        location: bill.location || 'Main Office',
        notes: bill.notes || ''
      });

      // Set image preview if bill has an image
      if (bill.billImage) {
        setImagePreview(getImageUrl(bill.billImage));
      }
    } catch (err) {
      setError('Failed to fetch utility bill details');
      console.error('Error fetching bill:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      const submitData = new FormData();
      
      // Add form data
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
          submitData.append(key, formData[key]);
        }
      });

      // Add image if selected
      if (selectedImage) {
        submitData.append('billImage', selectedImage);
      }

      if (isEdit) {
        await utilityBillService.updateUtilityBill(id, submitData);
      } else {
        await utilityBillService.createUtilityBill(submitData);
      }

      navigate('/admin/utility-bills');
    } catch (err) {
      setError(isEdit ? 'Failed to update utility bill' : 'Failed to create utility bill');
      console.error('Error saving bill:', err);
    } finally {
      setLoading(false);
    }
  };

  const utilityTypes = [
    'Electricity',
    'Water',
    'Gas',
    'Internet',
    'Phone',
    'Maintenance',
    'Security',
    'Cleaning',
    'Other'
  ];

  if (loading && isEdit) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Utility Bill' : 'Create New Utility Bill'}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/admin/utility-bills')}
        >
          Back to Bills
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Form */}
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Utility Type</InputLabel>
                  <Select
                    value={formData.utilityType}
                    onChange={handleChange('utilityType')}
                    label="Utility Type"
                  >
                    {utilityTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Provider"
                  value={formData.provider}
                  onChange={handleChange('provider')}
                  required
                  placeholder="e.g., K-Electric"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Account Number"
                  value={formData.accountNumber}
                  onChange={handleChange('accountNumber')}
                  placeholder="Optional account number"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Location"
                  value={formData.location}
                  onChange={handleChange('location')}
                  placeholder="e.g., Main Office"
                />
              </Grid>

              {/* Date Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Date Information
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Bill Date"
                  type="date"
                  value={formData.billDate}
                  onChange={handleChange('billDate')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Due Date"
                  type="date"
                  value={formData.dueDate}
                  onChange={handleChange('dueDate')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              {/* Amount Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Amount Information
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Total Amount"
                  type="number"
                  value={formData.amount}
                  onChange={handleChange('amount')}
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Paid Amount"
                  type="number"
                  value={formData.paidAmount}
                  onChange={handleChange('paidAmount')}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              {/* Additional Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Additional Information
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={handleChange('description')}
                  multiline
                  rows={3}
                  placeholder="Additional details about the bill..."
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={formData.notes}
                  onChange={handleChange('notes')}
                  multiline
                  rows={2}
                  placeholder="Internal notes..."
                />
              </Grid>

              {/* Image Upload Section */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Bill Image
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="bill-image-upload"
                    type="file"
                    onChange={handleImageChange}
                  />
                  <label htmlFor="bill-image-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<CloudUploadIcon />}
                      size="small"
                    >
                      Upload Image
                    </Button>
                  </label>
                  {imagePreview && (
                    <IconButton
                      onClick={handleRemoveImage}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Box>

                {imagePreview && (
                  <Box sx={{ mt: 2 }}>
                    <Avatar
                      src={imagePreview}
                      alt="Bill Preview"
                      sx={{
                        width: 200,
                        height: 200,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                      onError={(e) => handleImageError(e)}
                    />
                  </Box>
                )}
              </Grid>

              {/* Submit Button */}
              <Grid item xs={12}>
                <Box display="flex" gap={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/admin/utility-bills')}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : (isEdit ? 'Update Bill' : 'Create Bill')}
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

export default UtilityBillForm;