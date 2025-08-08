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
  Switch,
  FormControlLabel,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CheckCircle as ApproveIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  CalendarToday,
  Person,
  Work,
  Sync as SyncIcon,
  Fingerprint as BiometricIcon,
  Cancel as AbsentIcon,
  Wifi as WifiIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { PageLoading, TableSkeleton } from '../../components/LoadingSpinner';
import { formatAttendanceTime, formatLocalDate, isLateCheckIn, getTimeDifference } from '../../utils/timezoneHelper';
import RealTimeAttendance from '../../components/RealTimeAttendance';

const AttendanceList = () => {
  const [attendance, setAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [biometricIntegrations, setBiometricIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
  const [statistics, setStatistics] = useState({
    totalRecords: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    biometricRecords: 0
  });
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState('');
  const [syncDateRange, setSyncDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 1)),
    endDate: new Date()
  });
  const [activeTab, setActiveTab] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAttendance();
    fetchStatistics();
  }, [page, rowsPerPage, filters]);

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
    fetchBiometricIntegrations();
  }, []);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        latestOnly: 'true', // Show only latest records per employee
        ...filters
      });

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params.get(key) || params.get(key) === '' || params.get(key) === 'null') {
          params.delete(key);
        }
      });

      const response = await api.get(`/attendance?${params.toString()}`);

      if (response.data.success) {
        setAttendance(response.data.data);
        setTotalRecords(response.data.pagination?.total || 0);
      } else {
        setError('Failed to fetch attendance data');
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setError('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const params = new URLSearchParams({
        ...filters
      });

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params.get(key) || params.get(key) === '' || params.get(key) === 'null') {
          params.delete(key);
        }
      });

      const response = await api.get(`/attendance/statistics?${params}`);
      
      if (response.data.success) {
        setStatistics(response.data.data);
      } else {
        console.error('Statistics failed:', response.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/hr/employees?limit=1000');
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/hr/departments');
      if (response.data.success) {
        setDepartments(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchBiometricIntegrations = async () => {
    try {
      const response = await api.get('/biometric');
      if (response.data.success) {
        setBiometricIntegrations(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching biometric integrations:', error);
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
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPage(0);
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
    setPage(0);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/attendance/${selectedAttendance._id}`);
      setDeleteDialogOpen(false);
      setSelectedAttendance(null);
      fetchAttendance();
    } catch (error) {
      console.error('Error deleting attendance:', error);
      setError('Failed to delete attendance record');
    }
  };

  // Approval functionality removed - attendance is automatically approved based on biometric data

  const handleSyncBiometric = async () => {
    if (!selectedIntegration) {
      setError('Please select a biometric integration');
      return;
    }

    try {
      setSyncLoading(true);
      const response = await api.post('/attendance/sync-biometric', {
        integrationId: selectedIntegration,
        startDate: syncDateRange.startDate,
        endDate: syncDateRange.endDate
      });

      if (response.data.success) {
        setSyncDialogOpen(false);
        fetchAttendance();
        // Show success message
        setError(null);
      } else {
        setError('Failed to sync biometric attendance');
      }
    } catch (error) {
      console.error('Error syncing biometric attendance:', error);
      setError('Failed to sync biometric attendance');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSyncZKTeco = async () => {
    try {
      setSyncLoading(true);
      const response = await api.post('/attendance/sync-zkteco', {
        startDate: syncDateRange.startDate,
        endDate: syncDateRange.endDate
      });

      if (response.data.success) {
        setSyncDialogOpen(false);
        fetchAttendance();
        // Show success message
        setError(null);
      } else {
        setError('Failed to sync ZKTeco attendance');
      }
    } catch (error) {
      console.error('Error syncing ZKTeco attendance:', error);
      setError('Failed to sync ZKTeco attendance');
    } finally {
      setSyncLoading(false);
    }
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

  const formatTime = (time) => {
    return formatAttendanceTime(time);
  };

  const formatDate = (date) => {
    return formatLocalDate(date);
  };

  const calculateWorkHours = (checkInTime, checkOutTime) => {
    if (!checkInTime || !checkOutTime) return 0;
    
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const diffMs = checkOut - checkIn;
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.round(diffHours * 100) / 100;
  };

  const getWorkHoursDisplay = (record) => {
    if (record.workHours !== undefined && record.workHours !== null) {
      return `${record.workHours} hrs`;
    }
    
    // Calculate from check-in/check-out times if workHours not set
    const calculatedHours = calculateWorkHours(record.checkIn?.time, record.checkOut?.time);
    
    // Also show as time difference for better readability
    if (record.checkIn?.time && record.checkOut?.time) {
      const timeDiff = getTimeDifference(record.checkIn.time, record.checkOut.time);
      return calculatedHours > 0 ? `${calculatedHours} hrs (${timeDiff})` : timeDiff;
    }
    
    return calculatedHours > 0 ? `${calculatedHours} hrs` : 'N/A';
  };

  const getStatusDisplay = (record) => {
    if (record.status) {
      return record.status;
    }

    // Calculate status based on check-in time in Pakistan timezone
    if (record.checkIn?.time) {
      if (isLateCheckIn(record.checkIn.time)) {
        return 'Late';
      } else {
        return 'Present';
      }
    }

    return 'Unknown';
  };

  if (loading) {
    return <PageLoading skeletonType="table" />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">
            Attendance Management
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            Latest attendance records per employee
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<SyncIcon />}
            onClick={() => setSyncDialogOpen(true)}
            sx={{ mr: 1 }}
          >
            Sync Biometric
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/attendance/create')}
          >
            Add Attendance
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CalendarToday sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Total Records
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {statistics.totalRecords}
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
                    {statistics.presentToday}
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
                    {statistics.lateToday}
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
                    {statistics.absentToday}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SyncIcon sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Biometric Records
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {statistics.biometricRecords}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Attendance Records" icon={<CalendarToday />} />
          <Tab label="Real-Time Attendance" icon={<WifiIcon />} />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box>

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
                  {departments.map((dept) => (
                    <MenuItem key={dept._id} value={dept._id}>
                      {dept.name}
                    </MenuItem>
                  ))}
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
            {/* Approval filter removed - attendance is automatically approved based on biometric data */}
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
              <TableCell>Check In</TableCell>
              <TableCell>Check Out</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Work Hours</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {attendance.map((record) => (
              <TableRow key={record._id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {record.employee?.firstName} {record.employee?.lastName}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {record.employee?.employeeId}
                    </Typography>
                    {record.employee?.department && (
                      <Typography variant="caption" color="textSecondary" display="block">
                        {typeof record.employee.department === 'string' 
                          ? record.employee.department 
                          : record.employee.department?.name || 'N/A'
                        }
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(record.date)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2">
                      {formatTime(record.checkIn?.time)}
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
                    {record.overtimeHours > 0 && (
                      <Typography variant="caption" color="warning.main">
                        +{record.overtimeHours} OT
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2">
                      {record.checkIn?.method || record.checkOut?.method || 'Manual'}
                    </Typography>
                    {record.checkIn?.deviceId && (
                      <Typography variant="caption" color="textSecondary">
                        {record.checkIn.deviceId}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/hr/attendance/employee/${record.employee._id}/detail`)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/hr/attendance/${record._id}/edit`)}
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
            ))}
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
        </Box>
      )}

      {/* Sync Dialog */}
      <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Sync Biometric Attendance</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Biometric Integration</InputLabel>
                <Select
                  value={selectedIntegration}
                  onChange={(e) => setSelectedIntegration(e.target.value)}
                  label="Biometric Integration"
                >
                  <MenuItem value="">Select Integration</MenuItem>
                  {biometricIntegrations.map((integration) => (
                    <MenuItem key={integration._id} value={integration._id}>
                      {integration.systemName} - {integration.integrationType}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={syncDateRange.startDate}
                  onChange={(newValue) => setSyncDateRange(prev => ({ ...prev, startDate: newValue }))}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={syncDateRange.endDate}
                  onChange={(newValue) => setSyncDateRange(prev => ({ ...prev, endDate: newValue }))}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSyncZKTeco}
            variant="contained"
            disabled={syncLoading}
            startIcon={syncLoading ? <CircularProgress size={20} /> : <SyncIcon />}
          >
            Sync ZKTeco
          </Button>
          <Button
            onClick={handleSyncBiometric}
            variant="contained"
            disabled={syncLoading || !selectedIntegration}
            startIcon={syncLoading ? <CircularProgress size={20} /> : <BiometricIcon />}
          >
            Sync Biometric
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* Real-time Attendance Tab */}
      {activeTab === 1 && (
        <RealTimeAttendance />
      )}
    </Box>
  );
};

export default AttendanceList; 