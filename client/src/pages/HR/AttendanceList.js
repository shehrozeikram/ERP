import React, { useState, useEffect, useRef } from 'react';
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
  Tab,
  Badge
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
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import realtimeAttendanceService from '../../services/realtimeAttendanceService';
import { PageLoading, TableSkeleton } from '../../components/LoadingSpinner';
import { formatAttendanceTime, formatLocalDate, isLateCheckIn, getTimeDifference } from '../../utils/timezoneHelper';

const AttendanceList = () => {
  const [attendance, setAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [biometricIntegrations, setBiometricIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [realTimeError, setRealTimeError] = useState(null);
  const removeListenerRef = useRef(null);
  const navigate = useNavigate();

  // Handle real-time attendance updates
  const handleRealTimeAttendanceUpdate = (attendanceData) => {
    try {
      console.log('🔄 Processing real-time attendance update:', attendanceData);
      
      // Handle different types of attendance updates from Change Streams
      if (attendanceData.type === 'attendance_added') {
        // New attendance record
        const newRecord = attendanceData.data;
        console.log('➕ New attendance record received:', newRecord);
        
        setAttendance(prevAttendance => {
          // Check if record already exists to prevent duplicates
          const recordExists = prevAttendance.some(record => record._id === newRecord._id);
          if (recordExists) {
            console.log('⚠️ Record already exists, skipping duplicate');
            return prevAttendance;
          }
          
          const updatedAttendance = [newRecord, ...prevAttendance];
          console.log('🔄 Updated attendance count:', updatedAttendance.length);
          return updatedAttendance;
        });
        
        // Show notification
        if (newRecord.employee) {
          const employeeName = `${newRecord.employee.firstName} ${newRecord.employee.lastName}`;
          const action = newRecord.checkIn ? 'checked in' : 'checked out';
          const time = newRecord.checkIn?.time || newRecord.checkOut?.time;
          const timeStr = time ? new Date(time).toLocaleTimeString() : 'now';
          
          showRealTimeNotification({
            employeeName,
            isCheckIn: !!newRecord.checkIn,
            timestamp: time,
            localTimestamp: time
          });
        }
        
      } else if (attendanceData.type === 'attendance_updated') {
        // Updated attendance record
        const updatedRecord = attendanceData.data;
        console.log('✏️ Attendance record updated:', updatedRecord);
        
        setAttendance(prevAttendance => {
          const updatedAttendance = prevAttendance.map(record => 
            record._id === updatedRecord._id ? updatedRecord : record
          );
          console.log('🔄 Updated attendance count:', updatedAttendance.length);
          return updatedAttendance;
        });
        
      } else if (attendanceData.type === 'attendance_deleted') {
        // Deleted attendance record
        const deletedId = attendanceData.data._id;
        console.log('🗑️ Attendance record deleted:', deletedId);
        
        setAttendance(prevAttendance => {
          const updatedAttendance = prevAttendance.filter(record => record._id !== deletedId);
          console.log('🔄 Updated attendance count:', updatedAttendance.length);
          return updatedAttendance;
        });
      }
      
      // Refresh statistics
      fetchStatistics();
      
      console.log('✅ Real-time attendance update completed successfully');
      
    } catch (error) {
      console.error('❌ Error processing real-time attendance update:', error);
    }
  };

  // Show notification for real-time updates
  const showRealTimeNotification = (attendanceData) => {
    const action = attendanceData.isCheckIn ? 'checked in' : 'checked out';
    
    // Use the formatted timestamp directly if available, or parse localTimestamp
    const time = attendanceData.localTimestamp ? 
      new Date(attendanceData.localTimestamp).toLocaleTimeString() : 
      (typeof attendanceData.timestamp === 'string' && attendanceData.timestamp.includes(',') ? 
        attendanceData.timestamp.split(',')[1]?.trim() || attendanceData.timestamp : 
        new Date(attendanceData.timestamp).toLocaleTimeString());
    
    const message = `${attendanceData.employeeName} ${action} at ${time}`;
    
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Attendance Update', {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });
    }
    
    // Console log for debugging
    console.log(`🔔 Real-time notification: ${message}`);
  };

  // Initialize real-time connection
  const initializeRealTime = async () => {
    if (!isRealTimeEnabled || activeTab !== 0) {
      console.log('⏭️ Skipping real-time initialization - disabled or not on attendance tab');
      return;
    }
    
    // Prevent multiple initializations
    if (removeListenerRef.current) {
      console.log('⏭️ Real-time already initialized, skipping');
      return;
    }
    
    try {
      console.log('🔍 Initializing real-time connection...');
      
      // Connect to real-time service
      console.log('🔌 Connecting to real-time attendance service...');
      realtimeAttendanceService.connect();
      
      // Add listeners for real-time events
      console.log('👂 Adding real-time event listeners...');
      
      // Connection status listener
      removeListenerRef.current = realtimeAttendanceService.addListener('connection_status', (data) => {
        console.log('📡 Connection status update:', data);
        if (data.status === 'connected') {
          setIsConnected(true);
          setConnectionStatus('connected');
          setRealTimeError(null);
        } else if (data.status === 'disconnected' || data.status === 'error') {
          setIsConnected(false);
          setConnectionStatus('disconnected');
          setRealTimeError(data.message || 'Connection lost');
        }
      });
      
      // Attendance update listener
      const attendanceListener = realtimeAttendanceService.addListener('attendance_update', (data) => {
        console.log('📊 Attendance update received:', data);
        handleRealTimeAttendanceUpdate(data);
      });
      
      // Room joined listener
      const roomListener = realtimeAttendanceService.addListener('room_joined', (data) => {
        console.log('👥 Room joined:', data);
      });
      
      // Store all listeners for cleanup
      removeListenerRef.current = () => {
        attendanceListener();
        roomListener();
      };
      
      console.log('✅ Real-time initialization completed');
      
    } catch (error) {
      console.error('❌ Error initializing real-time connection:', error);
      setRealTimeError('Failed to initialize real-time connection');
    }
  };

  useEffect(() => {
    fetchAttendance();
    fetchStatistics();
    fetchEmployees();
    fetchDepartments();
    fetchBiometricIntegrations();
  }, [page, rowsPerPage, filters]);

  // Real-time connection management
  useEffect(() => {
    if (isRealTimeEnabled && activeTab === 0) {
      initializeRealTime();
    } else {
      // Remove listener but don't disconnect global WebSocket
      if (removeListenerRef.current) {
        removeListenerRef.current();
        removeListenerRef.current = null;
      }
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }

    // Cleanup on unmount
    return () => {
      if (removeListenerRef.current) {
        removeListenerRef.current();
        removeListenerRef.current = null;
      }
      // Disconnect from real-time service
      realtimeAttendanceService.disconnect();
      console.log('🧹 Cleaned up real-time connection');
    };
  }, [isRealTimeEnabled, activeTab]);

  // Check connection status periodically
  useEffect(() => {
      // Check connection status every 5 seconds
      if (isRealTimeEnabled && activeTab === 0) {
        const checkConnection = () => {
          const connected = realtimeAttendanceService.getConnectionStatus().isConnected;
          setIsConnected(connected);
          setConnectionStatus(connected ? 'connected' : 'disconnected');
        };
        
        const connectionInterval = setInterval(checkConnection, 5000);
        return () => clearInterval(connectionInterval);
      }
  }, [isRealTimeEnabled, activeTab]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        latestOnly: 'false', // Show all records to see most recent updates
                   sortBy: 'date', // Sort by date to get today's records first
        sortOrder: 'desc', // Most recent first
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
      setError(null);
      setSuccess(null);
      
      const response = await api.post('/attendance/sync-zkteco', {
        startDate: syncDateRange.startDate,
        endDate: syncDateRange.endDate
      });

      if (response.data.success) {
        setSyncDialogOpen(false);
        
        // Show success message with sync results
        const { data } = response.data;
        const message = `ZKTeco sync completed successfully! Processed: ${data.processed}, Created: ${data.created}, Updated: ${data.updated}, Errors: ${data.errors}`;
        
        // Update the attendance list
        fetchAttendance();
        fetchStatistics();
        
        // Show success message
        setSuccess(message);
        setError(null);
        
        console.log('✅ ZKTeco sync completed:', data);
      } else {
        setError(response.data.message || 'Failed to sync ZKTeco attendance');
        setSuccess(null);
      }
    } catch (error) {
      console.error('Error syncing ZKTeco attendance:', error);
      setError(error.response?.data?.message || 'Failed to sync ZKTeco attendance');
      setSuccess(null);
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
        <Typography variant="h4" component="h1" gutterBottom>
          Attendance Management
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Real-time Status Indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isRealTimeEnabled}
                  onChange={(e) => setIsRealTimeEnabled(e.target.checked)}
                  color="primary"
                />
              }
              label="Real-time"
            />
            <Tooltip title={isConnected ? 'Connected to real-time service' : 'Disconnected from real-time service'}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {isConnected ? (
                  <WifiIcon color="success" />
                ) : (
                  <WifiOffIcon color="error" />
                )}
                <Typography variant="caption" color={isConnected ? 'success.main' : 'error.main'}>
                  {isConnected ? 'Live' : 'Offline'}
                </Typography>
              </Box>
            </Tooltip>
            {lastUpdate && (
              <Typography variant="caption" color="textSecondary">
                Last: {lastUpdate.toLocaleTimeString()}
              </Typography>
            )}
          </Box>
          
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

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Real-time Status Alerts */}
      {realTimeError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setRealTimeError(null)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WifiOffIcon />
            <Typography>
              Real-time connection issue: {realTimeError}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={async () => {
                setRealTimeError(null);
                await initializeRealTime();
              }}
              sx={{ ml: 2 }}
            >
              Retry Connection
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={async () => {
                setRealTimeError(null);
                try {
                  const response = await api.post('/zkteco-push/start');
                  if (response.data.success) {
                    await initializeRealTime();
                  } else {
                    setRealTimeError('Failed to start ZKTeco Push service manually.');
                  }
                } catch (error) {
                  setRealTimeError('Failed to start ZKTeco Push service manually.');
                }
              }}
              sx={{ ml: 1 }}
            >
              Start Service
            </Button>
          </Box>
        </Alert>
      )}

      {isConnected && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => {}}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WifiIcon />
            <Typography>
              Real-time attendance is active. New check-ins/outs will appear automatically.
            </Typography>
          </Box>
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
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarToday />
                <Typography>Attendance Records</Typography>
                {isRealTimeEnabled && isConnected && (
                  <Badge color="success" variant="dot" />
                )}
              </Box>
            } 
          />
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
            {attendance.map((record) => (
              <TableRow 
                key={record._id} 
                hover
                sx={{
                  ...(record._id?.startsWith('realtime_') && {
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    '&:hover': {
                      backgroundColor: 'rgba(76, 175, 80, 0.2)',
                    }
                  })
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                    {record._id?.startsWith('realtime_') && (
                      <Tooltip title="Real-time update">
                        <Badge color="success" variant="dot" />
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(record.date)}
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
    </Box>
  );
};

export default AttendanceList; 