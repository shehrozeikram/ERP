import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Avatar
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../../services/api';

// Months array for month name lookup
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

const EmployeePayrollDetails = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employeeData, setEmployeeData] = useState(null);
  const [payslipModal, setPayslipModal] = useState({ open: false, data: null });
  const [employeeLoans, setEmployeeLoans] = useState([]);

  useEffect(() => {
    fetchEmployeePayrollDetails();
    fetchEmployeeLoans();
  }, [employeeId]);

  const fetchEmployeePayrollDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/payroll/view/employee/${employeeId}`);
      setEmployeeData(response.data.data);
    } catch (error) {
      console.error('Error fetching employee payroll details:', error);
      setError('Failed to load employee payroll details');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeLoans = async () => {
    try {
      console.log('🔍 Fetching loans for employeeId:', employeeId);
      const response = await api.get(`/loans/employee/${employeeId}`);
      console.log('🔍 Loans response:', response.data);
      setEmployeeLoans(response.data || []);
    } catch (error) {
      console.error('Error fetching employee loans:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  // Helper function to calculate total loan deductions from active loans
  const calculateLoanDeductions = () => {
    return employeeLoans
      .filter(loan => ['Active', 'Disbursed', 'Approved'].includes(loan.status))
      .reduce((total, loan) => total + (loan.monthlyInstallment || 0), 0);
  };

  // Helper function to calculate total deductions including loans
  const calculateTotalDeductions = () => {
    const loanDeductions = calculateLoanDeductions();
    return (currentPayroll.incomeTax || 0) + 
           (currentPayroll.eobi || 370) + 
           (currentPayroll.healthInsurance || 0) + 
           loanDeductions + 
           (currentPayroll.attendanceDeduction || 0) + 
           (currentPayroll.leaveDeduction || 0) + 
           (currentPayroll.otherDeductions || 0);
  };

  // Helper function to calculate net salary
  const calculateNetSalary = () => {
    return (currentPayroll.totalEarnings || 0) - calculateTotalDeductions();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPKR = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatEmployeeId = (employeeId) => {
    if (!employeeId) return 'N/A';
    return employeeId.toString().padStart(5, '0');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved':
        return 'success';
      case 'Pending':
        return 'warning';
      case 'Rejected':
        return 'error';
      case 'Paid':
        return 'success';
      default:
        return 'default';
    }
  };

  const generatePayslip = async (payroll) => {
    try {
      // Create payslip data from payroll - simplified version
      const payslipData = {
        employeeId: employee.employeeId,
        month: payroll.month,
        year: payroll.year,
        earnings: {
          basicSalary: payroll.basicSalary || 0,
          houseRent: payroll.houseRentAllowance || 0,
          medicalAllowance: payroll.medicalAllowance || 0,
          conveyanceAllowance: 0,
          specialAllowance: 0,
          otherAllowances: 0,
          overtime: payroll.overtimeAmount || 0,
          bonus: payroll.performanceBonus || 0,
          incentives: 0,
          arrears: 0,
          otherEarnings: 0
        },
        deductions: {
          providentFund: payroll.providentFund || 0,
          eobi: 370, // Fixed EOBI amount
          incomeTax: payroll.incomeTax || 0,
          loanDeduction: 0,
          advanceDeduction: 0,
          lateDeduction: 0,
          absentDeduction: 0,
          otherDeductions: 0
        },
        attendance: {
          totalDays: payroll.totalWorkingDays || 26,
          presentDays: payroll.presentDays || 26,
          absentDays: payroll.absentDays || 0,
          lateDays: 0,
          overtimeHours: 0
        },
        notes: `Generated from payroll for ${months.find(m => m.value === payroll.month.toString().padStart(2, '0'))?.label} ${payroll.year}`
      };

      console.log('Creating payslip with data:', payslipData);

      // Create payslip using the payslip creation endpoint
      const response = await api.post('/payslips', payslipData);
      
      if (response.data.success) {
        console.log('Payslip created successfully:', response.data.data);
        
        // Now generate the PDF for the created payslip
        const pdfResponse = await api.get(`/payslips/${response.data.data._id}/download`, {
          responseType: 'blob'
        });
        
        // Create blob and download
        const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `payslip-${employee.firstName}-${employee.lastName}-${payroll.month}-${payroll.year}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        alert('Payslip generated and downloaded successfully!');
      }
    } catch (error) {
      console.error('Error generating payslip:', error);
      console.error('Error details:', error.response?.data);
      alert(`Failed to generate payslip: ${error.response?.data?.message || error.message}`);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/hr/payroll')}
        >
          Back to Payroll
        </Button>
      </Box>
    );
  }

  if (!employeeData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Employee payroll data not found
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/hr/payroll')}
        >
          Back to Payroll
        </Button>
      </Box>
    );
  }

  const { employee, currentPayroll, existingPayrolls } = employeeData;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/hr/payroll')}
          sx={{ minWidth: 'auto' }}
        >
          Back
        </Button>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          Employee Payroll Details
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<ViewIcon />}
          onClick={() => {
            // Show payslip in popup
            const payslipData = {
              employee: {
                firstName: employee?.firstName || 'Atif',
                lastName: employee?.lastName || 'Mahmood',
                employeeId: employee?.employeeId || '6031',
                department: employeeData?.department || 'IT Development',
                designation: employeeData?.position || 'Developer'
              },
              period: {
                month: currentPayroll.month || 8,
                year: currentPayroll.year || 2025,
                monthName: months.find(m => m.value === String(currentPayroll.month || 8).padStart(2, '0'))?.label || 'August'
              },
              payslipNumber: `PS${currentPayroll.year || 2025}${String(currentPayroll.month || 8).padStart(2, '0')}${employee?.employeeId || '6031'}`,
              issueDate: new Date().toLocaleDateString(),
              earnings: {
                basicSalary: currentPayroll.basicSalary || 0,
                houseRent: currentPayroll.houseRentAllowance || 0,
                medicalAllowance: currentPayroll.medicalAllowance || 0,
                conveyanceAllowance: currentPayroll.allowances?.conveyance?.amount || 0,
                foodAllowance: currentPayroll.allowances?.food?.amount || 0,
                vehicleFuelAllowance: currentPayroll.allowances?.vehicleFuel?.amount || 0,
                specialAllowance: currentPayroll.allowances?.special?.amount || 0,
                otherAllowances: currentPayroll.allowances?.other?.amount || 0,
                overtime: currentPayroll.overtimeAmount || 0,
                bonus: currentPayroll.performanceBonus || 0,
                otherBonus: currentPayroll.otherBonus || 0,
                arrears: currentPayroll.arrears || 0
              },
              deductions: {
                eobi: currentPayroll.eobi || 370,
                incomeTax: currentPayroll.incomeTax || 0,
                providentFund: currentPayroll.providentFund || 0,
                healthInsurance: currentPayroll.healthInsurance || 0,
                loanDeductions: currentPayroll.loanDeductions || 0,
                attendanceDeduction: currentPayroll.attendanceDeduction || 0,
                leaveDeduction: currentPayroll.leaveDeduction || 0,
                otherDeductions: currentPayroll.otherDeductions || 0
              },
              attendance: {
                totalDays: currentPayroll.totalWorkingDays || 26,
                presentDays: currentPayroll.presentDays || 26,
                absentDays: currentPayroll.absentDays || 0,
                leaveDays: currentPayroll.leaveDays || 0
              },
              totals: {
                grossSalary: currentPayroll.totalEarnings || 0,
                totalDeductions: calculateTotalDeductions(),
                netSalary: calculateNetSalary()
              }
            };

            setPayslipModal({ open: true, data: payslipData });
          }}
          sx={{ ml: 'auto' }}
        >
          Review
        </Button>
      </Box>

      {/* Employee Information Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Employee Information
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
              {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h5" gutterBottom>
                {employee.firstName} {employee.lastName}
              </Typography>
              <Typography variant="body1" color="textSecondary">
                ID: {formatEmployeeId(employee.employeeId)}
              </Typography>
            </Box>
          </Box>
          <Typography variant="body2" color="textSecondary">
            <strong>Department:</strong> {employee.placementDepartment?.name || employee.department?.name || employee.department}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            <strong>Position:</strong> {employee.position?.title || employee.position}
          </Typography>
        </CardContent>
      </Card>

      {/* Database Payroll Data - Earnings */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Earnings (Database Values)
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Basic Salary</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.basicSalary || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>House Rent Allowance</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.houseRentAllowance || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Medical Allowance</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.medicalAllowance || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Conveyance Allowance</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.allowances?.conveyance?.amount || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Food Allowance</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.allowances?.food?.amount || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Vehicle & Fuel Allowance</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.allowances?.vehicleFuel?.amount || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Special Allowance</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.allowances?.special?.amount || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Allowance</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.allowances?.other?.amount || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Medical Allowance (from allowances)</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.allowances?.medical?.amount || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>House Rent Allowance (from allowances)</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.allowances?.houseRent?.amount || 0)}</TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell>Gross Salary</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.grossSalary || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Overtime Amount</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.overtimeAmount || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Performance Bonus</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.performanceBonus || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Bonus</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.otherBonus || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Arrears</TableCell>
                      <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 600 }}>
                        {formatPKR(currentPayroll.arrears || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Total Earnings</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.totalEarnings || 0)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Database Payroll Data - Deductions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Deductions (Database Values)
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Income Tax (Main Salary)</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.taxCalculation?.mainTax || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Income Tax (Arrears)</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.taxCalculation?.arrearsTax || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Total Income Tax</strong></TableCell>
                      <TableCell align="right"><strong>{formatPKR(currentPayroll.taxCalculation?.totalTax || currentPayroll.incomeTax || 0)}</strong></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>EOBI</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.eobi || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Health Insurance</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.healthInsurance || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Attendance Deduction</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.attendanceDeduction || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Leave Deduction Amount</TableCell>
                      <TableCell align="right">{formatPKR((currentPayroll.dailyRate || 0) * (currentPayroll.leaveDays || 0))}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Provident Fund</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.providentFund || 0)}</TableCell>
                    </TableRow>
                    {/* Individual Loan Deductions */}
                    {console.log('🔍 Employee loans for deductions:', employeeLoans)}
                    {employeeLoans
                      .filter(loan => ['Active', 'Disbursed', 'Approved'].includes(loan.status))
                      .map((loan, index) => (
                        <TableRow key={loan._id}>
                          <TableCell>{loan.loanType} Loan Deduction ({loan.status})</TableCell>
                          <TableCell align="right">{formatPKR(loan.monthlyInstallment || 0)}</TableCell>
                        </TableRow>
                      ))}
                    <TableRow>
                      <TableCell><strong>Total Loan Deductions</strong></TableCell>
                      <TableCell align="right"><strong>{formatPKR(calculateLoanDeductions())}</strong></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Deductions</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.otherDeductions || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Total Deductions</strong></TableCell>
                      <TableCell align="right"><strong>{formatPKR(calculateTotalDeductions())}</strong></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Database Payroll Data - Attendance & Leave Details */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Attendance Details (Database Values)
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Total Working Days</TableCell>
                      <TableCell align="right">{currentPayroll.totalWorkingDays || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Present Days</TableCell>
                      <TableCell align="right">{currentPayroll.presentDays || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Absent Days</TableCell>
                      <TableCell align="right">{currentPayroll.absentDays || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Leave Days</TableCell>
                      <TableCell align="right">{currentPayroll.leaveDays || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Daily Rate</TableCell>
                      <TableCell align="right">{formatPKR(currentPayroll.dailyRate || 0)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Leave Deductions (Database Values)
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Unpaid Leave</TableCell>
                      <TableCell align="right">{currentPayroll.leaveDeductions?.unpaidLeave || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Sick Leave</TableCell>
                      <TableCell align="right">{currentPayroll.leaveDeductions?.sickLeave || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Casual Leave</TableCell>
                      <TableCell align="right">{currentPayroll.leaveDeductions?.casualLeave || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Annual Leave</TableCell>
                      <TableCell align="right">{currentPayroll.leaveDeductions?.annualLeave || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Leave</TableCell>
                      <TableCell align="right">{currentPayroll.leaveDeductions?.otherLeave || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Total Leave Days</TableCell>
                      <TableCell align="right">{currentPayroll.leaveDeductions?.totalLeaveDays || 0}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Database Payroll Data - Summary */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Summary (Database Values)
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'primary.light', color: 'white' }}>
                <Typography variant="h4">{formatPKR(currentPayroll.totalEarnings || 0)}</Typography>
                <Typography variant="body2">Total Earnings</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'error.light', color: 'white' }}>
                <Typography variant="h4">{formatPKR(calculateTotalDeductions())}</Typography>
                <Typography variant="body2">Total Deductions</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'success.light', color: 'white' }}>
                <Typography variant="h4">{formatPKR(calculateNetSalary())}</Typography>
                <Typography variant="body2">Net Salary</Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Existing Payroll History */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceIcon color="primary" />
            Payroll History (Last 12 Months)
          </Typography>
          
          {existingPayrolls.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Pay Period</TableCell>
                    <TableCell>Basic Salary</TableCell>
                    <TableCell>Gross Salary</TableCell>
                    <TableCell>Net Salary</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {existingPayrolls.map((payroll) => (
                    <TableRow key={payroll._id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2">
                            {months.find(month => month.value === payroll.month.toString().padStart(2, '0'))?.label || `Month ${payroll.month}`} {payroll.year}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Payroll Period
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{formatCurrency(payroll.basicSalary)}</TableCell>
                      <TableCell>{formatCurrency(payroll.grossSalary)}</TableCell>
                      <TableCell>{formatCurrency(payroll.netSalary)}</TableCell>
                      <TableCell>
                        <Chip
                          label={payroll.status}
                          color={getStatusColor(payroll.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/hr/payroll/view/${payroll._id}`)}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Payroll">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/hr/payroll/edit/${payroll._id}`)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Generate Payslip">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => generatePayslip(payroll)}
                            >
                              <DownloadIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="textSecondary" gutterBottom>
                No previous payroll records found
              </Typography>
              <Typography variant="body2" color="textSecondary">
                This employee doesn't have any previous payroll records yet.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Payslip Review Modal */}
      <Dialog 
        open={payslipModal.open} 
        onClose={() => setPayslipModal({ open: false, data: null })}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { 
            minHeight: '80vh',
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{ 
          textAlign: 'center', 
          borderBottom: '2px solid #f0f0f0',
          pb: 2,
          mb: 2
        }}>
          <Typography variant="h4" sx={{ fontWeight: 600, color: '#2c3e50' }}>
            SARDAR GROUP OF COMPANIES
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50', mt: 1 }}>
            PAY SLIP
          </Typography>
          <Typography variant="subtitle1" sx={{ mt: 1, color: '#666' }}>
            For the month of {payslipModal.data?.period?.monthName} {payslipModal.data?.period?.year}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Typography variant="body2">
              <strong>Payslip No:</strong> {payslipModal.data?.payslipNumber}
            </Typography>
            <Typography variant="body2">
              <strong>Issue Date:</strong> {payslipModal.data?.issueDate}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {/* Employee Information */}
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#2c3e50' }}>
            Employee Information
          </Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell><strong>Name:</strong></TableCell>
                  <TableCell>{payslipModal.data?.employee?.firstName} {payslipModal.data?.employee?.lastName}</TableCell>
                  <TableCell><strong>Department:</strong></TableCell>
                  <TableCell>{payslipModal.data?.employee?.department}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Employee ID:</strong></TableCell>
                  <TableCell>{payslipModal.data?.employee?.employeeId}</TableCell>
                  <TableCell><strong>Designation:</strong></TableCell>
                  <TableCell>{payslipModal.data?.employee?.designation}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* Earnings & Deductions */}
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#2c3e50' }}>
            Earnings & Deductions
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {/* Earnings Column */}
            <Grid item xs={12} md={6}>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell><strong>EARNINGS</strong></TableCell>
                      <TableCell align="right"><strong>AMOUNT</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Basic Salary</TableCell>
                      <TableCell align="right">Rs {payslipModal.data?.earnings?.basicSalary?.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>House Rent Allowance</TableCell>
                      <TableCell align="right">Rs {payslipModal.data?.earnings?.houseRent?.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Medical Allowance</TableCell>
                      <TableCell align="right">Rs {payslipModal.data?.earnings?.medicalAllowance?.toLocaleString()}</TableCell>
                    </TableRow>
                    {(payslipModal.data?.earnings?.conveyanceAllowance || 0) > 0 && (
                      <TableRow>
                        <TableCell>Conveyance Allowance</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.earnings?.conveyanceAllowance?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.earnings?.foodAllowance || 0) > 0 && (
                      <TableRow>
                        <TableCell>Food Allowance</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.earnings?.foodAllowance?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.earnings?.vehicleFuelAllowance || 0) > 0 && (
                      <TableRow>
                        <TableCell>Vehicle & Fuel Allowance</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.earnings?.vehicleFuelAllowance?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.earnings?.specialAllowance || 0) > 0 && (
                      <TableRow>
                        <TableCell>Special Allowance</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.earnings?.specialAllowance?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.earnings?.otherAllowances || 0) > 0 && (
                      <TableRow>
                        <TableCell>Other Allowances</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.earnings?.otherAllowances?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(currentPayroll.allowances?.medical?.amount || 0) > 0 && (
                      <TableRow>
                        <TableCell>Medical Allowance (from allowances)</TableCell>
                        <TableCell align="right">Rs {(currentPayroll.allowances?.medical?.amount || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(currentPayroll.allowances?.houseRent?.amount || 0) > 0 && (
                      <TableRow>
                        <TableCell>House Rent Allowance (from allowances)</TableCell>
                        <TableCell align="right">Rs {(currentPayroll.allowances?.houseRent?.amount || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.earnings?.overtime || 0) > 0 && (
                      <TableRow>
                        <TableCell>Overtime</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.earnings?.overtime?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.earnings?.bonus || 0) > 0 && (
                      <TableRow>
                        <TableCell>Performance Bonus</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.earnings?.bonus?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.earnings?.otherBonus || 0) > 0 && (
                      <TableRow>
                        <TableCell>Other Bonus</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.earnings?.otherBonus?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.earnings?.arrears || 0) > 0 && (
                      <TableRow>
                        <TableCell>Arrears</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.earnings?.arrears?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            {/* Deductions Column */}
            <Grid item xs={12} md={6}>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell><strong>DEDUCTIONS</strong></TableCell>
                      <TableCell align="right"><strong>AMOUNT</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(payslipModal.data?.deductions?.eobi || 0) > 0 && (
                      <TableRow>
                        <TableCell>EOBI</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.deductions?.eobi?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.deductions?.incomeTax || 0) > 0 && (
                      <TableRow>
                        <TableCell>Income Tax</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.deductions?.incomeTax?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.deductions?.providentFund || 0) > 0 && (
                      <TableRow>
                        <TableCell>Provident Fund</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.deductions?.providentFund?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.deductions?.healthInsurance || 0) > 0 && (
                      <TableRow>
                        <TableCell>Health Insurance</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.deductions?.healthInsurance?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {/* Individual Loan Deductions in Payslip */}
                    {employeeLoans
                      .filter(loan => ['Active', 'Disbursed', 'Approved'].includes(loan.status))
                      .map((loan) => (
                        <TableRow key={loan._id}>
                          <TableCell>{loan.loanType} Loan Deduction ({loan.status})</TableCell>
                          <TableCell align="right">Rs {(loan.monthlyInstallment || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    {(payslipModal.data?.deductions?.loanDeductions || 0) > 0 && (
                      <TableRow>
                        <TableCell><strong>Total Loan Deductions</strong></TableCell>
                        <TableCell align="right"><strong>Rs {payslipModal.data?.deductions?.loanDeductions?.toLocaleString()}</strong></TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.deductions?.attendanceDeduction || 0) > 0 && (
                      <TableRow>
                        <TableCell>Attendance Deduction</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.deductions?.attendanceDeduction?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.deductions?.leaveDeduction || 0) > 0 && (
                      <TableRow>
                        <TableCell>Leave Deduction</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.deductions?.leaveDeduction?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {(payslipModal.data?.deductions?.otherDeductions || 0) > 0 && (
                      <TableRow>
                        <TableCell>Other Deductions</TableCell>
                        <TableCell align="right">Rs {payslipModal.data?.deductions?.otherDeductions?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>

          {/* Summary */}
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#2c3e50' }}>
            Summary of Earnings and Deductions
          </Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell><strong>Total Earnings</strong></TableCell>
                  <TableCell align="right"><strong>Rs {payslipModal.data?.totals?.grossSalary?.toLocaleString()}</strong></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Total Deductions</strong></TableCell>
                  <TableCell align="right"><strong>Rs {payslipModal.data?.totals?.totalDeductions?.toLocaleString()}</strong></TableCell>
                </TableRow>
                <TableRow sx={{ bgcolor: '#e8f5e8' }}>
                  <TableCell><strong>Net Salary</strong></TableCell>
                  <TableCell align="right"><strong>Rs {payslipModal.data?.totals?.netSalary?.toLocaleString()}</strong></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* Attendance Summary */}
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#2c3e50' }}>
            Attendance Summary
          </Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell><strong>Total Working Days:</strong></TableCell>
                  <TableCell>{payslipModal.data?.attendance?.totalDays}</TableCell>
                  <TableCell><strong>Present Days:</strong></TableCell>
                  <TableCell>{payslipModal.data?.attendance?.presentDays}</TableCell>
                  <TableCell><strong>Absent Days:</strong></TableCell>
                  <TableCell>{payslipModal.data?.attendance?.absentDays}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* Notes */}
          <Typography variant="body2" sx={{ mb: 3, fontStyle: 'italic', color: '#666' }}>
            Monthly payroll generated for {payslipModal.data?.period?.month}/{payslipModal.data?.period?.year}
          </Typography>
        </DialogContent>

        <DialogActions sx={{ borderTop: '2px solid #f0f0f0', p: 2 }}>
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#666' }}>
              Generated by: Sardar Umer • {new Date().toLocaleDateString()}
            </Typography>
            <Box>
              <Button 
                onClick={() => setPayslipModal({ open: false, data: null })}
                variant="outlined"
                sx={{ mr: 1 }}
              >
                Close
              </Button>
              <Button 
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  // Generate PDF download functionality here
                  console.log('PDF download would be triggered here');
                }}
              >
                Download PDF
              </Button>
            </Box>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmployeePayrollDetails;
