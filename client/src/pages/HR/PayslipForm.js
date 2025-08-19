import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Snackbar,
  CircularProgress,
  Divider,
  Avatar,
  InputAdornment,
  Container,
  useTheme,
  alpha,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Autocomplete,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Save,
  ArrowBack,
  ArrowForward,
  Person,
  AttachMoney,
  Receipt,
  CheckCircle,
  Refresh
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import payslipService from '../../services/payslipService';
import { formatPKR } from '../../utils/currency';
import api from '../../services/authService';
import { PageLoading, LoadingSpinner } from '../../components/LoadingSpinner';

const steps = ['Employee Selection', 'Salary & Earnings', 'Deductions & Attendance', 'Review & Submit'];

// Months array for the form
const months = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
];

const PayslipForm = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  // State
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [loadingEmployeeData, setLoadingEmployeeData] = useState(false);

  // Form validation schema
  const validationSchema = Yup.object({
    employeeId: Yup.string().required('Employee is required'),
    month: Yup.number().required('Month is required').min(1).max(12),
    year: Yup.number().required('Year is required').min(2020).max(2030),
    earnings: Yup.object({
      basicSalary: Yup.number().min(0),
      houseRent: Yup.number().min(0),
      medicalAllowance: Yup.number().min(0),
      conveyanceAllowance: Yup.number().min(0),
      specialAllowance: Yup.number().min(0),
      otherAllowances: Yup.number().min(0),
      overtime: Yup.number().min(0),
      bonus: Yup.number().min(0),
      incentives: Yup.number().min(0),
      arrears: Yup.number().min(0),
      otherEarnings: Yup.number().min(0)
    }),
    deductions: Yup.object({
      providentFund: Yup.number().min(0),
      eobi: Yup.number().min(0),
      incomeTax: Yup.number().min(0),
      loanDeduction: Yup.number().min(0),
      advanceDeduction: Yup.number().min(0),
      lateDeduction: Yup.number().min(0),
      absentDeduction: Yup.number().min(0),
      otherDeductions: Yup.number().min(0)
    }),
    attendance: Yup.object({
      totalDays: Yup.number().min(0).max(31),
      presentDays: Yup.number().min(0),
      absentDays: Yup.number().min(0),
      lateDays: Yup.number().min(0),
      overtimeHours: Yup.number().min(0)
    }),
    notes: Yup.string()
  });

  // Formik form
  const formik = useFormik({
    initialValues: {
      employeeId: '',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      earnings: {
        basicSalary: 0,
        houseRent: 0,
        medicalAllowance: 0,
        conveyanceAllowance: 0,
        specialAllowance: 0,
        otherAllowances: 0,
        overtime: 0,
        bonus: 0,
        incentives: 0,
        arrears: 0,
        otherEarnings: 0
      },
      deductions: {
        providentFund: 0,
        eobi: 0,
        incomeTax: 0,
        loanDeduction: 0,
        advanceDeduction: 0,
        lateDeduction: 0,
        absentDeduction: 0,
        otherDeductions: 0
      },
      attendance: {
        totalDays: 30,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        overtimeHours: 0
      },
      notes: ''
    },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        if (isEditMode) {
          await payslipService.updatePayslip(id, values);
          setSnackbar({
            open: true,
            message: 'Payslip updated successfully',
            severity: 'success'
          });
        } else {
          await payslipService.createPayslip(values);
          setSnackbar({
            open: true,
            message: 'Payslip created successfully',
            severity: 'success'
          });
        }
        setTimeout(() => navigate('/hr/payslips'), 1500);
      } catch (error) {
        setSnackbar({
          open: true,
          message: error.response?.data?.message || 'Error saving payslip',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    }
  });

  // Load employees
  const loadEmployees = async () => {
    setEmployeesLoading(true);
    try {
      // Fetch all employees using the new getAll parameter to avoid pagination issues
      const response = await api.get('/hr/employees?getAll=true');
      const employeesData = response.data.data || [];
      setEmployees(employeesData);
      
      // Log the number of employees fetched for debugging
      console.log(`Loaded ${employeesData.length} employees for payslip form`);
      
      if (employeesData.length === 0) {
        setSnackbar({
          open: true,
          message: 'No employees found. Please check if there are employees in the system.',
          severity: 'warning'
        });
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      setSnackbar({
        open: true,
        message: 'Error loading employees',
        severity: 'error'
      });
    } finally {
      setEmployeesLoading(false);
    }
  };

  // Load payslip data for editing
  const loadPayslipData = async () => {
    if (!isEditMode) return;
    
    setLoading(true);
    try {
      const response = await payslipService.getPayslipById(id);
      const payslip = response.data;
      
      formik.setValues({
        employeeId: payslip.employeeId,
        month: payslip.month,
        year: payslip.year,
        earnings: payslip.earnings,
        deductions: payslip.deductions,
        attendance: {
          totalDays: payslip.totalDays,
          presentDays: payslip.presentDays,
          absentDays: payslip.absentDays,
          lateDays: payslip.lateDays,
          overtimeHours: payslip.overtimeHours
        },
        notes: payslip.notes || ''
      });
      
      setSelectedEmployee({
        _id: payslip.employee,
        employeeId: payslip.employeeId,
        firstName: payslip.employeeName.split(' ')[0],
        lastName: payslip.employeeName.split(' ').slice(1).join(' '),
        department: { name: payslip.department },
        position: { title: payslip.designation }
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error loading payslip data',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle employee selection
  const handleEmployeeChange = async (employeeId) => {
    const employee = employees.find(emp => emp.employeeId === employeeId);
    if (employee) {
      setSelectedEmployee(employee);
      setLoadingEmployeeData(true);
      
      try {
                // Fetch detailed employee data including salary
        const response = await api.get(`/hr/employees/${employee._id}`);
        const employeeData = response.data.data;
          
        // Auto-populate salary data from employee record
        formik.setFieldValue('earnings.basicSalary', employeeData.salary?.basic || 0);
        formik.setFieldValue('earnings.houseRent', employeeData.salary?.houseRent || 0);
        formik.setFieldValue('earnings.medicalAllowance', employeeData.salary?.medical || 0);
        formik.setFieldValue('earnings.conveyanceAllowance', employeeData.salary?.conveyance || 0);
        formik.setFieldValue('earnings.specialAllowance', employeeData.salary?.special || 0);
        formik.setFieldValue('earnings.otherAllowances', employeeData.salary?.other || 0);
        
        // Calculate standard deductions based on salary
        const basicSalary = employeeData.salary?.basic || 0;
        const providentFund = basicSalary * 0.05; // 5% of basic salary
        const eobi = basicSalary * 0.01; // 1% of basic salary
        
        formik.setFieldValue('deductions.providentFund', providentFund);
        formik.setFieldValue('deductions.eobi', eobi);
        
        // Try to fetch latest payroll data for this employee
        try {
          const payrollResponse = await api.get(`/hr/payroll?employeeId=${employee.employeeId}&limit=1&sort=-createdAt`);
          
          if (payrollResponse.data.data && payrollResponse.data.data.docs && payrollResponse.data.data.docs.length > 0) {
            const latestPayroll = payrollResponse.data.data.docs[0];
            
            // Use payroll data if available, otherwise use employee salary data
            formik.setFieldValue('earnings.basicSalary', latestPayroll.basicSalary || employeeData.salary?.basic || 0);
            formik.setFieldValue('earnings.houseRent', latestPayroll.houseRent || employeeData.salary?.houseRent || 0);
            formik.setFieldValue('earnings.medicalAllowance', latestPayroll.medicalAllowance || employeeData.salary?.medical || 0);
            formik.setFieldValue('earnings.conveyanceAllowance', latestPayroll.conveyanceAllowance || employeeData.salary?.conveyance || 0);
            formik.setFieldValue('earnings.specialAllowance', latestPayroll.specialAllowance || employeeData.salary?.special || 0);
            formik.setFieldValue('earnings.otherAllowances', latestPayroll.otherAllowances || employeeData.salary?.other || 0);
            
            // Use payroll deductions
            formik.setFieldValue('deductions.providentFund', latestPayroll.deductions?.providentFund || providentFund);
            formik.setFieldValue('deductions.eobi', latestPayroll.deductions?.eobi || eobi);
            formik.setFieldValue('deductions.incomeTax', latestPayroll.deductions?.incomeTax || 0);
            formik.setFieldValue('deductions.loanDeduction', latestPayroll.deductions?.loan || 0);
            
            console.log('Latest payroll data loaded:', latestPayroll);
          }
        } catch (payrollError) {
          console.log('No payroll data found, using employee salary data');
        }
        
        // Calculate attendance (you can integrate with actual attendance data later)
        const totalDays = 30;
        const presentDays = Math.floor(Math.random() * 5) + 25; // 25-30 days
        const absentDays = totalDays - presentDays;
        const lateDays = Math.floor(Math.random() * 3);
        const overtimeHours = Math.floor(Math.random() * 20);
        
        formik.setFieldValue('attendance.totalDays', totalDays);
        formik.setFieldValue('attendance.presentDays', presentDays);
        formik.setFieldValue('attendance.absentDays', absentDays);
        formik.setFieldValue('attendance.lateDays', lateDays);
        formik.setFieldValue('attendance.overtimeHours', overtimeHours);
        
                 // Set overtime pay to 0 (like bonus and incentives)
         formik.setFieldValue('earnings.overtime', 0);
        
        console.log('Employee data loaded:', employeeData);
        
        setSnackbar({
          open: true,
          message: 'Employee salary data loaded successfully',
          severity: 'success'
        });
      } catch (error) {
        console.error('Error fetching employee details:', error);
        setSnackbar({
          open: true,
          message: 'Error loading employee salary data',
          severity: 'error'
        });
      } finally {
        setLoadingEmployeeData(false);
      }
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    const earnings = formik.values.earnings;
    const deductions = formik.values.deductions;
    
    const totalEarnings = Object.values(earnings).reduce((sum, value) => sum + (value || 0), 0);
    
    // Calculate total deductions excluding Provident Fund (Coming Soon)
    const totalDeductions = Object.entries(deductions).reduce((sum, [key, value]) => {
      // Exclude providentFund from total deductions
      if (key === 'providentFund') return sum;
      return sum + (value || 0);
    }, 0);
    
    const netSalary = totalEarnings - totalDeductions;
    
    return { totalEarnings, totalDeductions, netSalary };
  };

  // Handle next step
  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      formik.handleSubmit();
    } else {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  // Handle previous step
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  // Load data on mount
  useEffect(() => {
    loadEmployees();
    if (isEditMode) {
      loadPayslipData();
    }
  }, [isEditMode, id]);

  const totals = calculateTotals();

  if (loading) {
    return (
      <PageLoading 
        message="Loading payslip form..." 
        showSkeleton={true}
        skeletonType="cards"
      />
    );
  }

  const formatPKR = (amount) => {
    if (amount === null || amount === undefined) return 'PKR 0';
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format employee ID to 5 digits with leading zeros
  const formatEmployeeId = (employeeId) => {
    if (!employeeId) return '';
    return employeeId.toString().padStart(5, '0');
  };

  return (
    <Container maxWidth="lg">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
          {isEditMode ? 'Edit Payslip' : 'Create New Payslip'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {isEditMode ? 'Update payslip information and calculations' : 'Generate a new payslip for an employee'}
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
      <form onSubmit={formik.handleSubmit}>
        {/* Step 1: Employee Selection */}
        {activeStep === 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                Select Employee
              </Typography>
              
                              <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                   <Autocomplete
                     options={employees}
                     getOptionLabel={(option) => `${option.firstName || ''} ${option.lastName || ''} (${formatEmployeeId(option.employeeId || '')})`}
                     filterOptions={(options, { inputValue }) => {
                       const searchTerm = inputValue.toLowerCase();
                       return options.filter(option => 
                         (option.employeeId && option.employeeId.toString().toLowerCase().includes(searchTerm)) ||
                         (option.firstName && option.firstName.toLowerCase().includes(searchTerm)) ||
                         (option.lastName && option.lastName.toLowerCase().includes(searchTerm)) ||
                         (option.placementDepartment?.name && option.placementDepartment.name.toLowerCase().includes(searchTerm)) ||
                         (option.placementDesignation?.title && option.placementDesignation.title.toLowerCase().includes(searchTerm))
                       );
                     }}
                     value={selectedEmployee}
                     onChange={(event, newValue) => {
                       setSelectedEmployee(newValue);
                       if (newValue) {
                         formik.setFieldValue('employeeId', newValue.employeeId);
                         handleEmployeeChange(newValue.employeeId);
                       } else {
                         formik.setFieldValue('employeeId', '');
                         setSelectedEmployee(null);
                       }
                     }}
                     loading={employeesLoading}
                     disabled={employeesLoading}
                     noOptionsText={employeesLoading ? "Loading employees..." : employees.length === 0 ? "No employees found" : "No matching employees"}
                     renderInput={(params) => (
                       <TextField
                         {...params}
                         label="Employee"
                         placeholder={employeesLoading ? "Loading employees..." : "Search by employee ID, name, department, or position..."}
                         error={formik.touched.employeeId && Boolean(formik.errors.employeeId)}
                         InputProps={{
                           ...params.InputProps,
                           endAdornment: (
                             <>
                               {employeesLoading ? <CircularProgress color="inherit" size={20} /> : null}
                               {params.InputProps.endAdornment}
                             </>
                           ),
                         }}
                       />
                     )}
                     renderOption={(props, option) => (
                       <Box component="li" {...props}>
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                           <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                             <Person sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                           </Avatar>
                           <Box sx={{ flex: 1 }}>
                             <Typography variant="body2" sx={{ fontWeight: 500 }}>
                               {option.firstName || ''} {option.lastName || ''}
                             </Typography>
                             <Typography variant="caption" color="text.secondary">
                               {option.employeeId || ''} • {option.placementDepartment?.name || ''} • {option.placementDesignation?.title || ''}
                             </Typography>
                           </Box>
                         </Box>
                       </Box>
                     )}
                     loadingText="Loading employees..."
                     sx={{
                       '& .MuiAutocomplete-input': {
                         cursor: 'pointer',
                       },
                     }}
                   />
                  </Grid>
                
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    name="month"
                    label="Month"
                    type="number"
                    value={formik.values.month}
                    onChange={formik.handleChange}
                    error={formik.touched.month && Boolean(formik.errors.month)}
                    helperText={formik.touched.month && formik.errors.month}
                    inputProps={{ min: 1, max: 12 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    name="year"
                    label="Year"
                    type="number"
                    value={formik.values.year}
                    onChange={formik.handleChange}
                    error={formik.touched.year && Boolean(formik.errors.year)}
                    helperText={formik.touched.year && formik.errors.year}
                    inputProps={{ min: 2020, max: 2030 }}
                  />
                </Grid>
              </Grid>

              {loadingEmployeeData && (
                <Paper sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Loading employee salary data...
                    </Typography>
                  </Box>
                </Paper>
              )}
              
              {selectedEmployee && !loadingEmployeeData && (
                <Paper sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ color: theme.palette.primary.main }}>
                    Selected Employee Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2">
                        <strong>Name:</strong> {selectedEmployee.firstName || ''} {selectedEmployee.lastName || ''}
                      </Typography>
                      <Typography variant="body2">
                        <strong>ID:</strong> {formatEmployeeId(selectedEmployee.employeeId || '')}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2">
                        <strong>Department:</strong> {selectedEmployee.placementDepartment?.name}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Position:</strong> {selectedEmployee.placementDesignation?.title}
                      </Typography>
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Note:</strong> Salary data has been auto-populated from employee record and latest payroll (if available).
                  </Typography>
                </Paper>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Salary & Earnings */}
        {activeStep === 1 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
                Salary & Earnings
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>Basic Salary Components</Typography>
                  <TextField
                    fullWidth
                    name="earnings.basicSalary"
                    label="Basic Salary"
                    type="number"
                    value={formik.values.earnings.basicSalary}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>,
                    }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    name="earnings.houseRent"
                    label="House Rent"
                    type="number"
                    value={formik.values.earnings.houseRent}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>,
                    }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    name="earnings.medicalAllowance"
                    label="Medical Allowance"
                    type="number"
                    value={formik.values.earnings.medicalAllowance}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>,
                    }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    name="earnings.conveyanceAllowance"
                    label="Conveyance Allowance"
                    type="number"
                    value={formik.values.earnings.conveyanceAllowance}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>,
                    }}
                    sx={{ mb: 2 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>Additional Earnings</Typography>
                  <TextField
                    fullWidth
                    name="earnings.specialAllowance"
                    label="Special Allowance"
                    type="number"
                    value={formik.values.earnings.specialAllowance}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>,
                    }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    name="earnings.overtime"
                    label="Overtime Pay"
                    type="number"
                    value={formik.values.earnings.overtime}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>,
                    }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    name="earnings.bonus"
                    label="Bonus"
                    type="number"
                    value={formik.values.earnings.bonus}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>,
                    }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    name="earnings.incentives"
                    label="Incentives"
                    type="number"
                    value={formik.values.earnings.incentives}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>,
                    }}
                    sx={{ mb: 2 }}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Total Earnings</Typography>
                <Typography variant="h5" sx={{ color: theme.palette.success.main, fontWeight: 'bold' }}>
                  {formatPKR(totals.totalEarnings)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Deductions & Attendance */}
        {activeStep === 2 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                <Receipt sx={{ mr: 1, verticalAlign: 'middle' }} />
                Deductions & Attendance
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>Deductions</Typography>
                  <TextField
                    fullWidth
                    name="deductions.providentFund"
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Provident Fund
                        <Chip 
                          label="Coming Soon" 
                          size="small" 
                          color="warning" 
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      </Box>
                    }
                    type="number"
                    value={formik.values.deductions.providentFund}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>,
                      readOnly: true,
                      sx: { 
                        bgcolor: 'grey.100',
                        '& .MuiInputBase-input': { color: 'text.secondary' }
                      }
                    }}
                    helperText="Provident Fund - Not included in total deductions (Coming Soon)"
                    sx={{ 
                      mb: 2,
                      '& .MuiInputLabel-root': { color: 'text.secondary' },
                      '& .MuiOutlinedInput-root': {
                        borderColor: 'warning.main',
                        '&:hover fieldset': { borderColor: 'warning.main' }
                      }
                    }}
                  />
                  <TextField
                    fullWidth
                    name="deductions.eobi"
                    label="EOBI"
                    type="number"
                    value={formik.values.deductions.eobi}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>,
                    }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    name="deductions.incomeTax"
                    label="Income Tax"
                    type="number"
                    value={formik.values.deductions.incomeTax}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>,
                    }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    name="deductions.loanDeduction"
                    label="Loan Deduction"
                    type="number"
                    value={formik.values.deductions.loanDeduction}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>,
                    }}
                    sx={{ mb: 2 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>Attendance</Typography>
                  <TextField
                    fullWidth
                    name="attendance.totalDays"
                    label="Total Days"
                    type="number"
                    value={formik.values.attendance.totalDays}
                    onChange={formik.handleChange}
                    inputProps={{ min: 0, max: 31 }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    name="attendance.presentDays"
                    label="Present Days"
                    type="number"
                    value={formik.values.attendance.presentDays}
                    onChange={formik.handleChange}
                    inputProps={{ min: 0, max: 31 }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    name="attendance.absentDays"
                    label="Absent Days"
                    type="number"
                    value={formik.values.attendance.absentDays}
                    onChange={formik.handleChange}
                    inputProps={{ min: 0, max: 31 }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    name="attendance.lateDays"
                    label="Late Days"
                    type="number"
                    value={formik.values.attendance.lateDays}
                    onChange={formik.handleChange}
                    inputProps={{ min: 0, max: 31 }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    name="attendance.overtimeHours"
                    label="Overtime Hours"
                    type="number"
                    value={formik.values.attendance.overtimeHours}
                    onChange={formik.handleChange}
                    inputProps={{ min: 0 }}
                    sx={{ mb: 2 }}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Total Deductions</Typography>
                <Typography variant="h5" sx={{ color: theme.palette.error.main, fontWeight: 'bold' }}>
                  {formatPKR(totals.totalDeductions)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review & Submit */}
        {activeStep === 3 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                <CheckCircle sx={{ mr: 1, verticalAlign: 'middle' }} />
                Review & Submit
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>Employee Information</Typography>
                  <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <Typography variant="body2">
                      <strong>Name:</strong> {selectedEmployee?.firstName} {selectedEmployee?.lastName}
                    </Typography>
                    <Typography variant="body2">
                      <strong>ID:</strong> {formatEmployeeId(selectedEmployee?.employeeId)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Department:</strong> {selectedEmployee?.placementDepartment?.name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Position:</strong> {selectedEmployee?.placementDesignation?.title}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Period:</strong> {new Date(formik.values.year, formik.values.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>Summary</Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell><strong>Total Earnings</strong></TableCell>
                          <TableCell align="right" sx={{ color: theme.palette.success.main }}>
                            {formatPKR(totals.totalEarnings)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Total Deductions</strong></TableCell>
                          <TableCell align="right" sx={{ color: theme.palette.error.main }}>
                            {formatPKR(totals.totalDeductions)}
                          </TableCell>
                        </TableRow>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                          <TableCell><strong>Net Salary</strong></TableCell>
                          <TableCell align="right" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
                            {formatPKR(totals.netSalary)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />
              
              <TextField
                fullWidth
                name="notes"
                label="Notes (Optional)"
                multiline
                rows={3}
                value={formik.values.notes}
                onChange={formik.handleChange}
                placeholder="Add any additional notes or remarks..."
              />
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            startIcon={<ArrowBack />}
          >
            Back
          </Button>
          
          <Box>
            <Button
              variant="outlined"
              onClick={() => navigate('/hr/payslips')}
              sx={{ mr: 1 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={loading}
              startIcon={activeStep === steps.length - 1 ? <Save /> : <ArrowForward />}
            >
              {activeStep === steps.length - 1 ? (isEditMode ? 'Update Payslip' : 'Create Payslip') : 'Next'}
            </Button>
          </Box>
        </Box>
      </form>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PayslipForm; 