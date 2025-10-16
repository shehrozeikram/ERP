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
  IconButton,
  Tooltip,
  Chip,
  Rating,
  Autocomplete
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

const VendorForm = () => {
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
      vendorName: '',
      businessType: '',
      vendorType: '',
      contactInfo: {
        companyPhone: '',
        companyEmail: '',
        website: '',
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'Pakistan'
        }
      },
      primaryContact: {
        name: '',
        title: '',
        email: '',
        phone: '',
        department: ''
      },
      services: [],
      certifications: [],
      rating: {
        overall: 0,
        reliability: 0,
        quality: 0,
        price: 0,
        support: 0,
        delivery: 0
      },
      relationship: {
        status: 'Active',
        preferredVendor: false,
        blacklisted: false,
        partnershipLevel: '',
        contractTerms: '',
        paymentTerms: '',
        notes: ''
      },
      financialInfo: {
        creditLimit: '',
        paymentHistory: [],
        currency: 'PKR'
      },
      compliance: {
        taxId: '',
        licenseNumber: '',
        insurance: '',
        certifications: []
      },
      notes: ''
    }
  });

  // Fetch vendor data for editing
  const { data: vendorData, isLoading } = useQuery(
    ['it-vendor', id],
    () => itService.getITVendor(id),
    {
      enabled: isEdit,
      onSuccess: (data) => {
        const vendor = data.data;
        reset({
          ...vendor,
          services: vendor.services || [],
          certifications: vendor.certifications || [],
          compliance: {
            ...vendor.compliance,
            certifications: vendor.compliance?.certifications || []
          }
        });
      },
      onError: (error) => {
        toast.error('Failed to load vendor data');
        console.error('Vendor load error:', error);
      }
    }
  );

  // Create/Update vendor mutation
  const saveVendorMutation = useMutation(
    (data) => {
      if (isEdit) {
        return itService.updateITVendor(id, data);
      } else {
        return itService.createITVendor(data);
      }
    },
    {
      onSuccess: (data) => {
        toast.success(`Vendor ${isEdit ? 'updated' : 'created'} successfully`);
        queryClient.invalidateQueries(['it-vendors']);
        navigate('/it/vendors');
      },
      onError: (error) => {
        toast.error(`Failed to ${isEdit ? 'update' : 'create'} vendor`);
        console.error('Save error:', error);
      }
    }
  );

  // Vendor types
  const vendorTypes = [
    'Hardware Supplier', 'Software Vendor', 'Service Provider', 'Consultant',
    'Maintenance Provider', 'Cloud Provider', 'Security Provider', 'Network Provider',
    'Training Provider', 'Other'
  ];

  // Business types
  const businessTypes = [
    'Corporation', 'LLC', 'Partnership', 'Sole Proprietorship', 'Government Agency',
    'Non-Profit', 'Educational Institution', 'Other'
  ];

  // Partnership levels
  const partnershipLevels = [
    'Basic', 'Preferred', 'Gold', 'Platinum', 'Strategic'
  ];

  // Common services
  const commonServices = [
    'Hardware Supply', 'Software Licensing', 'IT Support', 'Network Services',
    'Cloud Services', 'Security Services', 'Training', 'Consulting',
    'Maintenance', 'Implementation', 'Custom Development', 'Data Backup',
    'Disaster Recovery', 'Migration Services', 'Integration Services'
  ];

  // Common certifications
  const commonCertifications = [
    'ISO 27001', 'ISO 9001', 'SOC 2', 'PCI DSS', 'HIPAA', 'GDPR',
    'Microsoft Partner', 'Cisco Partner', 'AWS Partner', 'Google Partner',
    'Oracle Partner', 'SAP Partner'
  ];

  // Currencies
  const currencies = ['PKR', 'USD', 'EUR'];

  // Handle form submission
  const onSubmit = (data) => {
    // Clean up data
    const submitData = {
      ...data,
      financialInfo: {
        ...data.financialInfo,
        creditLimit: data.financialInfo.creditLimit ? parseFloat(data.financialInfo.creditLimit) : null,
        paymentHistory: Array.isArray(data.financialInfo.paymentHistory) ? data.financialInfo.paymentHistory : []
      }
    };

    saveVendorMutation.mutate(submitData);
  };

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          {isEdit ? 'Edit Vendor' : 'Add New Vendor'}
        </Typography>
        <FormSkeleton fields={8} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/it/vendors')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Vendor' : 'Add New Vendor'}
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
                  name="vendorName"
                  control={control}
                  rules={{ required: 'Vendor name is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Vendor Name"
                      error={Boolean(errors.vendorName)}
                      helperText={errors.vendorName?.message}
                    />
                  )}
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Controller
                  name="businessType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Business Type</InputLabel>
                      <Select {...field} label="Business Type">
                        {businessTypes.map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Controller
                  name="vendorType"
                  control={control}
                  rules={{ required: 'Vendor type is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={Boolean(errors.vendorType)}>
                      <InputLabel>Vendor Type</InputLabel>
                      <Select {...field} label="Vendor Type">
                        {vendorTypes.map((type) => (
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
                  name="contactInfo.companyPhone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Company Phone"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="contactInfo.companyEmail"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Company Email"
                      type="email"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="contactInfo.website"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Website"
                      placeholder="https://example.com"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Contact Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Controller
                  name="primaryContact.name"
                  control={control}
                  rules={{ required: 'Primary contact name is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Primary Contact Name"
                      error={Boolean(errors.primaryContact?.name)}
                      helperText={errors.primaryContact?.name?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="primaryContact.title"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Title"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="primaryContact.department"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Department"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="primaryContact.email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Email"
                      type="email"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="primaryContact.phone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Phone"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Address
                </Typography>
              </Grid>

              <Grid item xs={12} md={8}>
                <Controller
                  name="contactInfo.address.street"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Street Address"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="contactInfo.address.zipCode"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Zip Code"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="contactInfo.address.city"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="City"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="contactInfo.address.state"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="State/Province"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="contactInfo.address.country"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Country"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Services & Certifications */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Services & Certifications
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="services"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      multiple
                      freeSolo
                      options={commonServices}
                      value={field.value || []}
                      onChange={(_, newValue) => field.onChange(newValue)}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            variant="outlined"
                            label={option}
                            {...getTagProps({ index })}
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Services"
                          placeholder="Select or add services"
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="certifications"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      multiple
                      freeSolo
                      options={commonCertifications}
                      value={field.value || []}
                      onChange={(_, newValue) => field.onChange(newValue)}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            variant="outlined"
                            label={option}
                            {...getTagProps({ index })}
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Certifications"
                          placeholder="Select or add certifications"
                        />
                      )}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Rating */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Vendor Rating
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Overall Rating
                </Typography>
                <Controller
                  name="rating.overall"
                  control={control}
                  render={({ field }) => (
                    <Rating
                      {...field}
                      value={field.value || 0}
                      onChange={(_, newValue) => field.onChange(newValue)}
                      precision={0.5}
                      size="large"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Detailed Ratings
                  </Typography>
                  <Grid container spacing={2}>
                    {[
                      { key: 'reliability', label: 'Reliability' },
                      { key: 'quality', label: 'Quality' },
                      { key: 'price', label: 'Price' },
                      { key: 'support', label: 'Support' },
                      { key: 'delivery', label: 'Delivery' }
                    ].map(({ key, label }) => (
                      <Grid item xs={12} key={key}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2">{label}</Typography>
                          <Controller
                            name={`rating.${key}`}
                            control={control}
                            render={({ field }) => (
                              <Rating
                                {...field}
                                value={field.value || 0}
                                onChange={(_, newValue) => field.onChange(newValue)}
                                size="small"
                                precision={0.5}
                              />
                            )}
                          />
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Relationship */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Relationship
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Controller
                  name="relationship.status"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select {...field} label="Status">
                        <MenuItem value="Active">Active</MenuItem>
                        <MenuItem value="Inactive">Inactive</MenuItem>
                        <MenuItem value="Suspended">Suspended</MenuItem>
                        <MenuItem value="Terminated">Terminated</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="relationship.partnershipLevel"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Partnership Level</InputLabel>
                      <Select {...field} label="Partnership Level">
                        {partnershipLevels.map((level) => (
                          <MenuItem key={level} value={level}>
                            {level}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="financialInfo.currency"
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
                  name="relationship.contractTerms"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Contract Terms"
                      multiline
                      rows={2}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="relationship.paymentTerms"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Payment Terms"
                      multiline
                      rows={2}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" gap={2}>
                  <Controller
                    name="relationship.preferredVendor"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={field.value}
                            onChange={field.onChange}
                          />
                        }
                        label="Preferred Vendor"
                      />
                    )}
                  />
                  <Controller
                    name="relationship.blacklisted"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={field.value}
                            onChange={field.onChange}
                            color="error"
                          />
                        }
                        label="Blacklisted"
                      />
                    )}
                  />
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="relationship.notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Relationship Notes"
                      multiline
                      rows={3}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Additional Notes */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Additional Information
            </Typography>
            
            <Grid container spacing={3}>
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
                      rows={4}
                      placeholder="Additional notes, special instructions, etc."
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
            onClick={() => navigate('/it/vendors')}
            startIcon={<Cancel />}
          >
            Cancel
          </Button>
          
          <Button
            type="submit"
            variant="contained"
            startIcon={<Save />}
            disabled={saveVendorMutation.isLoading}
          >
            {saveVendorMutation.isLoading 
              ? (isEdit ? 'Updating...' : 'Creating...') 
              : (isEdit ? 'Update Vendor' : 'Create Vendor')
            }
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default VendorForm;
