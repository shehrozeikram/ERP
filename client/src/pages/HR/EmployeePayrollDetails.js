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
  IconButton,
  Tooltip
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

  useEffect(() => {
    fetchEmployeePayrollDetails();
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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
      </Box>

      {/* Employee Information Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <PersonIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            <Box>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                {employee.firstName} {employee.lastName}
              </Typography>
              <Typography variant="body1" color="textSecondary">
                Employee ID: {employee.employeeId}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {employee.department?.name || employee.department} • {employee.position?.title || employee.position}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Current Payroll Breakdown */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon color="primary" />
            Current Payroll Breakdown
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Basic Salary Structure
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Basic Salary (66.66%)</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatCurrency(currentPayroll.basicSalary)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Medical Allowance (10%)</Typography>
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    {formatCurrency(currentPayroll.medicalAllowance)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">House Rent Allowance (23.34%)</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatCurrency(currentPayroll.houseRentAllowance)}
                  </Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Gross Salary</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatCurrency(currentPayroll.grossSalary)}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Additional Allowances & Tax
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Additional Allowances</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatCurrency(currentPayroll.additionalAllowances)}
                  </Typography>
                </Box>
                {/* Display individual arrears types */}
                {currentPayroll.arrearsDetails && currentPayroll.arrearsDetails.length > 0 ? (
                  currentPayroll.arrearsDetails.map((arrear, index) => (
                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {arrear.type}
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="warning.main">
                        {formatCurrency(arrear.amount)}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Arrears</Typography>
                    <Typography variant="body2" fontWeight={600} color="warning.main">
                      {formatCurrency(currentPayroll.arrears || 0)}
                    </Typography>
                  </Box>
                )}
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Total Earnings</Typography>
                  <Typography variant="body2" fontWeight={600} color="primary.main">
                    {formatCurrency(currentPayroll.totalEarnings)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Taxable Income (90%)</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatCurrency(currentPayroll.taxableIncome)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Monthly Tax</Typography>
                  <Typography variant="body2" fontWeight={600} color="error.main">
                    -{formatCurrency(currentPayroll.monthlyTax)}
                  </Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Net Salary</Typography>
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    {formatCurrency(currentPayroll.netSalary)}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Existing Payroll History */}
      <Card>
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
    </Box>
  );
};

export default EmployeePayrollDetails;
