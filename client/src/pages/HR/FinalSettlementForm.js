import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  FormHelperText,
  InputAdornment
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Person as PersonIcon,
  Payment as PaymentIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import finalSettlementService from '../../services/finalSettlementService';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import { PageLoading, LoadingSpinner } from '../../components/LoadingSpinner';

const steps = [
  'Employee & Basic Info',
  'Settlement Details',
  'Salary & Calculations',
  'Payment & Documents',
  'Review & Submit'
];

const FinalSettlementForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeLoans, setEmployeeLoans] = useState([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Filter employees based on search term
  const filteredEmployees = employees.filter((employee) => {
    if (!employeeSearch) return true;
    
    const searchTerm = employeeSearch.toLowerCase();
    const employeeName = employee.fullName || 
      `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 
      'Unknown';
    const departmentName = typeof employee.department === 'object' ? 
      (employee.department?.name || employee.department?.title || 'Unknown') : 
      (employee.department || 'Unknown');
    
    return (
      employee.employeeId?.toLowerCase().includes(searchTerm) ||
      employeeName.toLowerCase().includes(searchTerm) ||
      departmentName.toLowerCase().includes(searchTerm) ||
      employee.email?.toLowerCase().includes(searchTerm) ||
      employee.phone?.includes(searchTerm)
    );
  });

  // Form validation schema
  const validationSchema = Yup.object({
    employeeId: Yup.string().required('Employee is required'),
    settlementType: Yup.string().required('Settlement type is required'),
    reason: Yup.string().required('Reason is required').min(10, 'Reason must be at least 10 characters'),
    lastWorkingDate: Yup.date().required('Last working date is required'),
    settlementDate: Yup.date().required('Settlement date is required'),
    noticePeriod: Yup.number().min(0, 'Notice period cannot be negative'),
    noticePeriodServed: Yup.number().min(0, 'Notice period served cannot be negative'),
    paymentMethod: Yup.string().required('Payment method is required'),
    bankDetails: Yup.object({
      bankName: Yup.string().when('paymentMethod', {
        is: 'bank_transfer',
        then: Yup.string().required('Bank name is required')
      }),
      accountNumber: Yup.string().when('paymentMethod', {
        is: 'bank_transfer',
        then: Yup.string().required('Account number is required')
      }),
      accountTitle: Yup.string().when('paymentMethod', {
        is: 'bank_transfer',
        then: Yup.string().required('Account title is required')
      })
    })
  });

  // Formik form
  const formik = useFormik({
    initialValues: {
      employeeId: '',
      settlementType: '',
      reason: '',
      lastWorkingDate: '',
      settlementDate: '',
      noticePeriod: 30,
      noticePeriodServed: 0,
      paymentMethod: 'bank_transfer',
      bankDetails: {
        bankName: '',
        accountNumber: '',
        accountTitle: ''
      },
      notes: '',
      // Salary & Financial Details
      basicSalary: 0,
      grossSalary: 0,
      netSalary: 0,
      earnings: {
        basicSalary: 0,
        houseRent: 0,
        medicalAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
        leaveEncashment: 0,
        gratuity: 0,
        bonus: 0,
        overtime: 0,
        otherEarnings: 0
      },
      deductions: {
        noticePeriodDeduction: 0,
        loanDeductions: 0,
        advanceDeductions: 0,
        taxDeductions: 0,
        otherDeductions: 0
      },
      leaveBalance: {
        annual: 0,
        sick: 0,
        casual: 0,
        other: 0
      }
    },
    validationSchema,
    onSubmit: async (values) => {
      
      try {
        setLoading(true);
        
        // Prepare settlement data with required fields
        const settlementData = {
          ...values,
          employeeName: selectedEmployee?.name || '',
          department: selectedEmployee?.department || '',
          designation: selectedEmployee?.designation || '',
          employee: selectedEmployee?._id || '',
          basicSalary: selectedEmployee?.salary?.basic || 0,
          grossSalary: selectedEmployee?.salary?.gross || 0,
          netSalary: selectedEmployee?.salary?.net || 0
        };
        

        
        if (id) {
          // Update existing settlement
          await finalSettlementService.updateSettlement(id, settlementData);
          setSnackbar({
            open: true,
            message: 'Settlement updated successfully',
            severity: 'success'
          });
        } else {
          // Create new settlement
          await finalSettlementService.createSettlement(settlementData);
          setSnackbar({
            open: true,
            message: 'Settlement created successfully',
            severity: 'success'
          });
        }
        
        setTimeout(() => {
          navigate('/hr/settlements');
        }, 1500);
      } catch (error) {
        console.error('Error saving settlement:', error);
        setSnackbar({
          open: true,
          message: error.response?.data?.message || 'Error saving settlement',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    }
  });

  // Recalculate notice period deduction when notice period values change
  useEffect(() => {
    if (selectedEmployee) {
      const basicSalary = selectedEmployee.salary?.basic || (selectedEmployee.salary?.gross || 70000) * 0.6666;
      const dailyRate = basicSalary / 30;
      const noticeDeduction = noticePeriodShortfall > 0 ? dailyRate * noticePeriodShortfall : 0;
      formik.setFieldValue('deductions.noticePeriodDeduction', noticeDeduction);
    }
  }, [formik.values.noticePeriod, formik.values.noticePeriodServed, selectedEmployee]);

  // Load employees
  const fetchEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const response = await api.get('/hr/employees?limit=1000');
      setEmployees(response.data.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setSnackbar({
        open: true,
        message: 'Error fetching employees',
        severity: 'error'
      });
    } finally {
      setEmployeesLoading(false);
    }
  };

  // Load employee loans
  const fetchEmployeeLoans = async (employeeObjectId) => {
    if (!employeeObjectId) return;
    
    try {
      setLoansLoading(true);
      const response = await api.get(`/loans/employee/${employeeObjectId}`);
      const loans = response.data || [];
      setEmployeeLoans(loans);
      
      // Update loan deductions field
      const totalLoans = loans.reduce((sum, loan) => sum + (loan.outstandingBalance || 0), 0);
      formik.setFieldValue('deductions.loanDeductions', totalLoans);

    } catch (error) {
      console.error('Error fetching employee loans:', error);
      setSnackbar({
        open: true,
        message: 'Error fetching employee loans',
        severity: 'error'
      });
    } finally {
      setLoansLoading(false);
    }
  };

  // Handle employee selection
  const handleEmployeeChange = (employeeId) => {
    formik.setFieldValue('employeeId', employeeId);
    const employee = employees.find(emp => emp.employeeId === employeeId);
    
    if (employee) {
      // Get employee name from firstName + lastName or fullName virtual
      const employeeName = employee.fullName || 
        `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 
        'Unknown';
      
      // Handle nested department object
      const departmentName = typeof employee.department === 'object' ? 
        (employee.department?.name || employee.department?.title || 'Unknown') : 
        (employee.department || 'Unknown');
      
      // Handle nested designation object
      const designationName = typeof employee.designation === 'object' ? 
        (employee.designation?.name || employee.designation?.title || 'Unknown') : 
        (employee.designation || 'Unknown');
      
      const processedEmployee = {
        ...employee,
        name: employeeName,
        department: departmentName,
        designation: designationName
      };
      
      setSelectedEmployee(processedEmployee);
      
      // Calculate salary breakdown
      const grossSalary = employee.salary?.gross || 70000;
      const basicSalary = employee.salary?.basic || (grossSalary * 0.6666);
      const medicalAllowance = grossSalary * 0.10;
      const houseRentAllowance = grossSalary * 0.2334;
      const otherAllowances = grossSalary - basicSalary - medicalAllowance - houseRentAllowance;
      
      // Calculate daily rate and leave encashment
      const dailyRate = basicSalary / 30;
      const leaveEncashment = dailyRate * 30; // Assuming 30 days max
      
      // Calculate gratuity based on years of service
      const yearsOfService = employee.dateOfJoining ? 
        Math.floor((new Date() - new Date(employee.dateOfJoining)) / (1000 * 60 * 60 * 24 * 365)) : 0;
      const gratuity = basicSalary * Math.min(yearsOfService, 5); // Max 5 years
      
      // Auto-populate earnings with calculated values
      formik.setFieldValue('earnings.basicSalary', basicSalary);
      formik.setFieldValue('earnings.houseRent', houseRentAllowance);
      formik.setFieldValue('earnings.medicalAllowance', medicalAllowance);
      formik.setFieldValue('earnings.transportAllowance', employee.salary?.conveyance || 0);
      formik.setFieldValue('earnings.otherAllowances', otherAllowances);
      formik.setFieldValue('earnings.leaveEncashment', leaveEncashment);
      formik.setFieldValue('earnings.gratuity', gratuity);
      formik.setFieldValue('earnings.bonus', 0);
      formik.setFieldValue('earnings.overtime', 0);
      formik.setFieldValue('earnings.otherEarnings', 0);
      
      // Auto-populate leave balance
      const leaveBalance = employee.leaveBalance || {};
      formik.setFieldValue('leaveBalance.annual', leaveBalance.annual || 0);
      formik.setFieldValue('leaveBalance.sick', leaveBalance.sick || 0);
      formik.setFieldValue('leaveBalance.casual', leaveBalance.casual || 0);
      formik.setFieldValue('leaveBalance.other', leaveBalance.other || 0);
      
      // Calculate notice period deduction
      const noticeDeduction = noticePeriodShortfall > 0 ? dailyRate * noticePeriodShortfall : 0;
      formik.setFieldValue('deductions.noticePeriodDeduction', noticeDeduction);
      formik.setFieldValue('deductions.loanDeductions', 0); // Will be updated after loans are fetched
      formik.setFieldValue('deductions.advanceDeductions', 0);
      formik.setFieldValue('deductions.taxDeductions', 0);
      formik.setFieldValue('deductions.otherDeductions', 0);
      
      fetchEmployeeLoans(employee._id);
      
      // Pre-fill bank details if available
      if (employee.bankDetails) {
        formik.setFieldValue('bankDetails.bankName', employee.bankDetails.bankName || '');
        formik.setFieldValue('bankDetails.accountNumber', employee.bankDetails.accountNumber || '');
        formik.setFieldValue('bankDetails.accountTitle', employeeName);
      }
    }
  };

  // Load settlement data for editing
  const loadSettlementData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await finalSettlementService.getSettlement(id);
      const settlement = response.data;
      
      formik.setValues({
        employeeId: settlement.employeeId,
        settlementType: settlement.settlementType,
        reason: settlement.reason,
        lastWorkingDate: settlement.lastWorkingDate.split('T')[0],
        settlementDate: settlement.settlementDate.split('T')[0],
        noticePeriod: settlement.noticePeriod,
        noticePeriodServed: settlement.noticePeriodServed,
        paymentMethod: settlement.paymentMethod,
        bankDetails: settlement.bankDetails,
        notes: settlement.notes || ''
      });
      
      // Get employee name from firstName + lastName or fullName virtual
      const employeeName = settlement.employeeName || 
        `${settlement.employee?.firstName || ''} ${settlement.employee?.lastName || ''}`.trim() || 
        'Unknown';
      
      const departmentName = typeof settlement.department === 'object' ? 
        (settlement.department?.name || settlement.department?.title || 'Unknown') : 
        (settlement.department || 'Unknown');
      
      const designationName = typeof settlement.designation === 'object' ? 
        (settlement.designation?.name || settlement.designation?.title || 'Unknown') : 
        (settlement.designation || 'Unknown');
      
      setSelectedEmployee({
        _id: settlement.employee?._id || settlement.employee,
        employeeId: settlement.employeeId,
        name: employeeName,
        department: departmentName,
        designation: designationName
      });
      
      setEmployeeLoans(settlement.loans || []);
    } catch (error) {
      console.error('Error loading settlement:', error);
      setSnackbar({
        open: true,
        message: 'Error loading settlement data',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    if (id) {
      loadSettlementData();
    }
  }, [id]);

  // Update loan deductions when employee loans are fetched
  useEffect(() => {
    if (employeeLoans.length > 0) {
      const totalLoanAmount = employeeLoans.reduce((sum, loan) => {
        const outstanding = loan.outstandingBalance || 0;
        return sum + outstanding;
      }, 0);
      formik.setFieldValue('deductions.loanDeductions', totalLoanAmount);
    } else {
      formik.setFieldValue('deductions.loanDeductions', 0);
    }
  }, [employeeLoans]);

  // Update notice period deduction when notice period values change
  useEffect(() => {
    if (selectedEmployee && formik.values.noticePeriod && formik.values.noticePeriodServed) {
      const shortfall = Math.max(0, formik.values.noticePeriod - formik.values.noticePeriodServed);
      const basicSalary = selectedEmployee.salary?.basic || 50000;
      const noticeDeduction = shortfall > 0 ? (basicSalary / 30) * shortfall : 0;
      formik.setFieldValue('deductions.noticePeriodDeduction', noticeDeduction);
    }
  }, [formik.values.noticePeriod, formik.values.noticePeriodServed, selectedEmployee]);

  // Handle next step
  const handleNext = () => {
    // Validate current step before moving to next
    const currentStepFields = getStepFields(activeStep);
    const stepErrors = {};
    
    currentStepFields.forEach(field => {
      if (formik.errors[field]) {
        stepErrors[field] = formik.errors[field];
      }
    });
    
    if (Object.keys(stepErrors).length > 0) {
      // Mark fields as touched to show errors
      const touchedFields = {};
      currentStepFields.forEach(field => {
        touchedFields[field] = true;
      });
      formik.setTouched({ ...formik.touched, ...touchedFields });
      
      setSnackbar({
        open: true,
        message: 'Please fill in all required fields before proceeding',
        severity: 'error'
      });
      return;
    }
    
    setActiveStep((prevStep) => prevStep + 1);
  };

  // Get required fields for each step
  const getStepFields = (step) => {
    switch (step) {
      case 0: // Employee & Basic Info
        return ['employeeId'];
      case 1: // Settlement Details
        return ['settlementType', 'reason', 'lastWorkingDate', 'settlementDate'];
      case 2: // Salary & Calculations
        return []; // No required fields in this step
      case 3: // Payment & Documents
        const fields = ['paymentMethod'];
        if (formik.values.paymentMethod === 'bank_transfer') {
          fields.push('bankDetails.bankName', 'bankDetails.accountNumber', 'bankDetails.accountTitle');
        }
        return fields;
      default:
        return [];
    }
  };

  // Handle previous step
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  // Calculate notice period shortfall
  const noticePeriodShortfall = Math.max(0, formik.values.noticePeriod - formik.values.noticePeriodServed);

  // Calculate estimated settlement amount
  const calculateEstimatedAmount = () => {
    if (!selectedEmployee) return 0;
    
    const grossSalary = selectedEmployee.salary?.gross || 70000;
    const basicSalary = selectedEmployee.salary?.basic || (grossSalary * 0.6666);
    
    // Calculate salary components based on standard structure
    const medicalAllowance = grossSalary * 0.10; // 10% of gross (tax exempt)
    const houseRentAllowance = grossSalary * 0.2334; // 23.34% of gross
    const otherAllowances = grossSalary - basicSalary - medicalAllowance - houseRentAllowance;
    
    // Basic calculation
    let estimatedAmount = grossSalary;
    
    // Add leave encashment (based on basic salary)
    const dailyRate = basicSalary / 30;
    const leaveEncashment = dailyRate * Math.min(30, 30); // Assuming 30 days max
    estimatedAmount += leaveEncashment;
    
    // Add gratuity (if applicable - typically 1 month basic salary per year of service)
    const yearsOfService = selectedEmployee.dateOfJoining ? 
      Math.floor((new Date() - new Date(selectedEmployee.dateOfJoining)) / (1000 * 60 * 60 * 24 * 365)) : 0;
    const gratuity = basicSalary * Math.min(yearsOfService, 5); // Max 5 years
    
    // Subtract notice period deduction
    const noticeDeduction = dailyRate * noticePeriodShortfall;
    estimatedAmount -= noticeDeduction;
    
    // Subtract loan deductions
    const totalLoans = employeeLoans.reduce((sum, loan) => sum + (loan.outstandingBalance || 0), 0);
    estimatedAmount -= totalLoans;
    
    return Math.max(0, estimatedAmount);
  };

  // Calculate detailed salary breakdown
  const calculateSalaryBreakdown = () => {
    if (!selectedEmployee) return null;
    
    const grossSalary = selectedEmployee.salary?.gross || 70000;
    const basicSalary = selectedEmployee.salary?.basic || (grossSalary * 0.6666);
    
    // Calculate salary components
    const medicalAllowance = grossSalary * 0.10; // 10% of gross (tax exempt)
    const houseRentAllowance = grossSalary * 0.2334; // 23.34% of gross
    const otherAllowances = grossSalary - basicSalary - medicalAllowance - houseRentAllowance;
    
    // Calculate leave encashment
    const dailyRate = basicSalary / 30;
    const leaveEncashment = dailyRate * Math.min(30, 30);
    
    // Calculate gratuity
    const yearsOfService = selectedEmployee.dateOfJoining ? 
      Math.floor((new Date() - new Date(selectedEmployee.dateOfJoining)) / (1000 * 60 * 60 * 24 * 365)) : 0;
    const gratuity = basicSalary * Math.min(yearsOfService, 5);
    
    // Calculate deductions
    const noticeDeduction = dailyRate * noticePeriodShortfall;
    const totalLoans = employeeLoans.reduce((sum, loan) => sum + (loan.outstandingBalance || 0), 0);
    
    return {
      grossSalary,
      basicSalary,
      medicalAllowance,
      houseRentAllowance,
      otherAllowances,
      dailyRate,
      leaveEncashment,
      gratuity,
      noticeDeduction,
      totalLoans,
      netSettlement: Math.max(0, grossSalary + leaveEncashment + gratuity - noticeDeduction - totalLoans)
    };
  };

  // Render step content
  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={formik.touched.employeeId && Boolean(formik.errors.employeeId)}>
                <InputLabel>Employee</InputLabel>
                <Select
                  name="employeeId"
                  value={formik.values.employeeId}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  label="Employee"
                  disabled={employeesLoading}
                  onOpen={() => setEmployeeSearch('')}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 300
                      }
                    }
                  }}
                >
                  {/* Search Input */}
                  <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                    <TextField
                      size="small"
                      placeholder="Search by ID, name, department..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      fullWidth
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonIcon fontSize="small" />
                          </InputAdornment>
                        ),
                        endAdornment: employeesLoading ? (
                          <InputAdornment position="end">
                            <CircularProgress size={16} />
                          </InputAdornment>
                        ) : null
                      }}
                    />
                  </Box>
                  
                  {employeesLoading ? (
                    <MenuItem disabled>
                      <Box display="flex" alignItems="center" justifyContent="center" width="100%">
                        <CircularProgress size={20} />
                        <Typography variant="body2" style={{ marginLeft: 8 }}>
                          Loading employees...
                        </Typography>
                      </Box>
                    </MenuItem>
                  ) : filteredEmployees.length === 0 ? (
                    <MenuItem disabled>
                      {employeeSearch ? 'No employees found matching your search' : 'No employees found'}
                    </MenuItem>
                  ) : (
                    filteredEmployees.map((employee) => {
                      // Get employee name from firstName + lastName or fullName virtual
                      const employeeName = employee.fullName || 
                        `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 
                        'Unknown';
                      
                      // Handle nested department object
                      const departmentName = typeof employee.department === 'object' ? 
                        (employee.department?.name || employee.department?.title || 'Unknown') : 
                        (employee.department || 'Unknown');
                      
                      return (
                        <MenuItem key={employee._id} value={employee.employeeId}>
                          <Box>
                            <Typography variant="body1" fontWeight="bold">
                              {String(employee.employeeId || '')} - {String(employeeName)}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {String(departmentName)} • {String(employee.designation || 'N/A')}
                            </Typography>
                          </Box>
                        </MenuItem>
                      );
                    })
                  )}
                </Select>
                {formik.touched.employeeId && formik.errors.employeeId && (
                  <FormHelperText>{formik.errors.employeeId}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={formik.touched.settlementType && Boolean(formik.errors.settlementType)}>
                <InputLabel>Settlement Type</InputLabel>
                <Select
                  name="settlementType"
                  value={formik.values.settlementType}
                  onChange={formik.handleChange}
                  label="Settlement Type"
                >
                  <MenuItem value="resignation">Resignation</MenuItem>
                  <MenuItem value="termination">Termination</MenuItem>
                  <MenuItem value="retirement">Retirement</MenuItem>
                  <MenuItem value="contract_end">Contract End</MenuItem>
                  <MenuItem value="death">Death</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
                {formik.touched.settlementType && formik.errors.settlementType && (
                  <FormHelperText>{formik.errors.settlementType}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {selectedEmployee && (
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Employee Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Employee ID</Typography>
                        <Typography variant="body1">{String(selectedEmployee.employeeId || 'N/A')}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Name</Typography>
                        <Typography variant="body1">{String(selectedEmployee.name || 'N/A')}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Department</Typography>
                        <Typography variant="body1">{String(selectedEmployee.department || 'N/A')}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Designation</Typography>
                        <Typography variant="body1">{String(selectedEmployee.designation || 'N/A')}</Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                name="reason"
                label="Reason for Settlement"
                value={formik.values.reason}
                onChange={formik.handleChange}
                error={formik.touched.reason && Boolean(formik.errors.reason)}
                helperText={formik.touched.reason && formik.errors.reason}
                placeholder="Please provide detailed reason for the settlement..."
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                name="lastWorkingDate"
                label="Last Working Date"
                value={formik.values.lastWorkingDate}
                onChange={formik.handleChange}
                error={formik.touched.lastWorkingDate && Boolean(formik.errors.lastWorkingDate)}
                helperText={formik.touched.lastWorkingDate && formik.errors.lastWorkingDate}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                name="settlementDate"
                label="Settlement Date"
                value={formik.values.settlementDate}
                onChange={formik.handleChange}
                error={formik.touched.settlementDate && Boolean(formik.errors.settlementDate)}
                helperText={formik.touched.settlementDate && formik.errors.settlementDate}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                name="noticePeriod"
                label="Notice Period (Days)"
                value={formik.values.noticePeriod}
                onChange={formik.handleChange}
                error={formik.touched.noticePeriod && Boolean(formik.errors.noticePeriod)}
                helperText={formik.touched.noticePeriod && formik.errors.noticePeriod}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                name="noticePeriodServed"
                label="Notice Period Served (Days)"
                value={formik.values.noticePeriodServed}
                onChange={formik.handleChange}
                error={formik.touched.noticePeriodServed && Boolean(formik.errors.noticePeriodServed)}
                helperText={formik.touched.noticePeriodServed && formik.errors.noticePeriodServed}
              />
            </Grid>

            {noticePeriodShortfall > 0 && (
              <Grid item xs={12}>
                <Alert severity="warning">
                  Notice period shortfall: {noticePeriodShortfall} days
                  <br />
                  Estimated deduction: {formatPKR((selectedEmployee?.salary?.basic || 50000) / 30 * noticePeriodShortfall)}
                </Alert>
              </Grid>
            )}
          </Grid>
        );

      case 2:
        const salaryBreakdown = calculateSalaryBreakdown();
        return (
          <Grid container spacing={3}>
            {selectedEmployee && salaryBreakdown && (
              <>
                {/* Salary Summary Cards */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Salary Breakdown
                  </Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" color="primary">
                        Gross Salary
                      </Typography>
                      <Typography variant="h4">
                        {formatPKR(salaryBreakdown.grossSalary)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" color="secondary">
                        Basic Salary
                      </Typography>
                      <Typography variant="h4">
                        {formatPKR(salaryBreakdown.basicSalary)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        (66.66% of Gross)
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" color="success.main">
                        Medical Allowance
                      </Typography>
                      <Typography variant="h4">
                        {formatPKR(salaryBreakdown.medicalAllowance)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        (10% of Gross - Tax Exempt)
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" color="info.main">
                        House Rent Allowance
                      </Typography>
                      <Typography variant="h4">
                        {formatPKR(salaryBreakdown.houseRentAllowance)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        (23.34% of Gross)
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Detailed Salary Components */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Salary Components
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Basic Salary"
                    value={formatPKR(salaryBreakdown.basicSalary)}
                    InputProps={{ readOnly: true }}
                    helperText="66.66% of Gross Salary"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Medical Allowance"
                    value={formatPKR(salaryBreakdown.medicalAllowance)}
                    InputProps={{ readOnly: true }}
                    helperText="10% of Gross Salary (Tax Exempt)"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="House Rent Allowance"
                    value={formatPKR(salaryBreakdown.houseRentAllowance)}
                    InputProps={{ readOnly: true }}
                    helperText="23.34% of Gross Salary"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Other Allowances"
                    value={formatPKR(salaryBreakdown.otherAllowances)}
                    InputProps={{ readOnly: true }}
                    helperText="Remaining amount"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Daily Rate"
                    value={formatPKR(salaryBreakdown.dailyRate)}
                    InputProps={{ readOnly: true }}
                    helperText="Basic Salary ÷ 30 days"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Years of Service"
                    value={selectedEmployee.dateOfJoining ? 
                      Math.floor((new Date() - new Date(selectedEmployee.dateOfJoining)) / (1000 * 60 * 60 * 24 * 365)) : 0}
                    InputProps={{ readOnly: true }}
                    helperText="For gratuity calculation"
                  />
                </Grid>

                {/* Settlement Calculations */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Settlement Calculations
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Leave Encashment"
                    value={formatPKR(salaryBreakdown.leaveEncashment)}
                    InputProps={{ readOnly: true }}
                    helperText="30 days × Daily Rate"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Gratuity"
                    value={formatPKR(salaryBreakdown.gratuity)}
                    InputProps={{ readOnly: true }}
                    helperText={`${Math.min(selectedEmployee.dateOfJoining ? 
                      Math.floor((new Date() - new Date(selectedEmployee.dateOfJoining)) / (1000 * 60 * 60 * 24 * 365)) : 0, 5)} years × Basic Salary`}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Notice Period Deduction"
                    value={formatPKR(salaryBreakdown.noticeDeduction)}
                    InputProps={{ readOnly: true }}
                    helperText={`${noticePeriodShortfall} days × Daily Rate`}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Total Loan Deductions"
                    value={formatPKR(salaryBreakdown.totalLoans)}
                    InputProps={{ readOnly: true }}
                    helperText="Outstanding loan balance"
                  />
                </Grid>

                {/* Manual Override Fields */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Manual Adjustments
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    name="earnings.leaveEncashment"
                    label="Leave Encashment (Override)"
                    value={formik.values.earnings.leaveEncashment}
                    onChange={formik.handleChange}
                    helperText={`Auto-calculated: ${formatPKR(salaryBreakdown.leaveEncashment)}`}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    name="earnings.gratuity"
                    label="Gratuity (Override)"
                    value={formik.values.earnings.gratuity}
                    onChange={formik.handleChange}
                    helperText={`Auto-calculated: ${formatPKR(salaryBreakdown.gratuity)}`}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    name="earnings.bonus"
                    label="Bonus"
                    value={formik.values.earnings.bonus}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    name="earnings.otherEarnings"
                    label="Other Earnings"
                    value={formik.values.earnings.otherEarnings}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    name="deductions.noticePeriodDeduction"
                    label="Notice Period Deduction (Override)"
                    value={formik.values.deductions.noticePeriodDeduction}
                    onChange={formik.handleChange}
                    helperText={`Auto-calculated: ${formatPKR(salaryBreakdown.noticeDeduction)}`}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    name="deductions.loanDeductions"
                    label="Loan Deductions (Override)"
                    value={formik.values.deductions.loanDeductions}
                    onChange={formik.handleChange}
                    helperText={`Auto-calculated: ${formatPKR(salaryBreakdown.totalLoans)}`}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    name="deductions.advanceDeductions"
                    label="Advance Deductions"
                    value={formik.values.deductions.advanceDeductions}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    name="deductions.taxDeductions"
                    label="Tax Deductions"
                    value={formik.values.deductions.taxDeductions}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    name="deductions.otherDeductions"
                    label="Other Deductions"
                    value={formik.values.deductions.otherDeductions}
                    onChange={formik.handleChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₨</InputAdornment>
                    }}
                  />
                </Grid>

                {/* Final Settlement Summary */}
                <Grid item xs={12}>
                  <Card sx={{ backgroundColor: 'primary.light', color: 'white' }}>
                    <CardContent>
                      <Typography variant="h5" gutterBottom>
                        Final Settlement Amount
                      </Typography>
                      <Typography variant="h3">
                        {formatPKR(salaryBreakdown.netSettlement)}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Gross Salary + Leave Encashment + Gratuity - Deductions
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}
          </Grid>
        );

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={formik.touched.paymentMethod && Boolean(formik.errors.paymentMethod)}>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  name="paymentMethod"
                  value={formik.values.paymentMethod}
                  onChange={formik.handleChange}
                  label="Payment Method"
                >
                  <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="cheque">Cheque</MenuItem>
                  <MenuItem value="online">Online Payment</MenuItem>
                </Select>
                {formik.touched.paymentMethod && formik.errors.paymentMethod && (
                  <FormHelperText>{formik.errors.paymentMethod}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {formik.values.paymentMethod === 'bank_transfer' && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="bankDetails.bankName"
                    label="Bank Name"
                    value={formik.values.bankDetails.bankName}
                    onChange={formik.handleChange}
                    error={formik.touched.bankDetails?.bankName && Boolean(formik.errors.bankDetails?.bankName)}
                    helperText={formik.touched.bankDetails?.bankName && formik.errors.bankDetails?.bankName}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="bankDetails.accountNumber"
                    label="Account Number"
                    value={formik.values.bankDetails.accountNumber}
                    onChange={formik.handleChange}
                    error={formik.touched.bankDetails?.accountNumber && Boolean(formik.errors.bankDetails?.accountNumber)}
                    helperText={formik.touched.bankDetails?.accountNumber && formik.errors.bankDetails?.accountNumber}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="bankDetails.accountTitle"
                    label="Account Title"
                    value={formik.values.bankDetails.accountTitle}
                    onChange={formik.handleChange}
                    error={formik.touched.bankDetails?.accountTitle && Boolean(formik.errors.bankDetails?.accountTitle)}
                    helperText={formik.touched.bankDetails?.accountTitle && formik.errors.bankDetails?.accountTitle}
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                name="notes"
                label="Additional Notes"
                value={formik.values.notes}
                onChange={formik.handleChange}
                placeholder="Any additional notes or special instructions..."
              />
            </Grid>
          </Grid>
        );

      case 4:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Settlement Summary
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Employee Details
                  </Typography>
                  <Typography><strong>Name:</strong> {selectedEmployee?.name}</Typography>
                  <Typography><strong>ID:</strong> {selectedEmployee?.employeeId}</Typography>
                  <Typography><strong>Company:</strong> {selectedEmployee?.placementCompany?.name || 'N/A'}</Typography>
                  <Typography><strong>Department:</strong> {selectedEmployee?.placementDepartment?.name || 'N/A'}</Typography>
                  <Typography><strong>Designation:</strong> {selectedEmployee?.placementDesignation?.title || 'N/A'}</Typography>
                  <Typography><strong>Location:</strong> {selectedEmployee?.placementLocation?.name || 'N/A'}</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Settlement Details
                  </Typography>
                  <Typography><strong>Type:</strong> {finalSettlementService.getSettlementTypeLabel(formik.values.settlementType)}</Typography>
                  <Typography><strong>Last Working Date:</strong> {formik.values.lastWorkingDate}</Typography>
                  <Typography><strong>Settlement Date:</strong> {formik.values.settlementDate}</Typography>
                  <Typography><strong>Notice Period:</strong> {formik.values.noticePeriod} days</Typography>
                  <Typography><strong>Notice Served:</strong> {formik.values.noticePeriodServed} days</Typography>
                  {noticePeriodShortfall > 0 && (
                    <Typography color="error">
                      <strong>Shortfall:</strong> {noticePeriodShortfall} days
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Reason
                  </Typography>
                  <Typography>{formik.values.reason}</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Estimated Settlement Amount
                  </Typography>
                  <Typography variant="h4" color="primary">
                    {formatPKR(calculateEstimatedAmount())}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Final amount will be calculated during processing
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {formik.values.notes && (
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Additional Notes
                    </Typography>
                    <Typography>{formik.values.notes}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <PageLoading 
        message="Loading final settlement form..." 
        showSkeleton={true}
        skeletonType="cards"
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {id ? 'Edit Final Settlement' : 'New Final Settlement'}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/hr/settlements')}
        >
          Back to Settlements
        </Button>
      </Box>

      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Form Content */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <form onSubmit={formik.handleSubmit}>
          {renderStepContent(activeStep)}
        </form>
      </Paper>

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          startIcon={<BackIcon />}
        >
          Back
        </Button>

        <Box>
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={formik.handleSubmit}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            >
              {loading ? 'Saving...' : (id ? 'Update Settlement' : 'Create Settlement')}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              startIcon={<NextIcon />}
            >
              Next
            </Button>
          )}
        </Box>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FinalSettlementForm; 