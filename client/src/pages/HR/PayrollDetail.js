import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Avatar,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  CheckCircle as ApproveIcon,
  Payment as PaymentIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { formatPKR } from '../../utils/currency';
import api from '../../services/authService';
import {
  calculateTotalEarnings,
  calculateTotalDeductions,
  calculateNetSalary,
  calculateTaxBreakdown,
  getPayrollSummary,
  formatCurrency
} from '../../utils/payrollCalculations';

const PayrollDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payroll, setPayroll] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPayrollDetail();
  }, [id]);



  const fetchPayrollDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/payroll/${id}`);
      const payrollData = response.data.data;
      setPayroll(payrollData);
      
      // Debug: Log payroll allowances data
      console.log('🔍 Payroll Data Received:', {
        id: payrollData._id,
        month: payrollData.month,
        year: payrollData.year,
        allowances: payrollData.allowances,
        foodAllowance: payrollData.allowances?.food,
        totalEarnings: payrollData.totalEarnings,
        basicSalary: payrollData.basicSalary,
        houseRentAllowance: payrollData.houseRentAllowance,
        medicalAllowance: payrollData.medicalAllowance,
        overtimeAmount: payrollData.overtimeAmount,
        performanceBonus: payrollData.performanceBonus,
        otherBonus: payrollData.otherBonus
      });
      
      // Also fetch employee details to get current allowances
      if (payrollData.employee) {
        try {
          const employeeResponse = await api.get(`/hr/employees/${payrollData.employee._id || payrollData.employee}`);
          setEmployee(employeeResponse.data.data);
          
          // Debug: Log employee allowances data
          console.log('🔍 Employee Data Received:', {
            employeeId: employeeResponse.data.data.employeeId,
            allowances: employeeResponse.data.data.allowances,
            foodAllowance: employeeResponse.data.data.allowances?.food
          });
        } catch (employeeError) {
          console.error('Error fetching employee details:', employeeError);
          // Don't fail if employee fetch fails
        }
      }
    } catch (error) {
      console.error('Error fetching payroll details:', error);
      setError('Failed to load payroll details');
    } finally {
      setLoading(false);
    }
  };

  // 🧮 OPTIMIZED: Use reusable calculation utilities
  // All calculations are now consistent and optimized
  
  // Get comprehensive payroll summary with all calculations
  const getPayrollSummaryData = () => {
    if (!payroll) return null;
    return getPayrollSummary(payroll);
  };

  // Calculate total earnings using optimized utility
  const calculateTotalEarningsOptimized = () => {
    console.log('🔍 calculateTotalEarningsOptimized called with payroll:', {
      id: payroll?._id,
      basicSalary: payroll?.basicSalary,
      houseRentAllowance: payroll?.houseRentAllowance,
      medicalAllowance: payroll?.medicalAllowance,
      allowances: payroll?.allowances,
      overtimeAmount: payroll?.overtimeAmount,
      performanceBonus: payroll?.performanceBonus,
      otherBonus: payroll?.otherBonus,
      totalEarnings: payroll?.totalEarnings
    });
    
    const result = calculateTotalEarnings(payroll);
    console.log('🔍 calculateTotalEarnings result:', result);
    
    return result;
  };

  // Calculate total deductions using optimized utility
  const calculateTotalDeductionsOptimized = () => {
    const summary = getPayrollSummaryData();
    return calculateTotalDeductions(payroll, summary?.taxBreakdown?.monthlyTax);
  };

  // Calculate net salary using optimized utility
  const calculateNetSalaryOptimized = () => {
    const summary = getPayrollSummaryData();
    return calculateNetSalary(summary?.totalEarnings || 0, summary?.totalDeductions || 0);
  };

  // Calculate tax breakdown using optimized utility
  const calculateTaxBreakdownOptimized = () => {
    const totalEarnings = calculateTotalEarningsOptimized();
    return calculateTaxBreakdown(totalEarnings);
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      await api.patch(`/payroll/${id}/approve`);
      await fetchPayrollDetail(); // Refresh data
    } catch (error) {
      console.error('Error approving payroll:', error);
      setError('Failed to approve payroll');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      setActionLoading(true);
      await api.patch(`/payroll/${id}/mark-paid`, {
        paymentMethod: 'Bank Transfer'
      });
      await fetchPayrollDetail(); // Refresh data
    } catch (error) {
      console.error('Error marking payroll as paid:', error);
      setError('Failed to mark payroll as paid');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAsUnpaid = async () => {
    try {
      setActionLoading(true);
      await api.patch(`/payroll/${id}/mark-unpaid`);
      await fetchPayrollDetail(); // Refresh data
    } catch (error) {
      console.error('Error marking payroll as unpaid:', error);
      setError('Failed to mark payroll as unpaid');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      setActionLoading(true);
      const response = await api.get(`/payroll/${id}/download`, {
        responseType: 'blob'
      });
      
      // Create blob URL and trigger download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payroll-${payroll.employee?.employeeId}-${payroll.month}-${payroll.year}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setError(null); // Clear any previous errors
    } catch (error) {
      console.error('Error downloading payroll PDF:', error);
      setError('Failed to download payroll PDF');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft': return 'default';
      case 'Approved': return 'warning';
      case 'Paid': return 'success';
      case 'Cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'Draft': return 'Draft';
      case 'Approved': return 'Approved';
      case 'Paid': return 'Paid';
      case 'Cancelled': return 'Cancelled';
      default: return status;
    }
  };

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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button onClick={() => navigate('/hr/payroll')} startIcon={<ArrowBackIcon />}>
          Back to Payrolls
        </Button>
      </Box>
    );
  }

  if (!payroll) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Payroll not found
        </Alert>
        <Button onClick={() => navigate('/hr/payroll')} startIcon={<ArrowBackIcon />}>
          Back to Payrolls
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }} className="print-container">
      {/* Print styles */}
      <style>
        {`
          @media print {
            .no-print {
              display: none !important;
            }
            .print-break {
              page-break-before: always;
            }
            body {
              margin: 0;
              padding: 20px;
            }
            .print-container {
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          }
        `}
      </style>
      {/* Print Header - Only visible when printing */}
      <Box sx={{ display: 'none', '@media print': { display: 'block' }, mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ textAlign: 'center', mb: 1 }}>
          PAYROLL STATEMENT
        </Typography>
        <Typography variant="h6" sx={{ textAlign: 'center', color: 'text.secondary' }}>
          Period: {payroll.month}/{payroll.year}
        </Typography>
        <Divider sx={{ mt: 2 }} />
      </Box>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }} className="no-print">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/hr/payroll')}
          >
            Back
          </Button>
          <Typography variant="h4" component="h1">
            Payroll Details
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }} className="no-print">
          <Chip
            label={getStatusLabel(payroll.status)}
            color={getStatusColor(payroll.status)}
            size="large"
          />
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            disabled={actionLoading}
          >
            Print
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadPDF}
            disabled={actionLoading}
          >
            Download PDF
          </Button>
          {payroll.status === 'Draft' && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/hr/payroll/${id}/edit`)}
            >
              Edit
            </Button>
          )}
          {payroll.status === 'Draft' && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<ApproveIcon />}
              onClick={handleApprove}
              disabled={actionLoading}
            >
              Approve
            </Button>
          )}
          {payroll.status === 'Approved' && (
            <Button
              variant="contained"
              color="success"
              startIcon={<PaymentIcon />}
              onClick={handleMarkAsPaid}
              disabled={actionLoading}
            >
              Mark as Paid
            </Button>
          )}
          {payroll.status === 'Paid' && (
            <Button
              variant="contained"
              color="error"
              startIcon={<CancelIcon />}
              onClick={handleMarkAsUnpaid}
              disabled={actionLoading}
            >
              Mark as Unpaid
            </Button>
          )}
        </Box>
      </Box>

      {/* Employee Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Employee Information
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
              {payroll.employee?.firstName?.charAt(0)}{payroll.employee?.lastName?.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h5" gutterBottom>
                {payroll.employee?.firstName} {payroll.employee?.lastName}
              </Typography>
              <Typography variant="body1" color="textSecondary">
                ID: {formatEmployeeId(payroll.employee?.employeeId)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {payroll.employee?._id}
              </Typography>
            </Box>
          </Box>
          <Typography variant="body2" color="textSecondary">
            <strong>Pay Period:</strong> {payroll.month}/{payroll.year}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            <strong>Created:</strong> {format(new Date(payroll.createdAt), 'MMM dd, yyyy')}
          </Typography>
          {payroll.approvedAt && (
            <Typography variant="body2" color="textSecondary">
              <strong>Approved:</strong> {format(new Date(payroll.approvedAt), 'MMM dd, yyyy')}
            </Typography>
          )}
          {payroll.paymentDate && (
            <Typography variant="body2" color="textSecondary">
              <strong>Paid:</strong> {format(new Date(payroll.paymentDate), 'MMM dd, yyyy')}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Salary Breakdown */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Earnings
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Gross Salary (Base)</TableCell>
                      <TableCell align="right">{formatPKR(
                        employee ? (employee.salary?.gross || 0) : (payroll.grossSalary || 0)
                      )}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Typography variant="caption" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                          💡 Base Gross Salary (66.66% Basic + 10% Medical + 23.34% House Rent)
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Basic Salary (66.66%)</TableCell>
                      <TableCell align="right">{formatPKR(
                        employee ? Math.round((employee.salary?.gross || 0) * 0.6666) : (payroll.basicSalary || 0)
                      )}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>House Rent Allowance (23.34%)</TableCell>
                      <TableCell align="right">{formatPKR(
                        employee ? Math.round((employee.salary?.gross || 0) * 0.2334) : (payroll.houseRentAllowance || 0)
                      )}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Medical Allowance (10%)</TableCell>
                      <TableCell align="right">{formatPKR(
                        employee ? Math.round((employee.salary?.gross || 0) * 0.1) : (payroll.medicalAllowance || 0)
                      )}</TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: 'info.50', borderTop: '2px solid', borderColor: 'info.300' }}>
                      <TableCell colSpan={2}>
                        <Typography variant="subtitle2" color="info.main" sx={{ fontWeight: 600 }}>
                          📋 Additional Allowances (Added to Gross Salary)
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Conveyance Allowance</TableCell>
                      <TableCell align="right">{formatPKR(
                        payroll?.allowances?.conveyance?.isActive ? (payroll.allowances.conveyance.amount || 0) : 0
                      )}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Food Allowance</TableCell>
                      <TableCell align="right">{formatPKR(
                        payroll?.allowances?.food?.isActive ? (payroll.allowances.food.amount || 0) : 0
                      )}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Vehicle & Fuel Allowance</TableCell>
                      <TableCell align="right">{formatPKR(
                        payroll?.allowances?.vehicleFuel?.isActive ? (payroll.allowances.vehicleFuel.amount || 0) : 0
                      )}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Special Allowance</TableCell>
                      <TableCell align="right">{formatPKR(
                        payroll?.allowances?.special?.isActive ? (payroll.allowances.special.amount || 0) : 0
                      )}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Allowance</TableCell>
                      <TableCell align="right">{formatPKR(
                        payroll?.allowances?.other?.isActive ? (payroll.allowances.other.amount || 0) : 0
                      )}</TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: 'success.50', borderTop: '2px solid', borderColor: 'success.300' }}>
                      <TableCell colSpan={2}>
                        <Typography variant="subtitle2" color="success.main" sx={{ fontWeight: 600 }}>
                          💰 Total Additional Allowances: {formatPKR(
                            (payroll?.allowances?.conveyance?.isActive ? (payroll.allowances.conveyance.amount || 0) : 0) +
                            (payroll?.allowances?.food?.isActive ? (payroll.allowances.food.amount || 0) : 0) +
                            (payroll?.allowances?.vehicleFuel?.isActive ? (payroll.allowances.vehicleFuel.amount || 0) : 0) +
                            (payroll?.allowances?.special?.isActive ? (payroll.allowances.special.amount || 0) : 0) +
                            (payroll?.allowances?.other?.isActive ? (payroll.allowances.other.amount || 0) : 0)
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Overtime Amount</TableCell>
                      <TableCell align="right">{formatPKR(payroll.overtimeAmount)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Performance Bonus</TableCell>
                      <TableCell align="right">{formatPKR(payroll.performanceBonus)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Bonus</TableCell>
                      <TableCell align="right">{formatPKR(payroll.otherBonus)}</TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: 'primary.light', color: 'white' }}>
                      <TableCell><strong>Total Earnings</strong></TableCell>
                                              <TableCell align="right"><strong>{formatPKR(calculateTotalEarningsOptimized())}</strong></TableCell>
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
                Deductions
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>
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
                      </TableCell>
                      <TableCell align="right">
                        {formatPKR(payroll.providentFund)}
                        <Typography variant="caption" display="block" color="warning.main">
                          Not included in total deductions
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Income Tax</TableCell>
                      <TableCell align="right">
                        <Typography variant="body1" sx={{ fontWeight: 600, color: 'error.main' }}>
                          {formatPKR(calculateTaxBreakdownOptimized()?.monthlyTax || payroll.incomeTax || 0)}
                        </Typography>
                        <Typography variant="caption" display="block" color="info.main">
                          💡 Tax calculated on (Gross Salary - 10% Medical Allowance) per FBR 2025-2026
                        </Typography>
                        {calculateTaxBreakdownOptimized() && (
                          <Typography variant="caption" display="block" color="success.main">
                            ✅ Calculated: {formatPKR(calculateTaxBreakdownOptimized().monthlyTax)} | 
                            Stored: {formatPKR(payroll.incomeTax || 0)}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>EOBI</TableCell>
                      <TableCell align="right">{formatPKR(payroll.eobi || 370)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Health Insurance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.healthInsurance)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          Absents and Leaves Without Pay
                          <Typography variant="caption" color="info.main">
                            (Daily Rate: {formatPKR(payroll.dailyRate || 0)})
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body1" sx={{ fontWeight: 600, color: 'error.main' }}>
                          {formatPKR(payroll.attendanceDeduction || 0)}
                        </Typography>
                        <Typography variant="caption" display="block" color="info.main">
                          💡 {payroll.absentDays || 0} absent days × Daily Rate (Gross Salary ÷ 26)
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Deductions</TableCell>
                      <TableCell align="right">{formatPKR(payroll.otherDeductions)}</TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: 'error.light', color: 'white' }}>
                      <TableCell><strong>Total Deductions</strong></TableCell>
                      <TableCell align="right"><strong>{formatPKR(calculateTotalDeductionsOptimized())}</strong></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Typography variant="caption" color="warning.main" sx={{ fontStyle: 'italic' }}>
                          💡 Note: Provident Fund is excluded from total deductions (Coming Soon)
                        </Typography>
                        {payroll.totalDeductions !== calculateTotalDeductionsOptimized() && (
                          <Typography variant="caption" color="info.main" display="block" sx={{ mt: 1 }}>
                            📊 Stored Total Deductions: {formatPKR(payroll.totalDeductions)} | 
                            Recalculated (without PF): {formatPKR(calculateTotalDeductionsOptimized())}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Summary */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Summary
          </Typography>
          <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="caption" color="textSecondary">
              💡 <strong>Salary Structure:</strong> Gross Salary (Base) = Basic Salary (66.66%) + Medical (10%) + House Rent (23.34%)
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.5 }}>
              💰 <strong>Total Earnings:</strong> Gross Salary (Base) + Additional Allowances (Food, Vehicle, Conveyance, etc.)
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.5 }}>
              🧮 <strong>Tax Calculation:</strong> Medical Allowance (10% of Total Earnings) is tax-exempt per FBR 2025-2026
            </Typography>
            {calculateTaxBreakdownOptimized() && (
              <Typography variant="caption" color="primary.main" display="block" sx={{ mt: 0.5, fontWeight: 600 }}>
                🧮 <strong>Calculated Tax:</strong> PKR {calculateTaxBreakdownOptimized().monthlyTax.toLocaleString()} monthly | 
                PKR {calculateTaxBreakdownOptimized().annualTax.toLocaleString()} annually
              </Typography>
            )}
            {calculateTaxBreakdownOptimized() && (
              <Typography variant="caption" color="error.main" display="block" sx={{ mt: 0.5, fontWeight: 600 }}>
                📊 <strong>Tax Applied:</strong> Using calculated tax amount in deductions and net salary
              </Typography>
            )}
          </Box>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'primary.light', color: 'white' }}>
                <Typography variant="h4">{formatPKR(calculateTotalEarningsOptimized())}</Typography>
                <Typography variant="body2">Total Earnings</Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 1 }}>
                  Gross Salary + Allowances
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'error.light', color: 'white' }}>
                <Typography variant="h4">{formatPKR(calculateTotalDeductionsOptimized())}</Typography>
                <Typography variant="body2">Total Deductions</Typography>
                {payroll.totalDeductions !== calculateTotalDeductionsOptimized() && (
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 1 }}>
                    Stored: {formatPKR(payroll.totalDeductions)}
                  </Typography>
                )}
                {calculateTaxBreakdownOptimized() && (
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 1 }}>
                    ✅ Using calculated tax: {formatPKR(calculateTaxBreakdownOptimized().monthlyTax)}
                  </Typography>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'success.light', color: 'white' }}>
                <Typography variant="h4">{formatPKR(calculateNetSalaryOptimized())}</Typography>
                <Typography variant="body2">Net Salary</Typography>
                {payroll.netSalary !== calculateNetSalaryOptimized() && (
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 1 }}>
                    Stored: {formatPKR(payroll.netSalary)}
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
          
          {/* Attendance Summary */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'info.50', borderRadius: 1, border: '1px solid', borderColor: 'info.200' }}>
            <Typography variant="subtitle1" color="info.main" gutterBottom sx={{ fontWeight: 600 }}>
              📅 Attendance Summary (26 Working Days)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="primary.main">{payroll.totalWorkingDays || 26}</Typography>
                  <Typography variant="caption">Total Working Days</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="success.main">{payroll.presentDays || 26}</Typography>
                  <Typography variant="caption">Present Days</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="error.main">{payroll.absentDays || 0}</Typography>
                  <Typography variant="caption">Absent Days</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="warning.main">{formatPKR(payroll.dailyRate || 0)}</Typography>
                  <Typography variant="caption">Daily Rate</Typography>
                  <Typography variant="caption" color="info.main" display="block">
                    (Gross ÷ 26)
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            {payroll.absentDays > 0 && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'error.50', borderRadius: 1, border: '1px solid', borderColor: 'error.200' }}>
                <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
                  💰 Attendance Deduction: {formatPKR(payroll.attendanceDeduction || 0)} 
                  ({payroll.absentDays} days × {formatPKR(payroll.dailyRate || 0)})
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Tax Calculation Breakdown */}
      {calculateTaxBreakdownOptimized() && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
              🧮 Tax Calculation Breakdown (Pakistan FBR 2025-2026)
            </Typography>
            
            <Box sx={{ mb: 3, p: 2, bgcolor: 'info.50', borderRadius: 2, border: '1px solid', borderColor: 'info.200' }}>
              <Typography variant="subtitle2" color="info.main" gutterBottom sx={{ fontWeight: 600 }}>
                📋 Tax Calculation Formula
              </Typography>
              <Typography variant="body2" color="textSecondary">
                <strong>Step 1:</strong> Gross Salary (Base) + Additional Allowances = Total Earnings
              </Typography>
              <Typography variant="body2" color="textSecondary">
                <strong>Step 2:</strong> Total Earnings - 10% Medical Allowance = Taxable Income
              </Typography>
              <Typography variant="body2" color="textSecondary">
                <strong>Step 3:</strong> Calculate tax on Taxable Income using FBR 2025-2026 tax slabs for Salaried Persons
              </Typography>
              <Typography variant="body2" color="textSecondary">
                <strong>Step 4:</strong> Medical Allowance is completely tax-exempt per Pakistan tax law
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1, fontWeight: 600, color: 'primary.main' }}>
                <strong>FBR 2025-2026 Tax Slabs:</strong> 0% (≤600K) | 1% (600K-1.2M) | 11% (1.2M-2.2M) | 23% (2.2M-3.2M) | 30% (3.2M-4.1M) | 35% (&gt;4.1M)
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {/* Left Column - Tax Calculation Steps */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                  Tax Calculation Steps
                </Typography>
                
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableBody>
                      <TableRow sx={{ backgroundColor: 'primary.50' }}>
                        <TableCell sx={{ fontWeight: 600 }}>1. Gross Salary (Base)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatPKR(employee?.salary?.gross || 0)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>2. Additional Allowances</TableCell>
                        <TableCell align="right" sx={{ color: 'info.main', fontWeight: 600 }}>
                          + {formatPKR(
                            (payroll?.allowances?.conveyance?.isActive ? (payroll.allowances.conveyance.amount || 0) : 0) +
                            (payroll?.allowances?.food?.isActive ? (payroll.allowances.food.amount || 0) : 0) +
                            (payroll?.allowances?.vehicleFuel?.isActive ? (payroll.allowances.vehicleFuel.amount || 0) : 0) +
                            (payroll?.allowances?.special?.isActive ? (payroll.allowances.special.amount || 0) : 0) +
                            (payroll?.allowances?.other?.isActive ? (payroll.allowances.other.amount || 0) : 0)
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: 'success.50', borderTop: '2px solid', borderColor: 'success.300' }}>
                        <TableCell sx={{ fontWeight: 600, color: 'success.main' }}>
                          3. Total Earnings
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'success.main' }}>
                          {formatPKR(calculateTotalEarningsOptimized())}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>4. Medical Allowance (10%)</TableCell>
                        <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 600 }}>
                          - {formatPKR(calculateTaxBreakdownOptimized().medicalAllowance)}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: 'info.50', borderTop: '2px solid', borderColor: 'info.300' }}>
                        <TableCell sx={{ fontWeight: 600, color: 'info.main' }}>
                          5. Taxable Income
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'info.main' }}>
                          {formatPKR(calculateTaxBreakdownOptimized().taxableIncome)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ p: 2, bgcolor: 'warning.50', borderRadius: 2, border: '1px solid', borderColor: 'warning.200' }}>
                  <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                    💡 Medical Allowance (10% of Gross) is completely tax-exempt in Pakistan
                  </Typography>
                </Box>
              </Grid>

              {/* Right Column - Tax Results */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'error.main' }}>
                  Tax Calculation Results
                </Typography>
                
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>Total Earnings</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'success.main' }}>
                          {formatPKR(calculateTotalEarningsOptimized())}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Medical Allowance (10%)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'warning.main' }}>
                          {formatPKR(calculateTaxBreakdownOptimized().medicalAllowance)}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: 'info.50' }}>
                        <TableCell sx={{ fontWeight: 600, color: 'info.main' }}>
                          Monthly Taxable Income
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'info.main' }}>
                          {formatPKR(calculateTaxBreakdownOptimized().taxableIncome)}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: 'info.100' }}>
                        <TableCell sx={{ fontWeight: 600, color: 'info.main' }}>
                          Annual Taxable Income
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'info.main' }}>
                          {formatPKR(calculateTaxBreakdownOptimized().annualTaxableIncome)}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: 'error.50' }}>
                        <TableCell sx={{ fontWeight: 600, color: 'error.main' }}>
                          Monthly Tax
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'error.main' }}>
                          {formatPKR(calculateTaxBreakdownOptimized().monthlyTax)}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: 'error.100' }}>
                        <TableCell sx={{ fontWeight: 600, color: 'error.main' }}>
                          Annual Tax
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'error.main' }}>
                          {formatPKR(calculateTaxBreakdownOptimized().annualTax)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Tax Slab Information */}
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'grey.300' }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                    📊 FBR Tax Slab Applied: {(() => {
                      const annual = calculateTaxBreakdownOptimized().annualTaxableIncome;
                      if (annual <= 600000) return "0% (Up to 600,000)";
                      if (annual <= 1200000) return "1% (600,001 - 1,200,000)";
                      if (annual <= 2200000) return "11% (1,200,001 - 2,200,000)";
                      if (annual <= 3200000) return "23% (2,200,001 - 3,200,000)";
                      if (annual <= 4100000) return "30% (3,200,001 - 4,100,000)";
                      return "35% (Above 4,100,000)";
                    })()}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default PayrollDetail; 