import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Stack,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import {
  fetchLoginHistory,
  fetchActivityHistory,
  fetchActiveSessions,
  fetchTrackingStats
} from '../../services/userTrackingService';
import api from '../../services/api';

const UserTracking = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Login History State
  const [loginLogs, setLoginLogs] = useState([]);
  const [loginPage, setLoginPage] = useState(0);
  const [loginRowsPerPage, setLoginRowsPerPage] = useState(25);
  const [loginTotal, setLoginTotal] = useState(0);
  
  // Activity History State
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityPage, setActivityPage] = useState(0);
  const [activityRowsPerPage, setActivityRowsPerPage] = useState(50);
  const [activityTotal, setActivityTotal] = useState(0);
  
  // Active Sessions State
  const [activeSessions, setActiveSessions] = useState([]);
  
  // Stats State
  const [stats, setStats] = useState(null);
  
  // Filters
  const [filters, setFilters] = useState({
    userId: '',
    startDate: dayjs().subtract(7, 'days').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
    ipAddress: '',
    module: '',
    actionType: '',
    status: ''
  });
  
  const [users, setUsers] = useState([]);

  // Fetch users for filter dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/auth/users', { params: { limit: 1000 } });
        // API returns: { success: true, data: { users: [...], pagination: {...} } }
        const usersData = response.data?.data?.users || [];
        // Ensure it's always an array
        setUsers(Array.isArray(usersData) ? usersData : []);
      } catch (err) {
        console.error('Error fetching users:', err);
        setUsers([]); // Set empty array on error
      }
    };
    fetchUsers();
  }, []);

  // Fetch login history
  const loadLoginHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page: loginPage + 1,
        limit: loginRowsPerPage,
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.ipAddress && { ipAddress: filters.ipAddress }),
        ...(filters.status && { status: filters.status })
      };
      
      const response = await fetchLoginHistory(params);
      setLoginLogs(response.data.data.logs || []);
      setLoginTotal(response.data.data.pagination?.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load login history');
      console.error('Error loading login history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch activity history
  const loadActivityHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page: activityPage + 1,
        limit: activityRowsPerPage,
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.ipAddress && { ipAddress: filters.ipAddress }),
        ...(filters.module && { module: filters.module }),
        ...(filters.actionType && { actionType: filters.actionType })
      };
      
      const response = await fetchActivityHistory(params);
      setActivityLogs(response.data.data.logs || []);
      setActivityTotal(response.data.data.pagination?.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load activity history');
      console.error('Error loading activity history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch active sessions
  const loadActiveSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchActiveSessions();
      setActiveSessions(response.data.data.sessions || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load active sessions');
      console.error('Error loading active sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const loadStats = async () => {
    try {
      const params = {
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate })
      };
      const response = await fetchTrackingStats(params);
      setStats(response.data.data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  // Load data based on active tab
  useEffect(() => {
    loadStats();
    if (tabValue === 0) {
      loadLoginHistory();
    } else if (tabValue === 1) {
      loadActivityHistory();
    } else if (tabValue === 2) {
      loadActiveSessions();
    }
  }, [tabValue, loginPage, loginRowsPerPage, activityPage, activityRowsPerPage, filters]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setLoginPage(0);
    setActivityPage(0);
  };

  const formatDuration = (ms) => {
    if (!ms) return '—';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'logged_out':
        return 'default';
      case 'expired':
        return 'error';
      default:
        return 'default';
    }
  };

  const getActionTypeColor = (actionType) => {
    switch (actionType) {
      case 'create':
        return 'success';
      case 'update':
        return 'info';
      case 'delete':
        return 'error';
      case 'read':
      case 'view':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          User Tracking
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => {
              if (tabValue === 0) loadLoginHistory();
              else if (tabValue === 1) loadActivityHistory();
              else if (tabValue === 2) loadActiveSessions();
              loadStats();
            }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Logins
                </Typography>
                <Typography variant="h5">
                  {stats.totalLogins || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Active Sessions
                </Typography>
                <Typography variant="h5" color="success.main">
                  {stats.activeSessions || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Unique Users
                </Typography>
                <Typography variant="h5">
                  {stats.uniqueUsers || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Activities (24h)
                </Typography>
                <Typography variant="h5">
                  {stats.recentActivities24h || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>User</InputLabel>
              <Select
                value={filters.userId}
                label="User"
                onChange={(e) => handleFilterChange('userId', e.target.value)}
              >
                <MenuItem value="">All Users</MenuItem>
                {Array.isArray(users) && users.length > 0 && users.map((user) => (
                  <MenuItem key={user._id || user.id} value={user._id || user.id}>
                    {user.firstName} {user.lastName} ({user.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Start Date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="End Date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="IP Address"
              value={filters.ipAddress}
              onChange={(e) => handleFilterChange('ipAddress', e.target.value)}
              placeholder="Filter by IP"
            />
          </Grid>
          {tabValue === 0 && (
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="logged_out">Logged Out</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}
          {tabValue === 1 && (
            <>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Module"
                  value={filters.module}
                  onChange={(e) => handleFilterChange('module', e.target.value)}
                  placeholder="e.g., hr, finance"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Action Type</InputLabel>
                  <Select
                    value={filters.actionType}
                    label="Action Type"
                    onChange={(e) => handleFilterChange('actionType', e.target.value)}
                  >
                    <MenuItem value="">All Actions</MenuItem>
                    <MenuItem value="create">Create</MenuItem>
                    <MenuItem value="read">Read</MenuItem>
                    <MenuItem value="update">Update</MenuItem>
                    <MenuItem value="delete">Delete</MenuItem>
                    <MenuItem value="view">View</MenuItem>
                    <MenuItem value="export">Export</MenuItem>
                    <MenuItem value="approve">Approve</MenuItem>
                    <MenuItem value="reject">Reject</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Login History" />
          <Tab label="Activity Log" />
          <Tab label="Active Sessions" />
        </Tabs>

        {/* Login History Tab */}
        {tabValue === 0 && (
          <Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Login Time</TableCell>
                      <TableCell>Logout Time</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>IP Address</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loginLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography color="textSecondary" sx={{ py: 3 }}>
                            No login history found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      loginLogs.map((log) => (
                        <TableRow key={log._id}>
                          <TableCell>
                            {log.userId ? (
                              `${log.userId.firstName} ${log.userId.lastName}`
                            ) : (
                              log.username
                            )}
                            <br />
                            <Typography variant="caption" color="textSecondary">
                              {log.userId?.email || log.email}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {dayjs(log.loginTime).format('MMM D, YYYY h:mm A')}
                          </TableCell>
                          <TableCell>
                            {log.logoutTime
                              ? dayjs(log.logoutTime).format('MMM D, YYYY h:mm A')
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {formatDuration(log.sessionDuration)}
                          </TableCell>
                          <TableCell>{log.ipAddress}</TableCell>
                          <TableCell>
                            <Chip
                              label={log.status}
                              color={getStatusColor(log.status)}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={loginTotal}
                  page={loginPage}
                  onPageChange={(e, newPage) => setLoginPage(newPage)}
                  rowsPerPage={loginRowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setLoginRowsPerPage(parseInt(e.target.value, 10));
                    setLoginPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                />
              </TableContainer>
            )}
          </Box>
        )}

        {/* Activity Log Tab */}
        {tabValue === 1 && (
          <Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Module</TableCell>
                      <TableCell>Endpoint</TableCell>
                      <TableCell>IP Address</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activityLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Typography color="textSecondary" sx={{ py: 3 }}>
                            No activity history found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      activityLogs.map((log) => (
                        <TableRow key={log._id}>
                          <TableCell>
                            {log.userId ? (
                              `${log.userId.firstName} ${log.userId.lastName}`
                            ) : (
                              log.username
                            )}
                            <br />
                            <Typography variant="caption" color="textSecondary">
                              {log.userId?.email || log.email}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {dayjs(log.timestamp).format('MMM D, YYYY h:mm A')}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={log.actionType}
                              color={getActionTypeColor(log.actionType)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{log.module}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {log.requestMethod} {log.endpoint}
                            </Typography>
                          </TableCell>
                          <TableCell>{log.ipAddress}</TableCell>
                          <TableCell>{log.description || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={activityTotal}
                  page={activityPage}
                  onPageChange={(e, newPage) => setActivityPage(newPage)}
                  rowsPerPage={activityRowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setActivityRowsPerPage(parseInt(e.target.value, 10));
                    setActivityPage(0);
                  }}
                  rowsPerPageOptions={[25, 50, 100, 200]}
                />
              </TableContainer>
            )}
          </Box>
        )}

        {/* Active Sessions Tab */}
        {tabValue === 2 && (
          <Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Login Time</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>IP Address</TableCell>
                      <TableCell>User Agent</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeSessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography color="textSecondary" sx={{ py: 3 }}>
                            No active sessions
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeSessions.map((session) => {
                        const duration = Date.now() - new Date(session.loginTime).getTime();
                        return (
                          <TableRow key={session._id}>
                            <TableCell>
                              {session.userId ? (
                                `${session.userId.firstName} ${session.userId.lastName}`
                              ) : (
                                session.username
                              )}
                              <br />
                              <Typography variant="caption" color="textSecondary">
                                {session.userId?.email || session.email}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {dayjs(session.loginTime).format('MMM D, YYYY h:mm A')}
                            </TableCell>
                            <TableCell>
                              {formatDuration(duration)}
                            </TableCell>
                            <TableCell>{session.ipAddress}</TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem', maxWidth: 300 }}>
                                {session.userAgent || '—'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default UserTracking;

