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
  CircularProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Calculate as CalculateIcon,
  Receipt as ReceiptIcon,
  AccountBalance as AccountBalanceIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { format } from 'date-fns';
import { formatPKR } from '../../utils/currency';
import api from '../../services/authService';
import { loanService } from '../../services/loanService';

const steps = ['Basic Information', 'Salary & Allowances', 'Deductions & Overtime', 'Review & Calculate'];

const PayrollForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeLoans, setEmployeeLoans] = useState([]);

  // Add tax calculation display
  const [taxInfo, setTaxInfo] = useState(null);

  const validationSchema = Yup.object({
    employee: Yup.string().required('Employee is required'),
    payPeriod: Yup.object({
      startDate: Yup.date().required('Start date is required'),
      endDate: Yup.date().required('End date is required'),
      type: Yup.string().required('Pay period type is required')
    }),
    basicSalary: Yup.number().min(0, 'Basic salary must be positive').required('Basic salary is required'),
    allowances: Yup.object({
      housing: Yup.number().min(0, 'Housing allowance must be positive'),
      transport: Yup.number().min(0, 'Transport allowance must be positive'),
      meal: Yup.number().min(0, 'Meal allowance must be positive'),
      medical: Yup.number().min(0, 'Medical allowance must be positive'),
      other: Yup.number().min(0, 'Other allowance must be positive')
    }),
    overtime: Yup.object({
      hours: Yup.number().min(0, 'Overtime hours must be positive'),
      rate: Yup.number().min(0, 'Overtime rate must be positive')
    }),
    bonuses: Yup.object({
      performance: Yup.number().min(0, 'Performance bonus must be positive'),
      attendance: Yup.number().min(0, 'Attendance bonus must be positive'),
      other: Yup.number().min(0, 'Other bonus must be positive')
    }),
    deductions: Yup.object({
      tax: Yup.number().min(0, 'Tax must be positive'),
      insurance: Yup.number().min(0, 'Insurance must be positive'),
      pension: Yup.number().min(0, 'Pension must be positive'),
      eobi: Yup.number().min(0, 'EOBI must be positive'),
      providentFund: Yup.number().min(0, 'Provident Fund must be positive'),
      loan: Yup.number().min(0, 'Loan must be positive'),
      other: Yup.number().min(0, 'Other deduction must be positive')
    }),
    attendance: Yup.object({
      totalDays: Yup.number().min(0, 'Total days must be positive'),
      presentDays: Yup.number().min(0, 'Present days must be positive'),
      absentDays: Yup.number().min(0, 'Absent days must be positive'),
      lateDays: Yup.number().min(0, 'Late days must be positive'),
      halfDays: Yup.number().min(0, 'Half days must be positive')
    }),
    notes: Yup.string()
  });

  const formik = useFormik({
    initialValues: {
      employee: '',
      payPeriod: {
        startDate: '',
        endDate: '',
        type: 'monthly'
      },
      basicSalary: 0,
      allowances: {
        housing: 0,
        transport: 0,
        meal: 0,
        medical: 0,
        other: 0
      },
      overtime: {
        hours: 0,
        rate: 0,
        amount: 0
      },
      bonuses: {
        performance: 0,
        attendance: 0,
        other: 0
      },
      deductions: {
        tax: 0,
        insurance: 0,
        pension: 0,
        eobi: 0,
        providentFund: 0,
        loan: 0,
        other: 0
      },
      attendance: {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        halfDays: 0
      },
      leaveDeductions: {
        unpaidLeave: 0,
        sickLeave: 0,
        casualLeave: 0,
        annualLeave: 0,
        otherLeave: 0,
        totalLeaveDays: 0,
        leaveDeductionAmount: 0
      },
      notes: ''
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        console.log('Form submitted with values:', values);
        setLoading(true);
        setError(null);

        let savedPayroll;
        if (id && id !== 'add') {
          console.log('Updating existing payroll:', id);
          savedPayroll = await api.put(`/payroll/${id}`, values);
        } else {
          console.log('Creating new payroll');
          savedPayroll = await api.post('/payroll', values);
        }

        // Process loan payment if there's a loan deduction
        if (values.deductions.loan > 0 && employeeLoans.length > 0) {
          const activeLoan = employeeLoans.find(loan => 
            ['Active', 'Disbursed'].includes(loan.status) && loan.outstandingBalance > 0
          );
          
          if (activeLoan) {
            try {
              await loanService.processPayment(activeLoan._id, {
                amount: values.deductions.loan,
                paymentMethod: 'Salary Deduction'
              });
              console.log('Loan payment processed successfully');
              
              // Refresh loan information to get updated outstanding balance
              await fetchEmployeeLoans(values.employee);
            } catch (loanError) {
              console.error('Error processing loan payment:', loanError);
              // Don't fail the payroll save if loan payment fails
              setError('Payroll saved but loan payment failed: ' + (loanError.response?.data?.message || loanError.message));
            }
          }
        }

        console.log('Payroll saved successfully');
        navigate('/hr/payroll');
      } catch (error) {
        console.error('Error saving payroll:', error);
        console.error('Error response:', error.response);
        setError(error.response?.data?.message || 'Failed to save payroll');
      } finally {
        setLoading(false);
      }
    }
  });

  useEffect(() => {
    fetchEmployees();
    if (id && id !== 'add') {
      fetchPayroll();
    }
  }, [id]);

  // Update loan deduction when employee loans change
  useEffect(() => {
    if (employeeLoans.length > 0 && selectedEmployee) {
      const activeLoan = employeeLoans.find(loan => 
        ['Active', 'Disbursed'].includes(loan.status) && loan.outstandingBalance > 0
      );
      
      if (activeLoan) {
        // Recalculate loan deduction based on updated outstanding balance
        if (activeLoan.salaryDeduction?.enabled) {
          let loanDeduction = 0;
          
          if (activeLoan.salaryDeduction.deductionType === 'Fixed Amount') {
            loanDeduction = parseFloat(activeLoan.salaryDeduction.fixedAmount) || 0;
          } else if (activeLoan.salaryDeduction.deductionType === 'Percentage') {
            const percentage = parseFloat(activeLoan.salaryDeduction.percentage) || 0;
            loanDeduction = (formik.values.basicSalary * percentage) / 100;
          }
          
          // Ensure deduction doesn't exceed outstanding balance
          loanDeduction = Math.min(loanDeduction, activeLoan.outstandingBalance);
          formik.setFieldValue('deductions.loan', loanDeduction);
        }
      } else {
        // No active loan or loan is fully paid
        formik.setFieldValue('deductions.loan', 0);
      }
    }
  }, [employeeLoans, selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/hr/employees');
      setEmployees(response.data.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchEmployeeLoans = async (employeeId) => {
    try {
      const loans = await loanService.getEmployeeLoans(employeeId);
      setEmployeeLoans(loans);
      return loans;
    } catch (error) {
      console.error('Error fetching employee loans:', error);
      setEmployeeLoans([]);
      return [];
    }
  };

  const fetchPayroll = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/payroll/${id}`);
      const payroll = response.data.data;
      
      // Create a date from month and year for the pay period
      const startDate = new Date(payroll.year, payroll.month - 1, 1); // month is 0-indexed
      const endDate = new Date(payroll.year, payroll.month, 0); // Last day of the month
      
      formik.setValues({
        employee: payroll.employee._id,
        payPeriod: {
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          type: 'monthly'
        },
        basicSalary: payroll.basicSalary,
        allowances: {
          housing: payroll.houseRentAllowance || 0,
          transport: payroll.conveyanceAllowance || 0,
          meal: payroll.specialAllowance || 0,
          medical: payroll.medicalAllowance || 0,
          other: payroll.otherAllowance || 0
        },
        overtime: {
          hours: payroll.overtimeHours || 0,
          rate: payroll.overtimeRate || 0,
          amount: payroll.overtimeAmount || 0
        },
        bonuses: {
          performance: payroll.performanceBonus || 0,
          attendance: 0,
          other: payroll.otherBonus || 0
        },
        deductions: {
          tax: payroll.incomeTax || 0,
          insurance: payroll.healthInsurance || 0,
          pension: payroll.providentFund || 0,
          eobi: payroll.eobi || 0,
          loan: 0,
          other: payroll.otherDeductions || 0
        },
        attendance: {
          totalDays: payroll.totalWorkingDays || 22,
          presentDays: payroll.presentDays || 22,
          absentDays: payroll.absentDays || 0,
          lateDays: 0,
          halfDays: 0
        },
        leaveDeductions: {
          unpaidLeave: 0,
          sickLeave: 0,
          casualLeave: 0,
          annualLeave: 0,
          otherLeave: payroll.leaveDays || 0,
          totalLeaveDays: payroll.leaveDays || 0,
          leaveDeductionAmount: 0
        },
        notes: payroll.remarks || ''
      });
      
      setSelectedEmployee(payroll.employee);
    } catch (error) {
      console.error('Error fetching payroll:', error);
      setError('Failed to load payroll details');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeChange = async (employeeId) => {
    const employee = employees.find(emp => emp._id === employeeId);
    setSelectedEmployee(employee);
    formik.setFieldValue('employee', employeeId);
    if (employee) {
      // Auto-calculate salary components from gross salary
      const grossSalary = employee.salary?.gross || 0;
      const basicSalary = Math.round(grossSalary * 0.6666); // 66.66% of gross
      const medicalAllowance = Math.round(grossSalary * 0.1); // 10% of gross
      const houseRentAllowance = Math.round(grossSalary * 0.2334); // 23.34% of gross (remaining)
      
      // Set calculated values
      formik.setFieldValue('basicSalary', basicSalary);
      formik.setFieldValue('allowances.housing', houseRentAllowance);
      formik.setFieldValue('allowances.medical', medicalAllowance);
      // Don't reset conveyance allowance - let user enter their own value
      // formik.setFieldValue('allowances.transport', 0); // Removed - user should enter their own value
      formik.setFieldValue('allowances.other', 0); // Not used in new structure
      
      // Set EOBI if employee has it active
              // EOBI is always 370 PKR for all employees (Pakistan EOBI fixed amount)
        formik.setFieldValue('deductions.eobi', 370);
      
      // Set Provident Fund if employee has it active (8.834% of basic salary)
      if (employee.providentFund?.isActive) {
        const providentFundAmount = Math.round((basicSalary * 8.834) / 100);
        formik.setFieldValue('deductions.providentFund', providentFundAmount);
      } else {
        formik.setFieldValue('deductions.providentFund', 0);
      }
      
      // Fetch and set loan information
      const loans = await fetchEmployeeLoans(employeeId);
      const activeLoan = loans.find(loan => 
        ['Active', 'Disbursed'].includes(loan.status) && loan.outstandingBalance > 0
      );
      
      if (activeLoan) {
        // Set loan deduction based on salary deduction settings
        if (activeLoan.salaryDeduction?.enabled) {
          let loanDeduction = 0;
          
          if (activeLoan.salaryDeduction.deductionType === 'Fixed Amount') {
            loanDeduction = parseFloat(activeLoan.salaryDeduction.fixedAmount) || 0;
          } else if (activeLoan.salaryDeduction.deductionType === 'Percentage') {
            const percentage = parseFloat(activeLoan.salaryDeduction.percentage) || 0;
            loanDeduction = (basicSalary * percentage) / 100;
          }
          
          // Ensure deduction doesn't exceed outstanding balance
          loanDeduction = Math.min(loanDeduction, activeLoan.outstandingBalance);
          formik.setFieldValue('deductions.loan', loanDeduction);
        } else {
          formik.setFieldValue('deductions.loan', 0);
        }
      } else {
        formik.setFieldValue('deductions.loan', 0);
      }
      
      // Set currency
      formik.setFieldValue('currency', employee.currency || 'PKR');
    }
  };

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const calculateTotals = () => {
    const values = formik.values;
    
    // Ensure we have valid basic salary before calculating
    if (!values.basicSalary || values.basicSalary <= 0) {
      return {
        totalAllowances: 0,
        overtimeAmount: 0,
        totalBonuses: 0,
        totalDeductions: 0,
        grossPay: 0,
        netPay: 0,
        leaveDeductionAmount: 0,
        totalLeaveDays: 0,
        dailyRate: 0,
        autoCalculatedTax: 0
      };
    }
    
    // Calculate total allowances with safe defaults
    const totalAllowances = 
      (values.allowances?.housing || 0) + 
      (values.allowances?.transport || 0) + 
      (values.allowances?.meal || 0) + 
      (values.allowances?.medical || 0) + 
      (values.allowances?.other || 0);

    // Calculate overtime amount with safe defaults
    const overtimeAmount = (values.overtime?.hours || 0) * (values.overtime?.rate || 0);

    // Calculate total bonuses with safe defaults
    const totalBonuses = 
      (values.bonuses?.performance || 0) + 
      (values.bonuses?.attendance || 0) + 
      (values.bonuses?.other || 0);

    // Calculate leave deductions with safe defaults
    const workingDaysPerMonth = 22; // Standard working days per month
    const dailyRate = values.basicSalary / workingDaysPerMonth;
    
    // Ensure leaveDeductions exists with default values
    const leaveDeductions = values.leaveDeductions || {
      unpaidLeave: 0,
      sickLeave: 0,
      casualLeave: 0,
      annualLeave: 0,
      otherLeave: 0
    };
    
    const leaveDeductionAmount = (leaveDeductions.unpaidLeave + leaveDeductions.otherLeave) * dailyRate;
    const totalLeaveDays = leaveDeductions.unpaidLeave + leaveDeductions.sickLeave + 
                           leaveDeductions.casualLeave + leaveDeductions.annualLeave + 
                           leaveDeductions.otherLeave;

    // Use tax info from state (calculated by useEffect)
    const autoCalculatedTax = taxInfo ? (taxInfo.monthlyTax || 0) : 0;

    // Calculate total deductions (including auto-calculated tax)
    const totalDeductions = 
      autoCalculatedTax + // Use auto-calculated tax
      (values.deductions?.insurance || 0) + 
      (values.deductions?.pension || 0) + 
      (values.deductions?.eobi || 0) + 
      (values.deductions?.providentFund || 0) + 
      (values.deductions?.loan || 0) + 
      (values.deductions?.other || 0) + 
      leaveDeductionAmount;

    // Calculate gross pay
    const grossPay = values.basicSalary + totalAllowances + overtimeAmount + totalBonuses;

    // Calculate net pay (after all deductions including tax)
    const netPay = grossPay - totalDeductions;

    const totals = {
      totalAllowances: totalAllowances || 0,
      overtimeAmount: overtimeAmount || 0,
      totalBonuses: totalBonuses || 0,
      totalDeductions: totalDeductions || 0,
      grossPay: grossPay || 0,
      netPay: netPay || 0,
      leaveDeductionAmount: leaveDeductionAmount || 0,
      totalLeaveDays: totalLeaveDays || 0,
      dailyRate: dailyRate || 0,
      autoCalculatedTax: autoCalculatedTax || 0
    };

    // Debug logging
    console.log('🔍 Payroll Totals Calculation:', {
      basicSalary: values.basicSalary,
      allowances: values.allowances,
      taxInfo: taxInfo,
      autoCalculatedTax,
      totals
    });

    return totals;
  };

  const formatCurrency = formatPKR;

  // Add tax calculation display
  const calculateTaxInfo = async (basicSalary, allowances) => {
    if (!basicSalary) return null;

    // Calculate taxable income based on new salary structure:
    // - 66.66% Basic Salary (taxable)
    // - 10% Medical Allowance (tax-exempt)
    // - 23.34% House Rent Allowance (taxable)
    // - Other Allowances (conveyance, meal, transport, etc.) are taxable
    const taxableIncome = basicSalary + 
      (allowances?.housing || 0) + 
      (allowances?.transport || 0) + 
      (allowances?.meal || 0) + 
      (allowances?.other || 0);
    // Only medical allowance is tax-exempt according to FBR 2025-2026
    // All other allowances are taxable

    const annualTaxableIncome = taxableIncome * 12;
    
    try {
      // Use the new database-driven tax calculation
      const response = await api.post('/hr/fbr-tax-slabs/calculate', {
        annualIncome: annualTaxableIncome
      });
      
      const result = response.data.data;
      
      return {
        monthlyTax: result.monthlyTax,
        annualTaxableIncome: Math.round(annualTaxableIncome),
        taxSlab: result.taxInfo.slab,
        taxRate: result.taxInfo.rate,
        taxableIncome: Math.round(taxableIncome)
      };
    } catch (error) {
      console.error('Error calculating tax:', error);
      return null;
    }
  };

  // Update tax info when salary changes
  useEffect(() => {
    const updateTaxInfo = async () => {
      if (formik.values.basicSalary) {
        const taxInfo = await calculateTaxInfo(
          formik.values.basicSalary,
          formik.values.allowances
        );
        setTaxInfo(taxInfo);
        
        // Auto-update income tax field
        if (taxInfo) {
          formik.setFieldValue('incomeTax', taxInfo.monthlyTax);
        }
      }
    };

    updateTaxInfo();
  }, [formik.values.basicSalary, formik.values.allowances]);

  // Helper function to safely render populated object properties
  const safeRenderText = (value) => {
    if (typeof value === 'object' && value !== null) {
      return value.name || value.title || value.code || 'N/A';
    }
    return value || 'N/A';
  };

  const renderStepContent = (step) => {
    const totals = calculateTotals();

    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Employee</InputLabel>
                <Select
                  name="employee"
                  value={formik.values.employee}
                  onChange={(e) => {
                    handleEmployeeChange(e.target.value);
                    formik.setFieldValue('employee', e.target.value);
                    formik.setFieldTouched('employee', true);
                  }}
                  label="Employee"
                  error={formik.touched.employee && Boolean(formik.errors.employee)}
                >
                  {employees.map((employee) => (
                    <MenuItem key={employee._id} value={employee._id}>
                      {employee.firstName} {employee.lastName} - {employee.employeeId}
                    </MenuItem>
                  ))}
                </Select>
                {formik.touched.employee && formik.errors.employee && (
                  <Typography color="error" variant="caption">
                    {formik.errors.employee}
                  </Typography>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Pay Period Type</InputLabel>
                <Select
                  name="payPeriod.type"
                  value={formik.values.payPeriod.type}
                  onChange={formik.handleChange}
                  label="Pay Period Type"
                >
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="bi-weekly">Bi-weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                name="payPeriod.startDate"
                label="Start Date"
                value={formik.values.payPeriod.startDate}
                onChange={formik.handleChange}
                InputLabelProps={{ shrink: true }}
                error={formik.touched.payPeriod?.startDate && Boolean(formik.errors.payPeriod?.startDate)}
                helperText={formik.touched.payPeriod?.startDate && formik.errors.payPeriod?.startDate}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                name="payPeriod.endDate"
                label="End Date"
                value={formik.values.payPeriod.endDate}
                onChange={formik.handleChange}
                InputLabelProps={{ shrink: true }}
                error={formik.touched.payPeriod?.endDate && Boolean(formik.errors.payPeriod?.endDate)}
                helperText={formik.touched.payPeriod?.endDate && formik.errors.payPeriod?.endDate}
              />
            </Grid>
            {selectedEmployee && (
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Employee Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="textSecondary">
                          Name: {selectedEmployee.firstName} {selectedEmployee.lastName}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="textSecondary">
                          Employee ID: {selectedEmployee.employeeId}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="textSecondary">
                          Department: {safeRenderText(selectedEmployee.department)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="textSecondary">
                          Position: {safeRenderText(selectedEmployee.position)}
                        </Typography>
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
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                name="basicSalary"
                label="Basic Salary"
                value={formik.values.basicSalary}
                onChange={(e) => {
                  formik.handleChange(e);
                  formik.setFieldTouched('basicSalary', true);
                }}
                onBlur={() => formik.setFieldTouched('basicSalary', true)}
                error={formik.touched.basicSalary && Boolean(formik.errors.basicSalary)}
                helperText={formik.touched.basicSalary && formik.errors.basicSalary}
                InputProps={{
                  startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Allowances</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="allowances.housing"
                        label="House Rent Allowance"
                        value={formik.values.allowances.housing}
                        onChange={formik.handleChange}
                        InputProps={{
                          startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="allowances.medical"
                        label="Medical Allowance"
                        value={formik.values.allowances.medical}
                        onChange={formik.handleChange}
                        InputProps={{
                          startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="allowances.transport"
                        label="Conveyance Allowance"
                        value={formik.values.allowances.transport}
                        onChange={formik.handleChange}
                        inputProps={{
                          step: "1",
                          min: "0"
                        }}
                        InputProps={{
                          startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                        }}
                        helperText="Enter exact amount (no rounding)"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="allowances.other"
                        label="Special Allowance"
                        value={formik.values.allowances.other}
                        onChange={formik.handleChange}
                        InputProps={{
                          startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="allowances.meal"
                        label="Other Allowance"
                        value={formik.values.allowances.meal}
                        onChange={formik.handleChange}
                        InputProps={{
                          startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                        }}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Bonuses</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="bonuses.performance"
                        label="Performance Bonus"
                        value={formik.values.bonuses.performance}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="bonuses.attendance"
                        label="Attendance Bonus"
                        value={formik.values.bonuses.attendance}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="bonuses.other"
                        label="Other Bonus"
                        value={formik.values.bonuses.other}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Overtime</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="overtime.hours"
                        label="Overtime Hours"
                        value={formik.values.overtime.hours}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="overtime.rate"
                        label="Overtime Rate per Hour"
                        value={formik.values.overtime.rate}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        label="Overtime Amount"
                        value={formatCurrency(totals.overtimeAmount)}
                        InputProps={{ readOnly: true }}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Deductions</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="deductions.tax"
                        label="Tax"
                        value={formik.values.deductions.tax}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="deductions.insurance"
                        label="Insurance"
                        value={formik.values.deductions.insurance}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="deductions.pension"
                        label="Pension"
                        value={formik.values.deductions.pension}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="deductions.eobi"
                        label="EOBI"
                        value={370}
                        onChange={formik.handleChange}
                        InputProps={{
                          readOnly: true,
                          startAdornment: <span style={{ marginRight: 8 }}>PKR</span>
                        }}
                        helperText="Pakistan EOBI (Fixed: Rs 370 for All Employees)"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="deductions.providentFund"
                        label="Provident Fund"
                        value={formik.values.deductions.providentFund}
                        onChange={formik.handleChange}
                        helperText="Provident Fund (8.834% of basic salary)"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="deductions.loan"
                        label="Loan"
                        value={formik.values.deductions.loan}
                        onChange={formik.handleChange}
                        helperText={
                          employeeLoans.length > 0 
                            ? `Active Loan: ${employeeLoans.find(l => ['Active', 'Disbursed'].includes(l.status))?.loanType || 'N/A'} | Outstanding: ${formatPKR(employeeLoans.find(l => ['Active', 'Disbursed'].includes(l.status))?.outstandingBalance || 0)}`
                            : 'No active loans'
                        }
                        disabled={employeeLoans.length === 0}
                        InputProps={{
                          endAdornment: employeeLoans.length > 0 && (
                            <Chip 
                              size="small" 
                              label={employeeLoans.find(l => ['Active', 'Disbursed'].includes(l.status))?.outstandingBalance > 0 ? 'Active' : 'Paid'} 
                              color={employeeLoans.find(l => ['Active', 'Disbursed'].includes(l.status))?.outstandingBalance > 0 ? 'warning' : 'success'}
                            />
                          )
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="deductions.other"
                        label="Other Deduction"
                        value={formik.values.deductions.other}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Attendance</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="attendance.totalDays"
                        label="Total Days"
                        value={formik.values.attendance.totalDays}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="attendance.presentDays"
                        label="Present Days"
                        value={formik.values.attendance.presentDays}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="attendance.absentDays"
                        label="Absent Days"
                        value={formik.values.attendance.absentDays}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="attendance.lateDays"
                        label="Late Days"
                        value={formik.values.attendance.lateDays}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="attendance.halfDays"
                        label="Half Days"
                        value={formik.values.attendance.halfDays}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Leave Deductions</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="leaveDeductions.unpaidLeave"
                        label="Unpaid Leave (Days)"
                        value={formik.values.leaveDeductions?.unpaidLeave || 0}
                        onChange={formik.handleChange}
                        helperText="Deducted from salary"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="leaveDeductions.sickLeave"
                        label="Sick Leave (Days)"
                        value={formik.values.leaveDeductions?.sickLeave || 0}
                        onChange={formik.handleChange}
                        helperText="Usually paid"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="leaveDeductions.casualLeave"
                        label="Casual Leave (Days)"
                        value={formik.values.leaveDeductions?.casualLeave || 0}
                        onChange={formik.handleChange}
                        helperText="Usually paid"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="leaveDeductions.annualLeave"
                        label="Annual Leave (Days)"
                        value={formik.values.leaveDeductions?.annualLeave || 0}
                        onChange={formik.handleChange}
                        helperText="Usually paid"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="leaveDeductions.otherLeave"
                        label="Other Leave (Days)"
                        value={formik.values.leaveDeductions?.otherLeave || 0}
                        onChange={formik.handleChange}
                        helperText="Deducted from salary"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        label="Total Leave Days"
                        value={(formik.values.leaveDeductions?.unpaidLeave || 0) + 
                               (formik.values.leaveDeductions?.sickLeave || 0) + 
                               (formik.values.leaveDeductions?.casualLeave || 0) + 
                               (formik.values.leaveDeductions?.annualLeave || 0) + 
                               (formik.values.leaveDeductions?.otherLeave || 0)}
                        InputProps={{ readOnly: true }}
                        helperText="Auto-calculated"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
          </Grid>
        );

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Payroll Summary
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" color="primary">
                          Earnings
                        </Typography>
                        <Typography>Basic Salary: {formatCurrency(formik.values.basicSalary)}</Typography>
                        <Typography>Total Allowances: {formatCurrency(totals.totalAllowances)}</Typography>
                        <Typography>Overtime: {formatCurrency(totals.overtimeAmount)}</Typography>
                        <Typography>Total Bonuses: {formatCurrency(totals.totalBonuses)}</Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="h6" color="success.main">
                          Gross Pay: {formatCurrency(totals.grossPay)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" color="error">
                          Deductions
                        </Typography>
                        <Typography>Tax: {formatCurrency(totals.autoCalculatedTax)}</Typography>
                        <Typography>Insurance: {formatCurrency(formik.values.deductions.insurance)}</Typography>
                        <Typography>Pension: {formatCurrency(formik.values.deductions.pension)}</Typography>
                        <Typography>EOBI: {formatCurrency(formik.values.deductions.eobi)}</Typography>
                        <Typography>Provident Fund: {formatCurrency(formik.values.deductions.providentFund)}</Typography>
                        <Typography>Loan: {formatCurrency(formik.values.deductions.loan)}</Typography>
                        <Typography>Other: {formatCurrency(formik.values.deductions.other)}</Typography>
                        <Typography color="warning.main">Leave Deduction: {formatCurrency(totals.leaveDeductionAmount)}</Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="h6" color="error">
                          Total Deductions: {formatCurrency(totals.totalDeductions)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Leave Summary
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={3}>
                              <Typography variant="body2" color="textSecondary">
                                Unpaid Leave: {formik.values.leaveDeductions?.unpaidLeave || 0} days
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Typography variant="body2" color="textSecondary">
                                Sick Leave: {formik.values.leaveDeductions?.sickLeave || 0} days
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Typography variant="body2" color="textSecondary">
                                Casual Leave: {formik.values.leaveDeductions?.casualLeave || 0} days
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Typography variant="body2" color="textSecondary">
                                Annual Leave: {formik.values.leaveDeductions?.annualLeave || 0} days
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Typography variant="body2" color="textSecondary">
                                Other Leave: {formik.values.leaveDeductions?.otherLeave || 0} days
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Typography variant="body2" color="primary">
                                Total Leave Days: {totals.totalLeaveDays}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Typography variant="body2" color="warning.main">
                                Daily Rate: {formatCurrency(totals.dailyRate)}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Typography variant="body2" color="error">
                                Leave Deduction: {formatCurrency(totals.leaveDeductionAmount)}
                              </Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 2 }} />
                  
                  {/* Beautiful Net Salary Display */}
                  <Grid container spacing={3} sx={{ mb: 3 }}>
                    {/* Net Salary WITH Deductions */}
                    <Grid item xs={12} md={6}>
                      <Card sx={{ 
                        bgcolor: 'primary.main', 
                        color: 'white',
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '100px',
                          height: '100px',
                          background: 'rgba(255,255,255,0.1)',
                          borderRadius: '50%',
                          transform: 'translate(30px, -30px)'
                        }
                      }}>
                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                          <Typography variant="h6" sx={{ mb: 2, opacity: 0.9 }}>
                            💰 Net Salary (With Deductions)
                          </Typography>
                          <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
                            {formatCurrency(totals.netPay)}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.8 }}>
                            Take-Home Amount
                          </Typography>
                          <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Gross:</strong> {formatCurrency(totals.grossPay)}
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Tax:</strong> {formatCurrency(totals.autoCalculatedTax)}
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>EOBI:</strong> {formatCurrency(370)}
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>PF:</strong> {formatCurrency(formik.values.deductions.providentFund || 0)}
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Other:</strong> {formatCurrency((formik.values.deductions.other || 0) + (formik.values.deductions.loan || 0))}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.light' }}>
                              <strong>Total Deductions:</strong> {formatCurrency(totals.totalDeductions)}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Net Salary WITHOUT Deductions */}
                    <Grid item xs={12} md={6}>
                      <Card sx={{ 
                        bgcolor: 'success.main', 
                        color: 'white',
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '100px',
                          height: '100px',
                          background: 'rgba(255,255,255,0.1)',
                          borderRadius: '50%',
                          transform: 'translate(30px, -30px)'
                        }
                      }}>
                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                          <Typography variant="h6" sx={{ mb: 2, opacity: 0.9 }}>
                            🎯 Net Salary (Without PF & EOBI)
                          </Typography>
                          <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
                            {formatCurrency(totals.grossPay - totals.autoCalculatedTax - (formik.values.deductions.other || 0) - (formik.values.deductions.loan || 0))}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.8 }}>
                            Excluding PF & EOBI Deductions
                          </Typography>
                          <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Gross:</strong> {formatCurrency(totals.grossPay)}
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Tax:</strong> {formatCurrency(totals.autoCalculatedTax)}
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Other Deductions:</strong> {formatCurrency((formik.values.deductions.other || 0) + (formik.values.deductions.loan || 0))}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.light' }}>
                              <strong>PF + EOBI Saved:</strong> {formatCurrency((formik.values.deductions.providentFund || 0) + 370)}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  {/* Detailed Breakdown */}
                  <Card sx={{ bgcolor: '#f8f9fa', mb: 2 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>
                        📊 Detailed Salary Breakdown
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="textSecondary">
                            <strong>Gross Salary:</strong> {formatCurrency(totals.grossPay)}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            <strong>Income Tax:</strong> {formatCurrency(totals.autoCalculatedTax)}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            <strong>EOBI (Fixed):</strong> {formatCurrency(370)} (Pakistan EOBI - Fixed Amount for All Employees)
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="textSecondary">
                            <strong>Provident Fund:</strong> {formatCurrency(formik.values.deductions.providentFund || 0)} (8.834% of basic salary)
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            <strong>Other Deductions:</strong> {formatCurrency((formik.values.deductions.other || 0) + (formik.values.deductions.loan || 0))}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            <strong>Total Deductions:</strong> {formatCurrency(totals.totalDeductions)}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                name="notes"
                label="Notes"
                value={formik.values.notes}
                onChange={formik.handleChange}
                placeholder="Add any additional notes or comments..."
              />
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  if (loading && id && id !== 'add') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {id && id !== 'add' ? 'Edit Payroll' : 'Create New Payroll'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <form onSubmit={(e) => {
          console.log('Form submit event triggered');
          console.log('Formik errors:', formik.errors);
          console.log('Formik touched:', formik.touched);
          console.log('Formik isValid:', formik.isValid);
          formik.handleSubmit(e);
        }}>
          {renderStepContent(activeStep)}

          {/* Tax Calculation Information */}
          {taxInfo && (
            <Card sx={{ mb: 3, bgcolor: '#f8f9fa' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: '#1976d2', display: 'flex', alignItems: 'center' }}>
                  <CalculateIcon sx={{ mr: 1 }} />
                  Pakistan FBR Tax Calculation (FY 2025-26)
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Taxable Income (Monthly):</strong> Rs {taxInfo.taxableIncome.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Taxable Income (Annual):</strong> Rs {taxInfo.annualTaxableIncome.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Tax Slab:</strong> {taxInfo.taxSlab}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Tax Rate:</strong> {taxInfo.taxRate}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Monthly Tax:</strong> Rs {taxInfo.monthlyTax.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Annual Tax:</strong> Rs {(taxInfo.monthlyTax * 12).toLocaleString()}
                    </Typography>
                  </Grid>
                </Grid>
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Note:</strong> Tax is calculated on Basic Salary + All Allowances (except Medical Allowance which is tax-exempt)
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              startIcon={<ArrowBackIcon />}
            >
              Back
            </Button>
            <Box>
              {activeStep === steps.length - 1 ? (
                <>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      console.log('Manual form submission test');
                      console.log('Form values:', formik.values);
                      console.log('Form errors:', formik.errors);
                      console.log('Form touched:', formik.touched);
                      formik.handleSubmit();
                    }}
                    sx={{ mr: 2 }}
                  >
                    Test Submit
                  </Button>
                  <Button
                    variant="contained"
                    type="submit"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                  >
                    {loading ? 'Saving...' : 'Save Payroll'}
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  startIcon={<ArrowForwardIcon />}
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default PayrollForm; 