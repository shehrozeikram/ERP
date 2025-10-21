import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  CircularProgress,
  Skeleton,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  HourglassEmpty as PendingIcon,
  EventNote as EventNoteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import leaveService from '../../../services/leaveService';

const EmployeeLeaveHistory = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [leaveSummary, setLeaveSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchLeaveHistory();
  }, [employeeId, selectedYear]);

  const fetchLeaveHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await leaveService.getEmployeeLeaveSummary(employeeId, selectedYear);
      setLeaveSummary(response.data);
    } catch (err) {
      console.error('Error fetching leave history:', err);
      setError('Failed to load leave history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <ApprovedIcon fontSize="small" />;
      case 'rejected': return <RejectedIcon fontSize="small" />;
      case 'pending': return <PendingIcon fontSize="small" />;
      default: return null;
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return format(new Date(date), 'MMM dd, yyyy');
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header Skeleton */}
        <Box sx={{ mb: 3 }}>
          <Skeleton variant="rectangular" width={120} height={36} sx={{ borderRadius: 1, mb: 2 }} />
          <Skeleton variant="text" width="40%" height={60} />
          <Skeleton variant="text" width="25%" height={30} />
        </Box>

        {/* Employee Info Skeleton */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
              <Skeleton variant="circular" width={60} height={60} sx={{ mr: 2 }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="30%" height={24} />
                <Skeleton variant="text" width="20%" height={20} />
              </Box>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center', p: 2 }}>
                  <Skeleton variant="circular" width={40} height={40} sx={{ mx: 'auto', mb: 1 }} />
                  <Skeleton variant="text" width="60%" height={20} />
                  <Skeleton variant="text" width="40%" height={16} />
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center', p: 2 }}>
                  <Skeleton variant="circular" width={40} height={40} sx={{ mx: 'auto', mb: 1 }} />
                  <Skeleton variant="text" width="60%" height={20} />
                  <Skeleton variant="text" width="40%" height={16} />
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center', p: 2 }}>
                  <Skeleton variant="circular" width={40} height={40} sx={{ mx: 'auto', mb: 1 }} />
                  <Skeleton variant="text" width="60%" height={20} />
                  <Skeleton variant="text" width="40%" height={16} />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Leave History Table Skeleton */}
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Skeleton variant="text" width="25%" height={32} />
              <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
            </Box>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><Skeleton variant="text" width="70%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="60%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="50%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="40%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="60%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="50%" /></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[1, 2, 3, 4, 5].map((row) => (
                    <TableRow key={row}>
                      <TableCell>
                        <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 12 }} />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Skeleton variant="text" width={100} height={16} />
                          <Skeleton variant="text" width={80} height={16} />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={60} height={20} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="rectangular" width={70} height={24} sx={{ borderRadius: 12 }} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={80} height={16} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={100} height={16} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error || !leaveSummary) {
    return (
      <Box sx={{ p: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2 }}
        >
          Back
        </Button>
        <Alert severity="error">{error || 'Failed to load leave history'}</Alert>
      </Box>
    );
  }

  const { employee, balance, statistics, history } = leaveSummary;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/hr/employees/${employeeId}`)}
          >
            Back to Employee
          </Button>
          <Typography variant="h4">Leave History</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={selectedYear}
              label="Year"
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {Array.from({ length: 10 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchLeaveHistory}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Employee Info Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
              {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">
                {employee.firstName} {employee.lastName}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                ID: {employee.employeeId} | Email: {employee.email}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                Date of Joining: {formatDate(employee.hireDate)}
              </Typography>
              {leaveSummary.anniversaryInfo && (
                <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                  Work Year: {leaveSummary.workYear} | Next Anniversary: {formatDate(leaveSummary.anniversaryInfo.nextAnniversary)}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Leave Balance Summary */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Annual Leave
              </Typography>
              <Typography variant="h4" color="primary.main">
                {balance.annual.remaining} / {balance.annual.allocated}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Used: {balance.annual.used}
                {balance.annual.advance > 0 && (
                  <Chip 
                    label={`Adv: ${balance.annual.advance}`} 
                    size="small" 
                    color="error" 
                    sx={{ ml: 1, height: 18 }}
                  />
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Sick Leave
              </Typography>
              <Typography variant="h4" color="success.main">
                {balance.sick.remaining} / {balance.sick.allocated}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Used: {balance.sick.used}
                {balance.sick.advance > 0 && (
                  <Chip 
                    label={`Adv: ${balance.sick.advance}`} 
                    size="small" 
                    color="error" 
                    sx={{ ml: 1, height: 18 }}
                  />
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Casual Leave
              </Typography>
              <Typography variant="h4" color="info.main">
                {balance.casual.remaining} / {balance.casual.allocated}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Used: {balance.casual.used}
                {balance.casual.advance > 0 && (
                  <Chip 
                    label={`Adv: ${balance.casual.advance}`} 
                    size="small" 
                    color="error" 
                    sx={{ ml: 1, height: 18 }}
                  />
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Total Requests
              </Typography>
              <Typography variant="h4" color="warning.main">
                {statistics.totalRequests}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Approved: {statistics.approved} | Pending: {statistics.pending}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Anniversary Leave System Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            📅 Anniversary-Based Leave System
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Annual Leaves:</strong> 20 days per year, given after completing 1 year of service
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Sick/Casual Leaves:</strong> 10 days each per year, available from first year
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Carry Forward:</strong> Annual leaves carry forward for up to 2 years
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Expiration:</strong> Annual leaves expire automatically after 2 years
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Advance Leave Warning */}
      {balance.totalAdvanceLeaves > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Total Advance Leaves: {balance.totalAdvanceLeaves} days</strong> - 
            These will be deducted from the employee's payroll at the daily rate.
          </Typography>
        </Alert>
      )}

      {/* Leave History Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventNoteIcon />
            Leave Requests ({selectedYear})
          </Typography>
          
          {history.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                No leave requests found for {selectedYear}. 
                Try selecting a different year from the dropdown above to view historical leave records.
              </Typography>
            </Alert>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Leave Type</TableCell>
                    <TableCell>Start Date</TableCell>
                    <TableCell>End Date</TableCell>
                    <TableCell align="center">Days</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Applied Date</TableCell>
                    <TableCell>Action By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((leave) => (
                    <TableRow key={leave._id} hover>
                      <TableCell>
                        <Chip
                          label={leave.leaveType?.name || 'N/A'}
                          size="small"
                          sx={{ 
                            bgcolor: leave.leaveType?.color || '#3B82F6',
                            color: 'white'
                          }}
                        />
                      </TableCell>
                      <TableCell>{formatDate(leave.startDate)}</TableCell>
                      <TableCell>{formatDate(leave.endDate)}</TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={leave.totalDays} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {leave.reason}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(leave.status)}
                          label={leave.status}
                          color={getStatusColor(leave.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatDate(leave.appliedDate)}</TableCell>
                      <TableCell>
                        {leave.status === 'approved' && leave.approvedBy && (
                          <Typography variant="body2" color="success.main">
                            {leave.approvedBy.firstName} {leave.approvedBy.lastName}
                          </Typography>
                        )}
                        {leave.status === 'rejected' && leave.rejectedBy && (
                          <Typography variant="body2" color="error.main">
                            {leave.rejectedBy.firstName} {leave.rejectedBy.lastName}
                          </Typography>
                        )}
                        {leave.status === 'pending' && (
                          <Typography variant="body2" color="textSecondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default EmployeeLeaveHistory;

