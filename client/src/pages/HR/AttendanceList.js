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
  TablePagination,
  IconButton,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  Fab,
  Card,
  CardContent,
  Grid,
  Badge
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CheckCircle as ApproveIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Person,
  Work,
  Cancel as AbsentIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
// Real-time attendance service removed as requested

const AttendanceList = () => {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filters, setFilters] = useState({
    employee: '',
    department: '',
    status: '',
    startDate: '',
    endDate: '',
    isApproved: ''
  });
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  // Sync-related state variables removed as requested

  // Attendance data state
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  


  const navigate = useNavigate();

  // Initialize attendance data
  useEffect(() => {
    fetchAttendanceData();
  }, []);

  // Real-time attendance functions removed as requested



  // Essential functions for component functionality
  // Get latest 5 attendance records from TODAY only
  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Fetching today\'s latest attendance from ZKTeco...');
      
      const response = await api.get('/biometric/zkteco/attendance');
      console.log('📊 Full ZKTeco Response:', response.data);
      
      if (response.data.success) {
        const allRecords = response.data.data?.data || [];
        console.log('📋 All records count:', allRecords.length);
        
        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        console.log('📅 Today\'s date:', today);
        
        // Filter for today's records only
        const todaysRecords = allRecords.filter(record => {
          if (record.recordTime) {
            const recordDate = new Date(record.recordTime).toISOString().split('T')[0];
            return recordDate === today;
          }
          return false;
        });
        
        console.log('📅 Today\'s records count:', todaysRecords.length);
        
        // Sort by time (latest first) and get first 5
        const latest5Today = todaysRecords
          .sort((a, b) => new Date(b.recordTime) - new Date(a.recordTime))
          .slice(0, 5);
        
        console.log('🔢 Latest 5 from today:', latest5Today);
        
        setAttendance(latest5Today);
        setTotalRecords(latest5Today.length);
        setSuccess(`Fetched latest 5 attendance records from today`);
      } else {
        setError('Failed to fetch attendance data');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      setError('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      employee: '',
      department: '',
      status: '',
      startDate: '',
      endDate: '',
      isApproved: ''
    });
  };

  const handleDelete = async () => {
    if (!selectedAttendance) return;
    
    try {
      setLoading(true);
      const response = await api.delete(`/attendance/${selectedAttendance._id}`);
      
      if (response.data.success) {
        setSuccess('Attendance record deleted successfully');
        // Remove the deleted record from the list
        setAttendance(prev => prev.filter(record => record._id !== selectedAttendance._id));
        setTotalRecords(prev => Math.max(0, prev - 1));
        setSelectedAttendance(null);
        setDeleteDialogOpen(false);
      } else {
        setError(response.data.message || 'Failed to delete attendance record');
      }
    } catch (error) {
      console.error('Error deleting attendance record:', error);
      setError('Failed to delete attendance record');
    } finally {
      setLoading(false);
    }
  };

  // Sync functions removed as requested

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present':
        return 'success';
      case 'Absent':
        return 'error';
      case 'Late':
        return 'warning';
      case 'Leave':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    return new Date(time).toLocaleTimeString();
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const calculateWorkHours = (checkInTime, checkOutTime) => {
    if (!checkInTime || !checkOutTime) return 0;
    const diff = new Date(checkOutTime) - new Date(checkInTime);
    return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
  };

  const getWorkHoursDisplay = (record) => {
    if (!record.checkIn?.time || !record.checkOut?.time) return 'N/A';
    const hours = calculateWorkHours(record.checkIn.time, record.checkOut.time);
    return `${hours}h`;
  };

  const getStatusDisplay = (record) => {
    if (record.status) return record.status;
    if (record.checkIn?.time && record.checkOut?.time) return 'Present';
    if (record.checkIn?.time) return 'Present';
    return 'Absent';
  };

  // Simple attendance fetcher
  const getTodayAttendance = () => fetchAttendanceData();

  return (
    <Box sx={{ p: 3 }}>
      {/* Real-Time Status Banner */}
      {/* REMOVED - Real-time status banner as real-time service is removed */}

      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Attendance Management
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Button
          variant="contained"
          onClick={getTodayAttendance}
          disabled={loading}
          sx={{ mr: 1 }}
        >
          {loading ? 'Loading...' : 'Get Attendance'}
        </Button>
        </Box>
      </Box>

      {/* Debug Panel removed as requested - no longer needed without real-time functionality */}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}



      {/* Real-Time Status */}
      {/* REMOVED - Real-time status alert as real-time service is removed */}



      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Person sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Total Records
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {totalRecords}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Person sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Present Today
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {attendance.filter(r => getStatusDisplay(r) === 'Present').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', color: 'white' }}>
            <CardContent>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Work sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Late Today
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {attendance.filter(r => getStatusDisplay(r) === 'Late').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AbsentIcon sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Absent Today
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {attendance.filter(r => getStatusDisplay(r) === 'Absent').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                label="Search Employee"
                value={filters.employee || ''}
                onChange={(e) => handleFilterChange('employee', e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select
                  value={filters.department || ''}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                  label="Department"
                >
                  <MenuItem value="">All Departments</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="Present">Present</MenuItem>
                  <MenuItem value="Absent">Absent</MenuItem>
                  <MenuItem value="Late">Late</MenuItem>
                  <MenuItem value="Leave">Leave</MenuItem>
                  <MenuItem value="Sick Leave">Sick Leave</MenuItem>
                  <MenuItem value="Personal Leave">Personal Leave</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                onClick={clearFilters}
                size="small"
                fullWidth
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell>Check In</TableCell>
              <TableCell>Check Out</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Work Hours</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <CircularProgress size={24} />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Loading attendance records...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : attendance.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No attendance records found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              attendance.map((record, index) => (
                <TableRow key={`${record.deviceUserId || record.userId || record.uid || index}-${record.recordTime || Date.now()}-${index}`} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {record.employee?.firstName || record.employee?.lastName || record.name || record.userName || record.fullName || `User ${record.deviceUserId || record.userId || record.uid || 'Unknown'}`}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {record.employee?.employeeId || record.deviceUserId || record.userId || record.uid || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(record.date) || (record.recordTime ? new Date(record.recordTime).toLocaleDateString() : 'N/A')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {record.updatedAt ? new Date(record.updatedAt).toLocaleDateString() : 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {record.updatedAt ? new Date(record.updatedAt).toLocaleTimeString() : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {formatTime(record.checkIn?.time) || (record.recordTime ? new Date(record.recordTime).toLocaleTimeString() : 'N/A')}
                      </Typography>
                      {record.checkIn?.location && (
                        <Typography variant="caption" color="textSecondary">
                          {record.checkIn.location}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {formatTime(record.checkOut?.time)}
                      </Typography>
                      {record.checkOut?.location && (
                        <Typography variant="caption" color="textSecondary">
                          {record.checkOut.location}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusDisplay(record)}
                      color={getStatusColor(getStatusDisplay(record))}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {getWorkHoursDisplay(record)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {record.checkIn?.method || record.checkOut?.method || 'Manual'}
                      </Typography>
                      {record.deviceType && (
                        <Typography variant="caption" color="textSecondary">
                          {record.deviceType}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/hr/attendance/employee/${record.employee?._id || record.deviceUserId || record.userId || record.uid}/detail`)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/hr/attendance/${record._id || record.uid || record.userId || record.deviceUserId}/edit`)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedAttendance(record);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalRecords}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </TableContainer>

      {/* Sync Dialog removed as requested - no longer accessible without sync buttons */}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Attendance Record</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this attendance record? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AttendanceList; 