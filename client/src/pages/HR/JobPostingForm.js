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
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Save,
  Cancel,
  ArrowBack,
  Work,
  Business,
  Description,
  Schedule,
  LocationOn
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import jobPostingService from '../../services/jobPostingService';

// Step-specific validation schemas
const stepValidationSchemas = [
  // Step 1: Basic Information
  Yup.object({
    department: Yup.string().required('Department is required'),
    location: Yup.string().required('Location is required'),
    position: Yup.string().required('Position is required'),
    project: Yup.string(),
    numberOfPositions: Yup.number().min(1, 'Number of positions must be at least 1')
  }),
  
  // Step 2: Job Details
  Yup.object({
    employmentType: Yup.string().required('Employment type is required'),
    experienceLevel: Yup.string().required('Experience level is required'),
    educationLevel: Yup.string().required('Education level is required')
  }),
  
  // Step 3: Application Details
  Yup.object({
    applicationDeadline: Yup.date().min(new Date(), 'Deadline must be in the future')
  })
];

// Complete validation schema for final submission
const completeValidationSchema = Yup.object({
  department: Yup.string().required('Department is required'),
  location: Yup.string().required('Location is required'),
  position: Yup.string().required('Position is required'),
  project: Yup.string(),
  employmentType: Yup.string().required('Employment type is required'),
  experienceLevel: Yup.string().required('Experience level is required'),
  educationLevel: Yup.string().required('Education level is required'),
  applicationDeadline: Yup.date().min(new Date(), 'Deadline must be in the future')
});

