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
  AccordionDetails
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

const steps = ['Basic Information', 'Salary & Allowances', 'Deductions & Overtime', 'Review & Calculate'];

const PayrollForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

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

        if (id && id !== 'add') {
          console.log('Updating existing payroll:', id);
          await api.put(`/payroll/${id}`, values);
        } else {
          console.log('Creating new payroll');
          await api.post('/payroll', values);
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

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/hr/employees');
      setEmployees(response.data.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchPayroll = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/payroll/${id}`);
      const payroll = response.data.data;
      
      formik.setValues({
        employee: payroll.employee._id,
        payPeriod: {
          startDate: format(new Date(payroll.payPeriod.startDate), 'yyyy-MM-dd'),
          endDate: format(new Date(payroll.payPeriod.endDate), 'yyyy-MM-dd'),
          type: payroll.payPeriod.type
        },
        basicSalary: payroll.basicSalary,
        allowances: payroll.allowances || {},
        overtime: payroll.overtime || {},
        bonuses: payroll.bonuses || {},
        deductions: payroll.deductions || {},
        attendance: payroll.attendance || {},
        leaveDeductions: payroll.leaveDeductions || {
          unpaidLeave: 0,
          sickLeave: 0,
          casualLeave: 0,
          annualLeave: 0,
          otherLeave: 0,
          totalLeaveDays: 0,
          leaveDeductionAmount: 0
        },
        notes: payroll.notes || ''
      });
      
      setSelectedEmployee(payroll.employee);
    } catch (error) {
      console.error('Error fetching payroll:', error);
      setError('Failed to load payroll details');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeChange = (employeeId) => {
    const employee = employees.find(emp => emp._id === employeeId);
    setSelectedEmployee(employee);
    formik.setFieldValue('employee', employeeId);
    if (employee) {
      formik.setFieldValue('basicSalary', employee.salary || 0);
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
    
    // Calculate total allowances
    const totalAllowances = 
      values.allowances.housing + 
      values.allowances.transport + 
      values.allowances.meal + 
      values.allowances.medical + 
      values.allowances.other;

    // Calculate overtime amount
    const overtimeAmount = values.overtime.hours * values.overtime.rate;

    // Calculate total bonuses
    const totalBonuses = 
      values.bonuses.performance + 
      values.bonuses.attendance + 
      values.bonuses.other;

    // Calculate leave deductions
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

    // Calculate total deductions
    const totalDeductions = 
      values.deductions.tax + 
      values.deductions.insurance + 
      values.deductions.pension + 
      values.deductions.loan + 
      values.deductions.other + 
      leaveDeductionAmount;

    // Calculate gross pay
    const grossPay = values.basicSalary + totalAllowances + overtimeAmount + totalBonuses;

    // Calculate net pay
    const netPay = grossPay - totalDeductions;

    return {
      totalAllowances,
      overtimeAmount,
      totalBonuses,
      totalDeductions,
      grossPay,
      netPay,
      leaveDeductionAmount,
      totalLeaveDays,
      dailyRate
    };
  };

  const formatCurrency = formatPKR;

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
                          Department: {selectedEmployee.department}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="textSecondary">
                          Position: {selectedEmployee.position}
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
                        label="Housing Allowance"
                        value={formik.values.allowances.housing}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="allowances.transport"
                        label="Transport Allowance"
                        value={formik.values.allowances.transport}
                        onChange={formik.handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="allowances.meal"
                        label="Meal Allowance"
                        value={formik.values.allowances.meal}
                        onChange={formik.handleChange}
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
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        name="allowances.other"
                        label="Other Allowance"
                        value={formik.values.allowances.other}
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
                        name="deductions.loan"
                        label="Loan"
                        value={formik.values.deductions.loan}
                        onChange={formik.handleChange}
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
                        <Typography>Tax: {formatCurrency(formik.values.deductions.tax)}</Typography>
                        <Typography>Insurance: {formatCurrency(formik.values.deductions.insurance)}</Typography>
                        <Typography>Pension: {formatCurrency(formik.values.deductions.pension)}</Typography>
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
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary" gutterBottom>
                      Net Pay: {formatCurrency(totals.netPay)}
                    </Typography>
                  </Box>
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