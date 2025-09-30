import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Tabs,
  Tab,
  Avatar,
  Tooltip
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Assessment as ReportIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { format, subMonths, startOfYear, endOfYear } from 'date-fns';
import axios from 'axios';
import api from '../../../services/api';

// Debug authentication issues
const debugAuthentication = () => {
  console.log('🔍 Debugging Authentication...');
  
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  console.log('Token exists:', !!token);
  console.log('User exists:', !!user);
  
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('Token payload:', payload);
      console.log('Token expires:', new Date(payload.exp * 1000));
      console.log('Token expired:', Date.now() > payload.exp * 1000);
    } catch (error) {
      console.error('Error decoding token:', error);
    }
  }
  
  return { hasToken: !!token, hasUser: !!user, token, user };
};

const LeaveReports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  // Filter states
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    department: 'all',
    leaveType: 'all',
    status: 'all'
  });
  
  // Data states
  const [statistics, setStatistics] = useState({});
  const [departmentStats, setDepartmentStats] = useState([]);
  const [employeeStats, setEmployeeStats] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadReportData();
  }, [filters, tabValue]);

  const loadInitialData = async () => {
    try {
      console.log('🔍 Loading initial leave report data...');
      
      // Debug authentication
      const authDebug = debugAuthentication();
      console.log('Auth debug:', authDebug);
      
      const [typesRes, deptRes] = await Promise.all([
        api.get('/leaves/types'),
        api.get('/hr/departments')
      ]);
      
      setLeaveTypes(typesRes.data.data);
      setDepartments(deptRes.data.data);
    } catch (error) {
      console.error('Error loading initial data:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        code: error.code
      });
      
      let errorMessage = 'Failed to load initial data';
      if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
        errorMessage = 'Cannot connect to server. Please check if the backend is running.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication expired. Please login again.';
      }
      
      setError(errorMessage);
    }
  };

  const loadReportData = async () => {
    try {
      setLoading(true);
      
      // Load basic statistics (only available route)
      const statsRes = await api.get(`/leaves/statistics?year=${filters.year}`);
      setStatistics(statsRes.data.data);
      
      // Set empty arrays for missing data (will be implemented later)
      setDepartmentStats([]);
      setEmployeeStats([]);
      setMonthlyTrends([]);
      
    } catch (error) {
      console.error('Error loading report data:', error);
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const exportReport = async (format = 'excel') => {
    try {
      // Export functionality not yet implemented
      setError('Export functionality will be implemented in a future update');
      return;
      
      // Future implementation will go here
      /*
      const params = new URLSearchParams({
        year: filters.year,
        month: filters.month,
        department: filters.department,
        leaveType: filters.leaveType,
        status: filters.status,
        format: format
      });
      
      const response = await api.get(`/leaves/reports/export?${params}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leave-report-${filters.year}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      */
    } catch (error) {
      console.error('Error exporting report:', error);
      setError('Failed to export report');
    }
  };

  const getEmployeeInitials = (employee) => {
    return `${employee.firstName?.charAt(0) || ''}${employee.lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const calculateTrend = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getTrendIcon = (trend) => {
    if (trend > 0) return <TrendingUpIcon color="error" />;
    if (trend < 0) return <TrendingDownIcon color="success" />;
    return null;
  };

  const getTrendColor = (trend) => {
    if (trend > 0) return 'error.main';
    if (trend < 0) return 'success.main';
    return 'text.secondary';
  };

  if (loading && Object.keys(statistics).length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Leave Reports
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Year"
                type="number"
                value={filters.year}
                onChange={(e) => handleFilterChange('year', parseInt(e.target.value))}
                inputProps={{ min: 2020, max: 2030 }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  value={filters.month}
                  onChange={(e) => handleFilterChange('month', e.target.value)}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      {format(new Date(2024, i), 'MMMM')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  value={filters.department}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                >
                  <MenuItem value="all">All Departments</MenuItem>
                  {departments.map((dept) => (
                    <MenuItem key={dept._id} value={dept._id}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Leave Type</InputLabel>
                <Select
                  value={filters.leaveType}
                  onChange={(e) => handleFilterChange('leaveType', e.target.value)}
                >
                  <MenuItem value="all">All Types</MenuItem>
                  {leaveTypes.map((type) => (
                    <MenuItem key={type._id} value={type._id}>
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Box sx={{ display: 'flex', gap: 1, height: '100%', alignItems: 'end' }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadReportData}
                  fullWidth
                >
                  Refresh
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={() => exportReport('excel')}
        >
          Export Excel
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => exportReport('pdf')}
        >
          Export PDF
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Department Analysis" />
          <Tab label="Employee Analysis" />
          <Tab label="Monthly Trends" />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  Total Requests
                </Typography>
                <Typography variant="h4" color="primary">
                  {statistics.totalRequests || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  This Year
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="success.main" gutterBottom>
                  Approved Requests
                </Typography>
                <Typography variant="h4" color="success.main">
                  {statistics.approvedRequests || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {statistics.totalRequests > 0 ? 
                    Math.round((statistics.approvedRequests / statistics.totalRequests) * 100) : 0}% Approval Rate
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="warning.main" gutterBottom>
                  Pending Requests
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {statistics.pendingRequests || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Awaiting Approval
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="error.main" gutterBottom>
                  Total Days
                </Typography>
                <Typography variant="h4" color="error.main">
                  {statistics.totalDays || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Leave Days Taken
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Department Analysis Tab */}
      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Department Analysis
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Department</TableCell>
                    <TableCell align="right">Total Requests</TableCell>
                    <TableCell align="right">Approved</TableCell>
                    <TableCell align="right">Pending</TableCell>
                    <TableCell align="right">Total Days</TableCell>
                    <TableCell align="right">Avg Days/Request</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {departmentStats.map((dept) => (
                    <TableRow key={dept._id}>
                      <TableCell>{dept.name}</TableCell>
                      <TableCell align="right">{dept.totalRequests}</TableCell>
                      <TableCell align="right">{dept.approvedRequests}</TableCell>
                      <TableCell align="right">{dept.pendingRequests}</TableCell>
                      <TableCell align="right">{dept.totalDays}</TableCell>
                      <TableCell align="right">
                        {dept.totalRequests > 0 ? 
                          (dept.totalDays / dept.totalRequests).toFixed(1) : 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Employee Analysis Tab */}
      {tabValue === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Employee Analysis
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell align="right">Total Requests</TableCell>
                    <TableCell align="right">Total Days</TableCell>
                    <TableCell align="right">Annual Used</TableCell>
                    <TableCell align="right">Casual Used</TableCell>
                    <TableCell align="right">Medical Used</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employeeStats.map((emp) => (
                    <TableRow key={emp._id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {getEmployeeInitials(emp)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {emp.firstName} {emp.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {emp.employeeId}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="right">{emp.totalRequests}</TableCell>
                      <TableCell align="right">{emp.totalDays}</TableCell>
                      <TableCell align="right">{emp.annualUsed}</TableCell>
                      <TableCell align="right">{emp.casualUsed}</TableCell>
                      <TableCell align="right">{emp.medicalUsed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Monthly Trends Tab */}
      {tabValue === 3 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Monthly Trends
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Requests</TableCell>
                    <TableCell align="right">Days</TableCell>
                    <TableCell align="right">Trend</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monthlyTrends.map((month, index) => (
                    <TableRow key={month.month}>
                      <TableCell>{format(new Date(2024, month.month - 1), 'MMMM')}</TableCell>
                      <TableCell align="right">{month.requests}</TableCell>
                      <TableCell align="right">{month.days}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          {getTrendIcon(month.trend)}
                          <Typography 
                            variant="body2" 
                            color={getTrendColor(month.trend)}
                          >
                            {month.trend > 0 ? '+' : ''}{month.trend.toFixed(1)}%
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default LeaveReports;
