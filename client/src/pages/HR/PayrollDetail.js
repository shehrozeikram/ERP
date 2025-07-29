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
  Download as DownloadIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { formatPKR } from '../../utils/currency';
import api from '../../services/authService';

const PayrollDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payroll, setPayroll] = useState(null);
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
      setPayroll(response.data.data);
    } catch (error) {
      console.error('Error fetching payroll details:', error);
      setError('Failed to load payroll details');
    } finally {
      setLoading(false);
    }
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
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            label={getStatusLabel(payroll.status)}
            color={getStatusColor(payroll.status)}
            size="large"
          />
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
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar sx={{ width: 60, height: 60 }}>
                  {payroll.employee?.firstName?.charAt(0)}{payroll.employee?.lastName?.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {payroll.employee?.firstName} {payroll.employee?.lastName}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    ID: {payroll.employee?.employeeId}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {payroll.employee?.department} • {payroll.employee?.position}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
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
            </Grid>
          </Grid>
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
                      <TableCell>Basic Salary</TableCell>
                      <TableCell align="right">{formatPKR(payroll.basicSalary)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>House Rent Allowance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.houseRentAllowance)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Medical Allowance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.medicalAllowance)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Conveyance Allowance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.conveyanceAllowance)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Special Allowance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.specialAllowance)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Allowance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.otherAllowance)}</TableCell>
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
                      <TableCell align="right"><strong>{formatPKR(payroll.grossSalary)}</strong></TableCell>
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
                      <TableCell>Provident Fund</TableCell>
                      <TableCell align="right">{formatPKR(payroll.providentFund)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Income Tax</TableCell>
                      <TableCell align="right">{formatPKR(payroll.incomeTax)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Health Insurance</TableCell>
                      <TableCell align="right">{formatPKR(payroll.healthInsurance)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Deductions</TableCell>
                      <TableCell align="right">{formatPKR(payroll.otherDeductions)}</TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: 'error.light', color: 'white' }}>
                      <TableCell><strong>Total Deductions</strong></TableCell>
                      <TableCell align="right"><strong>{formatPKR(payroll.totalDeductions)}</strong></TableCell>
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
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'primary.light', color: 'white' }}>
                <Typography variant="h4">{formatPKR(payroll.grossSalary)}</Typography>
                <Typography variant="body2">Gross Salary</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'error.light', color: 'white' }}>
                <Typography variant="h4">{formatPKR(payroll.totalDeductions)}</Typography>
                <Typography variant="body2">Total Deductions</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'success.light', color: 'white' }}>
                <Typography variant="h4">{formatPKR(payroll.netSalary)}</Typography>
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