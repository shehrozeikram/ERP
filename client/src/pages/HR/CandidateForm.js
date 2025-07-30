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
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Save,
  Cancel,
  ArrowBack,
  Person,
  Business,
  School,
  Work,
  Description,
  Add,
  Delete
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import candidateService from '../../services/candidateService';

const CandidateForm = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  // State
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [activeStep, setActiveStep] = useState(0);
  const [editData, setEditData] = useState(null);

  // Steps for the form
  const steps = ['Personal Information', 'Professional Information', 'Education & Skills', 'Work Experience', 'Application Details'];

  // Load candidate data for editing
  const loadCandidate = async () => {
    if (!isEditing) return;
    
    setInitialLoading(true);
    try {
      const response = await candidateService.getCandidateById(id);
      
      // Format the data for the form
      const formattedData = {
        firstName: response.data.firstName || '',
        lastName: response.data.lastName || '',
        email: response.data.email || '',
        phone: response.data.phone || '',
        dateOfBirth: response.data.dateOfBirth ? new Date(response.data.dateOfBirth).toISOString().split('T')[0] : '',
        gender: response.data.gender || '',
        nationality: response.data.nationality || '',
        currentPosition: response.data.currentPosition || '',
        currentCompany: response.data.currentCompany || '',
        yearsOfExperience: response.data.yearsOfExperience || 0,
        expectedSalary: response.data.expectedSalary || '',
        noticePeriod: response.data.noticePeriod || 30,
        source: response.data.source || '',
        sourceDetails: response.data.sourceDetails || '',
        availability: response.data.availability || 'negotiable',
        preferredWorkType: response.data.preferredWorkType || 'on_site'
      };
      
      setEditData(formattedData);
      setInitialLoading(false);
    } catch (error) {
      console.error('Error loading candidate:', error);
      setSnackbar({
        open: true,
        message: 'Error loading candidate',
        severity: 'error'
      });
      setInitialLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    if (isEditing) {
      loadCandidate();
    }
  }, [isEditing, id]);

  // Check if current step is valid
  const isCurrentStepValid = (values, errors) => {
    if (activeStep === 0) {
      // Step 1: Personal Information
      const hasFirstName = values.firstName && values.firstName.trim() !== '';
      const hasLastName = values.lastName && values.lastName.trim() !== '';
      const hasEmail = values.email && values.email.trim() !== '';
      const hasPhone = values.phone && values.phone.trim() !== '';
      const hasDateOfBirth = values.dateOfBirth && values.dateOfBirth.trim() !== '';
      const hasGender = values.gender && values.gender.trim() !== '';
      const hasNationality = values.nationality && values.nationality.trim() !== '';
      
      return hasFirstName && hasLastName && hasEmail && hasPhone && hasDateOfBirth && hasGender && hasNationality;
    }
    
    if (activeStep === 1) {
      // Step 2: Professional Information
      const hasCurrentPosition = values.currentPosition && values.currentPosition.trim() !== '';
      const hasCurrentCompany = values.currentCompany && values.currentCompany.trim() !== '';
      const hasYearsOfExperience = values.yearsOfExperience !== undefined && values.yearsOfExperience >= 0;
      
      return hasCurrentPosition && hasCurrentCompany && hasYearsOfExperience;
    }
    
    if (activeStep === 2) {
      // Step 3: Education & Skills (placeholder for now)
      return true;
    }
    
    if (activeStep === 3) {
      // Step 4: Work Experience (placeholder for now)
      return true;
    }
    
    if (activeStep === 4) {
      // Step 5: Application Details
      const hasSource = values.source && values.source.trim() !== '';
      const hasAvailability = values.availability && values.availability.trim() !== '';
      const hasPreferredWorkType = values.preferredWorkType && values.preferredWorkType.trim() !== '';
      
      return hasSource && hasAvailability && hasPreferredWorkType;
    }
    
    return false;
  };

  // Initial values
  const initialValues = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    nationality: '',
    currentPosition: '',
    currentCompany: '',
    yearsOfExperience: 0,
    expectedSalary: '',
    noticePeriod: 30,
    education: [],
    workExperience: [],
    skills: [],
    source: '',
    sourceDetails: '',
    availability: 'negotiable',
    preferredWorkType: 'on_site'
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
            onClick={() => navigate('/hr/talent-acquisition/candidates')}
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography variant="h4" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
            {isEditing ? 'Edit Candidate' : 'Add Candidate'}
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          {isEditing ? 'Update candidate information' : 'Add a new candidate to the system'}
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
        validationSchema={Yup.object({
          firstName: Yup.string().required('First name is required'),
          lastName: Yup.string().required('Last name is required'),
          email: Yup.string().email('Invalid email format').required('Email is required'),
          phone: Yup.string().required('Phone number is required'),
          dateOfBirth: Yup.date().required('Date of birth is required'),
          gender: Yup.string().required('Gender is required'),
          nationality: Yup.string().required('Nationality is required'),
          currentPosition: Yup.string().required('Current position is required'),
          currentCompany: Yup.string().required('Current company is required'),
          yearsOfExperience: Yup.number().min(0, 'Years of experience must be positive'),
          source: Yup.string().required('Source is required'),
          availability: Yup.string().required('Availability is required'),
          preferredWorkType: Yup.string().required('Preferred work type is required')
        })}
        onSubmit={async (values, { setSubmitting }) => {
          setLoading(true);
          try {
            const candidateData = {
              firstName: values.firstName,
              lastName: values.lastName,
              email: values.email,
              phone: values.phone,
              dateOfBirth: values.dateOfBirth,
              gender: values.gender,
              nationality: values.nationality,
              currentPosition: values.currentPosition,
              currentCompany: values.currentCompany,
              yearsOfExperience: parseInt(values.yearsOfExperience) || 0,
              expectedSalary: parseInt(values.expectedSalary) || null,
              noticePeriod: parseInt(values.noticePeriod) || 30,
              source: values.source,
              sourceDetails: values.sourceDetails,
              availability: values.availability,
              preferredWorkType: values.preferredWorkType
            };

            if (isEditing) {
              await candidateService.updateCandidate(id, candidateData);
              setSnackbar({
                open: true,
                message: 'Candidate updated successfully',
                severity: 'success'
              });
            } else {
              await candidateService.createCandidate(candidateData);
              setSnackbar({
                open: true,
                message: 'Candidate created successfully',
                severity: 'success'
              });
            }
            
            setTimeout(() => {
              navigate('/hr/talent-acquisition/candidates');
            }, 1500);
          } catch (error) {
            console.error('Error submitting candidate:', error);
            setSnackbar({
              open: true,
              message: error.response?.data?.message || 'Error saving candidate',
              severity: 'error'
            });
          } finally {
            setLoading(false);
            setSubmitting(false);
          }
        }}
        enableReinitialize={true}
      >
        {({ values, errors, touched, handleChange, handleBlur, isValid, setFieldError, setTouched }) => (
          <Form>
            <Card>
              <CardContent>
                {/* Step 1: Personal Information */}
                {activeStep === 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Personal Information
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          name="firstName"
                          label="First Name"
                          value={values.firstName}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.firstName && Boolean(errors.firstName)}
                          helperText={touched.firstName && errors.firstName}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          name="lastName"
                          label="Last Name"
                          value={values.lastName}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.lastName && Boolean(errors.lastName)}
                          helperText={touched.lastName && errors.lastName}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          name="email"
                          label="Email"
                          type="email"
                          value={values.email}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.email && Boolean(errors.email)}
                          helperText={touched.email && errors.email}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          name="phone"
                          label="Phone Number"
                          value={values.phone}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.phone && Boolean(errors.phone)}
                          helperText={touched.phone && errors.phone}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          name="dateOfBirth"
                          label="Date of Birth"
                          type="date"
                          value={values.dateOfBirth}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.dateOfBirth && Boolean(errors.dateOfBirth)}
                          helperText={touched.dateOfBirth && errors.dateOfBirth}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth error={touched.gender && Boolean(errors.gender)}>
                          <InputLabel>Gender</InputLabel>
                          <Select
                            name="gender"
                            value={values.gender}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            label="Gender"
                          >
                            <MenuItem value="male">Male</MenuItem>
                            <MenuItem value="female">Female</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                          </Select>
                          {touched.gender && errors.gender && (
                            <FormHelperText>{errors.gender}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          name="nationality"
                          label="Nationality"
                          value={values.nationality}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.nationality && Boolean(errors.nationality)}
                          helperText={touched.nationality && errors.nationality}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Step 2: Professional Information */}
                {activeStep === 1 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Professional Information
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          name="currentPosition"
                          label="Current Position"
                          value={values.currentPosition}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.currentPosition && Boolean(errors.currentPosition)}
                          helperText={touched.currentPosition && errors.currentPosition}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          name="currentCompany"
                          label="Current Company"
                          value={values.currentCompany}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.currentCompany && Boolean(errors.currentCompany)}
                          helperText={touched.currentCompany && errors.currentCompany}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          name="yearsOfExperience"
                          label="Years of Experience"
                          type="number"
                          value={values.yearsOfExperience}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.yearsOfExperience && Boolean(errors.yearsOfExperience)}
                          helperText={touched.yearsOfExperience && errors.yearsOfExperience}
                          inputProps={{ min: 0 }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          name="expectedSalary"
                          label="Expected Salary (PKR)"
                          type="number"
                          value={values.expectedSalary}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          inputProps={{ min: 0 }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          name="noticePeriod"
                          label="Notice Period (Days)"
                          type="number"
                          value={values.noticePeriod}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          inputProps={{ min: 0 }}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Step 3: Education & Skills */}
                {activeStep === 2 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <School sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Education & Skills
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                      Education and skills information can be added later when needed.
                    </Typography>
                    
                    <Alert severity="info" sx={{ mb: 2 }}>
                      This section will be implemented in the next version with dynamic education and skills management.
                    </Alert>
                  </Box>
                )}

                {/* Step 4: Work Experience */}
                {activeStep === 3 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <Work sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Work Experience
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                      Work experience details can be added later when needed.
                    </Typography>
                    
                    <Alert severity="info" sx={{ mb: 2 }}>
                      This section will be implemented in the next version with dynamic work experience management.
                    </Alert>
                  </Box>
                )}

                {/* Step 5: Application Details */}
                {activeStep === 4 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <Description sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Application Details
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth error={touched.source && Boolean(errors.source)}>
                          <InputLabel>Source</InputLabel>
                          <Select
                            name="source"
                            value={values.source}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            label="Source"
                          >
                            <MenuItem value="website">Company Website</MenuItem>
                            <MenuItem value="job_board">Job Board</MenuItem>
                            <MenuItem value="referral">Employee Referral</MenuItem>
                            <MenuItem value="social_media">Social Media</MenuItem>
                            <MenuItem value="recruitment_agency">Recruitment Agency</MenuItem>
                            <MenuItem value="direct_application">Direct Application</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                          </Select>
                          {touched.source && errors.source && (
                            <FormHelperText>{errors.source}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          name="sourceDetails"
                          label="Source Details"
                          value={values.sourceDetails}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="Additional details about the source"
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth error={touched.availability && Boolean(errors.availability)}>
                          <InputLabel>Availability</InputLabel>
                          <Select
                            name="availability"
                            value={values.availability}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            label="Availability"
                          >
                            <MenuItem value="immediate">Immediate</MenuItem>
                            <MenuItem value="2_weeks">2 Weeks</MenuItem>
                            <MenuItem value="1_month">1 Month</MenuItem>
                            <MenuItem value="2_months">2 Months</MenuItem>
                            <MenuItem value="3_months">3 Months</MenuItem>
                            <MenuItem value="negotiable">Negotiable</MenuItem>
                          </Select>
                          {touched.availability && errors.availability && (
                            <FormHelperText>{errors.availability}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth error={touched.preferredWorkType && Boolean(errors.preferredWorkType)}>
                          <InputLabel>Preferred Work Type</InputLabel>
                          <Select
                            name="preferredWorkType"
                            value={values.preferredWorkType}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            label="Preferred Work Type"
                          >
                            <MenuItem value="on_site">On-Site</MenuItem>
                            <MenuItem value="remote">Remote</MenuItem>
                            <MenuItem value="hybrid">Hybrid</MenuItem>
                          </Select>
                          {touched.preferredWorkType && errors.preferredWorkType && (
                            <FormHelperText>{errors.preferredWorkType}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Navigation Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                  <Button
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep((prevStep) => prevStep - 1)}
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
                        {loading ? 'Saving...' : (isEditing ? 'Update Candidate' : 'Create Candidate')}
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={() => setActiveStep((prevStep) => prevStep + 1)}
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

export default CandidateForm; 