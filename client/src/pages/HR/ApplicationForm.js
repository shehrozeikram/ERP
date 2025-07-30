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
  Stepper,
  Step,
  StepLabel,
  Divider,
  Chip,
  Stack
} from '@mui/material';
import {
  Person,
  Business,
  Description,
  School,
  Work,
  Save,
  ArrowBack,
  Assignment,
  Schedule,
  AttachFile
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import applicationService from '../../services/applicationService';
import candidateService from '../../services/candidateService';
import jobPostingService from '../../services/jobPostingService';

const ApplicationForm = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [activeStep, setActiveStep] = useState(0);
  const [editData, setEditData] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [jobPostings, setJobPostings] = useState([]);
  
  const isEditing = Boolean(id);
  
  const steps = [
    'Basic Information',
    'Job & Candidate',
    'Application Details',
    'Documents',
    'Review & Submit'
  ];
  
  const loadDropdownData = async () => {
    try {
      const candidatesResponse = await candidateService.getCandidates();
      setCandidates(candidatesResponse.data.docs || []);
      
      const jobPostingsResponse = await jobPostingService.getJobPostings();
      setJobPostings(jobPostingsResponse.data.docs || []);
    } catch (error) {
      console.error('Error loading dropdown data:', error);
      setSnackbar({
        open: true,
        message: 'Error loading dropdown data',
        severity: 'error'
      });
    }
  };
  
  const loadApplication = async () => {
    if (!isEditing) return;
    
    setLoading(true);
    try {
      const response = await applicationService.getApplicationById(id);
      const application = response.data;
      
      const formattedData = {
        jobPosting: application.jobPosting?._id || '',
        candidate: application.candidate?._id || '',
        coverLetter: application.coverLetter || '',
        expectedSalary: application.expectedSalary || '',
        availability: application.availability || 'negotiable',
        status: application.status || 'applied'
      };
      
      setEditData(formattedData);
    } catch (error) {
      console.error('Error loading application:', error);
      setSnackbar({
        open: true,
        message: 'Error loading application',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadDropdownData();
    loadApplication();
  }, [isEditing, id]);
  
  // Handle candidate selection to auto-fill expected salary
  const handleCandidateChange = (candidateId, setFieldValue) => {
    if (candidateId) {
      const selectedCandidate = candidates.find(candidate => candidate._id === candidateId);
      if (selectedCandidate && selectedCandidate.expectedSalary) {
        setFieldValue('expectedSalary', selectedCandidate.expectedSalary);
      }
    }
  };

  const isCurrentStepValid = (values, errors) => {
    if (activeStep === 0) {
      const hasJobPosting = values.jobPosting && values.jobPosting.trim() !== '';
      const hasCandidate = values.candidate && values.candidate.trim() !== '';
      return hasJobPosting && hasCandidate;
    }
    
    if (activeStep === 1) return true;
    
    if (activeStep === 2) {
      const hasAvailability = values.availability && values.availability.trim() !== '';
      const hasStatus = values.status && values.status.trim() !== '';
      return hasAvailability && hasStatus;
    }
    
    if (activeStep === 3) return true; // Documents step
    
    return true;
  };
  
  const initialValues = {
    jobPosting: '',
    candidate: '',
    coverLetter: '',
    expectedSalary: '',
    availability: 'negotiable',
    status: 'applied'
  };
  
  const validationSchema = Yup.object({
    jobPosting: Yup.string().required('Job posting is required'),
    candidate: Yup.string().required('Candidate is required'),
    coverLetter: Yup.string(),
    expectedSalary: Yup.number().min(0, 'Expected salary must be positive'),
    availability: Yup.string().required('Availability is required'),
    status: Yup.string().required('Status is required')
  });
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
          {isEditing ? 'Edit Application' : 'Create Application'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {isEditing ? 'Update application details' : 'Create a new job application'}
        </Typography>
      </Box>
      
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
      
      <Formik
        initialValues={editData || initialValues}
        validationSchema={validationSchema}
        onSubmit={async (values, { setSubmitting }) => {
          setLoading(true);
          try {
            const applicationData = {
              jobPosting: values.jobPosting,
              candidate: values.candidate,
              coverLetter: values.coverLetter,
              expectedSalary: parseInt(values.expectedSalary) || null,
              availability: values.availability,
              status: values.status
            };

            if (isEditing) {
              await applicationService.updateApplication(id, applicationData);
              setSnackbar({
                open: true,
                message: 'Application updated successfully',
                severity: 'success'
              });
            } else {
              await applicationService.createApplication(applicationData);
              setSnackbar({
                open: true,
                message: 'Application created successfully',
                severity: 'success'
              });
            }
            
            setTimeout(() => {
              navigate('/hr/talent-acquisition/applications');
            }, 1500);
          } catch (error) {
            console.error('Error submitting application:', error);
            setSnackbar({
              open: true,
              message: error.response?.data?.message || 'Error saving application',
              severity: 'error'
            });
          } finally {
            setLoading(false);
            setSubmitting(false);
          }
        }}
        enableReinitialize={true}
      >
        {({ values, errors, touched, handleChange, handleBlur, isValid, setFieldValue }) => (
          <Form>
            <Card>
              <CardContent>
                {activeStep === 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <Assignment sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Basic Information
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth error={touched.jobPosting && Boolean(errors.jobPosting)}>
                          <InputLabel>Job Posting</InputLabel>
                          <Select
                            name="jobPosting"
                            value={values.jobPosting}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            label="Job Posting"
                          >
                            {jobPostings.map((job) => (
                              <MenuItem key={job._id} value={job._id}>
                                {job.title} - {job.jobCode}
                              </MenuItem>
                            ))}
                          </Select>
                          {touched.jobPosting && errors.jobPosting && (
                            <FormHelperText>{errors.jobPosting}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth error={touched.candidate && Boolean(errors.candidate)}>
                          <InputLabel>Candidate</InputLabel>
                          <Select
                            name="candidate"
                            value={values.candidate}
                            onChange={(e) => {
                              handleChange(e);
                              handleCandidateChange(e.target.value, setFieldValue);
                            }}
                            onBlur={handleBlur}
                            label="Candidate"
                          >
                            {candidates.map((candidate) => (
                              <MenuItem key={candidate._id} value={candidate._id}>
                                {candidate.firstName} {candidate.lastName} - {candidate.email}
                              </MenuItem>
                            ))}
                          </Select>
                          {touched.candidate && errors.candidate && (
                            <FormHelperText>{errors.candidate}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {activeStep === 1 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Job & Candidate Details
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    {values.jobPosting && values.candidate && (
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                Selected Job
                              </Typography>
                              {(() => {
                                const selectedJob = jobPostings.find(job => job._id === values.jobPosting);
                                return selectedJob ? (
                                  <Box>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                      {selectedJob.title}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {selectedJob.jobCode}
                                    </Typography>
                                    <Chip 
                                      label={selectedJob.status} 
                                      color="primary" 
                                      size="small" 
                                      sx={{ mt: 1 }}
                                    />
                                  </Box>
                                ) : (
                                  <Typography color="text.secondary">Job not found</Typography>
                                );
                              })()}
                            </CardContent>
                          </Card>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                Selected Candidate
                              </Typography>
                              {(() => {
                                const selectedCandidate = candidates.find(candidate => candidate._id === values.candidate);
                                return selectedCandidate ? (
                                  <Box>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                      {selectedCandidate.firstName} {selectedCandidate.lastName}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {selectedCandidate.email}
                                    </Typography>
                                    <Chip 
                                      label={`${selectedCandidate.yearsOfExperience} years exp.`} 
                                      color="info" 
                                      size="small" 
                                      sx={{ mt: 1 }}
                                    />
                                  </Box>
                                ) : (
                                  <Typography color="text.secondary">Candidate not found</Typography>
                                );
                              })()}
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>
                    )}
                  </Box>
                )}

                {activeStep === 2 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <Description sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Application Details
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          rows={4}
                          name="coverLetter"
                          label="Cover Letter"
                          value={values.coverLetter}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="Enter cover letter content..."
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          name="expectedSalary"
                          label="Expected Salary (PKR)"
                          type="number"
                          value={values.expectedSalary}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.expectedSalary && Boolean(errors.expectedSalary)}
                          helperText={touched.expectedSalary && errors.expectedSalary || "Auto-filled from candidate's expected salary"}
                          inputProps={{ min: 0 }}
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
                        <FormControl fullWidth error={touched.status && Boolean(errors.status)}>
                          <InputLabel>Status</InputLabel>
                          <Select
                            name="status"
                            value={values.status}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            label="Status"
                          >
                            <MenuItem value="applied">Applied</MenuItem>
                            <MenuItem value="screening">Screening</MenuItem>
                            <MenuItem value="shortlisted">Shortlisted</MenuItem>
                            <MenuItem value="interview_scheduled">Interview Scheduled</MenuItem>
                            <MenuItem value="interviewed">Interviewed</MenuItem>
                            <MenuItem value="technical_test">Technical Test</MenuItem>
                            <MenuItem value="reference_check">Reference Check</MenuItem>
                            <MenuItem value="offer_sent">Offer Sent</MenuItem>
                            <MenuItem value="offer_accepted">Offer Accepted</MenuItem>
                            <MenuItem value="offer_declined">Offer Declined</MenuItem>
                            <MenuItem value="hired">Hired</MenuItem>
                            <MenuItem value="rejected">Rejected</MenuItem>
                            <MenuItem value="withdrawn">Withdrawn</MenuItem>
                          </Select>
                          {touched.status && errors.status && (
                            <FormHelperText>{errors.status}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {activeStep === 3 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <AttachFile sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Documents
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Alert severity="info" sx={{ mb: 3 }}>
                      Document upload functionality will be implemented in the next version. 
                      For now, you can proceed to review and submit the application.
                    </Alert>
                    
                    <Stack direction="row" spacing={1}>
                      <Chip label="Resume" color="primary" variant="outlined" />
                      <Chip label="Cover Letter" color="primary" variant="outlined" />
                      <Chip label="Portfolio" color="primary" variant="outlined" />
                      <Chip label="Additional Documents" color="primary" variant="outlined" />
                    </Stack>
                  </Box>
                )}

                {activeStep === 4 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Review & Submit
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              Application Summary
                            </Typography>
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" color="text.secondary">
                                Job Posting
                              </Typography>
                              <Typography variant="body1">
                                {(() => {
                                  const selectedJob = jobPostings.find(job => job._id === values.jobPosting);
                                  return selectedJob ? `${selectedJob.title} (${selectedJob.jobCode})` : 'Not selected';
                                })()}
                              </Typography>
                            </Box>
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" color="text.secondary">
                                Candidate
                              </Typography>
                              <Typography variant="body1">
                                {(() => {
                                  const selectedCandidate = candidates.find(candidate => candidate._id === values.candidate);
                                  return selectedCandidate ? `${selectedCandidate.firstName} ${selectedCandidate.lastName}` : 'Not selected';
                                })()}
                              </Typography>
                            </Box>
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" color="text.secondary">
                                Expected Salary
                              </Typography>
                              <Typography variant="body1">
                                {values.expectedSalary ? `PKR ${values.expectedSalary.toLocaleString()}` : 'Not specified'}
                              </Typography>
                            </Box>
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" color="text.secondary">
                                Availability
                              </Typography>
                              <Typography variant="body1">
                                {values.availability}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="subtitle2" color="text.secondary">
                                Status
                              </Typography>
                              <Chip 
                                label={values.status} 
                                color="primary" 
                                size="small"
                              />
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <Alert severity="success" sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Ready to Submit
                          </Typography>
                          <Typography variant="body2">
                            All required information has been provided. Click the submit button to create the application.
                          </Typography>
                        </Alert>
                      </Grid>
                    </Grid>
                  </Box>
                )}

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
                        {loading ? 'Saving...' : (isEditing ? 'Update Application' : 'Create Application')}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="contained"
                        onClick={(e) => {
                          e.preventDefault(); // Prevent any form submission
                          setActiveStep((prevStep) => prevStep + 1);
                        }}
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

export default ApplicationForm; 