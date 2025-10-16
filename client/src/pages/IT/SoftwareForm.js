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
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Save,
  Cancel,
  ArrowBack,
  Info,
  Add,
  Delete
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';

import { itService } from '../../services/itService';
import { FormSkeleton } from '../../components/IT/SkeletonLoader';

const SoftwareForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm({
    defaultValues: {
      softwareName: '',
      version: '',
      category: '',
      subcategory: '',
      vendor: '',
      licenseType: '',
      purchaseDate: '',
      purchasePrice: '',
      currency: 'PKR',
      licenseKey: '',
      licenseCount: {
        total: 1,
        used: 0,
        available: 1
      },
      expiryDate: '',
      renewalDate: '',
      renewalCost: '',
      supportContact: {
        name: '',
        email: '',
        phone: '',
        website: ''
      },
      installationNotes: '',
      systemRequirements: {
        operatingSystem: [],
        processor: '',
        memory: '',
        storage: '',
        other: ''
      },
      compatibility: [],
      notes: ''
    }
  });

  // Fetch software data for editing
  const { data: softwareData, isLoading } = useQuery(
    ['software', id],
    () => itService.getSoftwareItem(id),
    {
      enabled: isEdit,
      onSuccess: (data) => {
        const software = data.data;
        reset({
          ...software,
          purchaseDate: software.purchaseDate ? software.purchaseDate.split('T')[0] : '',
          expiryDate: software.expiryDate ? software.expiryDate.split('T')[0] : '',
          renewalDate: software.renewalDate ? software.renewalDate.split('T')[0] : '',
          systemRequirements: {
            ...software.systemRequirements,
            operatingSystem: software.systemRequirements?.operatingSystem || []
          },
          compatibility: software.compatibility || []
        });
      },
      onError: (error) => {
        toast.error('Failed to load software data');
        console.error('Software load error:', error);
      }
    }
  );

  // Create/Update software mutation
  const saveSoftwareMutation = useMutation(
    (data) => {
      if (isEdit) {
        return itService.updateSoftware(id, data);
      } else {
        return itService.createSoftware(data);
      }
    },
    {
      onSuccess: (data) => {
        toast.success(`Software ${isEdit ? 'updated' : 'created'} successfully`);
        queryClient.invalidateQueries(['software']);
        navigate('/it/software');
      },
      onError: (error) => {
        toast.error(`Failed to ${isEdit ? 'update' : 'create'} software`);
        console.error('Save error:', error);
      }
    }
  );

  // Software categories
  const softwareCategories = [
    'Operating System', 'Office Suite', 'Design Software', 'Development Tools',
    'Database Software', 'Security Software', 'Antivirus', 'Backup Software',
    'Communication Tools', 'Project Management', 'Accounting Software', 'ERP Software', 'Other'
  ];

  // License types
  const licenseTypes = ['Perpetual', 'Subscription', 'Volume', 'Site License', 'Concurrent', 'Open Source'];

  // Currency options
  const currencies = ['PKR', 'USD', 'EUR'];

  // Operating systems
  const operatingSystems = [
    'Windows 10', 'Windows 11', 'macOS', 'Linux', 'Ubuntu', 'CentOS', 'Red Hat',
    'iOS', 'Android', 'Other'
  ];

  // Handle form submission
  const onSubmit = (data) => {
    // Clean up data
    const submitData = {
      ...data,
      purchasePrice: parseFloat(data.purchasePrice),
      renewalCost: data.renewalCost ? parseFloat(data.renewalCost) : null,
      licenseCount: {
        ...data.licenseCount,
        total: parseInt(data.licenseCount.total),
        used: parseInt(data.licenseCount.used || 0),
        available: parseInt(data.licenseCount.total) - parseInt(data.licenseCount.used || 0)
      }
    };

    saveSoftwareMutation.mutate(submitData);
  };

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          {isEdit ? 'Edit Software' : 'Add New Software'}
        </Typography>
        <FormSkeleton fields={10} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/it/software')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Software' : 'Add New Software'}
        </Typography>
      </Box>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Basic Information */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="softwareName"
                  control={control}
                  rules={{ required: 'Software name is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Software Name"
                      error={Boolean(errors.softwareName)}
                      helperText={errors.softwareName?.message}
                    />
                  )}
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Controller
                  name="version"
                  control={control}
                  rules={{ required: 'Version is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Version"
                      error={Boolean(errors.version)}
                      helperText={errors.version?.message}
                    />
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

              <Grid item xs={12} md={6}>
                <Controller
                  name="category"
                  control={control}
                  rules={{ required: 'Category is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={Boolean(errors.category)}>
                      <InputLabel>Category</InputLabel>
                      <Select {...field} label="Category">
                        {softwareCategories.map((category) => (
                          <MenuItem key={category} value={category}>
                            {category}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="vendor"
                  control={control}
                  rules={{ required: 'Vendor is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Vendor"
                      error={Boolean(errors.vendor)}
                      helperText={errors.vendor?.message}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* License Information */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              License Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Controller
                  name="licenseType"
                  control={control}
                  rules={{ required: 'License type is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={Boolean(errors.licenseType)}>
                      <InputLabel>License Type</InputLabel>
                      <Select {...field} label="License Type">
                        {licenseTypes.map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="licenseKey"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="License Key"
                      type="password"
                    />
                  )}
                />
              </Grid>

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

              <Grid item xs={12} md={4}>
                <Controller
                  name="expiryDate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Expiry Date"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>

              {/* License Count */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                  License Count
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="licenseCount.total"
                  control={control}
                  rules={{ 
                    required: 'Total license count is required',
                    min: { value: 1, message: 'Must be at least 1' }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Total Licenses"
                      type="number"
                      inputProps={{ min: 1 }}
                      error={Boolean(errors.licenseCount?.total)}
                      helperText={errors.licenseCount?.total?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="licenseCount.used"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Used Licenses"
                      type="number"
                      inputProps={{ min: 0 }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="renewalDate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Renewal Date"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="renewalCost"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Renewal Cost"
                      type="number"
                      inputProps={{ min: 0 }}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Support Information */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Support Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="supportContact.name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Contact Name"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="supportContact.email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Contact Email"
                      type="email"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="supportContact.phone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Contact Phone"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="supportContact.website"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Website"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="installationNotes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Installation Notes"
                      multiline
                      rows={3}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* System Requirements */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              System Requirements
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="systemRequirements.processor"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Processor"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="systemRequirements.memory"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Memory"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="systemRequirements.storage"
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

              <Grid item xs={12} md={6}>
                <Controller
                  name="systemRequirements.other"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Other Requirements"
                    />
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
                      label="Additional Notes"
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
            onClick={() => navigate('/it/software')}
            startIcon={<Cancel />}
          >
            Cancel
          </Button>
          
          <Button
            type="submit"
            variant="contained"
            startIcon={<Save />}
            disabled={saveSoftwareMutation.isLoading}
          >
            {saveSoftwareMutation.isLoading 
              ? (isEdit ? 'Updating...' : 'Creating...') 
              : (isEdit ? 'Update Software' : 'Create Software')
            }
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default SoftwareForm;
