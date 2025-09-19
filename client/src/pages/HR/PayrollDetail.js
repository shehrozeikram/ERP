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
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TablePagination,
  Snackbar
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  CheckCircle as ApproveIcon,
  CheckCircle,
  Payment as PaymentIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Receipt as ReceiptIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { formatPKR } from '../../utils/currency';
import api from '../../services/api';

const PayrollDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payroll, setPayroll] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  
  // Modal states for attendance history
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState(null);
  const [attendancePage, setAttendancePage] = useState(0);
  const [attendanceRowsPerPage, setAttendanceRowsPerPage] = useState(20);

  // Modal states for leave data
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveData, setLeaveData] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState(null);
  const [leavePage, setLeavePage] = useState(0);
  const [leaveRowsPerPage, setLeaveRowsPerPage] = useState(20);

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
      setDownloadLoading(true);
      setDownloadSuccess(false);
      
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
      
      // Show success feedback
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
      
    } catch (error) {
      console.error('Error generating payslip:', error);
      
      // Show error message
      const errorMessage = error.response?.data?.message || 'Failed to download payslip PDF';
      setError(errorMessage);
      
    } finally {
      setDownloadLoading(false);
    }
  };

  const formatEmployeeId = (employeeId) => {
    if (!employeeId) return 'N/A';
    return employeeId.toString().padStart(6, '0');
  };

  // Function to fetch attendance history
  const fetchAttendanceHistory = async (employeeId) => {
    try {
      setAttendanceLoading(true);
      setAttendanceError(null);
      
      console.log('🔍 Fetching attendance for employee:', employeeId);
      console.log('🔧 API Base URL:', api.defaults.baseURL);
      
      const response = await api.get(`/zkbio/zkbio/employees/${employeeId}/attendance`);
      
      if (response.data.success) {
        console.log('🔍 API Response:', response.data.data);
        setAttendanceHistory(response.data.data.attendance || []);
      } else {
        setAttendanceError(response.data.message || 'Failed to fetch attendance history');
      }
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      
      // Provide more specific error messages based on error type
      if (error.response?.status === 404) {
        setAttendanceError('Employee not found in attendance system');
      } else if (error.response?.status === 500) {
        setAttendanceError('Attendance system server error');
      } else if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
        setAttendanceError('Network error - please check your connection');
      } else if (error.message.includes('Failed to connect to attendance system')) {
        setAttendanceError('Failed to connect to attendance system');
      } else {
        setAttendanceError(`Failed to connect to attendance system: ${error.message}`);
      }
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Function to handle hyperlink clicks
  const handleAttendanceClick = async (type) => {
    if (!payroll?.employee) return;
    
    setAttendanceModalOpen(true);
    
    // Use employeeId (like "000001") instead of MongoDB _id
    const employeeId = payroll.employee.employeeId || payroll.employee._id;
    
    console.log('🔍 Payroll employee data:', payroll.employee);
    console.log('🔍 Using employeeId:', employeeId);
    
    await fetchAttendanceHistory(employeeId);
  };

  // Function to close modal
  const handleCloseModal = () => {
    setAttendanceModalOpen(false);
    setAttendanceHistory([]);
    setAttendanceError(null);
  };

  // Function to handle pagination
  const handleAttendancePageChange = (event, newPage) => {
    setAttendancePage(newPage);
  };

  const handleAttendanceRowsPerPageChange = (event) => {
    setAttendanceRowsPerPage(parseInt(event.target.value, 10));
    setAttendancePage(0);
  };

  // Function to fetch leave data
  const fetchLeaveData = async (employeeId) => {
    try {
      setLeaveLoading(true);
      setLeaveError(null);
      
      console.log('🔍 Fetching leave data for employee:', employeeId);
      
      // For now, we'll create mock leave data based on payroll data
      // In a real implementation, you would fetch from a leave API
      const mockLeaveData = [
        {
          id: 1,
          leaveType: 'Sick Leave',
          startDate: '2025-08-01',
          endDate: '2025-08-02',
          days: payroll.leaveDeductions?.sickLeave || 0,
          reason: 'Medical appointment',
          status: 'Approved'
        },
        {
          id: 2,
          leaveType: 'Casual Leave',
          startDate: '2025-08-15',
          endDate: '2025-08-16',
          days: payroll.leaveDeductions?.casualLeave || 0,
          reason: 'Personal work',
          status: 'Approved'
        },
        {
          id: 3,
          leaveType: 'Annual Leave',
          startDate: '2025-08-20',
          endDate: '2025-08-22',
          days: payroll.leaveDeductions?.annualLeave || 0,
          reason: 'Vacation',
          status: 'Approved'
        },
        {
          id: 4,
          leaveType: 'Unpaid Leave',
          startDate: '2025-08-25',
          endDate: '2025-08-26',
          days: payroll.leaveDeductions?.unpaidLeave || 0,
          reason: 'Emergency',
          status: 'Approved'
        }
      ].filter(leave => leave.days > 0); // Only show leaves with days > 0
      
      setLeaveData(mockLeaveData);
    } catch (error) {
      console.error('Error fetching leave data:', error);
      setLeaveError('Failed to fetch leave data');
    } finally {
      setLeaveLoading(false);
    }
  };

  // Function to handle leave hyperlink clicks
  const handleLeaveClick = async (type) => {
    if (!payroll?.employee) return;
    
    setLeaveModalOpen(true);
    
    // Use employeeId (like "000001") instead of MongoDB _id
    const employeeId = payroll.employee.employeeId || payroll.employee._id;
    
    console.log('🔍 Payroll employee data:', payroll.employee);
    console.log('🔍 Using employeeId for leave:', employeeId);
    
    await fetchLeaveData(employeeId);
  };

  // Function to close leave modal
  const handleCloseLeaveModal = () => {
    setLeaveModalOpen(false);
    setLeaveData([]);
    setLeaveError(null);
  };

  // Function to handle leave pagination
  const handleLeavePageChange = (event, newPage) => {
    setLeavePage(newPage);
  };

  const handleLeaveRowsPerPageChange = (event) => {
    setLeaveRowsPerPage(parseInt(event.target.value, 10));
    setLeavePage(0);
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
            color={downloadSuccess ? "success" : "secondary"}
            startIcon={downloadSuccess ? <CheckCircle /> : <ReceiptIcon />}
            onClick={handleGeneratePayslip}
            disabled={downloadLoading || actionLoading}
            sx={{
              transition: 'all 0.3s ease',
              transform: downloadSuccess ? 'scale(1.05)' : 'scale(1)',
              ...(downloadSuccess && {
                animation: 'pulse 0.6s ease-in-out',
                '@keyframes pulse': {
                  '0%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.05)' },
                  '100%': { transform: 'scale(1)' }
                }
              })
            }}
          >
            {downloadLoading ? 'Downloading...' : downloadSuccess ? 'Downloaded!' : 'Download Payslip PDF'}
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
                <Typography
                  component="span"
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8
                    }
                  }}
                  onClick={() => handleAttendanceClick('attendance')}
                >
                  Attendance Details (Database Values)
                </Typography>
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Total Working Days</TableCell>
                      <TableCell align="right">{payroll.totalWorkingDays || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Typography
                          component="span"
                          sx={{
                            cursor: 'pointer',
                            '&:hover': {
                              opacity: 0.8
                            }
                          }}
                          onClick={() => handleAttendanceClick('present')}
                        >
                          Present Days
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{payroll.presentDays || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Typography
                          component="span"
                          sx={{
                            cursor: 'pointer',
                            '&:hover': {
                              opacity: 0.8
                            }
                          }}
                          onClick={() => handleAttendanceClick('absent')}
                        >
                          Absent Days
                        </Typography>
                      </TableCell>
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
                <Typography
                  component="span"
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8
                    }
                  }}
                  onClick={() => handleLeaveClick('leave')}
                >
                  Leave Deductions (Database Values)
                </Typography>
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

      {/* Attendance History Modal */}
      <Dialog
        open={attendanceModalOpen}
        onClose={handleCloseModal}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { 
            minHeight: '80vh',
            borderRadius: 3,
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: '12px 12px 0 0',
          py: 3,
          px: 4
        }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
              📅 Attendance History
            </Typography>
            <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
              {payroll?.employee?.firstName} {payroll?.employee?.lastName}
            </Typography>
          </Box>
          <IconButton 
            onClick={handleCloseModal} 
            size="small"
            sx={{ 
              color: 'white',
              '&:hover': { 
                backgroundColor: 'rgba(255,255,255,0.1)' 
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          {attendanceLoading ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center',
              p: 6,
              gap: 2
            }}>
              <CircularProgress size={60} sx={{ color: '#667eea' }} />
              <Typography variant="h6" color="text.secondary">
                Loading attendance history...
              </Typography>
            </Box>
          ) : attendanceError ? (
            <Box sx={{ p: 4 }}>
              <Alert 
                severity="error" 
                sx={{ 
                  borderRadius: 2,
                  '& .MuiAlert-message': {
                    fontSize: '1.1rem'
                  }
                }}
              >
                {attendanceError}
              </Alert>
            </Box>
          ) : (
            <Box sx={{ p: 3 }}>
              <TableContainer 
                sx={{ 
                  borderRadius: 2,
                  border: '1px solid #e0e0e0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}
              >
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                      <TableCell sx={{ 
                        fontWeight: 600, 
                        fontSize: '1rem',
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>
                        📅 Date
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: 600, 
                        fontSize: '1rem',
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>
                        🕐 Check In
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: 600, 
                        fontSize: '1rem',
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>
                        🕕 Check Out
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {attendanceHistory
                      .slice(attendancePage * attendanceRowsPerPage, attendancePage * attendanceRowsPerPage + attendanceRowsPerPage)
                      .map((record, index) => (
                        <TableRow 
                          key={index}
                          sx={{ 
                            '&:hover': { 
                              backgroundColor: '#f8f9fa' 
                            },
                            '&:nth-of-type(even)': {
                              backgroundColor: '#fafbfc'
                            }
                          }}
                        >
                          <TableCell sx={{ 
                            fontSize: '1rem',
                            fontWeight: 500,
                            color: '#495057'
                          }}>
                            {record.date ? format(new Date(record.date), 'MMM dd, yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell sx={{ 
                            fontSize: '1rem',
                            color: '#28a745',
                            fontWeight: 500
                          }}>
                            {record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : 'N/A'}
                          </TableCell>
                          <TableCell sx={{ 
                            fontSize: '1rem',
                            color: '#dc3545',
                            fontWeight: 500
                          }}>
                            {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ 
          p: 3, 
          backgroundColor: '#f8f9fa',
          borderRadius: '0 0 12px 12px',
          flexDirection: 'column',
          gap: 2
        }}>
          {/* Floating Pagination */}
          <Box sx={{ 
            width: '100%',
            display: 'flex', 
            justifyContent: 'center',
            backgroundColor: 'white',
            borderRadius: 2,
            p: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <TablePagination
              component="div"
              count={attendanceHistory.length}
              page={attendancePage}
              onPageChange={handleAttendancePageChange}
              rowsPerPage={attendanceRowsPerPage}
              onRowsPerPageChange={handleAttendanceRowsPerPageChange}
              rowsPerPageOptions={[10, 20, 50]}
              sx={{
                '& .MuiTablePagination-toolbar': {
                  paddingLeft: 0
                }
              }}
            />
          </Box>
          
          <Button 
            onClick={handleCloseModal} 
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 2,
              px: 4,
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
              }
            }}
          >
            ✨ Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Leave Data Modal */}
      <Dialog
        open={leaveModalOpen}
        onClose={handleCloseLeaveModal}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { 
            minHeight: '80vh',
            borderRadius: 3,
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
          color: 'white',
          borderRadius: '12px 12px 0 0',
          py: 3,
          px: 4
        }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
              🏖️ Leave Records
            </Typography>
            <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
              {payroll?.employee?.firstName} {payroll?.employee?.lastName}
            </Typography>
          </Box>
          <IconButton 
            onClick={handleCloseLeaveModal} 
            size="small"
            sx={{ 
              color: 'white',
              '&:hover': { 
                backgroundColor: 'rgba(255,255,255,0.1)' 
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          {leaveLoading ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center',
              p: 6,
              gap: 2
            }}>
              <CircularProgress size={60} sx={{ color: '#ff6b6b' }} />
              <Typography variant="h6" color="text.secondary">
                Loading leave records...
              </Typography>
            </Box>
          ) : leaveError ? (
            <Box sx={{ p: 4 }}>
              <Alert 
                severity="error" 
                sx={{ 
                  borderRadius: 2,
                  '& .MuiAlert-message': {
                    fontSize: '1.1rem'
                  }
                }}
              >
                {leaveError}
              </Alert>
            </Box>
          ) : leaveData.length === 0 ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center',
              p: 6,
              gap: 2
            }}>
              <Typography variant="h4" sx={{ color: '#6c757d', mb: 2 }}>
                📋
              </Typography>
              <Typography variant="h6" color="text.secondary">
                No leave records found for this period
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This employee has not taken any leaves during this payroll period
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 3 }}>
              <TableContainer 
                sx={{ 
                  borderRadius: 2,
                  border: '1px solid #e0e0e0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}
              >
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                      <TableCell sx={{ 
                        fontWeight: 600, 
                        fontSize: '1rem',
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>
                        🏷️ Leave Type
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: 600, 
                        fontSize: '1rem',
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>
                        📅 Start Date
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: 600, 
                        fontSize: '1rem',
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>
                        📅 End Date
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: 600, 
                        fontSize: '1rem',
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>
                        📊 Days
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: 600, 
                        fontSize: '1rem',
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>
                        📝 Reason
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaveData
                      .slice(leavePage * leaveRowsPerPage, leavePage * leaveRowsPerPage + leaveRowsPerPage)
                      .map((leave, index) => (
                        <TableRow 
                          key={leave.id}
                          sx={{ 
                            '&:hover': { 
                              backgroundColor: '#f8f9fa' 
                            },
                            '&:nth-of-type(even)': {
                              backgroundColor: '#fafbfc'
                            }
                          }}
                        >
                          <TableCell sx={{ 
                            fontSize: '1rem',
                            fontWeight: 500,
                            color: '#495057'
                          }}>
                            {leave.leaveType}
                          </TableCell>
                          <TableCell sx={{ 
                            fontSize: '1rem',
                            color: '#28a745',
                            fontWeight: 500
                          }}>
                            {leave.startDate ? format(new Date(leave.startDate), 'MMM dd, yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell sx={{ 
                            fontSize: '1rem',
                            color: '#dc3545',
                            fontWeight: 500
                          }}>
                            {leave.endDate ? format(new Date(leave.endDate), 'MMM dd, yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell sx={{ 
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#ff6b6b'
                          }}>
                            {leave.days} day{leave.days > 1 ? 's' : ''}
                          </TableCell>
                          <TableCell sx={{ 
                            fontSize: '1rem',
                            color: '#6c757d',
                            fontStyle: 'italic'
                          }}>
                            {leave.reason}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <TablePagination
                  component="div"
                  count={leaveData.length}
                  page={leavePage}
                  onPageChange={handleLeavePageChange}
                  rowsPerPage={leaveRowsPerPage}
                  onRowsPerPageChange={handleLeaveRowsPerPageChange}
                  rowsPerPageOptions={[10, 20, 50]}
                  sx={{
                    '& .MuiTablePagination-toolbar': {
                      paddingLeft: 0
                    }
                  }}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ 
          p: 3, 
          backgroundColor: '#f8f9fa',
          borderRadius: '0 0 12px 12px'
        }}>
          <Button 
            onClick={handleCloseLeaveModal} 
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
              borderRadius: 2,
              px: 4,
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(135deg, #ff5252 0%, #d63031 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(255, 107, 107, 0.4)'
              }
            }}
          >
            ✨ Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={downloadSuccess}
        autoHideDuration={3000}
        onClose={() => setDownloadSuccess(false)}
        message="Payslip PDF downloaded successfully!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: '#4caf50',
            color: 'white',
            fontWeight: 'bold'
          }
        }}
      />
    </Box>
  );
};

export default PayrollDetail; 