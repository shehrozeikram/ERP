import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Science as TestIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../../services/authService';

const BiometricIntegration = () => {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [supportedSystems, setSupportedSystems] = useState([]);
  const [zktecoData, setZktecoData] = useState(null);
  const [zktecoLoading, setZktecoLoading] = useState(false);
  const [zktecoUsers, setZktecoUsers] = useState([]);
  const [zktecoUsersLoading, setZktecoUsersLoading] = useState(false);
  const [showZktecoUsers, setShowZktecoUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // Role mapping for ZKTeco devices
  const getRoleName = (roleId) => {
    const roleMap = {
      0: 'User',
      1: 'Admin',
      2: 'Manager',
      3: 'Supervisor',
      4: 'Operator',
      5: 'Guest',
      6: 'Visitor',
      7: 'Contractor',
      8: 'Temporary',
      9: 'Intern',
      10: 'Trainee',
      11: 'Consultant',
      12: 'Vendor',
      13: 'Client',
      14: 'Administrator',
      15: 'System Admin'
    };
    return roleMap[roleId] || `Role ${roleId}`;
  };

  // Form state
  const [formData, setFormData] = useState({
    systemName: '',
    integrationType: '',
    isActive: true,
    apiConfig: {
      baseUrl: '',
      apiKey: '',
      username: '',
      password: '',
      endpoints: {
        attendance: '',
        employees: '',
        devices: ''
      }
    },
    dbConfig: {
      host: '',
      port: 3306,
      database: '',
      username: '',
      password: '',
      tableName: ''
    },
    fileConfig: {
      importPath: '',
      fileFormat: 'CSV',
      delimiter: ',',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:mm:ss',
      columnMapping: {
        employeeId: '',
        date: '',
        time: '',
        deviceId: '',
        direction: ''
      }
    },
    syncConfig: {
      autoSync: false,
      syncInterval: 15
    }
  });

  // Sync form state
  const [syncData, setSyncData] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 1)),
    endDate: new Date()
  });

  useEffect(() => {
    fetchIntegrations();
    fetchSupportedSystems();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/biometric');
      setIntegrations(response.data.data);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      setError('Failed to load biometric integrations');
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportedSystems = async () => {
    try {
      const response = await api.get('/biometric/systems/supported');
      setSupportedSystems(response.data.data);
    } catch (error) {
      console.error('Error fetching supported systems:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedInputChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  const handleSubmit = async () => {
    try {
      if (editingIntegration) {
        await api.put(`/biometric/${editingIntegration._id}`, formData);
      } else {
        await api.post('/biometric', formData);
      }
      
      setDialogOpen(false);
      setEditingIntegration(null);
      resetForm();
      fetchIntegrations();
    } catch (error) {
      console.error('Error saving integration:', error);
      setError(error.response?.data?.message || 'Failed to save integration');
    }
  };

  const handleDelete = async (integration) => {
    if (window.confirm('Are you sure you want to delete this integration?')) {
      try {
        await api.delete(`/biometric/${integration._id}`);
        fetchIntegrations();
      } catch (error) {
        console.error('Error deleting integration:', error);
        setError('Failed to delete integration');
      }
    }
  };

  const handleTestConnection = async (integration) => {
    try {
      setTestLoading(true);
      const response = await api.post(`/biometric/${integration._id}/test`);
      alert(response.data.data.message);
    } catch (error) {
      console.error('Error testing connection:', error);
      alert('Connection test failed');
    } finally {
      setTestLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncLoading(true);
      const response = await api.post(`/biometric/${selectedIntegration._id}/sync`, syncData);
      alert(`Sync completed! ${response.data.data.created} created, ${response.data.data.updated} updated`);
      setSyncDialogOpen(false);
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Sync failed');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleAutoSync = async (integration, start) => {
    try {
      const endpoint = start ? 'start' : 'stop';
      await api.post(`/biometric/${integration._id}/auto-sync/${endpoint}`);
      fetchIntegrations();
    } catch (error) {
      console.error('Error toggling auto-sync:', error);
      alert('Failed to toggle auto-sync');
    }
  };

  const resetForm = () => {
    setFormData({
      systemName: '',
      integrationType: '',
      isActive: true,
      apiConfig: {
        baseUrl: '',
        apiKey: '',
        username: '',
        password: '',
        endpoints: {
          attendance: '',
          employees: '',
          devices: ''
        }
      },
      dbConfig: {
        host: '',
        port: 3306,
        database: '',
        username: '',
        password: '',
        tableName: ''
      },
      fileConfig: {
        importPath: '',
        fileFormat: 'CSV',
        delimiter: ',',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm:ss',
        columnMapping: {
          employeeId: '',
          date: '',
          time: '',
          deviceId: '',
          direction: ''
        }
      },
      syncConfig: {
        autoSync: false,
        syncInterval: 15
      }
    });
  };

  const openEditDialog = (integration) => {
    setEditingIntegration(integration);
    setFormData(integration);
    setDialogOpen(true);
  };

  const openSyncDialog = (integration) => {
    setSelectedIntegration(integration);
    setSyncDialogOpen(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  // ZKTeco specific functions
  const testZktecoConnection = async () => {
    setZktecoLoading(true);
    clearZktecoUsers(); // Clear and hide users section
    try {
      const response = await api.get('/biometric/zkteco/test-connection');
      setZktecoData(response.data);
      setSnackbar({
        open: true,
        message: 'ZKTeco connection test completed successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('ZKTeco connection test failed:', error);
      setError('Failed to test ZKTeco connection');
      setSnackbar({
        open: true,
        message: 'Failed to test ZKTeco connection',
        severity: 'error'
      });
    } finally {
      setZktecoLoading(false);
    }
  };

  const getZktecoDeviceInfo = async () => {
    setZktecoLoading(true);
    clearZktecoUsers(); // Clear and hide users section
    try {
      const response = await api.get('/biometric/zkteco/info');
      setZktecoData(response.data);
      setSnackbar({
        open: true,
        message: 'Device information retrieved successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to get ZKTeco device info:', error);
      setError('Failed to get device information');
      setSnackbar({
        open: true,
        message: 'Failed to get device information',
        severity: 'error'
      });
    } finally {
      setZktecoLoading(false);
    }
  };

  const getZktecoAttendance = async () => {
    setZktecoLoading(true);
    clearZktecoUsers(); // Clear and hide users section
    setUserSearchTerm(''); // Clear user search term
    try {
      const response = await api.get('/biometric/zkteco/attendance');
      setZktecoData(response.data);
      
      // Handle nested data structure: response.data.data.data
      const attendanceData = response.data.data;
      const attendanceRecords = attendanceData?.data || [];
      const recordCount = Array.isArray(attendanceRecords) ? attendanceRecords.length : 0;
      
      setSnackbar({
        open: true,
        message: `Retrieved ${recordCount} attendance records`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to get ZKTeco attendance:', error);
      setError('Failed to get attendance data');
      setSnackbar({
        open: true,
        message: 'Failed to get attendance data',
        severity: 'error'
      });
    } finally {
      setZktecoLoading(false);
    }
  };

  const syncZktecoAttendance = async () => {
    setZktecoLoading(true);
    clearZktecoUsers(); // Clear and hide users section
    try {
      const response = await api.post('/biometric/zkteco/sync-attendance');
      setZktecoData(response.data);
      setSnackbar({
        open: true,
        message: `Successfully synced ${response.data.data?.syncedRecords || 0} attendance records to database`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to sync ZKTeco attendance:', error);
      setError('Failed to sync attendance data');
      setSnackbar({
        open: true,
        message: 'Failed to sync attendance data',
        severity: 'error'
      });
    } finally {
      setZktecoLoading(false);
    }
  };

  // Get all users from ZKTeco device
  const getZktecoUsers = async () => {
    setZktecoUsersLoading(true);
    setZktecoData(null); // Clear any existing data to show only users
    try {
      const response = await api.get('/biometric/zkteco/users');
      const usersData = response.data.data;
      
      // Handle nested data structure: response.data.data.data
      const usersArray = usersData?.data || [];
      
      setZktecoUsers(usersArray);
      setShowZktecoUsers(true); // Show the users section
      
      const message = response.data.message || `Successfully fetched ${usersData.count || usersArray.length} users from ZKTeco device`;
      setSnackbar({
        open: true,
        message: message,
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to get ZKTeco users:', error);
      setError('Failed to get users from ZKTeco device');
      setSnackbar({
        open: true,
        message: 'Failed to get users from ZKTeco device',
        severity: 'error'
      });
    } finally {
      setZktecoUsersLoading(false);
    }
  };

  // Clear ZKTeco users display
  const clearZktecoUsers = () => {
    setZktecoUsers([]);
    setShowZktecoUsers(false);
    setUserSearchTerm(''); // Clear search term
    setAttendanceSearchTerm(''); // Clear attendance search term
  };

  // Filter users based on search term
  const getFilteredUsers = () => {
    if (!userSearchTerm.trim()) {
      return zktecoUsers;
    }
    
    const searchTerm = userSearchTerm.toLowerCase().trim();
    return zktecoUsers.filter(user => {
      const name = (user.name || user.userName || user.fullName || '').toLowerCase();
      const externalId = (user.userId || user.deviceUserId || '').toLowerCase();
      const uid = (user.uid || '').toString().toLowerCase();
      
      return name.includes(searchTerm) || 
             externalId.includes(searchTerm) || 
             uid.includes(searchTerm);
    });
  };

  // Filter attendance data based on search term
  const getFilteredAttendance = () => {
    if (!zktecoData?.data?.data || !Array.isArray(zktecoData.data.data)) {
      return [];
    }
    
    if (!attendanceSearchTerm.trim()) {
      return zktecoData.data.data;
    }
    
    const searchTerm = attendanceSearchTerm.toLowerCase().trim();
    return zktecoData.data.data.filter(record => {
      const userId = (record.deviceUserId || record.userId || record.uid || '').toLowerCase();
      const userSn = (record.userSn || '').toString().toLowerCase();
      
      return userId.includes(searchTerm) || userSn.includes(searchTerm);
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Biometric Integration
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingIntegration(null);
            resetForm();
            setDialogOpen(true);
          }}
        >
          Add Integration
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {integrations.map((integration) => (
          <Grid item xs={12} md={6} lg={4} key={integration._id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {integration.systemName}
                    </Typography>
                    <Chip 
                      label={integration.integrationType} 
                      size="small" 
                      color="primary" 
                      sx={{ mr: 1 }}
                    />
                    <Chip 
                      label={integration.isActive ? 'Active' : 'Inactive'} 
                      size="small" 
                      color={integration.isActive ? 'success' : 'default'}
                    />
                  </Box>
                  <Box>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(integration)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDelete(integration)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Sync Status
                  </Typography>
                  <Chip 
                    label={integration.syncConfig?.syncStatus || 'idle'} 
                    size="small" 
                    color={getStatusColor(integration.syncConfig?.syncStatus)}
                  />
                </Box>

                {integration.syncConfig?.lastSyncAt && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Last Sync: {new Date(integration.syncConfig.lastSyncAt).toLocaleString()}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<TestIcon />}
                    onClick={() => handleTestConnection(integration)}
                    disabled={testLoading}
                  >
                    Test
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SyncIcon />}
                    onClick={() => openSyncDialog(integration)}
                  >
                    Sync
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={integration.syncConfig?.autoSync ? <StopIcon /> : <StartIcon />}
                    onClick={() => handleAutoSync(integration, !integration.syncConfig?.autoSync)}
                  >
                    {integration.syncConfig?.autoSync ? 'Stop Auto' : 'Start Auto'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ZKTeco Device Section */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          ZKTeco Device (splaza.nayatel.net)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Direct connection to ZKTeco biometric device for real-time data access and synchronization.
        </Typography>

        {/* ZKTeco Control Buttons */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item>
            <Button
              variant="outlined"
              startIcon={<TestIcon />}
              onClick={testZktecoConnection}
              disabled={zktecoLoading}
            >
              {zktecoLoading ? <CircularProgress size={20} /> : 'Test Connection'}
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              startIcon={<InfoIcon />}
              onClick={getZktecoDeviceInfo}
              disabled={zktecoLoading}
            >
              {zktecoLoading ? <CircularProgress size={20} /> : 'Device Info'}
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              startIcon={<SyncIcon />}
              onClick={getZktecoUsers}
              disabled={zktecoUsersLoading}
            >
              {zktecoUsersLoading ? <CircularProgress size={20} /> : 'Get All Users'}
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={getZktecoAttendance}
              disabled={zktecoLoading}
            >
              {zktecoLoading ? <CircularProgress size={20} /> : 'Get Attendance'}
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<SyncIcon />}
              onClick={syncZktecoAttendance}
              disabled={zktecoLoading}
            >
              {zktecoLoading ? <CircularProgress size={20} /> : 'Sync to Database'}
            </Button>
          </Grid>
        </Grid>

        {/* ZKTeco Data Display */}
        {zktecoData && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {zktecoData.data?.data ? 'Attendance Data' : 'Device Information'}
              </Typography>
              
              {/* If it's attendance data, display it in a more user-friendly way */}
              {zktecoData.data?.data && Array.isArray(zktecoData.data.data) ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Total Records: {getFilteredAttendance().length}
                  </Typography>
                  
                  {/* Search Field for Attendance */}
                  <Box sx={{ mb: 3 }}>
                    <TextField
                      fullWidth
                      variant="outlined"
                      placeholder="Search by user ID or serial number..."
                      value={attendanceSearchTerm}
                      onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                        endAdornment: attendanceSearchTerm && (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => setAttendanceSearchTerm('')}
                            >
                              <ClearIcon />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                      size="small"
                    />
                  </Box>
                  
                  {/* Show first few records in a table format */}
                  <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
                    <Grid container spacing={1}>
                      {getFilteredAttendance().slice(0, 10).map((record, index) => (
                        <Grid item xs={12} key={index}>
                          <Card variant="outlined" sx={{ p: 1 }}>
                            <Grid container spacing={1}>
                              <Grid item xs={3}>
                                <Typography variant="caption" color="text.secondary">
                                  User ID:
                                </Typography>
                                <Typography variant="body2">
                                  {record.deviceUserId || record.userId || record.uid || 'N/A'}
                                </Typography>
                              </Grid>
                              <Grid item xs={3}>
                                <Typography variant="caption" color="text.secondary">
                                  Record Time:
                                </Typography>
                                <Typography variant="body2">
                                  {record.recordTime ? new Date(record.recordTime).toLocaleString() : 'N/A'}
                                </Typography>
                              </Grid>
                              <Grid item xs={3}>
                                <Typography variant="caption" color="text.secondary">
                                  Serial No:
                                </Typography>
                                <Typography variant="body2">
                                  {record.userSn || 'N/A'}
                                </Typography>
                              </Grid>
                              <Grid item xs={3}>
                                <Typography variant="caption" color="text.secondary">
                                  IP:
                                </Typography>
                                <Typography variant="body2">
                                  {record.ip || 'N/A'}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                    
                    {getFilteredAttendance().length > 10 && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                        Showing first 10 records of {getFilteredAttendance().length} total records
                      </Typography>
                    )}
                  </Box>
                </Box>
              ) : (
                /* Show raw JSON for other data types */
                <pre style={{ 
                  backgroundColor: '#f5f5f5', 
                  padding: '10px', 
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '300px'
                }}>
                  {JSON.stringify(zktecoData, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        )}

        {/* ZKTeco Users Display */}
        {showZktecoUsers && zktecoUsers.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  ZKTeco Device Users ({getFilteredUsers().length})
                </Typography>
                <Chip 
                  label={`Total Users: ${getFilteredUsers().length}`} 
                  color="primary" 
                  variant="outlined"
                />
              </Box>
              
              {/* Search Field for Users */}
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Search by name, external ID, or user ID..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: userSearchTerm && (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setUserSearchTerm('')}
                        >
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  size="small"
                />
              </Box>
              
              <Grid container spacing={2}>
                {getFilteredUsers().map((user, index) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                    <Card variant="outlined">
                      <CardContent sx={{ p: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          User ID: {user.uid || user.userId || user.deviceUserId || user.id || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Name: {user.name || user.userName || user.fullName || `User ${user.uid || user.userId || user.deviceUserId || 'Unknown'}`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          External ID: {user.userId || user.deviceUserId || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Role: {getRoleName(user.role) || user.userRole || user.jobTitle || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Password: {user.password ? (user.password.length > 0 ? 'Set' : 'Not Set') : 'Not Set'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Card: {user.cardno || user.card || user.cardNo || user.cardNumber || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Group: {user.group || user.userGroup || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Time Zone: {user.timeZone || user.timezone || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Privilege: {user.privilege || user.userPrivilege || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Fingerprints: {user.fingerprints ? user.fingerprints.length : 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Faces: {user.faces ? user.faces.length : 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Status: {user.status || user.userStatus || 'Active'}
                        </Typography>
                        {user.attendanceCount && (
                          <Typography variant="body2" color="primary">
                            Attendance Count: {user.attendanceCount}
                          </Typography>
                        )}
                        {user.lastAttendance && (
                          <Typography variant="body2" color="text.secondary">
                            Last Attendance: {new Date(user.lastAttendance).toLocaleString()}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Add/Edit Integration Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingIntegration ? 'Edit Biometric Integration' : 'Add Biometric Integration'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>System</InputLabel>
                <Select
                  value={formData.systemName}
                  onChange={(e) => handleInputChange('systemName', e.target.value)}
                  label="System"
                >
                  {supportedSystems.map((system) => (
                    <MenuItem key={system.name} value={system.name}>
                      {system.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Integration Type</InputLabel>
                <Select
                  value={formData.integrationType}
                  onChange={(e) => handleInputChange('integrationType', e.target.value)}
                  label="Integration Type"
                >
                  <MenuItem value="API">API</MenuItem>
                  <MenuItem value="Database">Database</MenuItem>
                  <MenuItem value="FileImport">File Import</MenuItem>
                  <MenuItem value="Webhook">Webhook</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* API Configuration */}
            {formData.integrationType === 'API' && (
              <Grid item xs={12}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>API Configuration</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Base URL"
                          value={formData.apiConfig.baseUrl}
                          onChange={(e) => handleNestedInputChange('apiConfig', 'baseUrl', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="API Key"
                          value={formData.apiConfig.apiKey}
                          onChange={(e) => handleNestedInputChange('apiConfig', 'apiKey', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Username"
                          value={formData.apiConfig.username}
                          onChange={(e) => handleNestedInputChange('apiConfig', 'username', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Password"
                          type="password"
                          value={formData.apiConfig.password}
                          onChange={(e) => handleNestedInputChange('apiConfig', 'password', e.target.value)}
                        />
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            )}

            {/* Database Configuration */}
            {formData.integrationType === 'Database' && (
              <Grid item xs={12}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Database Configuration</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Host"
                          value={formData.dbConfig.host}
                          onChange={(e) => handleNestedInputChange('dbConfig', 'host', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Port"
                          type="number"
                          value={formData.dbConfig.port}
                          onChange={(e) => handleNestedInputChange('dbConfig', 'port', parseInt(e.target.value))}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Database"
                          value={formData.dbConfig.database}
                          onChange={(e) => handleNestedInputChange('dbConfig', 'database', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Table Name"
                          value={formData.dbConfig.tableName}
                          onChange={(e) => handleNestedInputChange('dbConfig', 'tableName', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Username"
                          value={formData.dbConfig.username}
                          onChange={(e) => handleNestedInputChange('dbConfig', 'username', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Password"
                          type="password"
                          value={formData.dbConfig.password}
                          onChange={(e) => handleNestedInputChange('dbConfig', 'password', e.target.value)}
                        />
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            )}

            {/* Sync Configuration */}
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Sync Configuration</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.syncConfig.autoSync}
                            onChange={(e) => handleNestedInputChange('syncConfig', 'autoSync', e.target.checked)}
                          />
                        }
                        label="Enable Auto Sync"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Sync Interval (minutes)"
                        type="number"
                        value={formData.syncConfig.syncInterval}
                        onChange={(e) => handleNestedInputChange('syncConfig', 'syncInterval', parseInt(e.target.value))}
                        disabled={!formData.syncConfig.autoSync}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingIntegration ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sync Dialog */}
      <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)}>
        <DialogTitle>Sync Attendance Data</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <DatePicker
                  label="Start Date"
                  value={syncData.startDate}
                  onChange={(date) => setSyncData(prev => ({ ...prev, startDate: date }))}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              <Grid item xs={12}>
                <DatePicker
                  label="End Date"
                  value={syncData.endDate}
                  onChange={(date) => setSyncData(prev => ({ ...prev, endDate: date }))}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
            </Grid>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSync} 
            variant="contained" 
            disabled={syncLoading}
            startIcon={syncLoading ? <CircularProgress size={20} /> : <SyncIcon />}
          >
            Sync
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
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
    </Box>
  );
};

export default BiometricIntegration; 