import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Alert,
  Snackbar,
  CircularProgress,
  Container,
  useTheme,
  alpha,
  Stepper,
  Step,
  StepLabel,
  Divider,
  Chip,
  Stack
} from '@mui/material';
import {
  Save,
  Cancel,
  ArrowBack,
  Work,
  Business,
  Description,
  AttachMoney,
  Schedule,
  LocationOn
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import jobPostingService from '../../services/jobPostingService';

// Step-specific validation schemas
const stepValidationSchemas = [
  // Step 1: Basic Information
  Yup.object({
    title: Yup.string().required('Job title is required'),
    department: Yup.string().required('Department is required'),
    location: Yup.string().required('Location is required'),
    position: Yup.string().required('Position is required'),
    numberOfPositions: Yup.number().min(1, 'Number of positions must be at least 1')
  }),
  
  // Step 2: Job Details
  Yup.object({
    employmentType: Yup.string().required('Employment type is required'),
    experienceLevel: Yup.string().required('Experience level is required'),
    educationLevel: Yup.string().required('Education level is required')
  }),
  
  // Step 3: Compensation & Benefits
  Yup.object({
    minSalary: Yup.number().min(0, 'Minimum salary must be positive'),
    maxSalary: Yup.number().min(0, 'Maximum salary must be positive')
  }),
  
  // Step 4: Application Details
  Yup.object({
    applicationDeadline: Yup.date().min(new Date(), 'Deadline must be in the future')
  })
];

// Complete validation schema for final submission
const completeValidationSchema = Yup.object({
  title: Yup.string().required('Job title is required'),
  department: Yup.string().required('Department is required'),
  location: Yup.string().required('Location is required'),
  position: Yup.string().required('Position is required'),
  employmentType: Yup.string().required('Employment type is required'),
  experienceLevel: Yup.string().required('Experience level is required'),
  educationLevel: Yup.string().required('Education level is required'),
  minSalary: Yup.number().min(0, 'Minimum salary must be positive'),
  maxSalary: Yup.number().min(0, 'Maximum salary must be positive'),
  applicationDeadline: Yup.date().min(new Date(), 'Deadline must be in the future')
});

const JobPostingForm = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  // State
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [positions, setPositions] = useState([]);
  const [activeStep, setActiveStep] = useState(0);
  const [editData, setEditData] = useState(null);

  // Steps for the form
  const steps = ['Basic Information', 'Job Details', 'Compensation & Benefits', 'Application Details'];

  // Load departments, locations, and positions
  const loadDropdownData = async () => {
    try {
      // Fetch departments from API
      const departmentsResponse = await fetch('/api/hr/departments', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (departmentsResponse.ok) {
        const departmentsData = await departmentsResponse.json();
        setDepartments(departmentsData.data || []);
      }

      // Fetch locations from API
      const locationsResponse = await fetch('/api/locations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (locationsResponse.ok) {
        const locationsData = await locationsResponse.json();
        setLocations(locationsData.data || []);
      }

      // Fetch all positions from API
      const positionsResponse = await fetch('/api/hr/positions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (positionsResponse.ok) {
        const positionsData = await positionsResponse.json();
        setPositions(positionsData.data || []);
      }
    } catch (error) {
      console.error('Error loading dropdown data:', error);
      setSnackbar({
        open: true,
        message: 'Error loading dropdown data',
        severity: 'error'
      });
    }
  };

  // Load job posting data for editing
  const loadJobPosting = async () => {
    if (!isEditing) return;
    
    setInitialLoading(true);
    try {
      const response = await jobPostingService.getJobPostingById(id);
      
      // Format the data for the form
      const formattedData = {
        title: response.data.title || '',
        department: response.data.department?._id || response.data.department || '',
        position: response.data.position?._id || response.data.position || '',
        location: response.data.location?._id || response.data.location || '',
        description: response.data.description || '',
        requirements: response.data.requirements || '',
        responsibilities: response.data.responsibilities || '',
        qualifications: response.data.qualifications || '',
        employmentType: response.data.employmentType || '',
        experienceLevel: response.data.experienceLevel || '',
        educationLevel: response.data.educationLevel || '',
        minSalary: response.data.salaryRange?.min || '',
        maxSalary: response.data.salaryRange?.max || '',
        currency: response.data.salaryRange?.currency || 'PKR',
        benefits: response.data.benefits?.join(', ') || '',
        applicationDeadline: response.data.applicationDeadline ? new Date(response.data.applicationDeadline).toISOString().split('T')[0] : '',
        numberOfPositions: response.data.positionsAvailable || 1,
        isRemote: response.data.isRemote || false
      };
      
      setEditData(formattedData);
      setInitialLoading(false);
    } catch (error) {
      console.error('Error loading job posting:', error);
      setSnackbar({
        open: true,
        message: 'Error loading job posting',
        severity: 'error'
      });
      setInitialLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadDropdownData();
    if (isEditing) {
      loadJobPosting();
    }
  }, [isEditing, id]);

  // Handle form submission
  const handleSubmit = async (values, { setSubmitting }) => {
    setLoading(true);
    try {
      // Format data for API
      const jobPostingData = {
        title: values.title,
        department: values.department,
        position: values.position,
        location: values.location,
        description: values.description || 'Job description',
        requirements: values.requirements || 'Requirements will be specified',
        responsibilities: values.responsibilities || 'Responsibilities will be specified',
        qualifications: values.qualifications || 'Qualifications will be specified',
        employmentType: values.employmentType,
        experienceLevel: values.experienceLevel,
        educationLevel: values.educationLevel,
        salaryRange: {
          min: parseInt(values.minSalary) || 0,
          max: parseInt(values.maxSalary) || 0,
          currency: values.currency || 'PKR'
        },
        benefits: values.benefits ? values.benefits.split(',').map(b => b.trim()).filter(b => b) : [],
        applicationDeadline: values.applicationDeadline,
        positionsAvailable: parseInt(values.numberOfPositions) || 1
      };



      if (isEditing) {
        await jobPostingService.updateJobPosting(id, jobPostingData);
        setSnackbar({
          open: true,
          message: 'Job posting updated successfully',
          severity: 'success'
        });
      } else {
        await jobPostingService.createJobPosting(jobPostingData);
        setSnackbar({
          open: true,
          message: 'Job posting created successfully',
          severity: 'success'
        });
      }
      
      // Navigate back to job postings list
      setTimeout(() => {
        navigate('/hr/talent-acquisition/job-postings');
      }, 1500);
    } catch (error) {
      console.error('Error submitting job posting:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error saving job posting',
        severity: 'error'
      });
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  // Handle step navigation with validation
  const handleNext = async (values, { setFieldError, setTouched }) => {
    try {
      // Validate current step
      await stepValidationSchemas[activeStep].validate(values, { abortEarly: false });
      setActiveStep((prevStep) => prevStep + 1);
    } catch (validationErrors) {
      // Set errors for current step fields
      validationErrors.inner.forEach((error) => {
        setFieldError(error.path, error.message);
        setTouched({ [error.path]: true });
      });
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  // Handle department change to load positions for that department
  const handleDepartmentChange = async (departmentId, setFieldValue) => {
    if (!departmentId) return;
    
    try {
      const response = await fetch(`/api/hr/positions/${departmentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const positionsData = await response.json();
        setPositions(positionsData.data || []);
        // Clear position selection when department changes
        setFieldValue('position', '');
      }
    } catch (error) {
      console.error('Error loading positions for department:', error);
    }
  };

  // Check if current step is valid
  const isCurrentStepValid = (values, errors) => {
    if (activeStep === 0) {
      // Step 1: Basic Information
      const hasTitle = values.title && values.title.trim() !== '';
      const hasDepartment = values.department && values.department.trim() !== '';
      const hasLocation = values.location && values.location.trim() !== '';
      const hasPosition = values.position && values.position.trim() !== '';
      const hasNumberOfPositions = values.numberOfPositions && values.numberOfPositions > 0;
      

      return hasTitle && hasDepartment && hasLocation && hasPosition && hasNumberOfPositions;
    }
    
    if (activeStep === 1) {
      // Step 2: Job Details
      const hasEmploymentType = values.employmentType && values.employmentType.trim() !== '';
      const hasExperienceLevel = values.experienceLevel && values.experienceLevel.trim() !== '';
      const hasEducationLevel = values.educationLevel && values.educationLevel.trim() !== '';
      

      return hasEmploymentType && hasExperienceLevel && hasEducationLevel;
    }
    
    if (activeStep === 2) {
      // Step 3: Compensation & Benefits
      const hasMinSalary = values.minSalary && values.minSalary > 0;
      const hasMaxSalary = values.maxSalary && values.maxSalary > 0;
      

      return hasMinSalary && hasMaxSalary;
    }
    
    if (activeStep === 3) {
      // Step 4: Application Details
      const hasDeadline = values.applicationDeadline && values.applicationDeadline.trim() !== '';
      

      return hasDeadline;
    }
    
    return false;
  };

  // Initial values
  const initialValues = {
    title: '',
    department: '',
    location: '',
    position: '',
    employmentType: '',
    experienceLevel: '',
    educationLevel: '',
    minSalary: '',
    maxSalary: '',
    currency: 'PKR',
    benefits: '',
    requirements: '',
    responsibilities: '',
    qualifications: '',
    applicationDeadline: '',
    numberOfPositions: 1,
    isRemote: false,
    description: ''
  };

  if (initialLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/hr/talent-acquisition/job-postings')}
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography variant="h4" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
            {isEditing ? 'Edit Job Posting' : 'Create Job Posting'}
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          {isEditing ? 'Update job posting details' : 'Create a new job posting'}
        </Typography>
      </Box>

      {/* Stepper */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Form */}
      <Formik
        initialValues={editData || initialValues}
        validationSchema={completeValidationSchema}
        onSubmit={handleSubmit}
        enableReinitialize={true}
      >
        {({ values, errors, touched, handleChange, handleBlur, isValid, dirty, setFieldError, setTouched, setFieldValue }) => (
          <Form>
            <Card>
              <CardContent>
                {/* Step 1: Basic Information */}
                {activeStep === 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <Work sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Basic Information
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={8}>
                        <TextField
                          fullWidth
                          name="title"
                          label="Job Title"
                          value={values.title}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.title && Boolean(errors.title)}
                          helperText={touched.title && errors.title}
                          placeholder="e.g., Senior Software Engineer"
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          name="numberOfPositions"
                          label="Number of Positions"
                          type="number"
                          value={values.numberOfPositions}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          inputProps={{ min: 1 }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth error={touched.department && Boolean(errors.department)}>
                          <InputLabel>Department</InputLabel>
                          <Select
                            name="department"
                            value={values.department}
                            onChange={(e) => {
                              handleChange(e);
                              handleDepartmentChange(e.target.value, setFieldValue);
                            }}
                            onBlur={handleBlur}
                            label="Department"
                          >
                            {departments.map((dept) => (
                              <MenuItem key={dept._id} value={dept._id}>
                                {dept.name}
                              </MenuItem>
                            ))}
                          </Select>
                          {touched.department && errors.department && (
                            <FormHelperText>{errors.department}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth error={touched.location && Boolean(errors.location)}>
                          <InputLabel>Location</InputLabel>
                          <Select
                            name="location"
                            value={values.location}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            label="Location"
                          >
                            {locations.map((loc) => (
                              <MenuItem key={loc._id} value={loc._id}>
                                {loc.name}
                              </MenuItem>
                            ))}
                          </Select>
                          {touched.location && errors.location && (
                            <FormHelperText>{errors.location}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth error={touched.position && Boolean(errors.position)}>
                          <InputLabel>Position</InputLabel>
                          <Select
                            name="position"
                            value={values.position}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            label="Position"
                          >
                            {positions.map((pos) => (
                              <MenuItem key={pos._id} value={pos._id}>
                                {pos.title}
                              </MenuItem>
                            ))}
                          </Select>
                          {touched.position && errors.position && (
                            <FormHelperText>{errors.position}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          name="description"
                          label="Job Description"
                          multiline
                          rows={4}
                          value={values.description}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="Provide a brief overview of the role..."
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Step 2: Job Details */}
                {activeStep === 1 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <Description sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Job Details
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth error={touched.employmentType && Boolean(errors.employmentType)}>
                          <InputLabel>Employment Type</InputLabel>
                          <Select
                            name="employmentType"
                            value={values.employmentType}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            label="Employment Type"
                          >
                            <MenuItem value="full_time">Full Time</MenuItem>
                            <MenuItem value="part_time">Part Time</MenuItem>
                            <MenuItem value="contract">Contract</MenuItem>
                            <MenuItem value="internship">Internship</MenuItem>
                            <MenuItem value="temporary">Temporary</MenuItem>
                          </Select>
                          {touched.employmentType && errors.employmentType && (
                            <FormHelperText>{errors.employmentType}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth error={touched.experienceLevel && Boolean(errors.experienceLevel)}>
                          <InputLabel>Experience Level</InputLabel>
                          <Select
                            name="experienceLevel"
                            value={values.experienceLevel}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            label="Experience Level"
                          >
                            <MenuItem value="entry">Entry Level</MenuItem>
                            <MenuItem value="junior">Junior</MenuItem>
                            <MenuItem value="mid">Mid Level</MenuItem>
                            <MenuItem value="senior">Senior</MenuItem>
                            <MenuItem value="lead">Lead</MenuItem>
                            <MenuItem value="manager">Manager</MenuItem>
                            <MenuItem value="director">Director</MenuItem>
                            <MenuItem value="executive">Executive</MenuItem>
                          </Select>
                          {touched.experienceLevel && errors.experienceLevel && (
                            <FormHelperText>{errors.experienceLevel}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth error={touched.educationLevel && Boolean(errors.educationLevel)}>
                          <InputLabel>Education Level</InputLabel>
                          <Select
                            name="educationLevel"
                            value={values.educationLevel}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            label="Education Level"
                          >
                            <MenuItem value="high_school">High School</MenuItem>
                            <MenuItem value="diploma">Diploma</MenuItem>
                            <MenuItem value="bachelors">Bachelor's Degree</MenuItem>
                            <MenuItem value="masters">Master's Degree</MenuItem>
                            <MenuItem value="phd">PhD</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                          </Select>
                          {touched.educationLevel && errors.educationLevel && (
                            <FormHelperText>{errors.educationLevel}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          name="requirements"
                          label="Requirements"
                          multiline
                          rows={3}
                          value={values.requirements}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="List the key requirements for this position..."
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          name="responsibilities"
                          label="Responsibilities"
                          multiline
                          rows={3}
                          value={values.responsibilities}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="Describe the main responsibilities..."
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          name="qualifications"
                          label="Qualifications"
                          multiline
                          rows={3}
                          value={values.qualifications}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="List preferred qualifications..."
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Step 3: Compensation & Benefits */}
                {activeStep === 2 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Compensation & Benefits
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          name="minSalary"
                          label="Minimum Salary"
                          type="number"
                          value={values.minSalary}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.minSalary && Boolean(errors.minSalary)}
                          helperText={touched.minSalary && errors.minSalary}
                          InputProps={{
                            startAdornment: <Typography variant="body2" sx={{ mr: 1 }}>PKR</Typography>
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          name="maxSalary"
                          label="Maximum Salary"
                          type="number"
                          value={values.maxSalary}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.maxSalary && Boolean(errors.maxSalary)}
                          helperText={touched.maxSalary && errors.maxSalary}
                          InputProps={{
                            startAdornment: <Typography variant="body2" sx={{ mr: 1 }}>PKR</Typography>
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          name="benefits"
                          label="Benefits & Perks"
                          multiline
                          rows={3}
                          value={values.benefits}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="List the benefits and perks offered..."
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Step 4: Application Details */}
                {activeStep === 3 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Application Details
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          name="applicationDeadline"
                          label="Application Deadline"
                          type="date"
                          value={values.applicationDeadline}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.applicationDeadline && Boolean(errors.applicationDeadline)}
                          helperText={touched.applicationDeadline && errors.applicationDeadline}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Remote Work</InputLabel>
                          <Select
                            name="isRemote"
                            value={values.isRemote}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            label="Remote Work"
                          >
                            <MenuItem value={false}>On-site</MenuItem>
                            <MenuItem value={true}>Remote</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Navigation Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                  <Button
                    disabled={activeStep === 0}
                    onClick={handleBack}
                    startIcon={<ArrowBack />}
                  >
                    Back
                  </Button>
                  
                  <Box>
                    {activeStep === steps.length - 1 ? (
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={loading || !isValid}
                        startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                      >
                        {loading ? 'Saving...' : (isEditing ? 'Update Job Posting' : 'Create Job Posting')}
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={() => handleNext(values, { setFieldError, setTouched })}
                        disabled={!isCurrentStepValid(values, errors)}
                      >
                        Next
                      </Button>
                    )}
                  </Box>
                </Box>
                

              </CardContent>
            </Card>
          </Form>
        )}
      </Formik>

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
    </Container>
  );
};

export default JobPostingForm; 