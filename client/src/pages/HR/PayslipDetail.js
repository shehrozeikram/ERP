import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  Divider,
  Chip,
  Avatar,
  Container,
  useTheme,
  alpha,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Download,
  Print,
  CheckCircle,
  Schedule,
  Person,
  Business,
  AttachMoney,
  Receipt,
  TrendingUp,
  Payment
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import payslipService, { formatPayslipData } from '../../services/payslipService';
import { formatPKR } from '../../utils/currency';

const PayslipDetail = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();

  // State
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Load payslip data
  const loadPayslipData = async () => {
    setLoading(true);
    try {
      const response = await payslipService.getPayslipById(id);
      const formattedPayslip = formatPayslipData(response.data);
      setPayslip(formattedPayslip);
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error loading payslip',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle generate
  const handleGenerate = async () => {
    try {
      await payslipService.generatePayslip(id);
      setSnackbar({
        open: true,
        message: 'Payslip generated successfully',
        severity: 'success'
      });
      loadPayslipData();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error generating payslip',
        severity: 'error'
      });
    }
  };

  // Handle approve
  const handleApprove = async () => {
    try {
      await payslipService.approvePayslip(id);
      setSnackbar({
        open: true,
        message: 'Payslip approved successfully',
        severity: 'success'
      });
      loadPayslipData();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error approving payslip',
        severity: 'error'
      });
    }
  };

  // Handle mark as paid
  const handleMarkAsPaid = async () => {
    try {
      await payslipService.markPayslipAsPaid(id, {
        paymentMethod: 'bank_transfer',
        paymentDate: new Date()
      });
      setSnackbar({
        open: true,
        message: 'Payslip marked as paid successfully',
        severity: 'success'
      });
      loadPayslipData();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error marking payslip as paid',
        severity: 'error'
      });
    }
  };

  // Handle download PDF
  const handleDownloadPDF = async () => {
    try {
      await payslipService.downloadPayslipPDF(id);
      
      setSnackbar({
        open: true,
        message: 'PDF download started',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error downloading PDF',
        severity: 'error'
      });
    }
  };

  // Load data on mount
  useEffect(() => {
    loadPayslipData();
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!payslip) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error">Payslip not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/hr/payslips')}
            variant="outlined"
          >
            Back to Payslips
          </Button>
          <Typography variant="h4" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
            Payslip Details
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          View detailed information for payslip {payslip.payslipNumber}
        </Typography>
      </Box>

      {/* Status and Actions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                label={payslip.statusLabel}
                color={payslip.statusColor}
                variant="outlined"
                size="large"
              />
              <Typography variant="body2" color="text.secondary">
                {payslip.payslipNumber}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              {payslip.status === 'draft' && (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => navigate(`/hr/payslips/${id}/edit`)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Schedule />}
                    onClick={handleGenerate}
                  >
                    Generate
                  </Button>
                </>
              )}
              
              {payslip.status === 'generated' && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircle />}
                  onClick={handleApprove}
                >
                  Approve
                </Button>
              )}
              
              {payslip.status === 'approved' && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<Payment />}
                  onClick={handleMarkAsPaid}
                >
                  Mark as Paid
                </Button>
              )}
              
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleDownloadPDF}
              >
                Download PDF
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<Print />}
              >
                Print
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Employee Information */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                Employee Information
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar sx={{ width: 56, height: 56, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                  <Person sx={{ fontSize: 28, color: theme.palette.primary.main }} />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {payslip.employeeName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {payslip.employeeId}
                  </Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Department:</Typography>
                  <Typography variant="body2">{payslip.department}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Designation:</Typography>
                  <Typography variant="body2">{payslip.designation}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Period:</Typography>
                  <Typography variant="body2">{payslip.period}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Issue Date:</Typography>
                  <Typography variant="body2">
                    {new Date(payslip.issueDate).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Salary Summary */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
                Salary Summary
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                    <Typography variant="h6" sx={{ color: theme.palette.success.main }}>
                      {payslip.formattedTotals.totalEarnings}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Earnings
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.error.main, 0.1) }}>
                    <Typography variant="h6" sx={{ color: theme.palette.error.main }}>
                      {payslip.formattedTotals.totalDeductions}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Deductions
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                    <Typography variant="h6" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
                      {payslip.formattedTotals.netSalary}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Net Salary
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Earnings Details */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.success.main }}>
                <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
                Earnings Breakdown
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Basic Salary</TableCell>
                      <TableCell align="right">{payslip.formattedEarnings.basicSalary}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>House Rent</TableCell>
                      <TableCell align="right">{payslip.formattedEarnings.houseRent}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Medical Allowance</TableCell>
                      <TableCell align="right">{payslip.formattedEarnings.medicalAllowance}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Conveyance Allowance</TableCell>
                      <TableCell align="right">{payslip.formattedEarnings.conveyanceAllowance}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Special Allowance</TableCell>
                      <TableCell align="right">{payslip.formattedEarnings.specialAllowance}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Overtime</TableCell>
                      <TableCell align="right">{payslip.formattedEarnings.overtime}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Bonus</TableCell>
                      <TableCell align="right">{payslip.formattedEarnings.bonus}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Incentives</TableCell>
                      <TableCell align="right">{payslip.formattedEarnings.incentives}</TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                      <TableCell><strong>Total Earnings</strong></TableCell>
                      <TableCell align="right"><strong>{payslip.formattedTotals.totalEarnings}</strong></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Deductions Details */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.error.main }}>
                <Receipt sx={{ mr: 1, verticalAlign: 'middle' }} />
                Deductions Breakdown
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Provident Fund</TableCell>
                      <TableCell align="right">{payslip.formattedDeductions.providentFund}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>EOBI</TableCell>
                      <TableCell align="right">{payslip.formattedDeductions.eobi}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Income Tax</TableCell>
                      <TableCell align="right">{payslip.formattedDeductions.incomeTax}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Loan Deduction</TableCell>
                      <TableCell align="right">{payslip.formattedDeductions.loanDeduction}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Late Deduction</TableCell>
                      <TableCell align="right">{payslip.formattedDeductions.lateDeduction}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Absent Deduction</TableCell>
                      <TableCell align="right">{payslip.formattedDeductions.absentDeduction}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Deductions</TableCell>
                      <TableCell align="right">{payslip.formattedDeductions.otherDeductions}</TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.error.main, 0.1) }}>
                      <TableCell><strong>Total Deductions</strong></TableCell>
                      <TableCell align="right"><strong>{payslip.formattedTotals.totalDeductions}</strong></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Attendance Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.info.main }}>
                <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
                Attendance Information
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.info.main, 0.1) }}>
                    <Typography variant="h6" sx={{ color: theme.palette.info.main }}>
                      {payslip.totalDays}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Days
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                    <Typography variant="h6" sx={{ color: theme.palette.success.main }}>
                      {payslip.presentDays}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Present Days
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.error.main, 0.1) }}>
                    <Typography variant="h6" sx={{ color: theme.palette.error.main }}>
                      {payslip.absentDays}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Absent Days
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                    <Typography variant="h6" sx={{ color: theme.palette.warning.main }}>
                      {payslip.lateDays}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Late Days
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Attendance Percentage:</Typography>
                <Chip
                  label={`${payslip.attendancePercentage}%`}
                  color={payslip.attendancePercentage >= 90 ? 'success' : payslip.attendancePercentage >= 80 ? 'warning' : 'error'}
                  variant="outlined"
                />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="text.secondary">Overtime Hours:</Typography>
                <Typography variant="body2">{payslip.overtimeHours} hours</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Payment Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                <Payment sx={{ mr: 1, verticalAlign: 'middle' }} />
                Payment Information
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Status:</Typography>
                  <Chip
                    label={payslip.statusLabel}
                    color={payslip.statusColor}
                    variant="outlined"
                  />
                </Box>
                
                {payslip.approvedBy && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Approved By:</Typography>
                    <Typography variant="body2">
                      {payslip.approvedBy?.firstName} {payslip.approvedBy?.lastName}
                    </Typography>
                  </Box>
                )}
                
                {payslip.approvedAt && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Approved At:</Typography>
                    <Typography variant="body2">
                      {new Date(payslip.approvedAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
                
                {payslip.paymentDate && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Payment Date:</Typography>
                    <Typography variant="body2">
                      {new Date(payslip.paymentDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
                
                {payslip.paymentMethod && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Payment Method:</Typography>
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                      {payslip.paymentMethod.replace('_', ' ')}
                    </Typography>
                  </Box>
                )}
              </Box>
              
              {payslip.notes && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>Notes:</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {payslip.notes}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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

export default PayslipDetail; 