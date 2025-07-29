import React, { useState, useEffect } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  IconButton,
  Chip,
  Alert,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Calculate as CalculateIcon
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import api from '../../services/api';

const FBRTaxManagement = () => {
  const [taxSlabs, setTaxSlabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingSlab, setEditingSlab] = useState(null);
  const [openCalculator, setOpenCalculator] = useState(false);
  const [calculationResult, setCalculationResult] = useState(null);

  const validationSchema = Yup.object({
    fiscalYear: Yup.string().required('Fiscal year is required'),
    description: Yup.string(),
    isActive: Yup.boolean(),
    slabs: Yup.array().of(
      Yup.object({
        minAmount: Yup.number().required('Minimum amount is required').min(0, 'Minimum amount cannot be negative'),
        maxAmount: Yup.number().required('Maximum amount is required').min(0, 'Maximum amount cannot be negative'),
        rate: Yup.number().required('Tax rate is required').min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
        fixedTax: Yup.number().min(0, 'Fixed tax cannot be negative'),
        description: Yup.string()
      })
    ).min(1, 'At least one tax slab is required')
  });

  const formik = useFormik({
    initialValues: {
      fiscalYear: '',
      description: '',
      isActive: false,
      slabs: [
        { minAmount: 0, maxAmount: 600000, rate: 0, fixedTax: 0, description: '' }
      ]
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        if (editingSlab) {
          await api.put(`/hr/fbr-tax-slabs/${editingSlab._id}`, values);
        } else {
          await api.post('/hr/fbr-tax-slabs', values);
        }
        fetchTaxSlabs();
        handleCloseDialog();
        setError(null);
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to save tax slabs');
      }
    }
  });

  const fetchTaxSlabs = async () => {
    try {
      const response = await api.get('/hr/fbr-tax-slabs');
      setTaxSlabs(response.data.data);
    } catch (error) {
      setError('Failed to fetch tax slabs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxSlabs();
  }, []);

  const handleOpenDialog = (slab = null) => {
    if (slab) {
      setEditingSlab(slab);
      formik.setValues({
        fiscalYear: slab.fiscalYear,
        description: slab.description || '',
        isActive: slab.isActive,
        slabs: slab.slabs
      });
    } else {
      setEditingSlab(null);
      formik.resetForm();
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingSlab(null);
    formik.resetForm();
  };

  const handleDeleteSlab = async (id) => {
    if (window.confirm('Are you sure you want to delete this tax slab?')) {
      try {
        await api.delete(`/hr/fbr-tax-slabs/${id}`);
        fetchTaxSlabs();
      } catch (error) {
        setError('Failed to delete tax slab');
      }
    }
  };

  const addSlab = () => {
    const newSlabs = [...formik.values.slabs, { minAmount: 0, maxAmount: 0, rate: 0, fixedTax: 0, description: '' }];
    formik.setFieldValue('slabs', newSlabs);
  };

  const removeSlab = (index) => {
    const newSlabs = formik.values.slabs.filter((_, i) => i !== index);
    formik.setFieldValue('slabs', newSlabs);
  };

  const updateSlab = (index, field, value) => {
    const newSlabs = [...formik.values.slabs];
    newSlabs[index] = { ...newSlabs[index], [field]: value };
    formik.setFieldValue('slabs', newSlabs);
  };

  const calculateTax = async (annualIncome) => {
    try {
      const response = await api.post('/hr/fbr-tax-slabs/calculate', { annualIncome });
      setCalculationResult(response.data.data);
    } catch (error) {
      setError('Failed to calculate tax');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Typography>Loading FBR Tax Slabs...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button onClick={fetchTaxSlabs} variant="contained">
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          FBR Tax Management
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<CalculateIcon />}
            onClick={() => setOpenCalculator(true)}
            sx={{ mr: 1 }}
          >
            Tax Calculator
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Tax Slabs
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {taxSlabs && taxSlabs.length > 0 ? (
          taxSlabs.map((slab) => (
            <Grid item xs={12} md={6} key={slab._id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      FY {slab.fiscalYear || 'N/A'}
                      {slab.isActive && (
                        <Chip label="Active" color="success" size="small" sx={{ ml: 1 }} />
                      )}
                    </Typography>
                    <Box>
                      <IconButton onClick={() => handleOpenDialog(slab)} size="small">
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        onClick={() => handleDeleteSlab(slab._id)}
                        size="small"
                        disabled={slab.isActive}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  
                  {slab.description && (
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      {slab.description}
                    </Typography>
                  )}

                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Income Range</TableCell>
                          <TableCell>Rate</TableCell>
                          <TableCell>Fixed Tax</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {slab.slabs && slab.slabs.map((taxSlab, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              Rs {(taxSlab.minAmount || 0).toLocaleString()} - {taxSlab.maxAmount === Infinity ? 'Above' : 'Rs ' + (taxSlab.maxAmount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell>{(taxSlab.rate || 0)}%</TableCell>
                            <TableCell>Rs {(taxSlab.fixedTax || 0).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                    Created by: {slab.createdBy?.firstName || 'System'} {slab.createdBy?.lastName || ''}
                    {slab.updatedBy && ` | Updated by: ${slab.updatedBy.firstName || ''} ${slab.updatedBy.lastName || ''}`}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  No Tax Slabs Found
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  No FBR tax slabs have been configured yet.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                >
                  Add First Tax Slabs
                </Button>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingSlab ? 'Edit Tax Slabs' : 'Add New Tax Slabs'}
        </DialogTitle>
        <form onSubmit={formik.handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="fiscalYear"
                  label="Fiscal Year"
                  value={formik.values.fiscalYear}
                  onChange={formik.handleChange}
                  error={formik.touched.fiscalYear && Boolean(formik.errors.fiscalYear)}
                  helperText={formik.touched.fiscalYear && formik.errors.fiscalYear}
                  placeholder="e.g., 2025-26"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="description"
                  label="Description"
                  value={formik.values.description}
                  onChange={formik.handleChange}
                  placeholder="Optional description"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      name="isActive"
                      checked={formik.values.isActive}
                      onChange={formik.handleChange}
                    />
                  }
                  label="Set as Active"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            
            <Typography variant="h6" gutterBottom>
              Tax Slabs
            </Typography>

            {formik.values.slabs.map((slab, index) => (
              <Card key={index} sx={{ mb: 2, p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="Min Amount"
                      type="number"
                      value={slab.minAmount}
                      onChange={(e) => updateSlab(index, 'minAmount', parseFloat(e.target.value) || 0)}
                      error={formik.touched.slabs?.[index]?.minAmount && Boolean(formik.errors.slabs?.[index]?.minAmount)}
                      helperText={formik.touched.slabs?.[index]?.minAmount && formik.errors.slabs?.[index]?.minAmount}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="Max Amount"
                      type="number"
                      value={slab.maxAmount === Infinity ? '' : slab.maxAmount}
                      onChange={(e) => updateSlab(index, 'maxAmount', e.target.value === '' ? Infinity : parseFloat(e.target.value) || 0)}
                      placeholder="Infinity"
                      error={formik.touched.slabs?.[index]?.maxAmount && Boolean(formik.errors.slabs?.[index]?.maxAmount)}
                      helperText={formik.touched.slabs?.[index]?.maxAmount && formik.errors.slabs?.[index]?.maxAmount}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="Rate (%)"
                      type="number"
                      value={slab.rate}
                      onChange={(e) => updateSlab(index, 'rate', parseFloat(e.target.value) || 0)}
                      error={formik.touched.slabs?.[index]?.rate && Boolean(formik.errors.slabs?.[index]?.rate)}
                      helperText={formik.touched.slabs?.[index]?.rate && formik.errors.slabs?.[index]?.rate}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="Fixed Tax"
                      type="number"
                      value={slab.fixedTax}
                      onChange={(e) => updateSlab(index, 'fixedTax', parseFloat(e.target.value) || 0)}
                      error={formik.touched.slabs?.[index]?.fixedTax && Boolean(formik.errors.slabs?.[index]?.fixedTax)}
                      helperText={formik.touched.slabs?.[index]?.fixedTax && formik.errors.slabs?.[index]?.fixedTax}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Description"
                      value={slab.description}
                      onChange={(e) => updateSlab(index, 'description', e.target.value)}
                      placeholder="Optional"
                    />
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <IconButton onClick={() => removeSlab(index)} color="error" disabled={formik.values.slabs.length === 1}>
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </Card>
            ))}

            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addSlab}
              sx={{ mt: 1 }}
            >
              Add Slab
            </Button>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingSlab ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Tax Calculator Dialog */}
      <Dialog open={openCalculator} onClose={() => setOpenCalculator(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tax Calculator</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Annual Income (PKR)"
            type="number"
            onChange={(e) => {
              const income = parseFloat(e.target.value);
              if (income > 0) {
                calculateTax(income);
              } else {
                setCalculationResult(null);
              }
            }}
            sx={{ mb: 2 }}
          />
          
          {calculationResult && (
            <Card sx={{ p: 2, bgcolor: '#f8f9fa' }}>
              <Typography variant="h6" gutterBottom>Calculation Result</Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Annual Income" 
                    secondary={`Rs ${calculationResult.annualIncome.toLocaleString()}`} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Tax Slab" 
                    secondary={calculationResult.taxInfo.slab} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Tax Rate" 
                    secondary={calculationResult.taxInfo.rate} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Annual Tax" 
                    secondary={`Rs ${calculationResult.taxAmount.toLocaleString()}`} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Monthly Tax" 
                    secondary={`Rs ${calculationResult.monthlyTax.toLocaleString()}`} 
                  />
                </ListItem>
              </List>
            </Card>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCalculator(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FBRTaxManagement; 