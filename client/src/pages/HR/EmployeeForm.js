import React, { useState, useEffect } from 'react';
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
  FormControlLabel,
  Switch,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Avatar,
  Alert,
  Snackbar,
  Divider,
  Chip
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  ContactPhone as ContactIcon,
  School as EducationIcon,
  AttachMoney as SalaryIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import api from '../../services/authService';

const steps = ['Personal Information', 'Employment Details', 'Contact & Address', 'Salary & Benefits'];

const EmployeeForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [employee, setEmployee] = useState(null);

  // Validation schema
  const validationSchema = Yup.object({
    firstName: Yup.string().required('First name is required'),
    lastName: Yup.string().required('Last name is required'),
    email: Yup.string().email('Invalid email').required('Email is required'),
    phone: Yup.string().required('Phone is required'),
    dateOfBirth: Yup.date().required('Date of birth is required'),
    gender: Yup.string().required('Gender is required'),
    employeeId: Yup.string().required('Employee ID is required'),
    department: Yup.string().required('Department is required'),
    position: Yup.string().required('Position is required'),
    hireDate: Yup.date().required('Hire date is required'),
    salary: Yup.number().positive('Salary must be positive').required('Salary is required'),
    address: Yup.object({
      street: Yup.string().required('Street address is required'),
      city: Yup.string().required('City is required'),
      state: Yup.string().required('State is required'),
      zipCode: Yup.string().required('ZIP code is required'),
      country: Yup.string().required('Country is required')
    })
  });

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      const response = await api.get('/hr/departments');
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  // Fetch employee for editing
  const fetchEmployee = async () => {
    if (!id || id === 'add') return;
    
    try {
      setLoading(true);
      const response = await api.get(`/hr/employees/${id}`);
      setEmployee(response.data.data);
      formik.setValues({
        ...response.data.data,
        dateOfBirth: response.data.data.dateOfBirth ? new Date(response.data.data.dateOfBirth).toISOString().split('T')[0] : '',
        hireDate: response.data.data.hireDate ? new Date(response.data.data.hireDate).toISOString().split('T')[0] : ''
      });
    } catch (error) {
      console.error('Error fetching employee:', error);
      setSnackbar({
        open: true,
        message: 'Error fetching employee details',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
    if (id && id !== 'add') {
      fetchEmployee();
    }
  }, [id]);

  const formik = useFormik({
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      gender: '',
      employeeId: '',
      department: '',
      position: '',
      hireDate: '',
      salary: '',
      isActive: true,
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      emergencyContact: {
        name: '',
        relationship: '',
        phone: ''
      }
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        
        if (id && id !== 'add') {
          // Update existing employee
          await api.put(`/hr/employees/${id}`, values);
          setSnackbar({
            open: true,
            message: 'Employee updated successfully',
            severity: 'success'
          });
        } else {
          // Create new employee
          await api.post('/hr/employees', values);
          setSnackbar({
            open: true,
            message: 'Employee created successfully',
            severity: 'success'
          });
        }
        
        setTimeout(() => {
          navigate('/hr/employees');
        }, 1500);
      } catch (error) {
        console.error('Error saving employee:', error);
        setSnackbar({
          open: true,
          message: error.response?.data?.message || 'Error saving employee',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    }
  });

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleStepClick = (step) => {
    setActiveStep(step);
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="firstName"
                label="First Name"
                value={formik.values.firstName}
                onChange={formik.handleChange}
                error={formik.touched.firstName && Boolean(formik.errors.firstName)}
                helperText={formik.touched.firstName && formik.errors.firstName}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="lastName"
                label="Last Name"
                value={formik.values.lastName}
                onChange={formik.handleChange}
                error={formik.touched.lastName && Boolean(formik.errors.lastName)}
                helperText={formik.touched.lastName && formik.errors.lastName}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="email"
                label="Email"
                type="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                error={formik.touched.email && Boolean(formik.errors.email)}
                helperText={formik.touched.email && formik.errors.email}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="phone"
                label="Phone"
                value={formik.values.phone}
                onChange={formik.handleChange}
                error={formik.touched.phone && Boolean(formik.errors.phone)}
                helperText={formik.touched.phone && formik.errors.phone}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="dateOfBirth"
                label="Date of Birth"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formik.values.dateOfBirth}
                onChange={formik.handleChange}
                error={formik.touched.dateOfBirth && Boolean(formik.errors.dateOfBirth)}
                helperText={formik.touched.dateOfBirth && formik.errors.dateOfBirth}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  name="gender"
                  value={formik.values.gender}
                  onChange={formik.handleChange}
                  error={formik.touched.gender && Boolean(formik.errors.gender)}
                  label="Gender"
                >
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="employeeId"
                label="Employee ID"
                value={formik.values.employeeId}
                onChange={formik.handleChange}
                error={formik.touched.employeeId && Boolean(formik.errors.employeeId)}
                helperText={formik.touched.employeeId && formik.errors.employeeId}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  name="department"
                  value={formik.values.department}
                  onChange={formik.handleChange}
                  error={formik.touched.department && Boolean(formik.errors.department)}
                  label="Department"
                >
                  {departments.map((dept) => (
                    <MenuItem key={dept._id} value={dept.name}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="position"
                label="Position"
                value={formik.values.position}
                onChange={formik.handleChange}
                error={formik.touched.position && Boolean(formik.errors.position)}
                helperText={formik.touched.position && formik.errors.position}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="hireDate"
                label="Hire Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formik.values.hireDate}
                onChange={formik.handleChange}
                error={formik.touched.hireDate && Boolean(formik.errors.hireDate)}
                helperText={formik.touched.hireDate && formik.errors.hireDate}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="salary"
                label="Salary"
                type="number"
                value={formik.values.salary}
                onChange={formik.handleChange}
                error={formik.touched.salary && Boolean(formik.errors.salary)}
                helperText={formik.touched.salary && formik.errors.salary}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    name="isActive"
                    checked={formik.values.isActive}
                    onChange={formik.handleChange}
                  />
                }
                label="Active Employee"
              />
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Address Information
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="address.street"
                label="Street Address"
                value={formik.values.address.street}
                onChange={formik.handleChange}
                error={formik.touched.address?.street && Boolean(formik.errors.address?.street)}
                helperText={formik.touched.address?.street && formik.errors.address?.street}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="address.city"
                label="City"
                value={formik.values.address.city}
                onChange={formik.handleChange}
                error={formik.touched.address?.city && Boolean(formik.errors.address?.city)}
                helperText={formik.touched.address?.city && formik.errors.address?.city}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="address.state"
                label="State/Province"
                value={formik.values.address.state}
                onChange={formik.handleChange}
                error={formik.touched.address?.state && Boolean(formik.errors.address?.state)}
                helperText={formik.touched.address?.state && formik.errors.address?.state}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="address.zipCode"
                label="ZIP/Postal Code"
                value={formik.values.address.zipCode}
                onChange={formik.handleChange}
                error={formik.touched.address?.zipCode && Boolean(formik.errors.address?.zipCode)}
                helperText={formik.touched.address?.zipCode && formik.errors.address?.zipCode}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="address.country"
                label="Country"
                value={formik.values.address.country}
                onChange={formik.handleChange}
                error={formik.touched.address?.country && Boolean(formik.errors.address?.country)}
                helperText={formik.touched.address?.country && formik.errors.address?.country}
              />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Emergency Contact
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                name="emergencyContact.name"
                label="Emergency Contact Name"
                value={formik.values.emergencyContact.name}
                onChange={formik.handleChange}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                name="emergencyContact.relationship"
                label="Relationship"
                value={formik.values.emergencyContact.relationship}
                onChange={formik.handleChange}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                name="emergencyContact.phone"
                label="Emergency Contact Phone"
                value={formik.values.emergencyContact.phone}
                onChange={formik.handleChange}
              />
            </Grid>
          </Grid>
        );

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Salary & Benefits Summary
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <SalaryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Salary Information
                  </Typography>
                  <Typography variant="body1">
                    <strong>Base Salary:</strong> ${formik.values.salary?.toLocaleString() || '0'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Annual compensation
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <WorkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Employment Details
                  </Typography>
                  <Typography variant="body1">
                    <strong>Department:</strong> {formik.values.department}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Position:</strong> {formik.values.position}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Status:</strong> 
                    <Chip 
                      label={formik.values.isActive ? 'Active' : 'Inactive'} 
                      color={formik.values.isActive ? 'success' : 'error'} 
                      size="small" 
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info">
                Review all information before saving. You can go back to previous steps to make changes.
              </Alert>
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  if (loading && id && id !== 'add') {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading employee details...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {id ? 'Edit Employee' : 'Add New Employee'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={() => navigate('/hr/employees')}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={formik.handleSubmit}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Employee'}
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 3 }}>
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel onClick={() => handleStepClick(index)} sx={{ cursor: 'pointer' }}>
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step Content */}
        <Box sx={{ mb: 4 }}>
          {renderStepContent(activeStep)}
        </Box>

        {/* Navigation Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
          >
            Back
          </Button>
          <Box>
            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={formik.handleSubmit}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Employee'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
              >
                Next
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EmployeeForm; 