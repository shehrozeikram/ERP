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
  LinearProgress,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip
} from '@mui/material';
import {
  Save,
  ArrowBack,
  Add,
  Delete
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { Formik, Form, FieldArray } from 'formik';
import * as Yup from 'yup';
import api from '../../services/api';
import courseService from '../../services/courseService';
import trainingProgramService from '../../services/trainingProgramService';

const steps = [
  'Program Details',
  'Course Selection',
  'Structure & Requirements',
  'Target Audience',
  'Review & Publish'
];

const validationSchema = Yup.object({
  title: Yup.string().required('Program title is required'),
  description: Yup.string().required('Program description is required'),
  type: Yup.string().required('Program type is required'),
  category: Yup.string().required('Category is required'),
  difficulty: Yup.string().required('Difficulty level is required'),
  objectives: Yup.array().of(Yup.string().trim().min(1, 'Objective cannot be empty')).min(1, 'At least one objective is required'),
  courses: Yup.array().of(Yup.object().shape({
    course: Yup.string().required('Course is required'),
    order: Yup.number().required('Order is required'),
    isRequired: Yup.boolean(),
    estimatedDuration: Yup.number().nullable()
  })).min(1, 'At least one course is required'),
  targetAudience: Yup.object({
    roles: Yup.array().of(Yup.string()),
    departments: Yup.array().of(Yup.string()),
    experienceLevel: Yup.string()
  }),
  completionCriteria: Yup.object({
    requiredCourses: Yup.number().min(1, 'At least 1 course required'),
    minimumScore: Yup.number().min(0).max(100),
    timeLimit: Yup.number().min(1, 'Time limit must be at least 1 day')
  })
});

const TrainingProgramForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [program, setProgram] = useState(null);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activeStep, setActiveStep] = useState(0);
  
  // Data for dropdowns
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadData();
    if (isEditing) {
      loadProgram();
    }
  }, [id, isEditing]);

  const loadData = async () => {
    try {
      setLoadingData(true);
      
      // Load published courses
      const coursesResponse = await courseService.getCourses({ status: 'published', limit: 100 });
      setCourses(coursesResponse.data.docs || []);
      
      // Load departments
      const departmentsResponse = await api.get('/hr/departments');
      setDepartments(departmentsResponse.data.data || []);
      
    } catch (err) {
      setError('Failed to load data');
      console.error('Error loading data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const loadProgram = async () => {
    try {
      setInitialLoading(true);
      const response = await trainingProgramService.getTrainingProgramById(id);
      setProgram(response.data);
    } catch (err) {
      setError('Failed to load training program');
      console.error('Error loading training program:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setLoading(true);
      
      if (isEditing) {
        await trainingProgramService.updateTrainingProgram(id, values);
        setSnackbar({
          open: true,
          message: 'Training program updated successfully',
          severity: 'success'
        });
      } else {
        await trainingProgramService.createTrainingProgram(values);
        setSnackbar({
          open: true,
          message: 'Training program created successfully',
          severity: 'success'
        });
      }
      
      setTimeout(() => {
        navigate('/hr/learning/programs');
      }, 1500);
      
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to save training program',
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

  // Step-specific validation
  const isCurrentStepValid = (values, errors, activeStep) => {
    switch (activeStep) {
      case 0: // Program Details
        return !errors.title && !errors.description && !errors.type && !errors.category && !errors.difficulty && !errors.objectives;
      case 1: // Course Selection
        return values.courses.length > 0 && !errors.courses;
      case 2: // Structure & Requirements
        return !errors.completionCriteria;
      case 3: // Target Audience
        return true; // Optional fields
      case 4: // Review & Publish
        return Object.keys(errors).length === 0;
      default:
        return true;
    }
  };

  const initialValues = {
    title: program?.title || '',
    description: program?.description || '',
    shortDescription: program?.shortDescription || '',
    type: program?.type || 'custom',
    category: program?.category || '',
    difficulty: program?.difficulty || 'beginner',
    objectives: program?.objectives?.filter(obj => obj && obj.trim() !== '') || ['Enter learning objective'],
    prerequisites: program?.prerequisites?.filter(prereq => prereq && prereq.trim() !== '') || [''],
    courses: program?.courses?.map(course => ({
      course: course.course,
      order: course.order,
      isRequired: course.isRequired ?? true,
      estimatedDuration: course.estimatedDuration || null
    })) || [],
    targetAudience: {
      roles: program?.targetAudience?.roles || [],
      departments: program?.targetAudience?.departments || [],
      experienceLevel: program?.targetAudience?.experienceLevel || ''
    },
    completionCriteria: {
      requiredCourses: program?.completionCriteria?.requiredCourses || 1,
      minimumScore: program?.completionCriteria?.minimumScore || 70,
      timeLimit: program?.completionCriteria?.timeLimit || 30
    },
    maxEnrollments: program?.maxEnrollments || null,
    providesCertificate: program?.providesCertificate || false,
    certificateTemplate: program?.certificateTemplate || '',
    isActive: program?.isActive ?? true,
    status: program?.status || 'draft'
  };

  if (initialLoading || loadingData) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <LinearProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>
            {initialLoading ? 'Loading training program...' : 'Loading data...'}
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
          <IconButton onClick={() => navigate('/hr/learning/programs')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {isEditing ? 'Edit Training Program' : 'Create Training Program'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {isEditing ? 'Update training program details' : 'Create a comprehensive training program'}
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
                  {/* Step 1: Program Details */}
                  {activeStep === 0 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Program Details
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            name="title"
                            label="Program Title"
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
                            label="Program Description"
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
                            label="Short Description (Optional)"
                            multiline
                            rows={2}
                            value={values.shortDescription}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            helperText="Brief description for program cards and previews"
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
                          <FormControl fullWidth error={touched.type && Boolean(errors.type)}>
                            <InputLabel>Program Type</InputLabel>
                            <Select
                              name="type"
                              value={values.type}
                              label="Program Type"
                              onChange={handleChange}
                              onBlur={handleBlur}
                            >
                              <MenuItem value="certification">Certification</MenuItem>
                              <MenuItem value="skill_path">Skill Path</MenuItem>
                              <MenuItem value="onboarding">Onboarding</MenuItem>
                              <MenuItem value="compliance">Compliance</MenuItem>
                              <MenuItem value="leadership">Leadership</MenuItem>
                              <MenuItem value="custom">Custom</MenuItem>
                            </Select>
                            {touched.type && errors.type && (
                              <FormHelperText>{errors.type}</FormHelperText>
                            )}
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth error={touched.difficulty && Boolean(errors.difficulty)}>
                            <InputLabel>Difficulty Level</InputLabel>
                            <Select
                              name="difficulty"
                              value={values.difficulty}
                              label="Difficulty Level"
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
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" gutterBottom>
                            Learning Objectives *
                          </Typography>
                          <FieldArray
                            name="objectives"
                            render={arrayHelpers => (
                              <Box>
                                {values.objectives.map((objective, index) => (
                                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                    <TextField
                                      fullWidth
                                      name={`objectives.${index}`}
                                      label={`Objective ${index + 1}`}
                                      value={objective}
                                      onChange={handleChange}
                                      onBlur={handleBlur}
                                      error={touched.objectives?.[index] && Boolean(errors.objectives?.[index])}
                                      helperText={touched.objectives?.[index] && errors.objectives?.[index]}
                                    />
                                    <IconButton
                                      onClick={() => arrayHelpers.remove(index)}
                                      disabled={values.objectives.length === 1}
                                    >
                                      <Delete />
                                    </IconButton>
                                  </Box>
                                ))}
                                <Button
                                  type="button"
                                  variant="outlined"
                                  startIcon={<Add />}
                                  onClick={() => arrayHelpers.push('')}
                                  sx={{ mt: 1 }}
                                >
                                  Add Objective
                                </Button>
                              </Box>
                            )}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* Step 2: Course Selection */}
                  {activeStep === 1 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Course Selection
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Select courses to include in this training program. You can reorder them later.
                      </Typography>
                      
                      <Autocomplete
                        multiple
                        options={courses}
                        getOptionLabel={(option) => `${option.title} (${option.courseId})`}
                        value={values.courses.map(courseRef => 
                          courses.find(c => c._id === courseRef.course)
                        ).filter(Boolean)}
                        onChange={(event, newValue) => {
                          // Transform course objects to match validation schema
                          const transformedCourses = newValue.map((course, index) => ({
                            course: course._id,
                            order: index + 1,
                            isRequired: true,
                            estimatedDuration: course.duration || null
                          }));
                          setFieldValue('courses', transformedCourses);
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Select Courses"
                            placeholder="Choose courses..."
                            error={touched.courses && Boolean(errors.courses)}
                            helperText={touched.courses && errors.courses}
                          />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              label={`${option.title} (${option.duration}min)`}
                              {...getTagProps({ index })}
                              size="small"
                            />
                          ))
                        }
                      />
                      
                      {values.courses.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Selected Courses ({values.courses.length})
                          </Typography>
                          <List dense>
                            {values.courses.map((courseRef, index) => {
                              const course = courses.find(c => c._id === courseRef.course);
                              if (!course) return null;
                              
                              return (
                                <ListItem key={courseRef.course} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}>
                                  <ListItemText
                                    primary={course.title}
                                    secondary={`${course.courseId} • ${course.duration} minutes • ${course.difficulty}`}
                                  />
                                  <ListItemSecondaryAction>
                                    <IconButton
                                      edge="end"
                                      onClick={() => {
                                        const newCourses = values.courses.filter((_, i) => i !== index);
                                        setFieldValue('courses', newCourses);
                                      }}
                                    >
                                      <Delete />
                                    </IconButton>
                                  </ListItemSecondaryAction>
                                </ListItem>
                              );
                            })}
                          </List>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Step 3: Structure & Requirements */}
                  {activeStep === 2 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Structure & Requirements
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            name="completionCriteria.requiredCourses"
                            label="Required Courses"
                            type="number"
                            value={values.completionCriteria.requiredCourses}
                            onChange={(e) => setFieldValue('completionCriteria.requiredCourses', parseInt(e.target.value))}
                            onBlur={handleBlur}
                            error={touched.completionCriteria?.requiredCourses && Boolean(errors.completionCriteria?.requiredCourses)}
                            helperText={touched.completionCriteria?.requiredCourses && errors.completionCriteria?.requiredCourses}
                            inputProps={{ min: 1, max: values.courses.length }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            name="completionCriteria.minimumScore"
                            label="Minimum Passing Score (%)"
                            type="number"
                            value={values.completionCriteria.minimumScore}
                            onChange={(e) => setFieldValue('completionCriteria.minimumScore', parseInt(e.target.value))}
                            onBlur={handleBlur}
                            error={touched.completionCriteria?.minimumScore && Boolean(errors.completionCriteria?.minimumScore)}
                            helperText={touched.completionCriteria?.minimumScore && errors.completionCriteria?.minimumScore}
                            inputProps={{ min: 0, max: 100 }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            name="completionCriteria.timeLimit"
                            label="Time Limit (days)"
                            type="number"
                            value={values.completionCriteria.timeLimit}
                            onChange={(e) => setFieldValue('completionCriteria.timeLimit', parseInt(e.target.value))}
                            onBlur={handleBlur}
                            error={touched.completionCriteria?.timeLimit && Boolean(errors.completionCriteria?.timeLimit)}
                            helperText={touched.completionCriteria?.timeLimit && errors.completionCriteria?.timeLimit}
                            inputProps={{ min: 1 }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            name="maxEnrollments"
                            label="Max Enrollments (Optional)"
                            type="number"
                            value={values.maxEnrollments || ''}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            helperText="Leave empty for unlimited enrollments"
                            inputProps={{ min: 1 }}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* Step 4: Target Audience */}
                  {activeStep === 3 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Target Audience
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth>
                            <InputLabel>Experience Level</InputLabel>
                            <Select
                              name="targetAudience.experienceLevel"
                              value={values.targetAudience.experienceLevel}
                              label="Experience Level"
                              onChange={(e) => setFieldValue('targetAudience.experienceLevel', e.target.value)}
                              onBlur={handleBlur}
                            >
                              <MenuItem value="">Any Level</MenuItem>
                              <MenuItem value="entry">Entry Level</MenuItem>
                              <MenuItem value="mid">Mid Level</MenuItem>
                              <MenuItem value="senior">Senior Level</MenuItem>
                              <MenuItem value="management">Management</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth>
                            <InputLabel>Departments</InputLabel>
                            <Select
                              multiple
                              name="targetAudience.departments"
                              value={values.targetAudience.departments}
                              label="Departments"
                              onChange={(e) => setFieldValue('targetAudience.departments', e.target.value)}
                              onBlur={handleBlur}
                            >
                              {departments.map((dept) => (
                                <MenuItem key={dept._id} value={dept._id}>
                                  {dept.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* Step 5: Review & Publish */}
                  {activeStep === 4 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Review & Publish
                      </Typography>
                      

                      
                      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                        <Typography variant="subtitle1" gutterBottom>
                          Program Summary
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Title:</strong> {values.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Category:</strong> {values.category}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Difficulty:</strong> {values.difficulty}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Courses:</strong> {values.courses.length} selected
                            </Typography>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Required Courses:</strong> {values.completionCriteria.requiredCourses}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Minimum Score:</strong> {values.completionCriteria.minimumScore}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Time Limit:</strong> {values.completionCriteria.timeLimit} days
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Max Enrollments:</strong> {values.maxEnrollments || 'Unlimited'}
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
                      disabled={loading || !isCurrentStepValid(values, errors, activeStep)}
                      startIcon={loading ? <LinearProgress size={20} /> : <Save />}
                    >
                      {loading ? 'Saving...' : (isEditing ? 'Update Program' : 'Create Program')}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="contained"
                      disabled={!isCurrentStepValid(values, errors, activeStep)}
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

export default TrainingProgramForm; 