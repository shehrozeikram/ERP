import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Autocomplete
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import incrementService from '../../services/incrementService';
import api from '../../services/api';

const CreateIncrement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    employeeId: '',
    incrementType: 'annual',
    newSalary: '',
    reason: '',
    effectiveDate: new Date()
  });
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (formData.employeeId) {
      const employee = employees.find(emp => emp._id === formData.employeeId);
      setSelectedEmployee(employee);
    }
  }, [formData.employeeId, employees]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get('/hr/employees?isActive=true&employmentStatus=Active&getAll=true');
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setError('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateIncrement = () => {
    if (selectedEmployee && formData.newSalary) {
      const currentSalary = selectedEmployee.salary?.gross || 0;
      const newSalary = parseFloat(formData.newSalary);
      const incrementAmount = newSalary - currentSalary;
      const incrementPercentage = currentSalary > 0 ? ((incrementAmount / currentSalary) * 100).toFixed(2) : 0;
      
      return {
        currentSalary,
        incrementAmount,
        incrementPercentage
      };
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.employeeId || !formData.newSalary || !formData.reason) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      const incrementData = {
        ...formData,
        newSalary: parseFloat(formData.newSalary),
        effectiveDate: formData.effectiveDate.toISOString()
      };

      const response = await incrementService.createIncrement(incrementData);
      
      if (response.success) {
        setSuccess('Increment request created successfully!');
        setTimeout(() => {
          navigate('/hr/increments');
        }, 2000);
      } else {
        setError(response.error || 'Failed to create increment request');
      }
    } catch (error) {
      console.error('Error creating increment:', error);
      setError('Failed to create increment request');
    } finally {
      setSaving(false);
    }
  };

  const incrementTypes = [
    { value: 'annual', label: 'Annual Increment' },
    { value: 'performance', label: 'Performance Based' },
    { value: 'special', label: 'Special Increment' },
    { value: 'market_adjustment', label: 'Market Rate Adjustment' }
  ];

  const incrementCalculation = calculateIncrement();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header */}
        <Box display="flex" alignItems="center" mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/hr/increments')}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
          <Typography variant="h4" component="h1">
            <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Create Increment Request
          </Typography>
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

        <Grid container spacing={3}>
          {/* Form */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Increment Details
                </Typography>
                <form onSubmit={handleSubmit}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <Autocomplete
                        fullWidth
                        options={employees}
                        getOptionLabel={(employee) => 
                          `${employee.firstName} ${employee.lastName} (${employee.employeeId})`
                        }
                        value={employees.find(emp => emp._id === formData.employeeId) || null}
                        onChange={(event, newValue) => {
                          handleInputChange('employeeId', newValue?._id || '');
                        }}
                        filterOptions={(options, { inputValue }) => {
                          const filter = inputValue.toLowerCase();
                          return options.filter(option =>
                            option.firstName?.toLowerCase().includes(filter) ||
                            option.lastName?.toLowerCase().includes(filter) ||
                            option.employeeId?.toLowerCase().includes(filter) ||
                            `${option.firstName} ${option.lastName}`.toLowerCase().includes(filter)
                          );
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Employee *"
                            required
                            placeholder="Search by name or employee ID..."
                          />
                        )}
                        renderOption={(props, employee) => (
                          <Box component="li" {...props}>
                            <Box>
                              <Typography variant="body1">
                                {employee.firstName} {employee.lastName}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                ID: {employee.employeeId} • Department: {employee.placementDepartment?.name || 'N/A'}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                        noOptionsText="No employees found"
                        loading={loading}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        select
                        label="Increment Type *"
                        value={formData.incrementType}
                        onChange={(e) => handleInputChange('incrementType', e.target.value)}
                        required
                      >
                        {incrementTypes.map((type) => (
                          <MenuItem key={type.value} value={type.value}>
                            {type.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="New Salary *"
                        type="number"
                        value={formData.newSalary}
                        onChange={(e) => handleInputChange('newSalary', e.target.value)}
                        placeholder="Enter new salary amount"
                        required
                        InputProps={{
                          startAdornment: <Typography sx={{ mr: 1 }}>Rs.</Typography>
                        }}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <DatePicker
                        label="Effective Date *"
                        value={formData.effectiveDate}
                        onChange={(date) => handleInputChange('effectiveDate', date)}
                        renderInput={(params) => <TextField {...params} fullWidth required />}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Reason *"
                        value={formData.reason}
                        onChange={(e) => handleInputChange('reason', e.target.value)}
                        placeholder="Enter reason for increment..."
                        required
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Box display="flex" gap={2}>
                        <Button
                          type="submit"
                          variant="contained"
                          startIcon={<SaveIcon />}
                          disabled={saving}
                          size="large"
                        >
                          {saving ? <CircularProgress size={20} /> : 'Create Increment Request'}
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => navigate('/hr/increments')}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </form>
              </CardContent>
            </Card>
          </Grid>

          {/* Calculation Preview */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Increment Calculation
                </Typography>
                
                {selectedEmployee ? (
                  <Box>
                    <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Current Salary
                      </Typography>
                      <Typography variant="h6">
                        Rs. {selectedEmployee.salary?.gross?.toLocaleString() || 'N/A'}
                      </Typography>
                    </Paper>

                    {incrementCalculation && (
                      <>
                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.50' }}>
                          <Typography variant="subtitle2" color="textSecondary">
                            New Salary
                          </Typography>
                          <Typography variant="h6">
                            Rs. {formData.newSalary ? parseFloat(formData.newSalary).toLocaleString() : 'N/A'}
                          </Typography>
                        </Paper>

                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'success.50' }}>
                          <Typography variant="subtitle2" color="textSecondary">
                            Increment Amount
                          </Typography>
                          <Typography variant="h6" color="success.main">
                            Rs. {incrementCalculation.incrementAmount.toLocaleString()}
                          </Typography>
                        </Paper>

                        <Paper sx={{ p: 2, bgcolor: 'info.50' }}>
                          <Typography variant="subtitle2" color="textSecondary">
                            Increment Percentage
                          </Typography>
                          <Typography variant="h6" color="info.main">
                            {incrementCalculation.incrementPercentage}%
                          </Typography>
                        </Paper>
                      </>
                    )}
                  </Box>
                ) : (
                  <Typography color="textSecondary">
                    Select an employee to see calculation preview
                  </Typography>
                )}

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" color="textSecondary">
                  <strong>Note:</strong> This increment will be applied to the employee's salary and will affect all future payroll calculations.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default CreateIncrement;
