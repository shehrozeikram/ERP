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
  FormHelperText,
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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  ContactPhone as ContactIcon,
  School as EducationIcon,
  AttachMoney as SalaryIcon,
  Add as AddIcon,
  PhotoCamera as PhotoCameraIcon,
  Upload as UploadIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';

const steps = ['Personal Information', 'Employment Details', 'Placement', 'Contact & Address', 'Salary & Benefits'];

const EmployeeForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [banks, setBanks] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [countries, setCountries] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [nextEmployeeId, setNextEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [employee, setEmployee] = useState(null);
  const [showAddPositionDialog, setShowAddPositionDialog] = useState(false);
  const [newPositionData, setNewPositionData] = useState({
    title: '',
    level: 'Entry',
    description: ''
  });

  // Validation schema
  const validationSchema = Yup.object({
    firstName: Yup.string().required('First name is required'),
    lastName: Yup.string().required('Last name is required'),
    email: Yup.string().email('Invalid email').required('Email is required'),
    phone: Yup.string().required('Phone is required'),
    dateOfBirth: Yup.date().required('Date of birth is required'),
    gender: Yup.string().required('Gender is required'),
    idCard: Yup.string().required('ID Card number is required'),
    nationality: Yup.string().required('Nationality is required'),
    religion: Yup.string().required('Religion is required'),
    maritalStatus: Yup.string().required('Marital status is required'),
    employeeId: Yup.string(),
    department: Yup.string().required('Department is required'),
    position: Yup.string().required('Position is required'),
    qualification: Yup.string().required('Qualification is required'),
    bankName: Yup.string().required('Bank name is required'),
    foreignBankAccount: Yup.string(),
    spouseName: Yup.string().when('maritalStatus', {
      is: 'Married',
      then: (schema) => schema.required('Spouse name is required when married'),
      otherwise: (schema) => schema.optional()
    }),
    appointmentDate: Yup.date().required('Appointment date is required'),
    probationPeriodMonths: Yup.number()
      .required('Probation period is required')
      .min(0, 'Probation period cannot be negative')
      .max(24, 'Probation period cannot exceed 24 months'),
    hireDate: Yup.date().required('Hire date is required'),
    // Placement fields
    placementCompany: Yup.string(),
    placementProject: Yup.string(),
    placementDepartment: Yup.string(),
    placementSection: Yup.string(),
    placementDesignation: Yup.string(),
    oldDesignation: Yup.string(),
    placementLocation: Yup.string(),
    salary: Yup.number().positive('Salary must be positive').required('Salary is required'),
    address: Yup.object({
      street: Yup.string().required('Street address is required'),
      city: Yup.string().required('City is required'),
      state: Yup.string().required('State is required'),
                  city: Yup.string().required('City is required'),
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

  // Fetch positions by department
  const fetchPositionsByDepartment = async (departmentId) => {
    if (!departmentId) {
      setPositions([]);
      return;
    }
    try {
      const response = await api.get(`/hr/positions/${departmentId}`);
      setPositions(response.data.data || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
      setPositions([]);
    }
  };

  // Fetch banks
  const fetchBanks = async () => {
    try {
      const response = await api.get('/hr/banks');
      setBanks(response.data.data || []);
    } catch (error) {
      console.error('Error fetching banks:', error);
    }
  };

  // Fetch companies
  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data.data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  // Fetch projects
  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      setProjects(response.data.data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  // Fetch sections
  const fetchSections = async () => {
    try {
      const response = await api.get('/sections');
      setSections(response.data.data || []);
    } catch (error) {
      console.error('Error fetching sections:', error);
    }
  };

  // Fetch designations
  const fetchDesignations = async () => {
    try {
      const response = await api.get('/designations');
      setDesignations(response.data.data || []);
    } catch (error) {
      console.error('Error fetching designations:', error);
    }
  };

  // Fetch locations
  const fetchLocations = async () => {
    try {
      const response = await api.get('/locations');
      setLocations(response.data.data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  // Fetch address data
  const fetchCountries = async () => {
    try {
      const response = await api.get('/countries');
      setCountries(response.data.data || []);
    } catch (error) {
      console.error('Error fetching countries:', error);
    }
  };

  const fetchProvinces = async (countryId = null) => {
    try {
      const url = countryId ? `/provinces?country=${countryId}` : '/provinces';
      const response = await api.get(url);
      setProvinces(response.data.data || []);
    } catch (error) {
      console.error('Error fetching provinces:', error);
    }
  };

  const fetchCities = async (provinceId = null) => {
    try {
      const url = provinceId ? `/cities?province=${provinceId}` : '/cities';
      const response = await api.get(url);
      setCities(response.data.data || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  // Fetch next employee ID
  const fetchNextEmployeeId = async () => {
    try {
      const response = await api.get('/hr/employees/next-id');
      setNextEmployeeId(response.data.data.nextEmployeeId);
    } catch (error) {
      console.error('Error fetching next employee ID:', error);
    }
  };

  // Handle image upload
  const handleImageUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append('profileImage', file);

      const response = await api.post('/hr/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        formik.setFieldValue('profileImage', response.data.data.imagePath);
        setImagePreview(URL.createObjectURL(file));
        setSnackbar({
          open: true,
          message: 'Image uploaded successfully!',
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setSnackbar({
        open: true,
        message: 'Error uploading image',
        severity: 'error'
      });
    }
  };

  // Handle file input change
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      handleImageUpload(file);
    }
  };

  // Handle camera capture
  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'camera';
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (file) {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        handleImageUpload(file);
      }
    };
    input.click();
  };

  // Fetch employee for editing
  const fetchEmployee = async () => {
    if (!id || id === 'add') return;
    
    // Validate ID format before making request
    if (id && !/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error('❌ Invalid employee ID format:', id);
      setSnackbar({
        open: true,
        message: `Invalid employee ID format: ${id}. Please check the URL.`,
        severity: 'error'
      });
      return;
    }
    
    try {
      setLoading(true);
      console.log('🔍 Fetching employee with ID:', id);
      
      // Check if token exists
      const token = localStorage.getItem('token');
      console.log('🔍 Token exists:', !!token);
      console.log('🔍 API URL:', process.env.REACT_APP_API_URL || 'http://localhost:5001/api');
      
      // Test basic connectivity first
      console.log('🔍 Testing basic connectivity...');
      try {
        const healthResponse = await api.get('/health');
        console.log('🔍 Health check successful:', healthResponse.status);
      } catch (healthError) {
        console.error('🔍 Health check failed:', healthError);
        console.error('🔍 Health error type:', healthError.name);
        console.error('🔍 Health error message:', healthError.message);
        if (healthError.code) console.error('🔍 Health error code:', healthError.code);
      }
      
      const response = await api.get(`/hr/employees/${id}`);
      console.log('🔍 API Response:', response);
      const employeeData = response.data.data;
      console.log('🔍 Employee Data:', employeeData);
      setEmployee(employeeData);
      
      // Extract IDs from populated objects
      const formData = {
        ...employeeData,
        department: employeeData.department?._id || employeeData.department || '',
        position: employeeData.position?._id || employeeData.position || '',
        bankName: employeeData.bankName?._id || employeeData.bankName || '',
        placementCompany: employeeData.placementCompany?._id || employeeData.placementCompany || '',
        placementProject: employeeData.placementProject?._id || employeeData.placementProject || '',
        placementDepartment: employeeData.placementDepartment?._id || employeeData.placementDepartment || '',
        placementSection: employeeData.placementSection?._id || employeeData.placementSection || '',
        placementDesignation: employeeData.placementDesignation?._id || employeeData.placementDesignation || '',
        oldDesignation: employeeData.oldDesignation?._id || employeeData.oldDesignation || undefined,
        placementLocation: employeeData.placementLocation?._id || employeeData.placementLocation || '',
        address: {
          ...employeeData.address,
          city: employeeData.address?.city?._id || employeeData.address?.city || '',
          state: employeeData.address?.state?._id || employeeData.address?.state || '',
          country: employeeData.address?.country?._id || employeeData.address?.country || ''
        },
        dateOfBirth: employeeData.dateOfBirth ? new Date(employeeData.dateOfBirth).toISOString().split('T')[0] : '',
        hireDate: employeeData.hireDate ? new Date(employeeData.hireDate).toISOString().split('T')[0] : '',
        appointmentDate: employeeData.appointmentDate ? new Date(employeeData.appointmentDate).toISOString().split('T')[0] : '',
        endOfProbationDate: employeeData.endOfProbationDate ? new Date(employeeData.endOfProbationDate).toISOString().split('T')[0] : '',
        confirmationDate: employeeData.confirmationDate ? new Date(employeeData.confirmationDate).toISOString().split('T')[0] : ''
      };
      
      console.log('🔍 Form Data prepared:', formData);
      formik.setValues(formData);
      
      // Fetch dependent data if needed
      if (formData.department) {
        fetchPositionsByDepartment(formData.department);
      }
      if (formData.address.country) {
        fetchProvinces(formData.address.country);
      }
      if (formData.address.state) {
        fetchCities(formData.address.state);
      }
    } catch (error) {
      console.error('Error fetching employee:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      console.error('Error config:', error.config);
      
      // Handle specific error cases
      if (error.name === 'NetworkError' || error.code === 'ERR_NETWORK') {
        console.error('🔍 Network Error detected - possible causes:');
        console.error('   - Server not running');
        console.error('   - CORS issues');
        console.error('   - Network connectivity problems');
        console.error('   - Wrong API URL');
        setSnackbar({
          open: true,
          message: 'Network Error: Cannot connect to server. Please check if the server is running.',
          severity: 'error'
        });
      } else if (error.response?.status === 401) {
        console.error('🔐 Authentication error - token might be invalid or expired');
        setSnackbar({
          open: true,
          message: 'Authentication error. Please log in again.',
          severity: 'error'
        });
        // Redirect to login after a delay
        setTimeout(() => {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }, 2000);
      } else if (error.response?.status === 404) {
        setSnackbar({
          open: true,
          message: 'Employee not found',
          severity: 'error'
        });
      } else {
        setSnackbar({
          open: true,
          message: `Error fetching employee details: ${error.response?.data?.message || error.message}`,
          severity: 'error'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchBanks();
    fetchCompanies();
    fetchProjects();
    fetchSections();
    fetchDesignations();
    fetchLocations();
    fetchCountries();
    fetchProvinces();
    fetchCities();
    fetchNextEmployeeId();
    if (id && id !== 'add') {
      fetchEmployee();
    }
  }, [id]);

  // Update formik values when nextEmployeeId is fetched
  useEffect(() => {
    if (nextEmployeeId && !id) {
      formik.setFieldValue('employeeId', nextEmployeeId);
    }
  }, [nextEmployeeId, id]);

  const formik = useFormik({
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      gender: '',
      idCard: '',
      nationality: '',
      profileImage: '',
      religion: 'Islam',
      maritalStatus: 'Single',
      employeeId: nextEmployeeId,
      department: '',
      position: '',
      qualification: '',
      bankName: '',
      foreignBankAccount: '',
      spouseName: '',
      appointmentDate: '',
      probationPeriodMonths: 3,
      hireDate: '',
      salary: '',
      // Placement fields
      placementCompany: '',
      placementProject: '',
      placementDepartment: '',
      placementSection: '',
      placementDesignation: '',
      oldDesignation: undefined,
      placementLocation: '',
      isActive: true,
      address: {
        street: '',
        city: '',
        state: '',
                  city: '',
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
        
        // Clean up values before submission
        const cleanedValues = { ...values };
        
        // Handle empty oldDesignation
        if (cleanedValues.oldDesignation === '' || cleanedValues.oldDesignation === undefined) {
          delete cleanedValues.oldDesignation;
        }
        
        if (id && id !== 'add') {
          // Update existing employee
          await api.put(`/hr/employees/${id}`, cleanedValues);
          setSnackbar({
            open: true,
            message: 'Employee updated successfully',
            severity: 'success'
          });
        } else {
          // Create new employee
          await api.post('/hr/employees', cleanedValues);
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

  // Handle department change
  const handleDepartmentChange = (departmentId) => {
    formik.setFieldValue('department', departmentId);
    formik.setFieldValue('position', ''); // Reset position when department changes
    fetchPositionsByDepartment(departmentId);
  };

  // Handle add new position
  const handleAddNewPosition = () => {
    setNewPositionData({
      title: '',
      level: 'Entry',
      description: ''
    });
    setShowAddPositionDialog(true);
  };

  const handleSaveNewPosition = async () => {
    try {
      if (!formik.values.department) {
        setSnackbar({
          open: true,
          message: 'Please select a department first',
          severity: 'error'
        });
        return;
      }

      const positionData = {
        ...newPositionData,
        department: formik.values.department
      };

      const response = await api.post('/positions', positionData);
      
      setSnackbar({
        open: true,
        message: 'Position added successfully',
        severity: 'success'
      });

      setShowAddPositionDialog(false);
      
      // Refresh positions for the current department
      await fetchPositionsByDepartment(formik.values.department);
      
      // Set the newly created position as selected
      formik.setFieldValue('position', response.data.data._id);
      
    } catch (error) {
      console.error('Error adding position:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error adding position',
        severity: 'error'
      });
    }
  };

  const handleNewPositionChange = (field, value) => {
    setNewPositionData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Calculate end of probation date
  const calculateEndOfProbation = (appointmentDate, probationMonths) => {
    if (!appointmentDate || !probationMonths) return '';
    
    const endDate = new Date(appointmentDate);
    endDate.setMonth(endDate.getMonth() + parseInt(probationMonths));
    return endDate.toISOString().split('T')[0];
  };

  // Handle appointment date or probation period change
  const handleProbationChange = (field, value) => {
    formik.setFieldValue(field, value);
    
    if (field === 'appointmentDate' || field === 'probationPeriodMonths') {
      const appointmentDate = field === 'appointmentDate' ? value : formik.values.appointmentDate;
      const probationMonths = field === 'probationPeriodMonths' ? value : formik.values.probationPeriodMonths;
      
      const endDate = calculateEndOfProbation(appointmentDate, probationMonths);
      formik.setFieldValue('endOfProbationDate', endDate);
    }
  };

  // Handle address dropdown changes
  const handleCountryChange = (countryId) => {
    formik.setFieldValue('address.country', countryId);
    formik.setFieldValue('address.state', '');
    formik.setFieldValue('address.city', '');
    if (countryId) {
      fetchProvinces(countryId);
    }
  };

  const handleProvinceChange = (provinceId) => {
    formik.setFieldValue('address.state', provinceId);
    formik.setFieldValue('address.city', '');
    if (provinceId) {
      fetchCities(provinceId);
    }
  };

  // Handle marital status change
  const handleMaritalStatusChange = (status) => {
    formik.setFieldValue('maritalStatus', status);
    if (status !== 'Married') {
      formik.setFieldValue('spouseName', '');
    }
  };

  // Helper function to safely render text
  const safeRenderText = (value) => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (value && typeof value === 'object' && value.name) return value.name;
    if (value && typeof value === 'object' && value.title) return value.title;
    return 'Unknown';
  };

  // Helper function to safely get form value
  const safeFormValue = (value) => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (value && typeof value === 'object' && value._id !== undefined && value._id !== null) {
      return value._id.toString();
    }
    return '';
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
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="idCard"
                label="ID Card Number"
                value={formik.values.idCard}
                onChange={formik.handleChange}
                error={formik.touched.idCard && Boolean(formik.errors.idCard)}
                helperText={formik.touched.idCard && formik.errors.idCard}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="nationality"
                label="Nationality"
                value={formik.values.nationality}
                onChange={formik.handleChange}
                error={formik.touched.nationality && Boolean(formik.errors.nationality)}
                helperText={formik.touched.nationality && formik.errors.nationality}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Avatar
                  src={imagePreview || formik.values.profileImage}
                  sx={{ width: 120, height: 120, border: '2px solid #e0e0e0' }}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<UploadIcon />}
                    size="small"
                  >
                    Upload Image
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PhotoCameraIcon />}
                    onClick={handleCameraCapture}
                    size="small"
                  >
                    Camera
                  </Button>
                </Box>
                {formik.values.profileImage && (
                  <Typography variant="caption" color="textSecondary">
                    Image uploaded successfully
                  </Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Religion</InputLabel>
                <Select
                  name="religion"
                  value={formik.values.religion}
                  onChange={formik.handleChange}
                  error={formik.touched.religion && Boolean(formik.errors.religion)}
                  label="Religion"
                >
                  <MenuItem value="Islam">Islam</MenuItem>
                  <MenuItem value="Christianity">Christianity</MenuItem>
                  <MenuItem value="Hinduism">Hinduism</MenuItem>
                  <MenuItem value="Sikhism">Sikhism</MenuItem>
                  <MenuItem value="Buddhism">Buddhism</MenuItem>
                  <MenuItem value="Judaism">Judaism</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                  <MenuItem value="None">None</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Marital Status</InputLabel>
                <Select
                  name="maritalStatus"
                  value={formik.values.maritalStatus}
                  onChange={(e) => handleMaritalStatusChange(e.target.value)}
                  error={formik.touched.maritalStatus && Boolean(formik.errors.maritalStatus)}
                  label="Marital Status"
                >
                  <MenuItem value="Single">Single</MenuItem>
                  <MenuItem value="Married">Married</MenuItem>
                  <MenuItem value="Divorced">Divorced</MenuItem>
                  <MenuItem value="Widowed">Widowed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {formik.values.maritalStatus === 'Married' && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="spouseName"
                  label="Spouse Name"
                  value={formik.values.spouseName}
                  onChange={formik.handleChange}
                  error={formik.touched.spouseName && Boolean(formik.errors.spouseName)}
                  helperText={formik.touched.spouseName && formik.errors.spouseName}
                />
              </Grid>
            )}
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
                value={nextEmployeeId || 'Loading...'}
                InputProps={{
                  readOnly: true,
                }}
                helperText="Employee ID will be auto-generated"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  name="department"
                  value={safeFormValue(formik.values.department)}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  error={formik.touched.department && Boolean(formik.errors.department)}
                  label="Department"
                >
                  {departments.map((dept) => (
                    <MenuItem key={dept._id} value={dept._id}>
                      {safeRenderText(dept.name)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Position</InputLabel>
                <Select
                  name="position"
                  value={safeFormValue(formik.values.position)}
                  onChange={formik.handleChange}
                  error={formik.touched.position && Boolean(formik.errors.position)}
                  label="Position"
                  disabled={!safeFormValue(formik.values.department)}
                >
                  {positions.map((pos) => (
                    <MenuItem key={pos._id} value={pos._id}>
                      {safeRenderText(pos.title)} - {safeRenderText(pos.level)}
                    </MenuItem>
                  ))}
                  {safeFormValue(formik.values.department) && (
                    <MenuItem 
                      value="add_new" 
                      onClick={handleAddNewPosition}
                      sx={{ 
                        borderTop: '1px solid #e0e0e0',
                        backgroundColor: '#f5f5f5',
                        '&:hover': {
                          backgroundColor: '#e3f2fd'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AddIcon fontSize="small" />
                        Add New Position
                      </Box>
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Qualification</InputLabel>
                <Select
                  name="qualification"
                  value={formik.values.qualification}
                  onChange={formik.handleChange}
                  error={formik.touched.qualification && Boolean(formik.errors.qualification)}
                  label="Qualification"
                >
                  <MenuItem value="LLB">LLB</MenuItem>
                  <MenuItem value="MBA">MBA</MenuItem>
                  <MenuItem value="BBA">BBA</MenuItem>
                  <MenuItem value="BSc">BSc</MenuItem>
                  <MenuItem value="MSc">MSc</MenuItem>
                  <MenuItem value="PhD">PhD</MenuItem>
                  <MenuItem value="CA">CA</MenuItem>
                  <MenuItem value="ACCA">ACCA</MenuItem>
                  <MenuItem value="CMA">CMA</MenuItem>
                  <MenuItem value="CFA">CFA</MenuItem>
                  <MenuItem value="Diploma">Diploma</MenuItem>
                  <MenuItem value="Certificate">Certificate</MenuItem>
                  <MenuItem value="High School">High School</MenuItem>
                  <MenuItem value="Intermediate">Intermediate</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
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
              <FormControl fullWidth>
                <InputLabel>Bank Name</InputLabel>
                <Select
                  name="bankName"
                  value={safeFormValue(formik.values.bankName)}
                  onChange={formik.handleChange}
                  error={formik.touched.bankName && Boolean(formik.errors.bankName)}
                  label="Bank Name"
                >
                  {banks.map((bank) => (
                    <MenuItem key={bank._id} value={bank._id}>
                      {safeRenderText(bank.name)} ({safeRenderText(bank.type)})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="foreignBankAccount"
                label="Foreign Bank Account (Optional)"
                value={formik.values.foreignBankAccount}
                onChange={formik.handleChange}
                error={formik.touched.foreignBankAccount && Boolean(formik.errors.foreignBankAccount)}
                helperText={formik.touched.foreignBankAccount && formik.errors.foreignBankAccount}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="appointmentDate"
                label="Appointment Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formik.values.appointmentDate}
                onChange={(e) => handleProbationChange('appointmentDate', e.target.value)}
                error={formik.touched.appointmentDate && Boolean(formik.errors.appointmentDate)}
                helperText={formik.touched.appointmentDate && formik.errors.appointmentDate}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="probationPeriodMonths"
                label="Probation Period (Months)"
                type="number"
                value={formik.values.probationPeriodMonths}
                onChange={(e) => handleProbationChange('probationPeriodMonths', e.target.value)}
                error={formik.touched.probationPeriodMonths && Boolean(formik.errors.probationPeriodMonths)}
                helperText={formik.touched.probationPeriodMonths && formik.errors.probationPeriodMonths}
                inputProps={{ min: 0, max: 24 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="endOfProbationDate"
                label="End of Probation Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formik.values.endOfProbationDate || ''}
                InputProps={{
                  readOnly: true,
                }}
                helperText="Auto-calculated based on appointment date and probation period"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="confirmationDate"
                label="Confirmation Date (Optional)"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formik.values.confirmationDate || ''}
                onChange={formik.handleChange}
                error={formik.touched.confirmationDate && Boolean(formik.errors.confirmationDate)}
                helperText={formik.touched.confirmationDate && formik.errors.confirmationDate}
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
                Placement Information
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Company</InputLabel>
                <Select
                  name="placementCompany"
                  value={safeFormValue(formik.values.placementCompany)}
                  onChange={formik.handleChange}
                  error={formik.touched.placementCompany && Boolean(formik.errors.placementCompany)}
                  label="Company"
                >
                  {companies.map((company) => (
                    <MenuItem key={company._id} value={company._id}>
                      {safeRenderText(company.name)} ({safeRenderText(company.type)})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Project</InputLabel>
                <Select
                  name="placementProject"
                  value={safeFormValue(formik.values.placementProject)}
                  onChange={formik.handleChange}
                  error={formik.touched.placementProject && Boolean(formik.errors.placementProject)}
                  label="Project"
                >
                  {projects.map((project) => (
                    <MenuItem key={project._id} value={project._id}>
                      {safeRenderText(project.name)} - {safeRenderText(project.company?.name)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  name="placementDepartment"
                  value={safeFormValue(formik.values.placementDepartment)}
                  onChange={formik.handleChange}
                  error={formik.touched.placementDepartment && Boolean(formik.errors.placementDepartment)}
                  label="Department"
                >
                  {departments.map((dept) => (
                    <MenuItem key={dept._id} value={dept._id}>
                      {safeRenderText(dept.name)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Section</InputLabel>
                <Select
                  name="placementSection"
                  value={safeFormValue(formik.values.placementSection)}
                  onChange={formik.handleChange}
                  error={formik.touched.placementSection && Boolean(formik.errors.placementSection)}
                  label="Section"
                >
                  {sections.map((section) => (
                    <MenuItem key={section._id} value={section._id}>
                      {safeRenderText(section.name)} - {safeRenderText(section.department?.name)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Designation</InputLabel>
                <Select
                  name="placementDesignation"
                  value={safeFormValue(formik.values.placementDesignation)}
                  onChange={formik.handleChange}
                  error={formik.touched.placementDesignation && Boolean(formik.errors.placementDesignation)}
                  label="Designation"
                >
                  {designations.map((designation) => (
                    <MenuItem key={designation._id} value={designation._id}>
                      {safeRenderText(designation.title)} - {safeRenderText(designation.level)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Old Designation (Optional)</InputLabel>
                <Select
                  name="oldDesignation"
                  value={safeFormValue(formik.values.oldDesignation)}
                  onChange={formik.handleChange}
                  error={formik.touched.oldDesignation && Boolean(formik.errors.oldDesignation)}
                  label="Old Designation (Optional)"
                >
                  {designations.map((designation) => (
                    <MenuItem key={designation._id} value={designation._id}>
                      {safeRenderText(designation.title)} - {safeRenderText(designation.level)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Location</InputLabel>
                <Select
                  name="placementLocation"
                  value={safeFormValue(formik.values.placementLocation)}
                  onChange={formik.handleChange}
                  error={formik.touched.placementLocation && Boolean(formik.errors.placementLocation)}
                  label="Location"
                >
                  {locations.map((location) => (
                    <MenuItem key={location._id} value={location._id}>
                      {safeRenderText(location.name)} ({safeRenderText(location.type)})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );

      case 3:
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
              <FormControl fullWidth>
                <InputLabel>Country</InputLabel>
                <Select
                  name="address.country"
                  value={safeFormValue(formik.values.address.country)}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  error={formik.touched.address?.country && Boolean(formik.errors.address?.country)}
                  label="Country"
                >
                  {countries.map((country) => (
                    <MenuItem key={country._id} value={country._id}>
                      {safeRenderText(country.name)} ({safeRenderText(country.code)})
                    </MenuItem>
                  ))}
                </Select>
                {formik.touched.address?.country && formik.errors.address?.country && (
                  <FormHelperText error>{formik.errors.address?.country}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>State/Province</InputLabel>
                <Select
                  name="address.state"
                  value={safeFormValue(formik.values.address.state)}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                  error={formik.touched.address?.state && Boolean(formik.errors.address?.state)}
                  label="State/Province"
                  disabled={!formik.values.address.country}
                >
                  {provinces.map((province) => (
                    <MenuItem key={province._id} value={province._id}>
                      {safeRenderText(province.name)}
                    </MenuItem>
                  ))}
                </Select>
                {formik.touched.address?.state && formik.errors.address?.state && (
                  <FormHelperText error>{formik.errors.address?.state}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>City</InputLabel>
                <Select
                  name="address.city"
                  value={safeFormValue(formik.values.address.city)}
                  onChange={formik.handleChange}
                  error={formik.touched.address?.city && Boolean(formik.errors.address?.city)}
                  label="City"
                  disabled={!formik.values.address.state}
                >
                  {cities.map((city) => (
                    <MenuItem key={city._id} value={city._id}>
                      {safeRenderText(city.name)}
                    </MenuItem>
                  ))}
                </Select>
                {formik.touched.address?.city && formik.errors.address?.city && (
                  <FormHelperText error>{formik.errors.address?.city}</FormHelperText>
                )}
              </FormControl>
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

      case 4:
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
                    <strong>Base Salary:</strong> {formatPKR(formik.values.salary || 0)}
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
                    <strong>Department:</strong> {safeRenderText(departments.find(d => d._id === safeFormValue(formik.values.department))?.name) || 'Not selected'}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Position:</strong> {safeRenderText(positions.find(p => p._id === safeFormValue(formik.values.position))?.title) || 'Not selected'}
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

      {/* Add New Position Dialog */}
      <Dialog open={showAddPositionDialog} onClose={() => setShowAddPositionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Position</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Position Title"
                  value={newPositionData.title}
                  onChange={(e) => handleNewPositionChange('title', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Level</InputLabel>
                  <Select
                    value={newPositionData.level}
                    onChange={(e) => handleNewPositionChange('level', e.target.value)}
                    label="Level"
                  >
                    <MenuItem value="Entry">Entry</MenuItem>
                    <MenuItem value="Junior">Junior</MenuItem>
                    <MenuItem value="Mid">Mid</MenuItem>
                    <MenuItem value="Senior">Senior</MenuItem>
                    <MenuItem value="Lead">Lead</MenuItem>
                    <MenuItem value="Manager">Manager</MenuItem>
                    <MenuItem value="Director">Director</MenuItem>
                    <MenuItem value="Executive">Executive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  Department: {safeRenderText(departments.find(d => d._id === formik.values.department)?.name) || 'Not selected'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={newPositionData.description}
                  onChange={(e) => handleNewPositionChange('description', e.target.value)}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddPositionDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveNewPosition} variant="contained">
            Add Position
          </Button>
        </DialogActions>
      </Dialog>

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