const JobPostingForm = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isViewMode = Boolean(id) && !location.pathname.endsWith('/edit');
  const isEditing = Boolean(id) && location.pathname.endsWith('/edit');
  
  // State
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [positions, setPositions] = useState([]);
  const [activeStep, setActiveStep] = useState(0);
  const [editData, setEditData] = useState(null);
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [newPositionTitle, setNewPositionTitle] = useState('');
  const [newLocationName, setNewLocationName] = useState('');
  const [positionDialogError, setPositionDialogError] = useState('');
  const [locationDialogError, setLocationDialogError] = useState('');
  const [creatingPosition, setCreatingPosition] = useState(false);
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [projects, setProjects] = useState([]);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [departmentDialogError, setDepartmentDialogError] = useState('');
  const [projectDialogError, setProjectDialogError] = useState('');
  const [creatingDepartment, setCreatingDepartment] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const ADD_NEW_POSITION_VALUE = '__add_new_position__';
  const ADD_NEW_LOCATION_VALUE = '__add_new_location__';
  const ADD_NEW_DEPARTMENT_VALUE = '__add_new_department__';
  const ADD_NEW_PROJECT_VALUE = '__add_new_project__';

  // Steps for the form
  const steps = ['Basic Information', 'Job Details', 'Application Details'];

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

      // Fetch all projects from API
      const projectsResponse = await fetch('/api/hr/projects', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setProjects(projectsData.data || []);
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
        department: response.data.department?._id || response.data.department || '',
        position: response.data.position?._id || response.data.position || '',
        location: response.data.location?._id || response.data.location || '',
        project: response.data.project?._id || response.data.project || '',
        description: response.data.description || '',
        responsibilities: response.data.responsibilities || '',
        qualificationExperience: response.data.qualificationExperience || '',
        employmentType: response.data.employmentType || '',
        experienceLevel: response.data.experienceLevel || '',
        educationLevel: response.data.educationLevel || '',
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
    if (isViewMode) {
      setSubmitting(false);
      return;
    }

    setLoading(true);
    try {
      // Format data for API
      const jobPostingData = {
        department: values.department,
        position: values.position,
        location: values.location,
        project: values.project,
        description: values.description || 'Job description',
        responsibilities: values.responsibilities || 'Responsibilities will be specified',
        qualificationExperience: values.qualificationExperience || 'Qualification & experience will be specified',
        employmentType: values.employmentType,
        experienceLevel: values.experienceLevel,
        educationLevel: values.educationLevel,
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
      const response = await fetch(`/api/positions?department=${departmentId}`, {
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

  const openDepartmentDialog = () => {
    setDepartmentDialogError('');
    setNewDepartmentName('');
    setDepartmentDialogOpen(true);
  };

  const closeDepartmentDialog = () => {
    if (creatingDepartment) return;
    setDepartmentDialogOpen(false);
    setDepartmentDialogError('');
  };

  const openProjectDialog = () => {
    setProjectDialogError('');
    setNewProjectName('');
    setProjectDialogOpen(true);
  };

  const closeProjectDialog = () => {
    if (creatingProject) return;
    setProjectDialogOpen(false);
    setProjectDialogError('');
  };

  const handleCreateDepartment = async (setFieldValue) => {
    const name = newDepartmentName.trim();
    if (!name) {
      setDepartmentDialogError('Department name is required');
      return;
    }

    setCreatingDepartment(true);
    try {
      const response = await fetch('/api/hr/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name })
      });

      const responseData = await response.json();
      if (!response.ok || !responseData?.success) {
        throw new Error(responseData?.message || 'Failed to create department');
      }

      await loadDropdownData();
      if (responseData?.data?._id) {
        setFieldValue('department', responseData.data._id);
      }
      setDepartmentDialogOpen(false);
      setSnackbar({
        open: true,
        message: 'Department added successfully',
        severity: 'success'
      });
    } catch (error) {
      setDepartmentDialogError(error.message || 'Error adding department');
    } finally {
      setCreatingDepartment(false);
    }
  };

  const handleCreateProject = async (setFieldValue) => {
    const name = newProjectName.trim();
    if (!name) {
      setProjectDialogError('Project name is required');
      return;
    }

    setCreatingProject(true);
    try {
      const response = await fetch('/api/hr/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name })
      });

      const responseData = await response.json();
      if (!response.ok || !responseData?.success) {
        throw new Error(responseData?.message || 'Failed to create project');
      }

      await loadDropdownData();
      if (responseData?.data?._id) {
        setFieldValue('project', responseData.data._id);
      }
      setProjectDialogOpen(false);
      setSnackbar({
        open: true,
        message: 'Project added successfully',
        severity: 'success'
      });
    } catch (error) {
      setProjectDialogError(error.message || 'Error adding project');
    } finally {
      setCreatingProject(false);
    }
  };

  const openPositionDialog = () => {
    setPositionDialogError('');
    setNewPositionTitle('');
    setPositionDialogOpen(true);
  };

  const closePositionDialog = () => {
    if (creatingPosition) return;
    setPositionDialogOpen(false);
    setPositionDialogError('');
  };

  const openLocationDialog = () => {
    setLocationDialogError('');
    setNewLocationName('');
    setLocationDialogOpen(true);
  };

  const closeLocationDialog = () => {
    if (creatingLocation) return;
    setLocationDialogOpen(false);
    setLocationDialogError('');
  };

  const handleCreatePosition = async (departmentId, setFieldValue) => {
    if (!departmentId) {
      setSnackbar({
        open: true,
        message: 'Please select a department before adding a new position',
        severity: 'warning'
      });
      return;
    }

    const title = newPositionTitle.trim();
    if (!title) {
      setPositionDialogError('Position title is required');
      return;
    }

    setCreatingPosition(true);
    try {
      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title,
          department: departmentId
        })
      });

      const responseData = await response.json();
      if (!response.ok || !responseData?.success) {
        throw new Error(responseData?.message || 'Failed to create position');
      }

      await handleDepartmentChange(departmentId, setFieldValue);
      if (responseData?.data?._id) {
        setFieldValue('position', responseData.data._id);
      }
      setPositionDialogOpen(false);
      setSnackbar({
        open: true,
        message: 'Position added successfully',
        severity: 'success'
      });
    } catch (error) {
      setPositionDialogError(error.message || 'Error adding position');
    } finally {
      setCreatingPosition(false);
    }
  };

  const handleCreateLocation = async (setFieldValue) => {
    const name = newLocationName.trim();
    if (!name) {
      setLocationDialogError('Location name is required');
      return;
    }

    setCreatingLocation(true);
    try {
      const response = await fetch('/api/hr/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name,
          type: 'Office'
        })
      });

      const responseData = await response.json();
      if (!response.ok || !responseData?.success) {
        throw new Error(responseData?.message || 'Failed to create location');
      }

      await loadDropdownData();
      if (responseData?.data?._id) {
        setFieldValue('location', responseData.data._id);
      }
      setLocationDialogOpen(false);
      setSnackbar({
        open: true,
        message: 'Location added successfully',
        severity: 'success'
      });
    } catch (error) {
      setLocationDialogError(error.message || 'Error adding location');
    } finally {
      setCreatingLocation(false);
    }
  };

  // Check if current step is valid
  const isCurrentStepValid = (values, errors) => {
    if (activeStep === 0) {
      // Step 1: Basic Information
      const hasDepartment = values.department && values.department.trim() !== '';
      const hasLocation = values.location && values.location.trim() !== '';
      const hasPosition = values.position && values.position.trim() !== '';
      const hasNumberOfPositions = values.numberOfPositions && values.numberOfPositions > 0;
      

      return hasDepartment && hasLocation && hasPosition && hasNumberOfPositions;
    }
    
    if (activeStep === 1) {
      // Step 2: Job Details
      const hasEmploymentType = values.employmentType && values.employmentType.trim() !== '';
      const hasExperienceLevel = values.experienceLevel && values.experienceLevel.trim() !== '';
      const hasEducationLevel = values.educationLevel && values.educationLevel.trim() !== '';
      

      return hasEmploymentType && hasExperienceLevel && hasEducationLevel;
    }
    
    if (activeStep === 2) {
      // Step 3: Application Details
      const hasDeadline = values.applicationDeadline && values.applicationDeadline.trim() !== '';
      

      return hasDeadline;
    }
    
    return false;
  };

  // Initial values
  const initialValues = {
    department: '',
    location: '',
    position: '',
    project: '',
    employmentType: '',
    experienceLevel: '',
    educationLevel: '',
    responsibilities: '',
    qualificationExperience: '',
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
            {isViewMode ? 'View Job Posting' : (isEditing ? 'Edit Job Posting' : 'Create Job Posting')}
          </Typography>
          {isViewMode && (
            <Button
              variant="contained"
              sx={{ ml: 2 }}
              onClick={() => navigate(`/hr/talent-acquisition/job-postings/${id}/edit`)}
            >
              Edit
            </Button>
          )}
        </Box>
        <Typography variant="body1" color="text.secondary">
          {isViewMode ? 'Review job posting details' : (isEditing ? 'Update job posting details' : 'Create a new job posting')}
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
                <Box component="fieldset" disabled={isViewMode} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
                  {/* Step 1: Basic Information */}
                  {activeStep === 0 && (
                    <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                      <Work sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Basic Information
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
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
                        <FormControl fullWidth error={touched.project && Boolean(errors.project)}>
                          <InputLabel>Project</InputLabel>
                          <Select
                            name="project"
                            value={values.project}
                            onChange={(e) => {
                              const selectedValue = e.target.value;
                              if (selectedValue === ADD_NEW_PROJECT_VALUE) {
                                openProjectDialog();
                                return;
                              }
                              handleChange(e);
                            }}
                            onBlur={handleBlur}
                            label="Project"
                          >
                            {projects.map((proj) => (
                              <MenuItem key={proj._id} value={proj._id}>
                                {proj.name}
                              </MenuItem>
                            ))}
                            <Divider />
                            <MenuItem value={ADD_NEW_PROJECT_VALUE} sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                              + Add New Project
                            </MenuItem>
                          </Select>
                          {touched.project && errors.project && (
                            <FormHelperText>{errors.project}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth error={touched.department && Boolean(errors.department)}>
                          <InputLabel>Department</InputLabel>
                          <Select
                            name="department"
                            value={values.department}
                            onChange={(e) => {
                              const selectedValue = e.target.value;
                              if (selectedValue === ADD_NEW_DEPARTMENT_VALUE) {
                                openDepartmentDialog();
                                return;
                              }
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
                            <Divider />
                            <MenuItem value={ADD_NEW_DEPARTMENT_VALUE} sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                              + Add New Department
                            </MenuItem>
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
                            onChange={(e) => {
                              const selectedValue = e.target.value;
                              if (selectedValue === ADD_NEW_LOCATION_VALUE) {
                                openLocationDialog();
                                return;
                              }
                              handleChange(e);
                            }}
                            onBlur={handleBlur}
                            label="Location"
                          >
                            {locations.map((loc) => (
                              <MenuItem key={loc._id} value={loc._id}>
                                {loc.name}
                              </MenuItem>
                            ))}
                            <Divider />
                            <MenuItem value={ADD_NEW_LOCATION_VALUE} sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                              + Add New Location
                            </MenuItem>
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
                            onChange={(e) => {
                              const selectedValue = e.target.value;
                              if (selectedValue === ADD_NEW_POSITION_VALUE) {
                                if (!values.department) {
                                  setSnackbar({
                                    open: true,
                                    message: 'Please select a department before adding a new position',
                                    severity: 'warning'
                                  });
                                  return;
                                }
                                openPositionDialog();
                                return;
                              }
                              handleChange(e);
                            }}
                            onBlur={handleBlur}
                            label="Position"
                          >
                            {positions.map((pos) => (
                              <MenuItem key={pos._id} value={pos._id}>
                                {pos.title}
                              </MenuItem>
                            ))}
                            <Divider />
                            <MenuItem value={ADD_NEW_POSITION_VALUE} sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                              + Add New Position
                            </MenuItem>
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
                          name="qualificationExperience"
                          label="Qualification&Experience"
                          multiline
                          rows={3}
                          value={values.qualificationExperience}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="List required qualification and relevant experience..."
                        />
                      </Grid>
                    </Grid>
                    </Box>
                  )}

                  {/* Step 3: Application Details */}
                  {activeStep === 2 && (
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
                </Box>

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
                        disabled={isViewMode || loading || !isValid}
                        startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                      >
                        {loading ? 'Saving...' : (isEditing ? 'Update Job Posting' : 'Create Job Posting')}
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={() => handleNext(values, { setFieldError, setTouched })}
                        disabled={isViewMode ? false : !isCurrentStepValid(values, errors)}
                      >
                        Next
                      </Button>
                    )}
                  </Box>
                </Box>
                

              </CardContent>
            </Card>
            {/* Add Position Dialog */}
            <Dialog open={positionDialogOpen} onClose={closePositionDialog} fullWidth maxWidth="xs">
              <DialogTitle>Add New Position</DialogTitle>
              <DialogContent>
                <TextField
                  autoFocus
                  margin="dense"
                  fullWidth
                  label="Position Title"
                  value={newPositionTitle}
                  onChange={(e) => {
                    setNewPositionTitle(e.target.value);
                    if (positionDialogError) setPositionDialogError('');
                  }}
                  error={Boolean(positionDialogError)}
                  helperText={positionDialogError || ' '}
                />
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={closePositionDialog} disabled={creatingPosition}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={() => handleCreatePosition(values.department, setFieldValue)}
                  disabled={creatingPosition}
                  startIcon={creatingPosition ? <CircularProgress size={16} /> : null}
                >
                  {creatingPosition ? 'Saving...' : 'Save'}
                </Button>
              </DialogActions>
            </Dialog>

            {/* Add Location Dialog */}
            <Dialog open={locationDialogOpen} onClose={closeLocationDialog} fullWidth maxWidth="xs">
              <DialogTitle>Add New Location</DialogTitle>
              <DialogContent>
                <TextField
                  autoFocus
                  margin="dense"
                  fullWidth
                  label="Location Name"
                  value={newLocationName}
                  onChange={(e) => {
                    setNewLocationName(e.target.value);
                    if (locationDialogError) setLocationDialogError('');
                  }}
                  error={Boolean(locationDialogError)}
                  helperText={locationDialogError || ' '}
                />
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={closeLocationDialog} disabled={creatingLocation}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={() => handleCreateLocation(setFieldValue)}
                  disabled={creatingLocation}
                  startIcon={creatingLocation ? <CircularProgress size={16} /> : null}
                >
                  {creatingLocation ? 'Saving...' : 'Save'}
                </Button>
              </DialogActions>
            </Dialog>

            {/* Add Department Dialog */}
            <Dialog open={departmentDialogOpen} onClose={closeDepartmentDialog} fullWidth maxWidth="xs">
              <DialogTitle>Add New Department</DialogTitle>
              <DialogContent>
                <TextField
                  autoFocus
                  margin="dense"
                  fullWidth
                  label="Department Name"
                  value={newDepartmentName}
                  onChange={(e) => {
                    setNewDepartmentName(e.target.value);
                    if (departmentDialogError) setDepartmentDialogError('');
                  }}
                  error={Boolean(departmentDialogError)}
                  helperText={departmentDialogError || ' '}
                />
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={closeDepartmentDialog} disabled={creatingDepartment}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={() => handleCreateDepartment(setFieldValue)}
                  disabled={creatingDepartment}
                  startIcon={creatingDepartment ? <CircularProgress size={16} /> : null}
                >
                  {creatingDepartment ? 'Saving...' : 'Save'}
                </Button>
              </DialogActions>
            </Dialog>

            {/* Add Project Dialog */}
            <Dialog open={projectDialogOpen} onClose={closeProjectDialog} fullWidth maxWidth="xs">
              <DialogTitle>Add New Project</DialogTitle>
              <DialogContent>
                <TextField
                  autoFocus
                  margin="dense"
                  fullWidth
                  label="Project Name"
                  value={newProjectName}
                  onChange={(e) => {
                    setNewProjectName(e.target.value);
                    if (projectDialogError) setProjectDialogError('');
                  }}
                  error={Boolean(projectDialogError)}
                  helperText={projectDialogError || ' '}
                />
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={closeProjectDialog} disabled={creatingProject}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={() => handleCreateProject(setFieldValue)}
                  disabled={creatingProject}
                  startIcon={creatingProject ? <CircularProgress size={16} /> : null}
                >
                  {creatingProject ? 'Saving...' : 'Save'}
                </Button>
              </DialogActions>
            </Dialog>
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