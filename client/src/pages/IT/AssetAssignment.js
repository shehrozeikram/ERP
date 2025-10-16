import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Alert,
  Chip,
  Avatar,
  Divider,
  Paper,
  IconButton
} from '@mui/material';
import {
  ArrowBack,
  Assignment,
  Person,
  Computer,
  Save,
  Cancel
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { itService } from '../../services/itService';
import employeeService from '../../services/employeeService';
import { FormSkeleton } from '../../components/IT/SkeletonLoader';

const AssetAssignment = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      employeeId: '',
      assignmentReason: '',
      conditionAtAssignment: 'Excellent',
      expectedReturnDate: null,
      notes: '',
      accessories: []
    }
  });

  // Fetch asset data
  const { data: assetData, isLoading: assetLoading } = useQuery(
    ['asset', id],
    () => itService.getAsset(id),
    {
      onError: (error) => {
        toast.error('Failed to load asset data');
        console.error('Asset loading error:', error);
      }
    }
  );

  // Fetch all employees for dropdown
  const { data: employeesData, isLoading: employeesLoading } = useQuery(
    ['employees'],
    () => employeeService.getEmployees({ getAll: true }),
    {
      onError: (error) => {
        console.error('Employees loading error:', error);
      }
    }
  );

  // Assignment mutation
  const assignAssetMutation = useMutation(
    (assignmentData) => itService.assignAsset(id, assignmentData),
    {
      onSuccess: () => {
        toast.success('Asset assigned successfully');
        queryClient.invalidateQueries(['asset', id]);
        queryClient.invalidateQueries(['assets']);
        navigate('/it/assets');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to assign asset');
        console.error('Assignment error:', error);
      }
    }
  );

  const onSubmit = (data) => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    const assignmentData = {
      ...data,
      employeeId: selectedEmployee._id,
      expectedReturnDate: data.expectedReturnDate?.toISOString()
    };

    assignAssetMutation.mutate(assignmentData);
  };


  const handleBack = () => {
    navigate('/it/assets');
  };

  if (assetLoading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Assign Asset
        </Typography>
        <FormSkeleton fields={6} />
      </Box>
    );
  }

  if (!assetData?.data) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Assign Asset
        </Typography>
        <Alert severity="error">
          Asset not found or failed to load.
        </Alert>
        <Button onClick={handleBack} startIcon={<ArrowBack />} sx={{ mt: 2 }}>
          Back to Assets
        </Button>
      </Box>
    );
  }

  const asset = assetData.data;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header */}
        <Box display="flex" alignItems="center" mb={3}>
          <IconButton onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h4" gutterBottom>
              Assign Asset
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Assign asset to an employee
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Asset Information */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Asset Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <Computer />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {asset.assetName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {asset.assetTag}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Category: <Chip label={asset.category} size="small" />
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Brand: {asset.brand}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Model: {asset.model}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Serial: {asset.serialNumber || 'N/A'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Status: <Chip 
                      label={asset.status} 
                      color={asset.status === 'Available' ? 'success' : 'default'} 
                      size="small" 
                    />
                  </Typography>
                </Box>

                {asset.assignedTo?.employee && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    This asset is currently assigned to {asset.assignedTo.employee.firstName} {asset.assignedTo.employee.lastName}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Assignment Form */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Assignment Details
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <form onSubmit={handleSubmit(onSubmit)}>
                  <Grid container spacing={3}>
                    {/* Employee Selection */}
                    <Grid item xs={12}>
                      <Controller
                        name="employeeId"
                        control={control}
                        rules={{ required: 'Employee selection is required' }}
                        render={({ field, fieldState: { error } }) => (
                          <Autocomplete
                            options={employeesData?.data?.filter(emp => emp.isActive !== false) || []}
                            getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.employeeId})`}
                            value={employeesData?.data?.find(emp => emp._id === field.value) || null}
                            onChange={(event, newValue) => {
                              if (newValue) {
                                field.onChange(newValue._id);
                                setSelectedEmployee(newValue);
                              } else {
                                field.onChange('');
                                setSelectedEmployee(null);
                              }
                            }}
                            disabled={employeesLoading}
                            loading={employeesLoading}
                            loadingText="Loading employees..."
                            noOptionsText="No employees found"
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Select Employee *"
                                error={!!error}
                                helperText={error ? error.message : ''}
                                placeholder="Search employees..."
                              />
                            )}
                            renderOption={(props, option) => (
                              <Box component="li" {...props}>
                                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                  <Avatar sx={{ mr: 2, width: 32, height: 32 }}>
                                    {option.firstName?.[0]}{option.lastName?.[0]}
                                  </Avatar>
                                  <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="subtitle2">
                                      {option.firstName} {option.lastName}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {option.employeeId} • {option.placementDepartment?.name || 'No Department'}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Box>
                            )}
                            filterOptions={(options, { inputValue }) => {
                              const filtered = options.filter((option) => {
                                const searchText = inputValue.toLowerCase();
                                const fullName = `${option.firstName} ${option.lastName}`.toLowerCase();
                                const employeeId = option.employeeId?.toLowerCase() || '';
                                const department = option.placementDepartment?.name?.toLowerCase() || '';
                                const email = option.email?.toLowerCase() || '';
                                
                                return (
                                  fullName.includes(searchText) ||
                                  employeeId.includes(searchText) ||
                                  department.includes(searchText) ||
                                  email.includes(searchText)
                                );
                              });
                              
                              return filtered.sort((a, b) => 
                                `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
                              );
                            }}
                            isOptionEqualToValue={(option, value) => option._id === value._id}
                          />
                        )}
                      />
                    </Grid>

                    {/* Assignment Reason */}
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="assignmentReason"
                        control={control}
                        rules={{ required: 'Assignment reason is required' }}
                        render={({ field, fieldState: { error } }) => (
                          <FormControl fullWidth error={!!error}>
                            <InputLabel>Assignment Reason *</InputLabel>
                            <Select {...field} label="Assignment Reason *">
                              <MenuItem value="New Employee">New Employee</MenuItem>
                              <MenuItem value="Replacement">Replacement</MenuItem>
                              <MenuItem value="Upgrade">Upgrade</MenuItem>
                              <MenuItem value="Temporary">Temporary</MenuItem>
                              <MenuItem value="Project">Project</MenuItem>
                              <MenuItem value="Other">Other</MenuItem>
                            </Select>
                            {error && (
                              <Typography variant="caption" color="error">
                                {error.message}
                              </Typography>
                            )}
                          </FormControl>
                        )}
                      />
                    </Grid>

                    {/* Condition at Assignment */}
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="conditionAtAssignment"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>Condition at Assignment</InputLabel>
                            <Select {...field} label="Condition at Assignment">
                              <MenuItem value="Excellent">Excellent</MenuItem>
                              <MenuItem value="Good">Good</MenuItem>
                              <MenuItem value="Fair">Fair</MenuItem>
                              <MenuItem value="Poor">Poor</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>

                    {/* Expected Return Date */}
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="expectedReturnDate"
                        control={control}
                        render={({ field }) => (
                          <DatePicker
                            {...field}
                            label="Expected Return Date"
                            renderInput={(params) => (
                              <TextField {...params} fullWidth />
                            )}
                          />
                        )}
                      />
                    </Grid>

                    {/* Notes */}
                    <Grid item xs={12}>
                      <Controller
                        name="notes"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            multiline
                            rows={3}
                            label="Assignment Notes"
                            placeholder="Add any additional notes about this assignment..."
                          />
                        )}
                      />
                    </Grid>
                  </Grid>

                  {/* Action Buttons */}
                  <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<Assignment />}
                      disabled={assignAssetMutation.isLoading || !selectedEmployee}
                    >
                      {assignAssetMutation.isLoading ? 'Assigning...' : 'Assign Asset'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handleBack}
                      startIcon={<Cancel />}
                    >
                      Cancel
                    </Button>
                  </Box>
                </form>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

      </Box>
    </LocalizationProvider>
  );
};

export default AssetAssignment;
