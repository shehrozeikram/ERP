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
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Alert,
  Divider,
  InputAdornment
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Cancel,
  Add,
  Delete,
  Visibility,
  VisibilityOff,
  Security,
  Link,
  Person,
  Category,
  Notes,
  CalendarToday,
  Lock
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';

import { itService } from '../../services/itService';
import { FormSkeleton } from '../../components/IT/SkeletonLoader';

const PasswordForm = () => {
  const navigate = useNavigate();
  const { id: vendorId, passwordId } = useParams();
  const queryClient = useQueryClient();
  const isEdit = Boolean(passwordId);
  const isStandalone = !vendorId; // If no vendorId, it's a standalone password form

  // State
  const [showPassword, setShowPassword] = useState(false);
  const [additionalFields, setAdditionalFields] = useState([]);

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm({
    defaultValues: {
      title: '',
      description: '',
      category: '',
      username: '',
      password: '',
      url: '',
      tags: [],
      expiryDate: '',
      securityLevel: 'Medium',
      notes: '',
      additionalFields: [],
    }
  });


  // Fetch password data for editing
  const { data: passwordData, isLoading: passwordLoading } = useQuery(
    ['password', passwordId],
    () => itService.getPassword(passwordId),
    {
      enabled: isEdit,
      onSuccess: (data) => {
        const password = data.data;
        reset({
          ...password,
          tags: password.tags || [],
          additionalFields: password.additionalFields || []
        });
      },
      onError: (error) => {
        toast.error('Failed to load password data');
        console.error('Password load error:', error);
      }
    }
  );

  // Create/Update password mutation
  const savePasswordMutation = useMutation(
    (data) => {
      if (isEdit) {
        return itService.updatePassword(passwordId, data);
      } else {
        // Create password without vendor
        return itService.createPasswordWithoutVendor(data);
      }
    },
    {
      onSuccess: (data) => {
        toast.success(`Password ${isEdit ? 'updated' : 'created'} successfully`);
        queryClient.invalidateQueries(['vendor-passwords']);
        queryClient.invalidateQueries(['all-passwords']);
        
        // Navigate to passwords list
        navigate('/it/passwords');
      },
      onError: (error) => {
        toast.error(`Failed to ${isEdit ? 'update' : 'create'} password`);
        console.error('Save error:', error);
      }
    }
  );

  // Password categories
  const passwordCategories = [
    'Admin Panel',
    'Database Access',
    'Server Credentials',
    'API Keys',
    'VPN Access',
    'Cloud Services',
    'Email Account',
    'Software License',
    'Network Device',
    'Domain/DNS',
    'Payment Gateway',
    'Third Party Service',
    'Other'
  ];

  // Security levels
  const securityLevels = [
    { value: 'Low', label: 'Low', color: 'success' },
    { value: 'Medium', label: 'Medium', color: 'info' },
    { value: 'High', label: 'High', color: 'warning' },
    { value: 'Critical', label: 'Critical', color: 'error' }
  ];

  // Common tags
  const commonTags = [
    'Production', 'Development', 'Staging', 'Testing', 'Backup',
    'Primary', 'Secondary', 'Emergency', 'API', 'Database',
    'Admin', 'User', 'Service', 'System', 'External'
  ];

  // Handle form submission
  const onSubmit = (data) => {
    // Clean up data
    const submitData = {
      ...data,
      tags: data.tags || [],
      additionalFields: data.additionalFields || []
    };

    savePasswordMutation.mutate(submitData);
  };

  // Generate secure password
  const generateSecurePassword = () => {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const isLoading = passwordLoading;

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          {isEdit ? 'Edit Password' : 'Add New Password'}
        </Typography>
        <FormSkeleton fields={8} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/it/passwords')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Password' : 'Add New Password'}
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
                  name="title"
                  control={control}
                  rules={{ required: 'Title is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Title"
                      placeholder="e.g., Admin Panel Access"
                      error={Boolean(errors.title)}
                      helperText={errors.title?.message}
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
                        {passwordCategories.map((category) => (
                          <MenuItem key={category} value={category}>
                            {category}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Description"
                      multiline
                      rows={2}
                      placeholder="Brief description of this password's purpose"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="username"
                  control={control}
                  rules={{ required: 'Username is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Username"
                      placeholder="Username or email"
                      error={Boolean(errors.username)}
                      helperText={errors.username?.message}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Person />
                          </InputAdornment>
                        )
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="password"
                  control={control}
                  rules={{ required: 'Password is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      error={Boolean(errors.password)}
                      helperText={errors.password?.message}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowPassword(!showPassword)}>
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    const generatedPassword = generateSecurePassword();
                    reset({ ...watch(), password: generatedPassword });
                    toast.success('Secure password generated');
                  }}
                  startIcon={<Security />}
                >
                  Generate Secure Password
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Additional Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="url"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="URL"
                      placeholder="https://example.com"
                      error={Boolean(errors.url)}
                      helperText={errors.url?.message}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Link />
                          </InputAdornment>
                        )
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
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
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <CalendarToday />
                          </InputAdornment>
                        )
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="securityLevel"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Security Level</InputLabel>
                      <Select {...field} label="Security Level">
                        {securityLevels.map((level) => (
                          <MenuItem key={level.value} value={level.value}>
                            <Box display="flex" alignItems="center">
                              <Security sx={{ mr: 1, color: `${level.color}.main` }} />
                              {level.label}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="tags"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Tags"
                      placeholder="Enter tags separated by commas"
                      helperText="e.g., Production, Admin, API"
                      onChange={(e) => {
                        const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                        field.onChange(tags);
                      }}
                      value={field.value ? field.value.join(', ') : ''}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Common Tags
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {commonTags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      onClick={() => {
                        const currentTags = watch('tags') || [];
                        if (!currentTags.includes(tag)) {
                          const newTags = [...currentTags, tag];
                          reset({ ...watch(), tags: newTags });
                        }
                      }}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
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
                      placeholder="Additional notes, special instructions, etc."
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Notes />
                          </InputAdornment>
                        )
                      }}
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
            onClick={() => navigate('/it/passwords')}
            startIcon={<Cancel />}
          >
            Cancel
          </Button>
          
          <Button
            type="submit"
            variant="contained"
            startIcon={<Save />}
            disabled={savePasswordMutation.isLoading}
          >
            {savePasswordMutation.isLoading 
              ? (isEdit ? 'Updating...' : 'Creating...') 
              : (isEdit ? 'Update Password' : 'Create Password')
            }
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default PasswordForm;
