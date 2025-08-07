import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Alert,
  Snackbar,
  Container,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  LinearProgress
} from '@mui/material';
import {
  Save,
  ArrowBack
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import enrollmentService from '../../services/enrollmentService';
import courseService from '../../services/courseService';
import api from '../../services/api';

const steps = [
  'Select Employee & Course',
  'Enrollment Details',
  'Review & Confirm'
];

const validationSchema = Yup.object({
  employee: Yup.string().required('Employee is required'),
  course: Yup.string().required('Course is required'),
  enrollmentType: Yup.string().required('Enrollment type is required'),
  dueDate: Yup.date().nullable(),
  notes: Yup.string()
});

const EnrollmentForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [enrollment, setEnrollment] = useState(null);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activeStep, setActiveStep] = useState(0);
  
  // Data for dropdowns
  const [employees, setEmployees] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadData();
    if (isEditing) {
      loadEnrollment();
    }
  }, [id, isEditing]);

  const loadData = async () => {
    try {
      setLoadingData(true);
      
      // Load employees
      const employeesResponse = await api.get('/hr/employees?limit=1000');
      setEmployees(employeesResponse.data.data || []);
      
      // Load all courses (including drafts for now)
      const coursesResponse = await courseService.getCourses({ limit: 100 });
      setCourses(coursesResponse.data.docs || []);
      
      if (!coursesResponse.data.docs || coursesResponse.data.docs.length === 0) {
        setError('No courses available. Please create some courses first.');
      }
      
    } catch (err) {
      setError('Failed to load data');
      console.error('Error loading data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const loadEnrollment = async () => {
    try {
      setInitialLoading(true);
      const response = await enrollmentService.getEnrollmentById(id);
      setEnrollment(response.data);
    } catch (err) {
      setError('Failed to load enrollment');
      console.error('Error loading enrollment:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setLoading(true);
      
      if (isEditing) {
        await enrollmentService.updateEnrollment(id, values);
        setSnackbar({
          open: true,
          message: 'Enrollment updated successfully',
          severity: 'success'
        });
      } else {
        await enrollmentService.createEnrollment(values);
        setSnackbar({
          open: true,
          message: 'Employee enrolled successfully',
          severity: 'success'
        });
      }
      
      setTimeout(() => {
        navigate('/hr/learning/enrollments');
      }, 1500);
      
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to save enrollment',
        severity: 'error'
      });
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleNext = (e) => {
    e.preventDefault();
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = (e) => {
    e.preventDefault();
    setActiveStep((prevStep) => prevStep - 1);
  };

  const getSelectedEmployee = () => {
    if (!enrollment?.employee) return null;
    return employees.find(emp => emp._id === enrollment.employee);
  };

  const getSelectedCourse = () => {
    if (!enrollment?.course) return null;
    return courses.find(course => course._id === enrollment.course);
  };

  const initialValues = {
    employee: enrollment?.employee || '',
    course: enrollment?.course || '',
    enrollmentType: enrollment?.enrollmentType || 'assigned',
    dueDate: enrollment?.dueDate || '',
    notes: enrollment?.notes?.[0]?.content || ''
  };

  if (initialLoading || loadingData) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <LinearProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>
            {initialLoading ? 'Loading enrollment...' : 'Loading data...'}
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <IconButton onClick={() => navigate('/hr/learning/enrollments')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {isEditing ? 'Edit Enrollment' : 'Enroll Employee'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {isEditing ? 'Update enrollment details' : 'Enroll an employee in a course'}
            </Typography>
          </Box>
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

        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
          enableReinitialize={true}
        >
          {({ values, errors, touched, handleChange, handleBlur, isValid, setFieldValue }) => (
            <Form>
              <Card>
                <CardContent>
                  {/* Step 1: Select Employee & Course */}
                  {activeStep === 0 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Select Employee & Course
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth error={touched.employee && Boolean(errors.employee)}>
                            <InputLabel>Employee</InputLabel>
                            <Select
                              name="employee"
                              value={values.employee}
                              label="Employee"
                              onChange={handleChange}
                              onBlur={handleBlur}
                            >
                              {employees.map((employee) => (
                                <MenuItem key={employee._id} value={employee._id}>
                                  {employee.firstName} {employee.lastName} - {employee.employeeId}
                                </MenuItem>
                              ))}
                            </Select>
                            {touched.employee && errors.employee && (
                              <FormHelperText>{errors.employee}</FormHelperText>
                            )}
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth error={touched.course && Boolean(errors.course)}>
                            <InputLabel>Course</InputLabel>
                                                         <Select
                               name="course"
                               value={values.course}
                               label="Course"
                               onChange={handleChange}
                               onBlur={handleBlur}
                             >
                               {courses.map((course) => (
                                 <MenuItem key={course._id} value={course._id}>
                                   {course.title} - {course.courseId} ({course.status})
                                 </MenuItem>
                               ))}
                             </Select>
                            {touched.course && errors.course && (
                              <FormHelperText>{errors.course}</FormHelperText>
                            )}
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth error={touched.enrollmentType && Boolean(errors.enrollmentType)}>
                            <InputLabel>Enrollment Type</InputLabel>
                            <Select
                              name="enrollmentType"
                              value={values.enrollmentType}
                              label="Enrollment Type"
                              onChange={handleChange}
                              onBlur={handleBlur}
                            >
                              <MenuItem value="assigned">Assigned</MenuItem>
                              <MenuItem value="required">Required</MenuItem>
                              <MenuItem value="recommended">Recommended</MenuItem>
                              <MenuItem value="self_enrolled">Self Enrolled</MenuItem>
                            </Select>
                            {touched.enrollmentType && errors.enrollmentType && (
                              <FormHelperText>{errors.enrollmentType}</FormHelperText>
                            )}
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            name="dueDate"
                            label="Due Date (Optional)"
                            type="date"
                            value={values.dueDate}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            InputLabelProps={{
                              shrink: true,
                            }}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* Step 2: Enrollment Details */}
                  {activeStep === 1 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Enrollment Details
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            name="notes"
                            label="Notes (Optional)"
                            multiline
                            rows={4}
                            value={values.notes}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            placeholder="Add any additional notes or instructions for this enrollment..."
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* Step 3: Review & Confirm */}
                  {activeStep === 2 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Review & Confirm
                      </Typography>
                      
                      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                        <Typography variant="subtitle1" gutterBottom>
                          Enrollment Summary
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <Typography variant="body2" color="text.secondary">
                              Employee: {getSelectedEmployee()?.firstName} {getSelectedEmployee()?.lastName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Course: {getSelectedCourse()?.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Enrollment Type: {values.enrollmentType}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography variant="body2" color="text.secondary">
                              Due Date: {values.dueDate ? new Date(values.dueDate).toLocaleDateString() : 'No due date'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Course Duration: {getSelectedCourse()?.duration ? `${Math.floor(getSelectedCourse().duration / 60)}h ${getSelectedCourse().duration % 60}m` : 'N/A'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Course Difficulty: {getSelectedCourse()?.difficulty || 'N/A'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Card>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Navigation Buttons */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                <Button
                  type="button"
                  disabled={activeStep === 0}
                  onClick={handleBack}
                >
                  Back
                </Button>
                
                <Box>
                  {activeStep === steps.length - 1 ? (
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={loading || !isValid}
                      startIcon={loading ? <LinearProgress size={20} /> : <Save />}
                    >
                      {loading ? 'Saving...' : (isEditing ? 'Update Enrollment' : 'Enroll Employee')}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="contained"
                      onClick={handleNext}
                    >
                      Next
                    </Button>
                  )}
                </Box>
              </Box>
            </Form>
          )}
        </Formik>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
        >
          <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default EnrollmentForm; 