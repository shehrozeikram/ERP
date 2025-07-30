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

// Validation schema
const validationSchema = Yup.object({
  title: Yup.string().required('Job title is required'),
  department: Yup.string().required('Department is required'),
  location: Yup.string().required('Location is required'),
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
  const [activeStep, setActiveStep] = useState(0);

  // Steps for the form
  const steps = ['Basic Information', 'Job Details', 'Compensation & Benefits', 'Application Details'];

  // Load departments and locations
  const loadDropdownData = async () => {
    try {
      // In a real app, you'd fetch these from your API
      setDepartments([
        { _id: 'dept1', name: 'Information Technology' },
        { _id: 'dept2', name: 'Human Resources' },
        { _id: 'dept3', name: 'Marketing' },
        { _id: 'dept4', name: 'Finance' },
        { _id: 'dept5', name: 'Operations' }
      ]);
      
      setLocations([
        { _id: 'loc1', name: 'Karachi' },
        { _id: 'loc2', name: 'Lahore' },
        { _id: 'loc3', name: 'Islamabad' },
        { _id: 'loc4', name: 'Rawalpindi' },
        { _id: 'loc5', name: 'Faisalabad' }
      ]);
    } catch (error) {
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
      // Handle the response data
      setInitialLoading(false);
    } catch (error) {
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
      if (isEditing) {
        await jobPostingService.updateJobPosting(id, values);
        setSnackbar({
          open: true,
          message: 'Job posting updated successfully',
          severity: 'success'
        });
      } else {
        await jobPostingService.createJobPosting(values);
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

  // Handle step navigation
  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  // Initial values
  const initialValues = {
    title: '',
    department: '',
    location: '',
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
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ values, errors, touched, handleChange, handleBlur, isValid, dirty }) => (
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
                            onChange={handleChange}
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
                        disabled={loading || !isValid || !dirty}
                        startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                      >
                        {loading ? 'Saving...' : (isEditing ? 'Update Job Posting' : 'Create Job Posting')}
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={handleNext}
                        disabled={!isValid}
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