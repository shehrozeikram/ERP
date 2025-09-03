import React, { useState, useEffect, useCallback } from 'react';
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
  TablePagination,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';

const AttendanceRecordDetail = () => {
  const [employee, setEmployee] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const navigate = useNavigate();
  const { employeeId } = useParams();

  // Fetch employee details and attendance history
  const fetchEmployeeDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Ensure employeeId is a string
      const id = typeof employeeId === 'object' ? employeeId.id || employeeId.toString() : employeeId;
      
      const response = await fetch(`/api/zkbio/zkbio/employees/${id}/attendance`);
      const result = await response.json();
      
      if (result.success) {
        console.log('🔍 API Response:', result.data);
        setEmployee(result.data.employee);
        setAttendanceHistory(result.data.attendance);
      } else {
        setError(result.message || 'Failed to fetch employee details');
      }
    } catch (error) {
      console.error('Error fetching employee details:', error);
      setError('Failed to connect to attendance system');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  // Auto-fetch on component mount
  useEffect(() => {
    if (employeeId) {
      fetchEmployeeDetail();
    }
  }, [employeeId, fetchEmployeeDetail]);

  // Pagination
  const paginatedAttendance = (attendanceHistory || []).slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    const timeValue = typeof time === 'object' ? time.toString() : time;
    return new Date(timeValue).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const dateValue = typeof date === 'object' ? date.toString() : date;
    return new Date(dateValue).toLocaleDateString();
  };

  if (!employeeId || (typeof employeeId === 'object' && !employeeId.id)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Employee ID is required</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          color="inherit"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('/hr/attendance-record');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <BackIcon sx={{ mr: 1 }} />
          Attendance Record
        </Link>
        <Typography color="text.primary">
          {employee?.fullName || `Employee ${typeof employeeId === 'object' ? employeeId.id || employeeId.toString() : employeeId}`}
        </Typography>
      </Breadcrumbs>

      {/* Employee Header */}
      {employee && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PersonIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            <Box>
              <Typography variant="h5" component="h1" gutterBottom>
                {typeof employee.fullName === 'object' ? employee.fullName.toString() : employee.fullName || `${typeof employee.firstName === 'object' ? employee.firstName.toString() : employee.firstName || ''} ${typeof employee.lastName === 'object' ? employee.lastName.toString() : employee.lastName || ''}`.trim() || 'Unknown Employee'}
              </Typography>
              <Typography variant="body1" color="textSecondary">
                Employee ID: {typeof employee.employeeId === 'object' ? employee.employeeId.id || employee.employeeId.toString() : employee.employeeId || 'N/A'}
              </Typography>
              {employee.department && (
                <Typography variant="body2" color="textSecondary">
                  Department: {typeof employee.department === 'object' ? employee.department.toString() : employee.department}
                </Typography>
              )}
            </Box>
          </Box>
        </Paper>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Attendance History Table */}
      <Paper>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">
            Attendance History ({(attendanceHistory || []).length} records)
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Check In Time</TableCell>
                <TableCell>Check Out Time</TableCell>
                <TableCell>Location</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3 }}>
                      <CircularProgress size={24} sx={{ mr: 2 }} />
                      <Typography variant="body2" color="textSecondary">
                        Loading attendance history...
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : paginatedAttendance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography variant="body2" color="textSecondary">
                      No attendance records found for this employee
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAttendance.map((record, index) => (
                  <TableRow key={`${typeof record.date === 'object' ? record.date.toString() : record.date}-${index}`} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(record.date)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color={record.checkIn ? 'success.main' : 'textSecondary'}>
                        {record.checkIn ? formatTime(record.checkIn) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color={record.checkOut ? 'info.main' : 'textSecondary'}>
                        {record.checkOut ? formatTime(record.checkOut) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {typeof record.location === 'object' ? record.location.toString() : record.location || 'N/A'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
                      <TablePagination
              rowsPerPageOptions={[10, 20, 50, 100]}
              component="div"
              count={(attendanceHistory || []).length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handlePageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default AttendanceRecordDetail;
