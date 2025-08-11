import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CalendarToday,
  AccessTime,
  Work,
  Person
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { PageLoading } from '../../components/LoadingSpinner';

const AttendanceDetail = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [currentAttendance, setCurrentAttendance] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [department, setDepartment] = useState(null);
  const [position, setPosition] = useState(null);

  useEffect(() => {
    fetchAttendanceDetail();
  }, [employeeId]);

  const fetchAttendanceDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch employee attendance detail using the new endpoint
      const detailResponse = await api.get(`/attendance/employee/${employeeId}/detail`);
      if (detailResponse.data.success) {
        const detailData = detailResponse.data.data;
        
        // Set employee data
        setEmployee(detailData.employee);
        
        // Set attendance history
        setAttendanceHistory(detailData.attendanceRecords);
        
        // Set current attendance (today's attendance or latest record)
        if (detailData.todayAttendance) {
          setCurrentAttendance(detailData.todayAttendance);
        } else if (detailData.attendanceRecords.length > 0) {
          setCurrentAttendance(detailData.attendanceRecords[0]);
        }
        
        // Set department and position from employee data
        if (detailData.employee.department) {
          setDepartment({ name: detailData.employee.department });
        }
        if (detailData.employee.position) {
          setPosition({ name: detailData.employee.position });
        }
      } else {
        throw new Error(detailResponse.data.message || 'Failed to fetch attendance details');
      }
    } catch (error) {
      console.error('Error fetching attendance detail:', error);
      setError('Failed to fetch attendance details');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    return new Date(time).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present':
        return 'success';
      case 'Absent':
        return 'error';
      case 'Late':
        return 'warning';
      case 'Leave':
      case 'Sick Leave':
      case 'Personal Leave':
        return 'info';
      default:
        return 'default';
    }
  };

  const calculateWorkHours = (checkInTime, checkOutTime) => {
    if (!checkInTime || !checkOutTime) return 0;
    
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const diffMs = checkOut - checkIn;
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.round(diffHours * 100) / 100;
  };

  if (loading) {
    return <PageLoading skeletonType="table" />;
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Tooltip title="Back to Attendance List">
          <IconButton onClick={() => navigate('/hr/attendance')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Box>
          <Typography variant="h4" component="h1">
            Attendance Detail
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            {employee?.firstName} {employee?.lastName} ({employee?.employeeId})
          </Typography>
        </Box>
      </Box>

      {/* Employee Information Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Person sx={{ mr: 1, color: 'primary.main' }} />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Employee Name
                  </Typography>
                  <Typography variant="h6">
                    {employee?.firstName} {employee?.lastName}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CalendarToday sx={{ mr: 1, color: 'primary.main' }} />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Employee ID
                  </Typography>
                  <Typography variant="h6">
                    {employee?.employeeId}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Work sx={{ mr: 1, color: 'primary.main' }} />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Department
                  </Typography>
                  <Typography variant="h6">
                    {department?.name || 'N/A'}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AccessTime sx={{ mr: 1, color: 'primary.main' }} />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Position
                  </Typography>
                  <Typography variant="h6">
                    {position?.title || 'N/A'}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Current Day Attendance */}
      {currentAttendance && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Today's Attendance ({formatDate(currentAttendance.date)})
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Status
                  </Typography>
                  <Chip
                    label={currentAttendance.status}
                    color={getStatusColor(currentAttendance.status)}
                    size="small"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Check In
                  </Typography>
                  <Typography variant="h6">
                    {formatTime(currentAttendance.checkIn?.time)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Check Out
                  </Typography>
                  <Typography variant="h6">
                    {formatTime(currentAttendance.checkOut?.time)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Work Hours
                  </Typography>
                  <Typography variant="h6">
                    {currentAttendance.workHours || calculateWorkHours(currentAttendance.checkIn?.time, currentAttendance.checkOut?.time)} hrs
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Attendance History */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Attendance History (Last 30 Days)
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Check In</TableCell>
                  <TableCell>Check Out</TableCell>
                  <TableCell>Work Hours</TableCell>
                  <TableCell>Overtime</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {attendanceHistory.map((record) => (
                  <TableRow key={record._id} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(record.date)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.status}
                        color={getStatusColor(record.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatTime(record.checkIn?.time)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatTime(record.checkOut?.time)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {record.workHours || calculateWorkHours(record.checkIn?.time, record.checkOut?.time)} hrs
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color={record.overtimeHours > 0 ? 'warning.main' : 'textSecondary'}>
                        {record.overtimeHours > 0 ? `+${record.overtimeHours} hrs` : 'N/A'}
                      </Typography>
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
};

export default AttendanceDetail; 