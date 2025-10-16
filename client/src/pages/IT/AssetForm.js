import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Save,
  Cancel,
  ArrowBack,
  Add,
  Delete,
  Info
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';

import { itService } from '../../services/itService';
import { FormSkeleton } from '../../components/IT/SkeletonLoader';

const AssetForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  // Form state
  const [activeStep, setActiveStep] = useState(0);
  const [warrantyEnabled, setWarrantyEnabled] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue
  } = useForm({
    defaultValues: {
      assetName: '',
      category: '',
      subcategory: '',
      brand: '',
      model: '',
      serialNumber: '',
      specifications: {
        cpu: '',
        ram: '',
        storage: '',
        gpu: '',
        operatingSystem: '',
        screenSize: '',
        resolution: '',
        other: ''
      },
      purchaseDate: '',
      purchasePrice: '',
      currency: 'PKR',
      supplier: '',
      warranty: {
        startDate: '',
        endDate: '',
        type: 'Manufacturer',
        provider: '',
        contactInfo: ''
      },
      depreciation: {
        method: 'Straight Line',
        usefulLife: 5,
        residualValue: 0,
        currentValue: ''
      },
      location: {
        building: '',
        floor: '',
        room: '',
        desk: ''
      },
      status: 'Active',
      condition: 'Good',
      notes: ''
    }
  });

  // Fetch asset data for editing
  const { data: assetData, isLoading } = useQuery(
    ['asset', id],
    () => itService.getAsset(id),
    {
      enabled: isEdit,
      onSuccess: (data) => {
        const asset = data.data;
        reset({
          ...asset,
          purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
          warranty: {
            ...asset.warranty,
            startDate: asset.warranty?.startDate ? asset.warranty.startDate.split('T')[0] : '',
            endDate: asset.warranty?.endDate ? asset.warranty.endDate.split('T')[0] : ''
          }
        });
        setWarrantyEnabled(Boolean(asset.warranty?.startDate));
        setMaintenanceEnabled(Boolean(asset.maintenance?.lastServiceDate));
      },
      onError: (error) => {
        toast.error('Failed to load asset data');
        console.error('Asset load error:', error);
      }
    }
  );

  // Create/Update asset mutation
  const saveAssetMutation = useMutation(
    (data) => {
      if (isEdit) {
        return itService.updateAsset(id, data);
      } else {
        return itService.createAsset(data);
      }
    },
    {
      onSuccess: (data) => {
        toast.success(`Asset ${isEdit ? 'updated' : 'created'} successfully`);
        queryClient.invalidateQueries(['assets']);
        navigate('/it/assets');
      },
      onError: (error) => {
        toast.error(`Failed to ${isEdit ? 'update' : 'create'} asset`);
        console.error('Save error:', error);
      }
    }
  );

  // Asset categories
  const assetCategories = [
    'Laptop', 'Desktop', 'Server', 'Printer', 'Scanner', 'Router', 'Switch',
    'Access Point', 'Firewall', 'UPS', 'Monitor', 'Keyboard', 'Mouse',
    'Webcam', 'Headset', 'Projector', 'Tablet', 'Smartphone', 'Other'
  ];

  // Currency options
  const currencies = ['PKR', 'USD', 'EUR'];

  // Warranty types
  const warrantyTypes = ['Manufacturer', 'Extended', 'Third Party'];

  // Depreciation methods
  const depreciationMethods = ['Straight Line', 'Declining Balance', 'Sum of Years'];

  // Asset statuses
  const assetStatuses = ['Active', 'In Repair', 'Retired', 'Lost', 'Stolen', 'Disposed'];

  // Asset conditions
  const assetConditions = ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged'];

  // Steps configuration
  const steps = [
    { label: 'Basic Information', description: 'Asset details and specifications' },
    { label: 'Purchase & Warranty', description: 'Purchase information and warranty details' },
    { label: 'Location & Status', description: 'Asset location and current status' }
  ];

  // Handle step change
  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  // Handle form submission
  const onSubmit = (data) => {
    // Clean up data
    const submitData = {
      ...data,
      purchasePrice: parseFloat(data.purchasePrice),
      depreciation: {
        ...data.depreciation,
        usefulLife: parseInt(data.depreciation.usefulLife),
        residualValue: parseFloat(data.depreciation.residualValue || 0),
        currentValue: data.depreciation.currentValue ? parseFloat(data.depreciation.currentValue) : data.purchasePrice
      },
      warranty: warrantyEnabled ? data.warranty : null,
      maintenance: maintenanceEnabled ? data.maintenance : null
    };

    saveAssetMutation.mutate(submitData);
  };

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          {isEdit ? 'Edit Asset' : 'Add New Asset'}
        </Typography>
        <FormSkeleton fields={8} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/it/assets')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Asset' : 'Add New Asset'}
        </Typography>
      </Box>

      {/* Stepper */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stepper activeStep={activeStep} orientation="horizontal">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Basic Information */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="assetName"
                  control={control}
                  rules={{ required: 'Asset name is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Asset Name"
                      error={Boolean(errors.assetName)}
                      helperText={errors.assetName?.message}
                    />
                  )}
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Controller
                  name="category"
                  control={control}
                  rules={{ required: 'Category is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={Boolean(errors.category)}>
                      <InputLabel>Category</InputLabel>
                      <Select {...field} label="Category">
                        {assetCategories.map((category) => (
                          <MenuItem key={category} value={category}>
                            {category}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Controller
                  name="subcategory"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Subcategory"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="brand"
                  control={control}
                  rules={{ required: 'Brand is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Brand"
                      error={Boolean(errors.brand)}
                      helperText={errors.brand?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="model"
                  control={control}
                  rules={{ required: 'Model is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Model"
                      error={Boolean(errors.model)}
                      helperText={errors.model?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="serialNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Serial Number"
                    />
                  )}
                />
              </Grid>

              {/* Specifications */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Specifications
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="specifications.cpu"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="CPU"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="specifications.ram"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="RAM"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="specifications.storage"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Storage"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="specifications.gpu"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="GPU"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="specifications.operatingSystem"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Operating System"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="specifications.screenSize"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Screen Size"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Step 2: Purchase & Warranty */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Purchase & Warranty Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Controller
                  name="purchaseDate"
                  control={control}
                  rules={{ required: 'Purchase date is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Purchase Date"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      error={Boolean(errors.purchaseDate)}
                      helperText={errors.purchaseDate?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="purchasePrice"
                  control={control}
                  rules={{ 
                    required: 'Purchase price is required',
                    min: { value: 0, message: 'Price must be positive' }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Purchase Price"
                      type="number"
                      error={Boolean(errors.purchasePrice)}
                      helperText={errors.purchasePrice?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="currency"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Currency</InputLabel>
                      <Select {...field} label="Currency">
                        {currencies.map((currency) => (
                          <MenuItem key={currency} value={currency}>
                            {currency}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="supplier"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Supplier"
                    />
                  )}
                />
              </Grid>

              {/* Warranty Section */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Box display="flex" alignItems="center" mb={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={warrantyEnabled}
                        onChange={(e) => setWarrantyEnabled(e.target.checked)}
                      />
                    }
                    label="Has Warranty"
                  />
                  <Tooltip title="Enable if this asset has warranty coverage">
                    <IconButton size="small">
                      <Info />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Grid>

              {warrantyEnabled && (
                <>
                  <Grid item xs={12} md={4}>
                    <Controller
                      name="warranty.startDate"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Warranty Start Date"
                          type="date"
                          InputLabelProps={{ shrink: true }}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Controller
                      name="warranty.endDate"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Warranty End Date"
                          type="date"
                          InputLabelProps={{ shrink: true }}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Controller
                      name="warranty.type"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel>Warranty Type</InputLabel>
                          <Select {...field} label="Warranty Type">
                            {warrantyTypes.map((type) => (
                              <MenuItem key={type} value={type}>
                                {type}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Controller
                      name="warranty.provider"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Warranty Provider"
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Controller
                      name="warranty.contactInfo"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Contact Information"
                        />
                      )}
                    />
                  </Grid>
                </>
              )}

              {/* Depreciation Section */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Depreciation Settings
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="depreciation.method"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Depreciation Method</InputLabel>
                      <Select {...field} label="Depreciation Method">
                        {depreciationMethods.map((method) => (
                          <MenuItem key={method} value={method}>
                            {method}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="depreciation.usefulLife"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Useful Life (Years)"
                      type="number"
                      inputProps={{ min: 1, max: 20 }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="depreciation.residualValue"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Residual Value"
                      type="number"
                      inputProps={{ min: 0 }}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Step 3: Location & Status */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Location & Status
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Controller
                  name="location.building"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Building"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Controller
                  name="location.floor"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Floor"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Controller
                  name="location.room"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Room"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Controller
                  name="location.desk"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Desk"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select {...field} label="Status">
                        {assetStatuses.map((status) => (
                          <MenuItem key={status} value={status}>
                            {status}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="condition"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Condition</InputLabel>
                      <Select {...field} label="Condition">
                        {assetConditions.map((condition) => (
                          <MenuItem key={condition} value={condition}>
                            {condition}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Notes"
                      multiline
                      rows={3}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <Box display="flex" justifyContent="space-between" mt={3}>
          <Button
            variant="outlined"
            onClick={() => navigate('/it/assets')}
            startIcon={<Cancel />}
          >
            Cancel
          </Button>
          
          <Button
            type="submit"
            variant="contained"
            startIcon={<Save />}
            disabled={saveAssetMutation.isLoading}
          >
            {saveAssetMutation.isLoading 
              ? (isEdit ? 'Updating...' : 'Creating...') 
              : (isEdit ? 'Update Asset' : 'Create Asset')
            }
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default AssetForm;
