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
import { useData } from '../../contexts/DataContext';

const steps = ['Personal Information', 'Employment Details', 'Contact & Address', 'Salary & Benefits'];

const EmployeeForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchEmployees } = useData();
  const [activeStep, setActiveStep] = useState(0);
  const [departments, setDepartments] = useState([]);

  const [banks, setBanks] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [sectors, setSectors] = useState([]);
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

  const [showAddCompanyDialog, setShowAddCompanyDialog] = useState(false);
  const [showAddSectorDialog, setShowAddSectorDialog] = useState(false);
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [showAddDepartmentDialog, setShowAddDepartmentDialog] = useState(false);
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [showAddDesignationDialog, setShowAddDesignationDialog] = useState(false);
  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false);


  // New data states for placement dialogs
  const [newCompanyData, setNewCompanyData] = useState({
    name: '',
    code: '',
    type: 'Private Limited',
    description: ''
  });

  const [newSectorData, setNewSectorData] = useState({
    name: '',
    industry: 'Technology'
  });

  const [newProjectData, setNewProjectData] = useState({
    name: '',
    code: '',
    description: ''
  });

  const [newDepartmentData, setNewDepartmentData] = useState({
    name: '',
    code: '',
    description: ''
  });

  const [newSectionData, setNewSectionData] = useState({
    name: ''
  });

  const [newDesignationData, setNewDesignationData] = useState({
    title: '',
    level: 'Entry',
    description: ''
  });

  const [newLocationData, setNewLocationData] = useState({
    name: '',
    type: 'Office',
    description: ''
  });



  // State for company search suggestions
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);

  // State for project search suggestions
  const [projectSuggestions, setProjectSuggestions] = useState([]);
  const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);

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
    qualification: Yup.string().required('Qualification is required'),
    bankName: Yup.string().required('Bank name is required'),
    bankAccountNumber: Yup.string().required('Bank account number is required'),
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
    // Employment status
    employmentStatus: Yup.string().oneOf(['Draft', 'Active', 'Inactive', 'Terminated', 'Resigned', 'Retired'], 'Invalid employment status'),
    // Placement fields
    placementCompany: Yup.string().required('Company is required'),
    placementSector: Yup.string().required('Sector is required'),
    placementProject: Yup.string(),
    placementDepartment: Yup.string(),
    placementSection: Yup.string(),
    placementDesignation: Yup.string(),
    placementLocation: Yup.string(),
    oldDesignation: Yup.string(),
    salary: Yup.object({
      gross: Yup.number().nullable().optional().min(0, 'Gross salary must be positive'),
      basic: Yup.number().min(0, 'Basic salary must be positive')
    }),
    allowances: Yup.object({
      conveyance: Yup.object({
        isActive: Yup.boolean(),
        amount: Yup.number().min(0, 'Conveyance allowance must be positive')
      }),
      food: Yup.object({
        isActive: Yup.boolean(),
        amount: Yup.number().min(0, 'Food allowance must be positive')
      }),
      vehicleFuel: Yup.object({
        isActive: Yup.boolean(),
        amount: Yup.number().min(0, 'Vehicle & fuel allowance must be positive')
      }),
      medical: Yup.object({
        isActive: Yup.boolean(),
        amount: Yup.number().min(0, 'Medical allowance must be positive')
      }),
      houseRent: Yup.object({
        isActive: Yup.boolean(),
        amount: Yup.number().min(0, 'House allowance must be positive')
      }),
      special: Yup.object({
        isActive: Yup.boolean(),
        amount: Yup.number().min(0, 'Special allowance must be positive')
      }),
      other: Yup.object({
        isActive: Yup.boolean(),
        amount: Yup.number().min(0, 'Other allowance must be positive')
      })
    }),
    eobi: Yup.object({
      isActive: Yup.boolean(),
      amount: Yup.number().min(0, 'EOBI amount must be positive'),
      percentage: Yup.number().min(0, 'EOBI percentage must be positive')
    }),
    providentFund: Yup.object({
      isActive: Yup.boolean(),
      amount: Yup.number().min(0, 'Provident Fund amount must be positive'),
      percentage: Yup.number().min(0, 'Provident Fund percentage must be positive')
    }),
    address: Yup.object({
      street: Yup.string().required('Street address is required'),
      city: Yup.string().required('City is required'),
      state: Yup.string().required('State is required'),
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
      const response = await api.get('/hr/companies');
      setCompanies(response.data.data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  // Fetch sectors
  const fetchSectors = async () => {
    try {
      const response = await api.get('/hr/sectors');
      setSectors(response.data.data || []);
    } catch (error) {
      console.error('Error fetching sectors:', error);
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

  // Fetch sections by department
  const fetchSectionsByDepartment = async (departmentId) => {
    try {
      const response = await api.get(`/sections?department=${departmentId}`);
      setSections(response.data.data || []);
    } catch (error) {
      console.error('Error fetching sections by department:', error);
    }
  };

  // Fetch designations by section
  const fetchDesignationsBySection = async (sectionId) => {
    try {
      const response = await api.get(`/designations?section=${sectionId}`);
      setDesignations(response.data.data || []);
    } catch (error) {
      console.error('Error fetching designations by section:', error);
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

  // Handle employment status change
  const handleEmploymentStatusChange = (newStatus) => {
    // Auto-sync isActive when employment status changes
    if (newStatus === 'Active') {
      formik.setFieldValue('isActive', true);
    } else if (newStatus === 'Draft') {
      formik.setFieldValue('isActive', false);
    }
    formik.setFieldValue('employmentStatus', newStatus);
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
        bankName: employeeData.bankName?._id || employeeData.bankName || '',
        bankAccountNumber: employeeData.bankAccountNumber || employeeData.accountNumber || '',
        placementCompany: employeeData.placementCompany?._id || employeeData.placementCompany || '',
        placementSector: employeeData.placementSector?._id || employeeData.placementSector || '',
        placementProject: employeeData.placementProject?._id || employeeData.placementProject || '',
        placementDepartment: employeeData.placementDepartment?._id || employeeData.placementDepartment || '',
        placementSection: employeeData.placementSection?._id || employeeData.placementSection || '',
        placementDesignation: employeeData.placementDesignation?._id || employeeData.placementDesignation || '',
        oldDesignation: employeeData.oldDesignation?._id || employeeData.oldDesignation || undefined,
        placementLocation: employeeData.placementLocation?._id || employeeData.placementLocation || '',
        salary: {
          gross: employeeData.salary?.gross || 0,
          basic: employeeData.salary?.basic || 0
        },
        allowances: {
          conveyance: {
            isActive: employeeData.allowances?.conveyance?.isActive || false,
            amount: employeeData.allowances?.conveyance?.amount || 0
          },
          food: {
            isActive: employeeData.allowances?.food?.isActive || false,
            amount: employeeData.allowances?.food?.amount || 0
          },
          vehicleFuel: {
            isActive: employeeData.allowances?.vehicleFuel?.isActive || false,
            amount: employeeData.allowances?.vehicleFuel?.amount || 0
          },
          medical: {
            isActive: employeeData.allowances?.medical?.isActive || false,
            amount: employeeData.allowances?.medical?.amount || 0
          },
          houseRent: {
            isActive: employeeData.allowances?.houseRent?.isActive || false,
            amount: employeeData.allowances?.houseRent?.amount || 0
          },
          special: {
            isActive: employeeData.allowances?.special?.isActive || false,
            amount: employeeData.allowances?.special?.amount || 0
          },
          other: {
            isActive: employeeData.allowances?.other?.isActive || false,
            amount: employeeData.allowances?.other?.amount || 0
          }
        },
        eobi: {
          isActive: employeeData.eobi?.isActive || false,
          amount: employeeData.eobi?.amount || 0,
          percentage: employeeData.eobi?.percentage || 0.06 // Assuming 6% is the default
        },
        providentFund: {
          isActive: employeeData.providentFund?.isActive || false,
          amount: employeeData.providentFund?.amount || 0,
          percentage: employeeData.providentFund?.percentage || 0.0834 // 8.34% is the default
        },
        address: {
          ...employeeData.address,
          city: employeeData.address?.city?._id || employeeData.address?.city || '',
          state: employeeData.address?.state?._id || employeeData.address?.state || '',
          country: employeeData.address?.country?._id || employeeData.address?.country || ''
        },
        emergencyContact: {
          name: employeeData.emergencyContact?.name || '',
          relationship: employeeData.emergencyContact?.relationship || '',
          phone: employeeData.emergencyContact?.phone || ''
        },
        dateOfBirth: employeeData.dateOfBirth ? new Date(employeeData.dateOfBirth).toISOString().split('T')[0] : '',
        hireDate: employeeData.hireDate ? new Date(employeeData.hireDate).toISOString().split('T')[0] : '',
        appointmentDate: employeeData.appointmentDate ? new Date(employeeData.appointmentDate).toISOString().split('T')[0] : '',
        endOfProbationDate: employeeData.endOfProbationDate ? new Date(employeeData.endOfProbationDate).toISOString().split('T')[0] : '',
        confirmationDate: employeeData.confirmationDate ? new Date(employeeData.confirmationDate).toISOString().split('T')[0] : '',
        isActive: employeeData.isActive !== undefined ? employeeData.isActive : true,
        employmentStatus: employeeData.employmentStatus || 'Draft'
      };
      
      console.log('🔍 Form Data prepared:', formData);
      formik.setValues(formData);
      
      // Fetch dependent data if needed
      if (formData.address.country) {
        fetchProvinces(formData.address.country);
      }
      if (formData.address.state) {
        fetchCities(formData.address.state);
      }
      
      // When editing an employee, load all sections and designations to ensure current values are available
      // This handles cases where the employee's section/designation might not match the current department filter
      await fetchSections(); // Load all sections
      await fetchDesignations(); // Load all designations
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

  // Load initial data - only run once on mount
  useEffect(() => {
    fetchDepartments();
    fetchBanks();
    fetchCompanies();
    fetchSectors();
    fetchProjects();
    fetchSections();
    fetchDesignations();
    fetchLocations();
    fetchCountries();
    fetchProvinces();
    fetchCities();
    fetchNextEmployeeId();
  }, []); // Empty dependency array - only run once

  // Fetch employee data when ID changes
  useEffect(() => {
    if (id && id !== 'add') {
      fetchEmployee();
    }
  }, [id]);

  // Update formik values when nextEmployeeId is fetched
  useEffect(() => {
    if (nextEmployeeId && (!id || id === 'add')) {
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
      employeeId: (id && id !== 'add') ? '' : nextEmployeeId, // Empty for editing, nextEmployeeId for new
      qualification: '',
      bankName: '',
      bankAccountNumber: '',
      foreignBankAccount: '',
      spouseName: '',
      appointmentDate: '',
      probationPeriodMonths: 3,
      hireDate: '',
      salary: {
        gross: ''
      },
      // Placement fields
      placementSector: '',
      placementProject: '',
      placementDepartment: '',
      placementSection: '',
      placementDesignation: '',
      placementLocation: '',
      oldDesignation: undefined,
      isActive: true,
      employmentStatus: 'Draft', // Default to Draft for new employees
      address: {
        street: '',
        city: '',
        state: '',
        country: ''
      },
      emergencyContact: {
        name: '',
        relationship: '',
        phone: ''
      },
      eobi: {
        isActive: false,
        amount: 0
      },
      providentFund: {
        isActive: false,
        amount: 0
      }
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        console.log('🚀 Starting employee save...');
        console.log('📝 Form values:', values);
        console.log('🔍 Checking form validation...');
        
        // Check for validation errors
        const errors = await formik.validateForm();
        console.log('🔍 Validation errors found:', errors);
        
        if (Object.keys(errors).length > 0) {
          console.error('❌ Validation errors:', errors);
          setSnackbar({
            open: true,
            message: `Validation errors: ${Object.keys(errors).join(', ')}`,
            severity: 'error'
          });
          return;
        }
        
        console.log('✅ Form validation passed!');
        
        setLoading(true);
        
        // Clean up values before submission
        const cleanedValues = { ...values };
        console.log('🧹 Cleaned values:', cleanedValues);
        
        // Handle empty oldDesignation
        if (cleanedValues.oldDesignation === '' || cleanedValues.oldDesignation === undefined) {
          delete cleanedValues.oldDesignation;
        }
        
        // Clean up empty placement fields (convert empty strings to undefined)
                  const placementFields = [
            'placementCompany', 'placementSector', 'placementProject', 
            'placementDepartment', 'placementSection', 'placementDesignation', 'placementLocation'
          ];
        
        console.log('🧹 Cleaning up placement fields...');
        placementFields.forEach(field => {
          console.log(`🧹 Field ${field}:`, cleanedValues[field]);
          if (cleanedValues[field] === '' || cleanedValues[field] === null || cleanedValues[field] === undefined) {
            console.log(`🧹 Deleting empty field: ${field}`);
            delete cleanedValues[field];
          }
        });
        
        // Clean up other ObjectId fields that might be empty strings
        const objectIdFields = [
          'user', 'city', 'state', 'country', 'department', 'position', 'manager'
        ];
        
        console.log('🧹 Cleaning up other ObjectId fields...');
        objectIdFields.forEach(field => {
          console.log(`🧹 Field ${field}:`, cleanedValues[field]);
          if (cleanedValues[field] === '' || cleanedValues[field] === null || cleanedValues[field] === undefined) {
            console.log(`🧹 Deleting empty field: ${field}`);
            delete cleanedValues[field];
          }
        });
        
        // Handle address ObjectId fields
        if (cleanedValues.address) {
          console.log('🧹 Cleaning up address ObjectId fields...');
          if (cleanedValues.address.city === '' || cleanedValues.address.city === null || cleanedValues.address.city === undefined) {
            console.log('🧹 Deleting empty address.city field');
            delete cleanedValues.address.city;
          }
          if (cleanedValues.address.state === '' || cleanedValues.address.state === null || cleanedValues.address.state === undefined) {
            console.log('🧹 Deleting empty address.state field');
            delete cleanedValues.address.state;
          }
          if (cleanedValues.address.country === '' || cleanedValues.address.country === null || cleanedValues.address.country === undefined) {
            console.log('🧹 Deleting empty address.country field');
            delete cleanedValues.address.country;
          }
        }
        
        // Ensure salary.gross is a number
        console.log('🎯 Original salary value:', cleanedValues.salary);
        if (cleanedValues.salary?.gross !== undefined && cleanedValues.salary?.gross !== null && cleanedValues.salary?.gross !== '') {
          cleanedValues.salary.gross = parseFloat(cleanedValues.salary.gross);
          console.log('🎯 Converted salary.gross to:', cleanedValues.salary.gross);
        } else {
          console.log('🎯 Salary.gross is empty, removing salary object');
          delete cleanedValues.salary;
        }
        
        console.log('🧹 Final cleaned values to send:', cleanedValues);
        
        if (id && id !== 'add') {
          console.log('🔄 Updating existing employee...');
          console.log('🎯 Salary before sending:', cleanedValues.salary);
          console.log('🎯 Salary.gross before sending:', cleanedValues.salary?.gross);
          console.log('🎯 Salary.gross type:', typeof cleanedValues.salary?.gross);
          // Update existing employee
          const response = await api.put(`/hr/employees/${id}`, cleanedValues);
          console.log('✅ Update response:', response);
          setSnackbar({
            open: true,
            message: 'Employee updated successfully',
            severity: 'success'
          });
        } else {
          console.log('🆕 Creating new employee...');
          // Create new employee
          const response = await api.post('/hr/employees', cleanedValues);
          console.log('✅ Create response:', response);
          setSnackbar({
            open: true,
            message: 'Employee created successfully',
            severity: 'success'
          });
        }
        
        // Refresh employee data immediately
        await fetchEmployees(true);
        
        setTimeout(() => {
          navigate('/hr/employees');
        }, 1500);
      } catch (error) {
        console.error('❌ Error saving employee:', error);
        console.error('❌ Error response:', error.response);
        console.error('❌ Error data:', error.response?.data);
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




  // Handler functions for new placement items
  const handleNewCompanyChange = (field, value) => {
    setNewCompanyData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNewSectorChange = (field, value) => {
    setNewSectorData(prev => ({
      ...prev,
      [field]: value
    }));
  };



  const handleNewProjectChange = (field, value) => {
    setNewProjectData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNewDepartmentChange = (field, value) => {
    setNewDepartmentData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNewSectionChange = (field, value) => {
    setNewSectionData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNewDesignationChange = (field, value) => {
    setNewDesignationData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNewLocationChange = (field, value) => {
    setNewLocationData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Save functions for new placement items
  const handleSaveNewCompany = async () => {
    try {
      if (!newCompanyData.name || !newCompanyData.code) {
        setSnackbar({
          open: true,
          message: 'Please fill in all required fields',
          severity: 'error'
        });
        return;
      }

      const response = await api.post('/hr/companies', newCompanyData);
      
      setSnackbar({
        open: true,
        message: 'Company added successfully',
        severity: 'success'
      });

      setShowAddCompanyDialog(false);
      setNewCompanyData({ name: '', code: '', type: 'Private Limited', description: '' });
      
      // Refresh companies
      await fetchCompanies();
      
      // Set the newly created company as selected
      formik.setFieldValue('placementCompany', response.data.data._id);
      
    } catch (error) {
      console.error('Error adding company:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error adding company',
        severity: 'error'
      });
    }
  };

  const handleSaveNewSector = async () => {
    try {
      if (!newSectorData.name) {
        setSnackbar({
          open: true,
          message: 'Please fill in all required fields',
          severity: 'error'
        });
        return;
      }

      const response = await api.post('/hr/sectors', newSectorData);
      
      setSnackbar({
        open: true,
        message: 'Sector added successfully',
        severity: 'success'
      });

      setShowAddSectorDialog(false);
      setNewSectorData({ name: '', industry: 'Technology' });
      
      // Refresh sectors
      await fetchSectors();
      
      // Set the newly created sector as selected
      formik.setFieldValue('placementSector', response.data.data._id);
      
    } catch (error) {
      console.error('Error adding sector:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error adding sector',
        severity: 'error'
      });
    }
  };



  const handleSaveNewProject = async () => {
    try {
      if (!newProjectData.name || !newProjectData.code) {
        setSnackbar({
          open: true,
          message: 'Please fill in all required fields',
          severity: 'error'
        });
        return;
      }

      const projectData = {
        ...newProjectData,
        sector: formik.values.placementSector
      };

      const response = await api.post('/hr/projects', projectData);
      
      setSnackbar({
        open: true,
        message: 'Project added successfully',
        severity: 'success'
      });

      setShowAddProjectDialog(false);
      setNewProjectData({ name: '', code: '', description: '' });
      
      // Refresh projects
      await fetchProjects();
      
      // Set the newly created project as selected
      formik.setFieldValue('placementProject', response.data.data._id);
      
    } catch (error) {
      console.error('Error adding project:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error adding project',
        severity: 'error'
      });
    }
  };

  const handleSaveNewDepartment = async () => {
    try {
      if (!newDepartmentData.name || !newDepartmentData.code) {
        setSnackbar({
          open: true,
          message: 'Please fill in all required fields',
          severity: 'error'
        });
        return;
      }

      const response = await api.post('/hr/departments', newDepartmentData);
      
      setSnackbar({
        open: true,
        message: 'Department added successfully',
        severity: 'success'
      });

      setShowAddDepartmentDialog(false);
      setNewDepartmentData({ name: '', code: '', description: '' });
      
      // Refresh departments
      await fetchDepartments();
      
      // Set the newly created department as selected
      formik.setFieldValue('placementDepartment', response.data.data._id);
      
    } catch (error) {
      console.error('Error adding department:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error adding department',
        severity: 'error'
      });
    }
  };

  const handleSaveNewSection = async () => {
    try {
      if (!newSectionData.name) {
        setSnackbar({
          open: true,
          message: 'Please fill in all required fields',
          severity: 'error'
        });
        return;
      }

      if (!formik.values.placementDepartment) {
        setSnackbar({
          open: true,
          message: 'Please select a department first',
          severity: 'error'
        });
        return;
      }

      const sectionData = {
        ...newSectionData,
        department: formik.values.placementDepartment
      };

      const response = await api.post('/hr/sections', sectionData);
      
      setSnackbar({
        open: true,
        message: 'Section added successfully',
        severity: 'success'
      });

      setShowAddSectionDialog(false);
      setNewSectionData({ name: '' });
      
      // Refresh sections
      await fetchSectionsByDepartment(formik.values.placementDepartment);
      
      // Set the newly created section as selected
      formik.setFieldValue('placementSection', response.data.data._id);
      
    } catch (error) {
      console.error('Error adding section:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error adding section',
        severity: 'error'
      });
    }
  };

  const handleSaveNewDesignation = async () => {
    try {
      if (!newDesignationData.title) {
        setSnackbar({
          open: true,
          message: 'Please fill in all required fields',
          severity: 'error'
        });
        return;
      }

      const designationData = {
        ...newDesignationData,
        section: formik.values.placementSection
      };

      const response = await api.post('/hr/designations', designationData);
      
      setSnackbar({
        open: true,
        message: 'Designation added successfully',
        severity: 'success'
      });

      setShowAddDesignationDialog(false);
      setNewDesignationData({ title: '', level: 'Entry', description: '' });
      
      // Refresh designations
      await fetchDesignationsBySection(formik.values.placementSection);
      
      // Set the newly created designation as selected
      formik.setFieldValue('placementDesignation', response.data.data._id);
      
    } catch (error) {
      console.error('Error adding designation:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error adding designation',
        severity: 'error'
      });
    }
  };

  const handleSaveNewLocation = async () => {
    try {
      if (!newLocationData.name) {
        setSnackbar({
          open: true,
          message: 'Please fill in all required fields',
          severity: 'error'
        });
        return;
      }

      const response = await api.post('/hr/locations', newLocationData);
      
      setSnackbar({
        open: true,
        message: 'Location added successfully',
        severity: 'success'
      });

      setShowAddLocationDialog(false);
      setNewLocationData({ name: '', type: 'Office', description: '' });
      
      // Refresh locations
      await fetchLocations();
      
      // Set the newly created location as selected
      formik.setFieldValue('placementLocation', response.data.data._id);
      
    } catch (error) {
      console.error('Error adding location:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error adding location',
        severity: 'error'
      });
    }
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
            {/* Status Indicator */}
            {id && id !== 'add' && (
              <Grid item xs={12}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'grey.50', 
                  borderRadius: 2, 
                  border: '1px solid', 
                  borderColor: 'grey.200',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
                }}>
                  <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 600 }}>
                    📋 Current Status:
                  </Typography>
                  <Chip 
                    label={formik.values.employmentStatus || 'Draft'} 
                    color={
                      formik.values.employmentStatus === 'Active' ? 'success' : 
                      formik.values.employmentStatus === 'Draft' ? 'warning' : 'error'
                    }
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                  
                </Box>
              </Grid>
            )}
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
            </Grid>
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
                value={(id && id !== 'add') ? (formik.values.employeeId || 'Loading...') : (nextEmployeeId || 'Loading...')}
                InputProps={{
                  readOnly: true,
                }}
                helperText={(id && id !== 'add') ? "Employee ID (cannot be changed)" : "Employee ID will be auto-generated"}
              />
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
                name="salary.gross"
                label="Gross Salary"
                type="number"
                value={formik.values.salary?.gross || ''}
                onChange={formik.handleChange}
                error={formik.touched.salary?.gross && Boolean(formik.errors.salary?.gross)}
                helperText={formik.touched.salary?.gross && formik.errors.salary?.gross}
                InputProps={{
                  startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                }}
              />
            </Grid>
            {/* Flexible Allowances Section */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 1 }}>
                Allowances Management
              </Typography>
            </Grid>
            
            {/* Conveyance Allowance */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formik.values.allowances?.conveyance?.isActive || false}
                      onChange={(e) => formik.setFieldValue('allowances.conveyance.isActive', e.target.checked)}
                      name="allowances.conveyance.isActive"
                    />
                  }
                  label="Conveyance Allowance"
                />
              </FormControl>
            </Grid>
            {formik.values.allowances?.conveyance?.isActive && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="allowances.conveyance.amount"
                  label="Conveyance Allowance Amount"
                  type="number"
                  value={formik.values.allowances?.conveyance?.amount || ''}
                  onChange={formik.handleChange}
                  InputProps={{
                    startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                  }}
                />
              </Grid>
            )}
            

            
            {/* Food Allowance */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formik.values.allowances?.food?.isActive || false}
                      onChange={(e) => formik.setFieldValue('allowances.food.isActive', e.target.checked)}
                      name="allowances.food.isActive"
                    />
                  }
                  label="Food Allowance"
                />
              </FormControl>
            </Grid>
            {formik.values.allowances?.food?.isActive && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="allowances.food.amount"
                  label="Food Allowance Amount"
                  type="number"
                  value={formik.values.allowances?.food?.amount || ''}
                  onChange={formik.handleChange}
                  InputProps={{
                    startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                  }}
                />
              </Grid>
            )}
            
            {/* Vehicle & Fuel Allowance */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formik.values.allowances?.vehicleFuel?.isActive || false}
                      onChange={(e) => formik.setFieldValue('allowances.vehicleFuel.isActive', e.target.checked)}
                      name="allowances.vehicleFuel.isActive"
                    />
                  }
                  label="Vehicle & Fuel Allowance"
                />
              </FormControl>
            </Grid>
            {formik.values.allowances?.vehicleFuel?.isActive && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="allowances.vehicleFuel.amount"
                  label="Vehicle & Fuel Allowance Amount"
                  type="number"
                  value={formik.values.allowances?.vehicleFuel?.amount || ''}
                  onChange={formik.handleChange}
                  InputProps={{
                    startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                  }}
                />
              </Grid>
            )}
            
            {/* Medical Allowance */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formik.values.allowances?.medical?.isActive || false}
                      onChange={(e) => formik.setFieldValue('allowances.medical.isActive', e.target.checked)}
                      name="allowances.medical.isActive"
                    />
                  }
                  label="Medical Allowance"
                />
              </FormControl>
            </Grid>
            {formik.values.allowances?.medical?.isActive && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="allowances.medical.amount"
                  label="Medical Allowance Amount"
                  type="number"
                  value={formik.values.allowances?.medical?.amount || ''}
                  onChange={formik.handleChange}
                  InputProps={{
                    startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                  }}
                />
              </Grid>
            )}
            
            {/* House Allowance */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formik.values.allowances?.houseRent?.isActive || false}
                      onChange={(e) => formik.setFieldValue('allowances.houseRent.isActive', e.target.checked)}
                      name="allowances.houseRent.isActive"
                    />
                  }
                  label="House Allowance"
                />
              </FormControl>
            </Grid>
            {formik.values.allowances?.houseRent?.isActive && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="allowances.houseRent.amount"
                  label="House Allowance Amount"
                  type="number"
                  value={formik.values.allowances?.houseRent?.amount || ''}
                  onChange={formik.handleChange}
                  InputProps={{
                    startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                  }}
                />
              </Grid>
            )}
            
            {/* Special Allowance */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formik.values.allowances?.special?.isActive || false}
                      onChange={(e) => formik.setFieldValue('allowances.special.isActive', e.target.checked)}
                      name="allowances.special.isActive"
                    />
                  }
                  label="Special Allowance"
                />
              </FormControl>
            </Grid>
            {formik.values.allowances?.special?.isActive && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="allowances.special.amount"
                  label="Special Allowance Amount"
                  type="number"
                  value={formik.values.allowances?.special?.amount || ''}
                  onChange={formik.handleChange}
                  InputProps={{
                    startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                  }}
                />
              </Grid>
            )}
            
            {/* Other Allowance */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formik.values.allowances?.other?.isActive || false}
                      onChange={(e) => formik.setFieldValue('allowances.other.isActive', e.target.checked)}
                      name="allowances.other.isActive"
                    />
                  }
                  label="Other Allowance"
                />
              </FormControl>
            </Grid>
            {formik.values.allowances?.other?.isActive && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="allowances.other.amount"
                  label="Other Allowance Amount"
                  type="number"
                  value={formik.values.allowances?.other?.amount || ''}
                  onChange={formik.handleChange}
                  InputProps={{
                    startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                  }}
                />
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formik.values.eobi?.isActive || false}
                      onChange={(e) => formik.setFieldValue('eobi.isActive', e.target.checked)}
                      name="eobi.isActive"
                    />
                  }
                  label="EOBI Active"
                />
                <FormHelperText>
                  Employees' Old-Age Benefits Institution (6% of basic salary)
                </FormHelperText>
              </FormControl>
            </Grid>
            {formik.values.eobi?.isActive && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="eobi.amount"
                  label="EOBI Amount"
                  type="number"
                  value={formik.values.eobi?.amount || 370}
                  onChange={formik.handleChange}
                  InputProps={{
                    readOnly: true,
                    startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                  }}
                  helperText="Fixed amount: Rs 370 (1% of minimum wage)"
                />
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formik.values.providentFund?.isActive || false}
                      onChange={(e) => formik.setFieldValue('providentFund.isActive', e.target.checked)}
                      name="providentFund.isActive"
                    />
                  }
                  label="Provident Fund Active"
                />
                <FormHelperText>
                                      Provident Fund (8.34% of basic salary)
                </FormHelperText>
              </FormControl>
            </Grid>
            {formik.values.providentFund?.isActive && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="providentFund.amount"
                  label="Provident Fund Amount"
                  type="number"
                  value={formik.values.providentFund?.amount || Math.round((formik.values.salary?.gross || 0) * 0.6 * 0.08)}
                  onChange={formik.handleChange}
                  InputProps={{
                    readOnly: true,
                    startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                  }}
                                      helperText="Auto-calculated: 8.34% of basic salary"
                />
              </Grid>
            )}
            
            
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ p: 2, backgroundColor: '#f8f9fa' }}>
                <Typography variant="h6" gutterBottom>
                  Auto-Calculated Salary Breakdown
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      Basic Salary (66.66%): {formatPKR(Math.round((formik.values.salary?.gross || 0) * 0.6666))}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      House Rent (23.34%): {formatPKR(Math.round((formik.values.salary?.gross || 0) * 0.2334))}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      Medical (10%): {formatPKR(Math.round((formik.values.salary?.gross || 0) * 0.1))}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      Total: {formatPKR(formik.values.salary?.gross || 0)}
                    </Typography>
                  </Grid>
                </Grid>
              </Card>
            </Grid>
            
            {/* Current Placement Summary */}
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ p: 2, backgroundColor: '#e3f2fd' }}>
                <Typography variant="h6" gutterBottom>
                  Current Placement Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary">
                                      <strong>Company:</strong> {safeRenderText(companies.find(c => c._id === formik.values.placementCompany)?.name) || 'Not Selected'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary">
                <strong>Sector:</strong> {safeRenderText(sectors.find(s => s._id === formik.values.placementSector)?.name) || 'Not Selected'}
              </Typography>
            </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Department:</strong> {safeRenderText(departments.find(d => d._id === formik.values.placementDepartment)?.name) || 'Not Selected'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Designation:</strong> {safeRenderText(designations.find(d => d._id === formik.values.placementDesignation)?.title) || 'Not Selected'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Location:</strong> {safeRenderText(locations.find(l => l._id === formik.values.placementLocation)?.name) || 'Not Selected'}
                    </Typography>
                  </Grid>
                </Grid>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Project:</strong> {safeRenderText(projects.find(p => p._id === formik.values.placementProject)?.name) || 'Not Selected'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Section:</strong> {safeRenderText(sections.find(s => s._id === formik.values.placementSection)?.name) || 'Not Selected'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Status:</strong> {formik.values.placementCompany && formik.values.placementSector && formik.values.placementDepartment && formik.values.placementDesignation ? 'Complete' : 'Incomplete'}
                    </Typography>
                  </Grid>
                </Grid>
              </Card>
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
                name="bankAccountNumber"
                label="Bank Account Number"
                value={formik.values.bankAccountNumber}
                onChange={formik.handleChange}
                error={formik.touched.bankAccountNumber && Boolean(formik.errors.bankAccountNumber)}
                helperText={formik.touched.bankAccountNumber && formik.errors.bankAccountNumber}
              />
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

            {/* Placement Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2 }}>
                Placement Information
              </Typography>
            </Grid>
            
            {/* Company */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Company</InputLabel>
                <Select
                  name="placementCompany"
                  value={safeFormValue(formik.values.placementCompany)}
                  onChange={(e) => {
                    if (e.target.value === 'add_new') {
                      setShowAddCompanyDialog(true);
                      return;
                    }
                    formik.setFieldValue('placementCompany', e.target.value);
                    formik.setFieldValue('placementProject', '');
                    formik.setFieldValue('placementDepartment', '');
                    formik.setFieldValue('placementSection', '');
                    formik.setFieldValue('placementDesignation', '');
                  }}
                  error={formik.touched.placementCompany && Boolean(formik.errors.placementCompany)}
                  label="Company"
                >
                  {companies.map((company) => (
                    <MenuItem key={company._id} value={company._id}>
                      {safeRenderText(company.name)} ({safeRenderText(company.type)})
                    </MenuItem>
                  ))}
                  <MenuItem 
                    value="add_new" 
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
                      Add New Company
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Sector */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Sector</InputLabel>
                <Select
                  name="placementSector"
                  value={safeFormValue(formik.values.placementSector)}
                  onChange={(e) => {
                    if (e.target.value === 'add_new') {
                      setShowAddSectorDialog(true);
                      return;
                    }
                    formik.setFieldValue('placementSector', e.target.value);
                    formik.setFieldValue('placementProject', '');
                    formik.setFieldValue('placementDepartment', '');
                    formik.setFieldValue('placementSection', '');
                    formik.setFieldValue('placementDesignation', '');
                  }}
                  error={formik.touched.placementSector && Boolean(formik.errors.placementSector)}
                  label="Sector"
                >
                  {sectors.map((sector) => (
                    <MenuItem key={sector._id} value={sector._id}>
                      {safeRenderText(sector.name)}
                    </MenuItem>
                  ))}
                  <MenuItem 
                    value="add_new" 
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
                      Add New Sector
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>



            {/* Project */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Project</InputLabel>
                <Select
                  name="placementProject"
                  value={safeFormValue(formik.values.placementProject)}
                  onChange={(e) => {
                    if (e.target.value === 'add_new') {
                      setShowAddProjectDialog(true);
                      return;
                    }
                    formik.setFieldValue('placementProject', e.target.value);
                    formik.setFieldValue('placementDepartment', '');
                    formik.setFieldValue('placementSection', '');
                    formik.setFieldValue('placementDesignation', '');
                  }}
                  error={formik.touched.placementProject && Boolean(formik.errors.placementProject)}
                  label="Project"
                  disabled={!safeFormValue(formik.values.placementSector)}
                >
                  {projects.map((project) => (
                    <MenuItem key={project._id} value={project._id}>
                      {safeRenderText(project.name)} - {safeRenderText(project.company?.name)}
                    </MenuItem>
                  ))}
                  {safeFormValue(formik.values.placementSector) && (
                                      <MenuItem 
                    value="add_new" 
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
                        Add New Project
                      </Box>
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>

            {/* Department */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  name="placementDepartment"
                  value={safeFormValue(formik.values.placementDepartment)}
                  onChange={(e) => {
                    if (e.target.value === 'add_new') {
                      setShowAddDepartmentDialog(true);
                      return;
                    }
                    formik.setFieldValue('placementDepartment', e.target.value);
                    
                    // Only clear section and designation if we're creating a new employee (no ID) or if the department actually changed
                    if (!id || id === 'add') {
                      formik.setFieldValue('placementSection', '');
                      formik.setFieldValue('placementDesignation', '');
                    }
                    
                    if (e.target.value) {
                      fetchSectionsByDepartment(e.target.value);
                    }
                  }}
                  error={formik.touched.placementDepartment && Boolean(formik.errors.placementDepartment)}
                  label="Department"
                  disabled={!safeFormValue(formik.values.placementSector)}
                >
                  {departments.map((dept) => (
                    <MenuItem key={dept._id} value={dept._id}>
                      {safeRenderText(dept.name)} ({safeRenderText(dept.code)})
                    </MenuItem>
                  ))}
                  {safeFormValue(formik.values.placementSector) && (
                                      <MenuItem 
                    value="add_new" 
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
                        Add New Department
                      </Box>
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>

            {/* Section */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Section</InputLabel>
                <Select
                  name="placementSection"
                  value={safeFormValue(formik.values.placementSection)}
                  onChange={(e) => {
                    if (e.target.value === 'add_new') {
                      setShowAddSectionDialog(true);
                      return;
                    }
                    formik.setFieldValue('placementSection', e.target.value);
                    
                    // Only clear designation if we're creating a new employee (no ID) or if the section actually changed
                    if (!id || id === 'add') {
                      formik.setFieldValue('placementDesignation', '');
                    }
                    
                    if (e.target.value) {
                      fetchDesignationsBySection(e.target.value);
                    }
                  }}
                  error={formik.touched.placementSection && Boolean(formik.errors.placementSection)}
                  label="Section"
                  disabled={!safeFormValue(formik.values.placementSector)}
                >
                  {sections.map((section) => (
                    <MenuItem key={section._id} value={section._id}>
                      {safeRenderText(section.name)}
                    </MenuItem>
                  ))}
                  {safeFormValue(formik.values.placementSector) && (
                                      <MenuItem 
                    value="add_new" 
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
                        Add New Section
                      </Box>
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>

            {/* Designation/Position */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Designation/Position</InputLabel>
                <Select
                  name="placementDesignation"
                  value={safeFormValue(formik.values.placementDesignation)}
                  onChange={(e) => {
                    if (e.target.value === 'add_new') {
                      setShowAddDesignationDialog(true);
                      return;
                    }
                    formik.handleChange(e);
                  }}
                  error={formik.touched.placementDesignation && Boolean(formik.errors.placementDesignation)}
                  label="Designation/Position"
                  disabled={!safeFormValue(formik.values.placementSector)}
                >
                  {designations.map((designation) => (
                    <MenuItem key={designation._id} value={designation._id}>
                      {safeRenderText(designation.title)} - {safeRenderText(designation.level)}
                    </MenuItem>
                  ))}
                  {safeFormValue(formik.values.placementSector) && (
                                      <MenuItem 
                    value="add_new" 
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
                        Add New Designation
                      </Box>
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>

            {/* Location */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Location</InputLabel>
                <Select
                  name="placementLocation"
                  value={safeFormValue(formik.values.placementLocation)}
                  onChange={(e) => {
                    if (e.target.value === 'add_new') {
                      setShowAddLocationDialog(true);
                      return;
                    }
                    formik.handleChange(e);
                  }}
                  error={formik.touched.placementLocation && Boolean(formik.errors.placementLocation)}
                  label="Location"
                >
                  {locations.map((location) => (
                    <MenuItem key={location._id} value={location._id}>
                      {safeRenderText(location.name)} ({safeRenderText(location.type)})
                    </MenuItem>
                  ))}
                  <MenuItem 
                    value="add_new" 
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
                      Add New Location
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Old Designation (Optional) */}
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
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Employment Status</InputLabel>
                <Select
                  name="employmentStatus"
                  value={formik.values.employmentStatus}
                  onChange={(e) => handleEmploymentStatusChange(e.target.value)}
                  error={formik.touched.employmentStatus && Boolean(formik.errors.employmentStatus)}
                  label="Employment Status"
                >
                  <MenuItem value="Draft">Draft (Completed Onboarding)</MenuItem>
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                  <MenuItem value="Terminated">Terminated</MenuItem>
                  <MenuItem value="Resigned">Resigned</MenuItem>
                  <MenuItem value="Retired">Retired</MenuItem>
                </Select>
                {formik.touched.employmentStatus && formik.errors.employmentStatus && (
                  <FormHelperText error>{formik.errors.employmentStatus}</FormHelperText>
                )}
              </FormControl>
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
                value={formik.values.emergencyContact?.name || ''}
                onChange={formik.handleChange}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                name="emergencyContact.relationship"
                label="Relationship"
                value={formik.values.emergencyContact?.relationship || ''}
                onChange={formik.handleChange}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                name="emergencyContact.phone"
                label="Emergency Contact Phone"
                value={formik.values.emergencyContact?.phone || ''}
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
                    <strong>Gross Salary:</strong> {formatPKR(formik.values.salary?.gross || 0)}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="textSecondary">
                    <strong>Salary Distribution (Total: {formatPKR(formik.values.salary?.gross || 0)}):</strong>
                  </Typography>
                  
                  {/* Calculate the actual distribution based on current allowances */}
                  {(() => {
                    const grossSalary = formik.values.salary?.gross || 0;
                    const vehicleFuelAllowance = formik.values.allowances?.vehicleFuel?.isActive ? (formik.values.allowances.vehicleFuel.amount || 0) : 0;
                    const houseRent = Math.round(grossSalary * 0.2334); // 23.34% of gross
                    const medical = Math.round(grossSalary * 0.1); // 10% of gross
                    const basicSalary = grossSalary - houseRent - medical - vehicleFuelAllowance;
                    
                    return (
                      <>
                        <Typography variant="body2" color="primary.main">
                          💰 Basic Salary: {formatPKR(basicSalary)} (Adjusted to accommodate allowances)
                        </Typography>
                        <Typography variant="body2">
                          🏠 House Rent (23.34%): {formatPKR(houseRent)}
                        </Typography>
                        <Typography variant="body2">
                          🏥 Medical (10%): {formatPKR(medical)}
                        </Typography>
                        
                        {/* Show Vehicle & Fuel allowance as included in gross */}
                        {vehicleFuelAllowance > 0 && (
                          <Typography variant="body2" color="success.main">
                            🚗 Vehicle & Fuel: {formatPKR(vehicleFuelAllowance)} (Included in Gross)
                          </Typography>
                        )}
                        
                        {/* Show other allowances if active */}
                        {formik.values.allowances?.food?.isActive && (
                          <Typography variant="body2" color="success.main">
                            🍽️ Food Allowance: {formatPKR(formik.values.allowances.food.amount || 0)}
                          </Typography>
                        )}
                        {formik.values.allowances?.conveyance?.isActive && (
                          <Typography variant="body2" color="success.main">
                            🚌 Conveyance: {formatPKR(formik.values.allowances.conveyance.amount || 0)}
                          </Typography>
                        )}
                        {formik.values.allowances?.medical?.isActive && (
                          <Typography variant="body2" color="success.main">
                            🏥 Medical Allowance: {formatPKR(formik.values.allowances.medical.amount || 0)}
                          </Typography>
                        )}
                        {formik.values.allowances?.houseRent?.isActive && (
                          <Typography variant="body2" color="success.main">
                            🏠 House Allowance: {formatPKR(formik.values.allowances.houseRent.amount || 0)}
                          </Typography>
                        )}
                        {formik.values.allowances?.special?.isActive && (
                          <Typography variant="body2" color="success.main">
                            ⭐ Special: {formatPKR(formik.values.allowances.special.amount || 0)}
                          </Typography>
                        )}
                        {formik.values.allowances?.other?.isActive && (
                          <Typography variant="body2" color="success.main">
                            📋 Other: {formatPKR(formik.values.allowances.other.amount || 0)}
                          </Typography>
                        )}
                        
                        {/* Show total breakdown */}
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2" color="info.main">
                          <strong>Breakdown Total:</strong> {formatPKR(basicSalary + houseRent + medical + vehicleFuelAllowance)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          This equals your Gross Salary of {formatPKR(grossSalary)}
                        </Typography>
                      </>
                    );
                  })()}
                  
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="h6" color="primary">
                    <strong>Total Monthly Compensation:</strong> {formatPKR(formik.values.salary?.gross || 0)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Monthly compensation (Gross Salary - includes all allowances)
                  </Typography>
                  
                  {/* Salary Calculation Formula */}
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="textSecondary">
                    <strong>📊 Salary Calculation Formula:</strong>
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                    <strong>Step 1:</strong> Fixed Components (from Gross Salary)
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', ml: 2, mb: 1 }}>
                    • House Rent = 23.34% of Gross Salary (Fixed)
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', ml: 2, mb: 1 }}>
                    • Medical = 10% of Gross Salary (Fixed)
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', ml: 2, mb: 1 }}>
                    • Vehicle & Fuel = Fixed Amount (if active)
                  </Typography>
                  
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                    <strong>Step 2:</strong> Calculate Basic Salary
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', ml: 2, mb: 1 }}>
                    • Basic Salary = Gross Salary - House Rent - Medical - Vehicle & Fuel
                  </Typography>
                  
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                    <strong>Step 3:</strong> Total Monthly Compensation
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', ml: 2, mb: 1 }}>
                    • Total = Gross Salary (includes all components)
                  </Typography>
                  {formik.values.eobi?.isActive && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body2" color="error">
                        <strong>EOBI Deduction:</strong> {formatPKR(formik.values.eobi?.amount || 370)}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Fixed amount: Rs 370 (1% of minimum wage)
                      </Typography>
                    </>
                  )}
                  {formik.values.providentFund?.isActive && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body2" color="error">
                        <strong>Provident Fund Deduction:</strong> {formatPKR(formik.values.providentFund?.amount || Math.round((formik.values.salary?.gross || 0) * 0.6666 * 0.0834))}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Auto-calculated: 8.34% of basic salary
                      </Typography>
                    </>
                  )}
                  
                  {/* Net Salary Calculation */}
                  {(() => {
                    const grossSalary = formik.values.salary?.gross || 0;
                    const vehicleFuelAllowance = formik.values.allowances?.vehicleFuel?.isActive ? (formik.values.allowances.vehicleFuel.amount || 0) : 0;
                    const houseRent = Math.round(grossSalary * 0.2334);
                    const medical = Math.round(grossSalary * 0.1);
                    const basicSalary = grossSalary - houseRent - medical - vehicleFuelAllowance;
                    
                    const totalDeductions = (formik.values.eobi?.isActive ? (formik.values.eobi?.amount || 370) : 0);
                    // Provident Fund excluded from total deductions (Coming Soon)
                    // + (formik.values.providentFund?.isActive ? Math.round(basicSalary * 0.0834) : 0);
                    
                    const netSalary = grossSalary - totalDeductions;
                    
                    return totalDeductions > 0 ? (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="h6" color="success.main">
                          <strong>Net Monthly Salary:</strong> {formatPKR(netSalary)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Net = Gross Salary - Total Deductions
                        </Typography>
                      </>
                    ) : null;
                  })()}
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
                                    <strong>Company:</strong> {safeRenderText(companies.find(c => c._id === safeFormValue(formik.values.placementCompany))?.name) || 'Not selected'}
              </Typography>
              <Typography variant="body1">
                <strong>Sector:</strong> {safeRenderText(sectors.find(s => s._id === safeFormValue(formik.values.placementSector))?.name) || 'Not selected'}
              </Typography>
              <Typography variant="body1">
                    <strong>Department:</strong> {safeRenderText(departments.find(d => d._id === safeFormValue(formik.values.placementDepartment))?.name) || 'Not selected'}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Designation:</strong> {safeRenderText(designations.find(d => d._id === safeFormValue(formik.values.placementDesignation))?.title) || 'Not selected'}
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

      {/* Add New Company Dialog */}
      <Dialog open={showAddCompanyDialog} onClose={() => setShowAddCompanyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Company</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Company Name"
                  value={newCompanyData.name}
                  onChange={(e) => handleNewCompanyChange('name', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Company Code"
                  value={newCompanyData.code}
                  onChange={(e) => handleNewCompanyChange('code', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Company Type</InputLabel>
                  <Select
                    value={newCompanyData.type}
                    onChange={(e) => handleNewCompanyChange('type', e.target.value)}
                    label="Company Type"
                  >
                    <MenuItem value="Private Limited">Private Limited</MenuItem>
                    <MenuItem value="Public Limited">Public Limited</MenuItem>
                    <MenuItem value="Partnership">Partnership</MenuItem>
                    <MenuItem value="Sole Proprietorship">Sole Proprietorship</MenuItem>
                    <MenuItem value="Government">Government</MenuItem>
                    <MenuItem value="NGO">NGO</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={newCompanyData.description}
                  onChange={(e) => handleNewCompanyChange('description', e.target.value)}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddCompanyDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveNewCompany} variant="contained">
            Add Company
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Sector Dialog */}
      <Dialog open={showAddSectorDialog} onClose={() => setShowAddSectorDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Sector</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Sector Name"
                  value={newSectorData.name}
                  onChange={(e) => handleNewSectorChange('name', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Industry</InputLabel>
                  <Select
                    value={newSectorData.industry}
                    onChange={(e) => handleNewSectorChange('industry', e.target.value)}
                    label="Industry"
                  >
                    <MenuItem value="Technology">Technology</MenuItem>
                    <MenuItem value="Healthcare">Healthcare</MenuItem>
                    <MenuItem value="Finance">Finance</MenuItem>
                    <MenuItem value="Manufacturing">Manufacturing</MenuItem>
                    <MenuItem value="Education">Education</MenuItem>
                    <MenuItem value="Government">Government</MenuItem>
                    <MenuItem value="Retail">Retail</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddSectorDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveNewSector} variant="contained">
            Add Sector
          </Button>
        </DialogActions>
      </Dialog>



      {/* Add New Project Dialog */}
      <Dialog open={showAddProjectDialog} onClose={() => setShowAddProjectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Project</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Project Name"
                  value={newProjectData.name}
                  onChange={(e) => handleNewProjectChange('name', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Project Code"
                  value={newProjectData.code}
                  onChange={(e) => handleNewProjectChange('code', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={newProjectData.description}
                  onChange={(e) => handleNewProjectChange('description', e.target.value)}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddProjectDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveNewProject} variant="contained">
            Add Project
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Department Dialog */}
      <Dialog open={showAddDepartmentDialog} onClose={() => setShowAddDepartmentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Department</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Department Name"
                  value={newDepartmentData.name}
                  onChange={(e) => handleNewDepartmentChange('name', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Department Code"
                  value={newDepartmentData.code}
                  onChange={(e) => handleNewDepartmentChange('code', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={newDepartmentData.description}
                  onChange={(e) => handleNewDepartmentChange('description', e.target.value)}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDepartmentDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveNewDepartment} variant="contained">
            Add Department
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Section Dialog */}
      <Dialog open={showAddSectionDialog} onClose={() => setShowAddSectionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Section</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Section Name"
                  value={newSectionData.name}
                  onChange={(e) => handleNewSectionChange('name', e.target.value)}
                  required
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddSectionDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveNewSection} variant="contained">
            Add Section
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Designation Dialog */}
      <Dialog open={showAddDesignationDialog} onClose={() => setShowAddDesignationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Designation</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Designation Title"
                  value={newDesignationData.title}
                  onChange={(e) => handleNewDesignationChange('title', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Level</InputLabel>
                  <Select
                    value={newDesignationData.level}
                    onChange={(e) => handleNewDesignationChange('level', e.target.value)}
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
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={newDesignationData.description}
                  onChange={(e) => handleNewDesignationChange('description', e.target.value)}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDesignationDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveNewDesignation} variant="contained">
            Add Designation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Location Dialog */}
      <Dialog open={showAddLocationDialog} onClose={() => setShowAddLocationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Location</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Location Name"
                  value={newLocationData.name}
                  onChange={(e) => handleNewLocationChange('name', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Location Type</InputLabel>
                  <Select
                    value={newLocationData.type}
                    onChange={(e) => handleNewLocationChange('type', e.target.value)}
                    label="Location Type"
                  >
                    <MenuItem value="Office">Office</MenuItem>
                    <MenuItem value="Branch">Branch</MenuItem>
                    <MenuItem value="Site">Site</MenuItem>
                    <MenuItem value="Warehouse">Warehouse</MenuItem>
                    <MenuItem value="Factory">Factory</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={newLocationData.description}
                  onChange={(e) => handleNewLocationChange('description', e.target.value)}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddLocationDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveNewLocation} variant="contained">
            Add Location
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