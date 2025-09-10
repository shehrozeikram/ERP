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
  Print as PrintIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { formatPKR } from '../../utils/currency';
import api from '../../services/authService';

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
      
      // Also fetch employee details
      if (payrollData.employee) {
        try {
          const employeeResponse = await api.get(`/hr/employees/${payrollData.employee._id || payrollData.employee}`);
          setEmployee(employeeResponse.data.data);
        } catch (employeeError) {
          console.error('Error fetching employee details:', employeeError);
        }
      }
    } catch (error) {
      console.error('Error fetching payroll details:', error);
      setError('Failed to fetch payroll details');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/hr/payroll/${id}/edit`);
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      await api.put(`/payroll/${id}/approve`);
      await fetchPayrollDetail();
    } catch (error) {
      console.error('Error approving payroll:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      setActionLoading(true);
      await api.put(`/payroll/${id}/mark-paid`);
      await fetchPayrollDetail();
    } catch (error) {
      console.error('Error marking payroll as paid:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAsUnpaid = async () => {
    try {
      setActionLoading(true);
      await api.put(`/payroll/${id}/mark-unpaid`);
      await fetchPayrollDetail();
    } catch (error) {
      console.error('Error marking payroll as unpaid:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleGeneratePayslip = async () => {
    try {
      setActionLoading(true);
      
      // Make request to generate payslip and get PDF
      const response = await api.post(`/payroll/${id}/generate-payslip`, {}, {
        responseType: 'blob' // Important for PDF download
      });
      
      // Create blob URL for the PDF
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from response headers or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'payslip.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      // Show success message
      alert('Payslip PDF downloaded successfully!');
      
    } catch (error) {
      console.error('Error generating payslip:', error);
      
      if (error.response?.status === 404) {
        alert('Error: Payroll not found. Please refresh the page and try again.');
      } else if (error.response?.status === 400) {
        if (error.response?.data?.message?.includes('already exists')) {
          alert(`Error: ${error.response.data.message}`);
        } else if (error.response?.data?.message?.includes('Employee data not found')) {
          alert('Error: Employee data is missing from this payroll. Please contact administrator.');
        } else if (error.response?.data?.message?.includes('Invalid payroll ID')) {
          alert('Error: Invalid payroll ID. Please refresh the page and try again.');
        } else {
          alert(`Error: ${error.response.data.message || 'Invalid request'}`);
        }
      } else if (error.response?.data?.message) {
        alert(`Error: ${error.response.data.message}`);
      } else {
        alert('Failed to generate payslip. Please try again.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const formatEmployeeId = (employeeId) => {
    if (!employeeId) return 'N/A';
    return employeeId.toString().padStart(6, '0');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!payroll) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Payroll not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/hr/payroll')}
          >
            Back to Payrolls
          </Button>
          <Typography variant="h4">
            Payroll Details
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={handleEdit}
          >
            Edit
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<ReceiptIcon />}
            onClick={handleGeneratePayslip}
            disabled={actionLoading}
          >
            Download Payslip PDF
          </Button>
          {!payroll.isApproved && (
            <Button
              variant="contained"
              color="success"
              startIcon={<ApproveIcon />}
              onClick={handleApprove}
              disabled={actionLoading}
            >
              Approve
            </Button>
          )}
          {payroll.isApproved && !payroll.isPaid && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<PaymentIcon />}
              onClick={handleMarkAsPaid}
              disabled={actionLoading}
            >
              Mark as Paid
            </Button>
          )}
          {payroll.isPaid && (
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
                      <TableCell align="right">{formatPKR(payroll.basicSalary || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>House Rent Allowance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.houseRentAllowance || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Medical Allowance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.medicalAllowance || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Conveyance Allowance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.allowances.conveyance.amount || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Food Allowance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.allowances.food.amount || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Vehicle & Fuel Allowance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.allowances.vehicleFuel.amount || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Special Allowance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.allowances.special.amount || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Allowance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.allowances.other.amount || 0)}</TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell>Gross Salary</TableCell>
                      <TableCell align="right">{formatPKR(payroll.grossSalary || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Overtime Amount</TableCell>
                      <TableCell align="right">{formatPKR(payroll.overtimeAmount || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Performance Bonus</TableCell>
                      <TableCell align="right">{formatPKR(payroll.performanceBonus || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Bonus</TableCell>
                      <TableCell align="right">{formatPKR(payroll.otherBonus || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Total Earnings</TableCell>
                      <TableCell align="right">{formatPKR(payroll.totalEarnings || 0)}</TableCell>
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
                      <TableCell>Income Tax</TableCell>
                      <TableCell align="right">{formatPKR(payroll.incomeTax || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>EOBI</TableCell>
                      <TableCell align="right">{formatPKR(payroll.eobi || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Health Insurance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.healthInsurance || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Attendance Deduction</TableCell>
                      <TableCell align="right">{formatPKR(payroll.attendanceDeduction || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Leave Deduction Amount</TableCell>
                      <TableCell align="right">{formatPKR((payroll.dailyRate || 0) * (payroll.leaveDays || 0))}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Deductions</TableCell>
                      <TableCell align="right">{formatPKR(payroll.otherDeductions || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Total Deductions</TableCell>
                      <TableCell align="right">{formatPKR(payroll.totalDeductions || 0)}</TableCell>
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
                      <TableCell align="right">{payroll.totalWorkingDays || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Present Days</TableCell>
                      <TableCell align="right">{payroll.presentDays || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Absent Days</TableCell>
                      <TableCell align="right">{payroll.absentDays || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Leave Days</TableCell>
                      <TableCell align="right">{payroll.leaveDays || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Daily Rate</TableCell>
                      <TableCell align="right">{formatPKR(payroll.dailyRate || 0)}</TableCell>
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
                      <TableCell align="right">{payroll.leaveDeductions?.unpaidLeave || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Sick Leave</TableCell>
                      <TableCell align="right">{payroll.leaveDeductions?.sickLeave || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Casual Leave</TableCell>
                      <TableCell align="right">{payroll.leaveDeductions?.casualLeave || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Annual Leave</TableCell>
                      <TableCell align="right">{payroll.leaveDeductions?.annualLeave || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Leave</TableCell>
                      <TableCell align="right">{payroll.leaveDeductions?.otherLeave || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Total Leave Days</TableCell>
                      <TableCell align="right">{payroll.leaveDeductions?.totalLeaveDays || 0}</TableCell>
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
                <Typography variant="h4">{formatPKR(payroll.totalEarnings || 0)}</Typography>
                <Typography variant="body2">Total Earnings</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'error.light', color: 'white' }}>
                <Typography variant="h4">{formatPKR(payroll.totalDeductions || 0)}</Typography>
                <Typography variant="body2">Total Deductions</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'success.light', color: 'white' }}>
                <Typography variant="h4">{formatPKR(payroll.netSalary || 0)}</Typography>
                <Typography variant="body2">Net Salary</Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PayrollDetail; 