import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Badge,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
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

const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  console.log('✅ Authentication data cleared');
  window.location.reload();
};

const LeaveManagement = () => {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  // Quick stats
  const [stats, setStats] = useState({
    totalEmployees: 0,
    employeesOnLeave: 0,
    pendingRequests: 0,
    totalLeaveDays: 0
  });
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // Form states
  const [leaveForm, setLeaveForm] = useState({
    employee: '',
    leaveType: '',
    startDate: '',
    endDate: '',
    totalDays: '',
    reason: '',
    isEmergency: false,
    isHalfDay: false,
    halfDayType: 'first_half',
    workHandover: '',
    contactDuringLeave: {
      phone: '',
      email: '',
      availableHours: ''
    }
  });

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const [existingLeaves, setExistingLeaves] = useState([]);

  // Load existing leaves when employee is selected
  useEffect(() => {
    const loadExistingLeaves = async () => {
      if (leaveForm.employee) {
        try {
          const response = await api.get(`/leaves/requests?employee=${leaveForm.employee}&status=approved`);
          setExistingLeaves(response.data.data);
        } catch (error) {
          console.error('Error loading existing leaves:', error);
          setExistingLeaves([]);
        }
      } else {
        setExistingLeaves([]);
      }
    };
    
    loadExistingLeaves();
  }, [leaveForm.employee]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading leave data...');
      
      // Debug authentication
      const authDebug = debugAuthentication();
      console.log('Auth debug:', authDebug);
      
      const [typesRes, employeesRes, statsRes] = await Promise.all([
        api.get('/leaves/types'),
        api.get('/leaves/employees/balances'),
        api.get('/leaves/statistics')
      ]);
      
      setLeaveTypes(typesRes.data.data);
      setEmployees(employeesRes.data.data);
      
      // Calculate quick stats
      const totalEmployees = employeesRes.data.data.length;
      const employeesOnLeave = employeesRes.data.data.filter(emp => 
        emp.leaveBalance?.annual?.used > 0 || 
        emp.leaveBalance?.casual?.used > 0 || 
        emp.leaveBalance?.medical?.used > 0
      ).length;
      
      setStats({
        totalEmployees,
        employeesOnLeave,
        pendingRequests: 0, // Will be updated from stats API
        totalLeaveDays: employeesRes.data.data.reduce((sum, emp) => 
          sum + (emp.leaveBalance?.annual?.used || 0) + 
          (emp.leaveBalance?.casual?.used || 0) + 
          (emp.leaveBalance?.medical?.used || 0), 0
        )
      });
    } catch (error) {
      console.error('Error loading leave data:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        code: error.code
      });
      
      let errorMessage = 'Failed to load leave data';
      if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
        errorMessage = 'Cannot connect to server. Please check if the backend is running.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication expired. Please login again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied. You do not have permission to view leave data.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLeave = async () => {
    try {
      setLoading(true);
      
      // Pre-validate leave balance
      const selectedEmp = employees.find(emp => emp._id === (selectedEmployee ? selectedEmployee._id : leaveForm.employee));
      const selectedLeaveType = leaveTypes.find(type => type._id === leaveForm.leaveType);
      
      if (selectedEmp && selectedLeaveType && leaveForm.totalDays) {
        const leaveTypeKey = selectedLeaveType.code.toLowerCase();
        const availableDays = selectedEmp.leaveBalance?.[leaveTypeKey]?.remaining || 0;
        
        if (availableDays < leaveForm.totalDays) {
          setError(`Insufficient ${selectedLeaveType.name} balance. Available: ${availableDays} days, Requested: ${leaveForm.totalDays} days`);
          return;
        }
      }
      
      // Check for overlapping leaves
      if (leaveForm.startDate && leaveForm.endDate) {
        const overlapCheck = await checkForOverlappingLeaves(
          selectedEmployee ? selectedEmployee._id : leaveForm.employee,
          leaveForm.startDate,
          leaveForm.endDate
        );
        
        if (overlapCheck.hasOverlap) {
          const conflictingLeave = overlapCheck.conflictingLeave;
          const conflictStart = new Date(conflictingLeave.startDate).toLocaleDateString();
          const conflictEnd = new Date(conflictingLeave.endDate).toLocaleDateString();
          setError(`This leave request overlaps with an existing approved leave (${conflictStart} - ${conflictEnd}). Please choose different dates.`);
          return;
        }
      }
      
      const formData = {
        ...leaveForm,
        employee: selectedEmployee ? selectedEmployee._id : leaveForm.employee,
        totalDays: leaveForm.totalDays || calculateTotalDays()
      };
      
      const response = await api.post('/leaves/requests', formData);
      setSuccess('Leave request added successfully');
      setAddDialogOpen(false);
      setSelectedEmployee(null);
      resetLeaveForm();
      // Refresh data to show updated leave balances
      await loadData();
    } catch (error) {
      console.error('Error adding leave:', error);
      const errorMessage = error.response?.data?.message || 'Failed to add leave request';
      
      // Provide more helpful error messages
      if (errorMessage.includes('Insufficient')) {
        setError(errorMessage);
      } else if (errorMessage.includes('overlaps')) {
        setError('This leave request overlaps with an existing approved leave. Please choose different dates.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetLeaveForm = () => {
    setLeaveForm({
      employee: '',
      leaveType: '',
      startDate: '',
      endDate: '',
      totalDays: '',
      reason: '',
      isEmergency: false,
      isHalfDay: false,
      halfDayType: 'first_half',
      workHandover: '',
      contactDuringLeave: {
        phone: '',
        email: '',
        availableHours: ''
      }
    });
  };

  const checkForOverlappingLeaves = async (employeeId, startDate, endDate) => {
    try {
      const response = await api.get(`/leaves/requests?employee=${employeeId}&status=approved`);
      const approvedLeaves = response.data.data;
      
      const newStart = new Date(startDate);
      const newEnd = new Date(endDate);
      
      for (const leave of approvedLeaves) {
        const existingStart = new Date(leave.startDate);
        const existingEnd = new Date(leave.endDate);
        
        // Check for overlap
        if ((newStart <= existingEnd && newEnd >= existingStart)) {
          return {
            hasOverlap: true,
            conflictingLeave: leave
          };
        }
      }
      
      return { hasOverlap: false };
    } catch (error) {
      console.error('Error checking for overlapping leaves:', error);
      return { hasOverlap: false };
    }
  };

  const getAvailableLeaveBalance = () => {
    const selectedEmp = employees.find(emp => emp._id === (selectedEmployee ? selectedEmployee._id : leaveForm.employee));
    const selectedLeaveType = leaveTypes.find(type => type._id === leaveForm.leaveType);
    
    if (selectedEmp && selectedLeaveType) {
      const leaveTypeKey = selectedLeaveType.code.toLowerCase();
      return selectedEmp.leaveBalance?.[leaveTypeKey]?.remaining || 0;
    }
    return 0;
  };

  const calculateTotalDays = () => {
    if (leaveForm.startDate && leaveForm.endDate) {
      const start = new Date(leaveForm.startDate);
      const end = new Date(leaveForm.endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return leaveForm.isHalfDay ? 0.5 : diffDays;
    }
    return 0;
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    if (term.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    const results = employees.filter(emp => 
      emp.firstName?.toLowerCase().includes(term.toLowerCase()) ||
      emp.lastName?.toLowerCase().includes(term.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(term.toLowerCase()) ||
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(term.toLowerCase())
    );
    setSearchResults(results);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Leave Management
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Manage employee leaves, view balances, and handle leave operations
      </Typography>

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }} 
          onClose={() => setError('')}
          action={
            error.includes('Authentication') || error.includes('connect to server') ? (
              <Button color="inherit" size="small" onClick={() => clearAuth()}>
                Fix Authentication
              </Button>
            ) : null
          }
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PersonIcon color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6" color="primary.main" gutterBottom>
                    Total Employees
                  </Typography>
                  <Typography variant="h4" color="primary.main">
                    {stats.totalEmployees}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CalendarIcon color="warning" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6" color="warning.main" gutterBottom>
                    On Leave Today
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {stats.employeesOnLeave}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <AssignmentIcon color="info" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6" color="info.main" gutterBottom>
                    Total Leave Days
                  </Typography>
                  <Typography variant="h4" color="info.main">
                    {stats.totalLeaveDays}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TrendingUpIcon color="success" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6" color="success.main" gutterBottom>
                    Leave Types
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {leaveTypes.length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setAddDialogOpen(true)}
                >
                  Add Leave Request
                </Button>
                        <Button
                          variant="outlined"
                          startIcon={<RefreshIcon />}
                          onClick={async () => {
                            setLoading(true);
                            await loadData();
                            setLoading(false);
                          }}
                          disabled={loading}
                        >
                          Refresh Data
                        </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Navigation
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<CheckIcon />}
                  href="/hr/leaves/approval"
                >
                  Leave Approval
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CalendarIcon />}
                  href="/hr/leaves/calendar"
                >
                  Leave Calendar
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<TrendingUpIcon />}
                  href="/hr/leaves/reports"
                >
                  Leave Reports
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Employee Leave Balances - Searchable */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Employee Leave Balances
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Search for an employee to view their leave balance and add leave requests
          </Typography>
          
          {/* Search Bar */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search by employee name or ID..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              InputProps={{
                startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              sx={{ maxWidth: 400 }}
            />
          </Box>

          {/* Search Results */}
          {searchTerm && (
            <Box>
              {searchResults.length > 0 ? (
                <Grid container spacing={2}>
                  {searchResults.map((employee) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={employee._id}>
                      <Card 
                        variant="outlined" 
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { 
                            boxShadow: 2,
                            backgroundColor: 'action.hover'
                          }
                        }}
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setAddDialogOpen(true);
                        }}
                      >
                        <CardContent sx={{ p: 2 }}>
                          <Box display="flex" alignItems="center" mb={1}>
                            <Avatar sx={{ mr: 1, width: 32, height: 32, fontSize: '0.875rem' }}>
                              {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="subtitle2" noWrap>
                                {employee.firstName} {employee.lastName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {employee.employeeId}
                              </Typography>
                            </Box>
                          </Box>
                          
                          <Box sx={{ mt: 1 }}>
                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                              <Typography variant="caption" color="text.secondary">
                                Annual:
                              </Typography>
                              <Typography variant="caption" fontWeight="bold">
                                {employee.leaveBalance?.annual?.remaining || 0}/{employee.leaveBalance?.annual?.allocated || 14}
                              </Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                              <Typography variant="caption" color="text.secondary">
                                Casual:
                              </Typography>
                              <Typography variant="caption" fontWeight="bold">
                                {employee.leaveBalance?.casual?.remaining || 0}/{employee.leaveBalance?.casual?.allocated || 10}
                              </Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="caption" color="text.secondary">
                                Medical:
                              </Typography>
                              <Typography variant="caption" fontWeight="bold">
                                {employee.leaveBalance?.medical?.remaining || 0}/{employee.leaveBalance?.medical?.allocated || 8}
                              </Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No employees found matching "{searchTerm}"
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try searching by name or employee ID
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* No Search State */}
          {!searchTerm && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                Search for an employee to view their leave balance
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You can search by name or employee ID
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Leave Management Overview
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            This page provides an overview of employee leave balances and quick access to leave management functions.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Search Employee:</strong> Use the search bar above to find employees by name or ID
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Add Leave Request:</strong> Click on any employee card to add a leave request for them
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Leave Approval:</strong> Use the Leave Approval page to review and approve pending requests
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Leave Calendar:</strong> View all approved leaves in calendar format
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Leave Reports:</strong> Generate detailed reports and analytics
          </Typography>
        </CardContent>
      </Card>

      {/* Add Leave Dialog */}
      <Dialog 
        open={addDialogOpen} 
        onClose={() => {
          setAddDialogOpen(false);
          setSelectedEmployee(null);
          resetLeaveForm();
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Add Leave Request
          {selectedEmployee && (
            <Typography variant="body2" color="text.secondary">
              for {selectedEmployee.firstName} {selectedEmployee.lastName}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent sx={{ minHeight: '500px', padding: '24px' }}>
          {/* Employee Leave Balance Info */}
          {leaveForm.employee && (
            <Card sx={{ mb: 3, backgroundColor: 'primary.50' }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Current Leave Balance
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Annual: {employees.find(emp => emp._id === leaveForm.employee)?.leaveBalance?.annual?.remaining || 0} days
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Casual: {employees.find(emp => emp._id === leaveForm.employee)?.leaveBalance?.casual?.remaining || 0} days
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Medical: {employees.find(emp => emp._id === leaveForm.employee)?.leaveBalance?.medical?.remaining || 0} days
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
          
          {/* Existing Approved Leaves */}
          {leaveForm.employee && existingLeaves.length > 0 && (
            <Card sx={{ mb: 3, backgroundColor: 'warning.50' }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="warning.main">
                  ⚠️ Existing Approved Leaves
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Please avoid overlapping dates with these approved leaves:
                </Typography>
                {existingLeaves.map((leave, index) => (
                  <Typography key={index} variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                    • {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()} 
                    ({leave.totalDays} days)
                  </Typography>
                ))}
              </CardContent>
            </Card>
          )}
          
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Autocomplete
                  options={employees}
                  getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.employeeId})`}
                  value={employees.find(emp => emp._id === (selectedEmployee ? selectedEmployee._id : leaveForm.employee)) || null}
                  onChange={(event, newValue) => {
                    if (newValue) {
                      setLeaveForm({ ...leaveForm, employee: newValue._id });
                      setSelectedEmployee(newValue);
                    } else {
                      setLeaveForm({ ...leaveForm, employee: '' });
                      setSelectedEmployee(null);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Employee"
                      placeholder="Search employee..."
                      required
                      sx={{ '& .MuiInputLabel-root': { marginTop: '8px' } }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ mr: 2, width: 32, height: 32, fontSize: '0.875rem' }}>
                          {option.firstName?.charAt(0)}{option.lastName?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">
                            {option.firstName} {option.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.employeeId}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                  isOptionEqualToValue={(option, value) => option._id === value?._id}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Autocomplete
                  options={leaveTypes}
                  getOptionLabel={(option) => `${option.name} (${option.daysPerYear} days/year)`}
                  value={leaveTypes.find(type => type._id === leaveForm.leaveType) || null}
                  onChange={(event, newValue) => {
                    if (newValue) {
                      setLeaveForm({ ...leaveForm, leaveType: newValue._id });
                    } else {
                      setLeaveForm({ ...leaveForm, leaveType: '' });
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Leave Type"
                      placeholder="Select leave type..."
                      required
                      sx={{ '& .MuiInputLabel-root': { marginTop: '8px' } }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {option.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.description}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center">
                          <Box 
                            sx={{ 
                              width: 12, 
                              height: 12, 
                              borderRadius: '50%', 
                              backgroundColor: option.color || '#3B82F6',
                              mr: 1 
                            }} 
                          />
                          <Typography variant="caption" color="text.secondary">
                            {option.daysPerYear} days/year
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                  isOptionEqualToValue={(option, value) => option._id === value?._id}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Total Days"
                  type="number"
                  value={leaveForm.totalDays || calculateTotalDays()}
                  onChange={(e) => setLeaveForm({ ...leaveForm, totalDays: parseFloat(e.target.value) || 0 })}
                  inputProps={{ min: 0.5, max: 365, step: 0.5 }}
                  helperText={
                    leaveForm.employee && leaveForm.leaveType 
                      ? `Available: ${getAvailableLeaveBalance()} days`
                      : "Enter number of leave days"
                  }
                  error={leaveForm.totalDays > getAvailableLeaveBalance() && getAvailableLeaveBalance() > 0}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={leaveForm.startDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={leaveForm.endDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  disabled={leaveForm.isHalfDay}
                />
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Reason"
                  multiline
                  rows={3}
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Please provide a detailed reason for the leave request"
                />
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Work Handover"
                  multiline
                  rows={2}
                  value={leaveForm.workHandover}
                  onChange={(e) => setLeaveForm({ ...leaveForm, workHandover: e.target.value })}
                  placeholder="Describe work handover arrangements"
                />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddDialogOpen(false);
            setSelectedEmployee(null);
            resetLeaveForm();
          }}>
            Cancel
          </Button>
                  <Button
                    onClick={handleAddLeave}
                    variant="contained"
                    disabled={loading || !leaveForm.employee || !leaveForm.leaveType || !leaveForm.startDate || !leaveForm.totalDays || !leaveForm.reason}
                  >
                    {loading ? <CircularProgress size={20} /> : 'Add Leave Request'}
                  </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeaveManagement;