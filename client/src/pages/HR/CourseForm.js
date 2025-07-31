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
  Divider,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  Save,
  ArrowBack,
  Add,
  Delete,
  School,
  Description,
  VideoLibrary,
  Assignment,
  Quiz
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { Formik, Form, FieldArray } from 'formik';
import * as Yup from 'yup';
import courseService from '../../services/courseService';

const steps = [
  'Basic Information',
  'Course Content',
  'Assessment & Settings',
  'Review & Publish'
];

const validationSchema = Yup.object({
  title: Yup.string().required('Title is required'),
  description: Yup.string().required('Description is required'),
  shortDescription: Yup.string().max(200, 'Short description must be 200 characters or less'),
  category: Yup.string().required('Category is required'),
  subcategory: Yup.string(),
  duration: Yup.number().required('Duration is required').min(1, 'Duration must be at least 1 minute'),
  difficulty: Yup.string().required('Difficulty is required'),
  learningObjectives: Yup.array().of(Yup.string()),
  prerequisites: Yup.array().of(Yup.string()),
  materials: Yup.array().of(
    Yup.object({
      title: Yup.string().required('Material title is required'),
      type: Yup.string().required('Material type is required'),
      description: Yup.string(),
      isRequired: Yup.boolean()
    })
  ),
  hasAssessment: Yup.boolean(),
  passingScore: Yup.number().when('hasAssessment', {
    is: true,
    then: Yup.number().min(0).max(100).required('Passing score is required')
  }),
  maxAttempts: Yup.number().when('hasAssessment', {
    is: true,
    then: Yup.number().min(1).required('Max attempts is required')
  }),
  status: Yup.string().required('Status is required'),
  isPublic: Yup.boolean(),
  maxEnrollments: Yup.number().nullable(),
  providesCertificate: Yup.boolean()
});

const CourseForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [course, setCourse] = useState(null);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (isEditing) {
      loadCourse();
    }
  }, [id]);

  const loadCourse = async () => {
    try {
      setInitialLoading(true);
      const response = await courseService.getCourseById(id);
      setCourse(response.data);
    } catch (err) {
      setError('Failed to load course');
      console.error('Error loading course:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setLoading(true);
      
      if (isEditing) {
        await courseService.updateCourse(id, values);
        setSnackbar({
          open: true,
          message: 'Course updated successfully',
          severity: 'success'
        });
      } else {
        await courseService.createCourse(values);
        setSnackbar({
          open: true,
          message: 'Course created successfully',
          severity: 'success'
        });
      }
      
      setTimeout(() => {
        navigate('/hr/learning/courses');
      }, 1500);
      
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to save course',
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
    e.preventDefault(); // Prevent any form submission
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = (e) => {
    e.preventDefault(); // Prevent any form submission
    setActiveStep((prevStep) => prevStep - 1);
  };

  const getMaterialTypeIcon = (type) => {
    const icons = {
      video: <VideoLibrary />,
      document: <Description />,
      presentation: <School />,
      quiz: <Quiz />,
      assignment: <Assignment />,
      link: <Description />
    };
    return icons[type] || <Description />;
  };

  const initialValues = {
    title: course?.title || '',
    description: course?.description || '',
    shortDescription: course?.shortDescription || '',
    category: course?.category || '',
    subcategory: course?.subcategory || '',
    tags: course?.tags || [],
    duration: course?.duration || 60,
    difficulty: course?.difficulty || 'beginner',
    learningObjectives: course?.learningObjectives || [''],
    prerequisites: course?.prerequisites || [''],
    materials: course?.materials || [],
    hasAssessment: course?.hasAssessment || false,
    passingScore: course?.passingScore || 70,
    maxAttempts: course?.maxAttempts || 3,
    status: course?.status || 'draft',
    isPublic: course?.isPublic || false,
    maxEnrollments: course?.maxEnrollments || null,
    providesCertificate: course?.providesCertificate || false,
    certificateTemplate: course?.certificateTemplate || ''
  };

  if (initialLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <LinearProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading course...
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
          <IconButton onClick={() => navigate('/hr/learning/courses')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {isEditing ? 'Edit Course' : 'Create New Course'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {isEditing ? 'Update course information and content' : 'Set up a new learning course'}
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
                  {/* Step 1: Basic Information */}
                  {activeStep === 0 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Basic Information
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            name="title"
                            label="Course Title"
                            value={values.title}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.title && Boolean(errors.title)}
                            helperText={touched.title && errors.title}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            name="description"
                            label="Course Description"
                            multiline
                            rows={4}
                            value={values.description}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.description && Boolean(errors.description)}
                            helperText={touched.description && errors.description}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            name="shortDescription"
                            label="Short Description"
                            multiline
                            rows={2}
                            value={values.shortDescription}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.shortDescription && Boolean(errors.shortDescription)}
                            helperText={touched.shortDescription && errors.shortDescription}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth error={touched.category && Boolean(errors.category)}>
                            <InputLabel>Category</InputLabel>
                            <Select
                              name="category"
                              value={values.category}
                              label="Category"
                              onChange={handleChange}
                              onBlur={handleBlur}
                            >
                              <MenuItem value="technical">Technical Skills</MenuItem>
                              <MenuItem value="soft_skills">Soft Skills</MenuItem>
                              <MenuItem value="leadership">Leadership</MenuItem>
                              <MenuItem value="compliance">Compliance</MenuItem>
                              <MenuItem value="productivity">Productivity</MenuItem>
                              <MenuItem value="safety">Safety</MenuItem>
                              <MenuItem value="customer_service">Customer Service</MenuItem>
                              <MenuItem value="sales">Sales</MenuItem>
                              <MenuItem value="other">Other</MenuItem>
                            </Select>
                            {touched.category && errors.category && (
                              <FormHelperText>{errors.category}</FormHelperText>
                            )}
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            name="subcategory"
                            label="Subcategory"
                            value={values.subcategory}
                            onChange={handleChange}
                            onBlur={handleBlur}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            name="duration"
                            label="Duration (minutes)"
                            type="number"
                            value={values.duration}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.duration && Boolean(errors.duration)}
                            helperText={touched.duration && errors.duration}
                            inputProps={{ min: 1 }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth error={touched.difficulty && Boolean(errors.difficulty)}>
                            <InputLabel>Difficulty</InputLabel>
                            <Select
                              name="difficulty"
                              value={values.difficulty}
                              label="Difficulty"
                              onChange={handleChange}
                              onBlur={handleBlur}
                            >
                              <MenuItem value="beginner">Beginner</MenuItem>
                              <MenuItem value="intermediate">Intermediate</MenuItem>
                              <MenuItem value="advanced">Advanced</MenuItem>
                              <MenuItem value="expert">Expert</MenuItem>
                            </Select>
                            {touched.difficulty && errors.difficulty && (
                              <FormHelperText>{errors.difficulty}</FormHelperText>
                            )}
                          </FormControl>
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* Step 2: Course Content */}
                  {activeStep === 1 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Course Content
                      </Typography>
                      
                      {/* Learning Objectives */}
                      <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                        Learning Objectives
                      </Typography>
                      <FieldArray name="learningObjectives">
                        {({ push, remove }) => (
                          <Stack spacing={2}>
                            {values.learningObjectives.map((objective, index) => (
                              <Box key={index} sx={{ display: 'flex', gap: 1 }}>
                                <TextField
                                  fullWidth
                                  name={`learningObjectives.${index}`}
                                  label={`Objective ${index + 1}`}
                                  value={objective}
                                  onChange={handleChange}
                                />
                                <IconButton
                                  onClick={() => remove(index)}
                                  color="error"
                                  disabled={values.learningObjectives.length === 1}
                                >
                                  <Delete />
                                </IconButton>
                              </Box>
                            ))}
                            <Button
                              startIcon={<Add />}
                              onClick={() => push('')}
                              variant="outlined"
                            >
                              Add Objective
                            </Button>
                          </Stack>
                        )}
                      </FieldArray>

                      {/* Prerequisites */}
                      <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
                        Prerequisites
                      </Typography>
                      <FieldArray name="prerequisites">
                        {({ push, remove }) => (
                          <Stack spacing={2}>
                            {values.prerequisites.map((prerequisite, index) => (
                              <Box key={index} sx={{ display: 'flex', gap: 1 }}>
                                <TextField
                                  fullWidth
                                  name={`prerequisites.${index}`}
                                  label={`Prerequisite ${index + 1}`}
                                  value={prerequisite}
                                  onChange={handleChange}
                                />
                                <IconButton
                                  onClick={() => remove(index)}
                                  color="error"
                                >
                                  <Delete />
                                </IconButton>
                              </Box>
                            ))}
                            <Button
                              startIcon={<Add />}
                              onClick={() => push('')}
                              variant="outlined"
                            >
                              Add Prerequisite
                            </Button>
                          </Stack>
                        )}
                      </FieldArray>
                    </Box>
                  )}

                  {/* Step 3: Assessment & Settings */}
                  {activeStep === 2 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Assessment & Settings
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12}>
                          <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select
                              name="status"
                              value={values.status}
                              label="Status"
                              onChange={handleChange}
                            >
                              <MenuItem value="draft">Draft</MenuItem>
                              <MenuItem value="published">Published</MenuItem>
                              <MenuItem value="archived">Archived</MenuItem>
                              <MenuItem value="maintenance">Under Maintenance</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            name="maxEnrollments"
                            label="Max Enrollments (leave empty for unlimited)"
                            type="number"
                            value={values.maxEnrollments || ''}
                            onChange={handleChange}
                            inputProps={{ min: 1 }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth>
                            <InputLabel>Public Access</InputLabel>
                            <Select
                              name="isPublic"
                              value={values.isPublic}
                              label="Public Access"
                              onChange={handleChange}
                            >
                              <MenuItem value={true}>Public</MenuItem>
                              <MenuItem value={false}>Private</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* Step 4: Review & Publish */}
                  {activeStep === 3 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Review & Publish
                      </Typography>
                      
                      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                        <Typography variant="subtitle1" gutterBottom>
                          Course Summary
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <Typography variant="body2" color="text.secondary">
                              Title: {values.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Category: {values.category}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Difficulty: {values.difficulty}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography variant="body2" color="text.secondary">
                              Duration: {values.duration} minutes
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Status: {values.status}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Public: {values.isPublic ? 'Yes' : 'No'}
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
                      {loading ? 'Saving...' : (isEditing ? 'Update Course' : 'Create Course')}
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

export default CourseForm; 