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
  Tooltip,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Tabs,
  Tab,
  Chip,
  Skeleton
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Person,
  Work,
  Cancel as AbsentIcon,
  Refresh as RefreshIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getAbsentEmployees } from '../../services/attendanceService';

const AttendanceList = () => {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
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

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);

  const [attendance, setAttendance] = useState([]);
  const [absentEmployees, setAbsentEmployees] = useState([]);
  const [absentSummary, setAbsentSummary] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [absentLoading, setAbsentLoading] = useState(false);
  const [absentPage, setAbsentPage] = useState(0);
  const [absentRowsPerPage, setAbsentRowsPerPage] = useState(10);
  const [departments, setDepartments] = useState([]);
  const navigate = useNavigate();

  // Initialize with empty state
  useEffect(() => {
    setAttendance([]);
    setTotalRecords(0);
  }, []);

  // Fetch today's attendance from ZKBio Time
  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Clear any existing data first
      setAttendance([]);
      setTotalRecords(0);
      
      const response = await fetch('/api/zkbio/zkbio/today');
      const result = await response.json();
      
      if (result.success) {
        setAttendance(result.data);
        setTotalRecords(result.count);
        setSuccess(result.message);
      } else {
        setError(result.message || 'Failed to fetch attendance data');
        setAttendance([]);
        setTotalRecords(0);
      }
    } catch (error) {
      console.error('❌ Error fetching attendance:', error);
      setError('Failed to connect to ZKBio Time system');
      setAttendance([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  // Fetch departments for filter
  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/zkbio/zkbio/departments');
      const result = await response.json();
      
      if (result.success) {
        setDepartments(result.data);
      }
    } catch (error) {
      console.error('❌ Error fetching departments:', error);
    }
  };

  // Fetch absent employees for a specific date (optimized)
  const fetchAbsentEmployees = async (date) => {
    try {
      setAbsentLoading(true);
      setError(null);
      
      const result = await getAbsentEmployees(date, {
        excludeWeekends: true,
        excludeHolidays: true,
        onlyActiveEmployees: true
      });
      
      if (result.success) {
        setAbsentEmployees(result.data);
        setAbsentSummary(result.summary);
        setSuccess(result.message);
      } else {
        setError(result.message || 'Failed to fetch absent employees');
        setAbsentEmployees([]);
        setAbsentSummary({});
      }
    } catch (error) {
      console.error('❌ Error fetching absent employees:', error);
      if (error.name === 'AbortError') {
        setError('Request timeout - ZKBio Time system is taking too long to respond');
      } else {
        setError('Failed to fetch absent employees from ZKBio Time. Please check your connection.');
      }
      setAbsentEmployees([]);
      setAbsentSummary({});
    } finally {
      setAbsentLoading(false);
    }
  };

  // Auto-fetch attendance on component mount
  useEffect(() => {
    // Force fresh data fetch every time component mounts
    fetchTodayAttendance();
    fetchDepartments();
  }, []);

  // Fetch absent employees when date changes or tab becomes active (optimized)
  useEffect(() => {
    if (activeTab === 1) {
      fetchAbsentEmployees(selectedDate);
    }
  }, [selectedDate, activeTab]);

  // Remove redundant useEffect for tab changes since it's handled above

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setPage(0);
    setAbsentPage(0);
  };

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };

  const refreshAbsentEmployees = () => {
    fetchAbsentEmployees(selectedDate);
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleAbsentPageChange = (event, newPage) => {
    setAbsentPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleAbsentRowsPerPageChange = (event) => {
    setAbsentRowsPerPage(parseInt(event.target.value, 10));
    setAbsentPage(0);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0); // Reset to first page when filter changes
    setAbsentPage(0); // Reset absent page when filter changes
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
    setPage(0); // Reset to first page when clearing filters
    setAbsentPage(0); // Reset absent page when clearing filters
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return filters.employee || filters.department || filters.status || filters.startDate || filters.endDate;
  };

  // Get filtered count for current tab
  const getFilteredCount = () => {
    if (activeTab === 0) {
      return getFilteredData(attendance).length;
    } else {
      return getFilteredAbsentEmployees(absentEmployees).length;
    }
  };

  // Get total count for current tab
  const getTotalCount = () => {
    if (activeTab === 0) {
      return attendance.length;
    } else {
      return absentEmployees.length;
    }
  };

  // Filter data based on current filters
  const getFilteredData = (data) => {
    if (!data || data.length === 0) return [];
    
    return data.filter(record => {
      // Employee name filter
      if (filters.employee && !record.employee?.fullName?.toLowerCase().includes(filters.employee.toLowerCase())) {
        return false;
      }
      
      // Department filter
      if (filters.department && record.employee?.department !== filters.department) {
        return false;
      }
      
      // Status filter
      if (filters.status && getStatusDisplay(record) !== filters.status) {
        return false;
      }
      
      // Date range filter
      if (filters.startDate || filters.endDate) {
        const recordDate = record.date || record.originalRecord?.punch_time?.split(' ')[0];
        if (filters.startDate && recordDate < filters.startDate) return false;
        if (filters.endDate && recordDate > filters.endDate) return false;
      }
      
      return true;
    });
  };

  // Filter absent employees based on current filters
  const getFilteredAbsentEmployees = (data) => {
    if (!data || data.length === 0) return [];
    
    return data.filter(employee => {
      // Employee name filter
      if (filters.employee && !employee.fullName?.toLowerCase().includes(filters.employee.toLowerCase())) {
        return false;
      }
      
      // Department filter
      if (filters.department && (employee.placementDepartment?.name || employee.department?.name || employee.department) !== filters.department) {
        return false;
      }
      
      // Position filter (using status field for absent employees)
      if (filters.status && employee.position !== filters.status) {
        return false;
      }
      
      // Date range filter
      if (filters.startDate || filters.endDate) {
        const absenceDate = employee.absenceDate;
        if (filters.startDate && absenceDate < filters.startDate) return false;
        if (filters.endDate && absenceDate > filters.endDate) return false;
      }
      
      return true;
    });
  };

  const handleDelete = async () => {
    if (!selectedAttendance) return;
    
    try {
      // Simulate delete operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess('Attendance record deleted successfully');
      setSelectedAttendance(null);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting attendance record:', error);
      setError('Failed to delete attendance record');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const getStatusDisplay = (record) => {
    if (record.status) return record.status;
    if (record.checkIn?.time && record.checkOut?.time) return 'Present';
    if (record.checkIn?.time) return 'Present';
    return 'Absent';
  };

  // Loading skeleton component for better perceived performance
  const LoadingSkeleton = ({ rows = 5 }) => (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <TableRow key={index}>
          <TableCell><Skeleton width="60%" /></TableCell>
          <TableCell><Skeleton width="40%" /></TableCell>
          <TableCell><Skeleton width="50%" /></TableCell>
          <TableCell><Skeleton width="30%" /></TableCell>
          <TableCell><Skeleton width="40%" /></TableCell>
          <TableCell><Skeleton width="35%" /></TableCell>
          <TableCell><Skeleton width="20%" /></TableCell>
        </TableRow>
      ))}
    </>
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Attendance Management
          </Typography>
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

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Person sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    {activeTab === 0 ? 'Total Records' : 'Total Employees'}
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {activeTab === 0 ? getFilteredData(attendance).length : (absentSummary.totalEmployees || 0)}
                  </Typography>
                  {activeTab === 1 && absentSummary.totalEmployees > 0 && (
                    <Typography variant="caption" sx={{ color: 'white', opacity: 0.8 }}>
                      All employees in system
                    </Typography>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Work sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    {activeTab === 0 ? 'Present Today' : 'Present'}
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {activeTab === 0 ? 
                      (getFilteredData(attendance).filter(a => getStatusDisplay(a) === 'Present').length) : 
                      (absentSummary.presentEmployees || 0)
                    }
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AbsentIcon sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    {activeTab === 0 ? 'Absent Today' : 'Absent'}
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {activeTab === 0 ? 
                      (getFilteredData(attendance).filter(a => getStatusDisplay(a) === 'Absent').length) : 
                      (absentSummary.totalAbsent || 0)
                    }
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CalendarIcon sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Absent %
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {activeTab === 0 ? 
                      (getFilteredData(attendance).length > 0 ? Math.round((getFilteredData(attendance).filter(a => getStatusDisplay(a) === 'Absent').length / getFilteredData(attendance).length) * 100) : 0) : 
                      (absentSummary.absentPercentage || 0)
                    }%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="attendance tabs">
          <Tab label="Today's Attendance" />
          <Tab label="Absent Employees" />
        </Tabs>
        
        {/* Refresh button for Today's Attendance */}
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {loading && <CircularProgress size={20} />}
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchTodayAttendance}
              disabled={loading}
              size="small"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </Box>
        )}
      </Box>

      {/* Absent Employees Date Selector */}
      {activeTab === 1 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <TextField
            type="date"
            label="Select Date"
            value={selectedDate}
            onChange={handleDateChange}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 200 }}
          />
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={refreshAbsentEmployees}
            disabled={absentLoading}
          >
            Refresh
          </Button>
          {absentLoading && <CircularProgress size={24} />}
        </Box>
      )}

      {/* Absent Employees Summary */}
      {activeTab === 1 && absentSummary.totalEmployees > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight="bold">
            📊 Absent Employees Summary for {formatDate(selectedDate)}
          </Typography>
          <Typography variant="body2">
            Total Employees: <strong>{absentSummary.totalEmployees}</strong> | 
            Present: <strong>{absentSummary.presentEmployees}</strong> | 
            Absent: <strong>{absentSummary.totalAbsent}</strong> | 
            Absent Percentage: <strong>{absentSummary.absentPercentage}%</strong>
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Showing {getFilteredAbsentEmployees(absentEmployees).length} absent employees with pagination
            {hasActiveFilters() && ` (filtered from ${absentEmployees.length} total)`}
          </Typography>
        </Alert>
      )}

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
                    <MenuItem key={dept.id} value={dept.dept_name}>
                      {dept.dept_name}
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
                  {activeTab === 0 ? (
                    <>
                      <MenuItem value="Present">Present</MenuItem>
                      <MenuItem value="Absent">Absent</MenuItem>
                      <MenuItem value="Late">Late</MenuItem>
                      <MenuItem value="Leave">Leave</MenuItem>
                      <MenuItem value="Sick Leave">Sick Leave</MenuItem>
                      <MenuItem value="Personal Leave">Personal Leave</MenuItem>
                    </>
                  ) : (
                    <>
                      <MenuItem value="Driver">Driver</MenuItem>
                      <MenuItem value="Watchman">Watchman</MenuItem>
                      <MenuItem value="Vigilence Inspector">Vigilence Inspector</MenuItem>
                      <MenuItem value="Washerman">Washerman</MenuItem>
                      <MenuItem value="Senior Electrician">Senior Electrician</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                onClick={clearFilters}
                size="small"
                fullWidth
                disabled={!hasActiveFilters()}
              >
                Clear Filters {hasActiveFilters() && `(${getFilteredCount()}/${getTotalCount()})`}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Data Tables */}
      {activeTab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Event Type</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingSkeleton rows={10} />
              ) : attendance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="textSecondary">
                      No attendance records found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                getFilteredData(attendance)
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((record, index) => (
                  <TableRow key={`${typeof record.deviceUserId === 'object' ? record.deviceUserId.id || record.deviceUserId.toString() : record.deviceUserId || typeof record.userId === 'object' ? record.userId.id || record.userId.toString() : record.userId || typeof record.uid === 'object' ? record.uid.id || record.uid.toString() : record.uid || index}-${record.recordTime || Date.now()}-${index}`} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {record.employee?.firstName || record.employee?.lastName || record.name || record.userName || record.fullName || `User ${typeof record.deviceUserId === 'object' ? record.deviceUserId.id || record.deviceUserId.toString() : record.deviceUserId || typeof record.userId === 'object' ? record.userId.id || record.userId.toString() : record.userId || typeof record.uid === 'object' ? record.uid.id || record.uid.toString() : record.uid || 'Unknown'}`}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {record.employee?.employeeId || (typeof record.deviceUserId === 'object' ? record.deviceUserId.id || record.deviceUserId.toString() : record.deviceUserId) || (typeof record.userId === 'object' ? record.userId.id || record.userId.toString() : record.userId) || (typeof record.uid === 'object' ? record.uid.id || record.uid.toString() : record.uid) || 'N/A'}
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
                      <Typography variant="body2" color="primary" fontWeight="bold">
                        {record.originalRecord?.punch_state_display || 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {record.originalRecord?.punch_time ? 
                          new Date(record.originalRecord.punch_time).toLocaleTimeString('en-US', { 
                            hour12: false, 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            second: '2-digit' 
                          }) : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {record.originalRecord?.area_alias || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {record.originalRecord?.verify_type_display || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => {
                              // Use employee's actual employeeId or MongoDB _id, NOT device IDs
                              const employeeId = record.employee?.employeeId || record.employee?._id || record.employee?.id;
                              const id = typeof employeeId === 'object' ? employeeId.id || employeeId.toString() : employeeId;
                              
                              if (!id) {
                                console.error('No valid employee ID found:', record.employee);
                                return;
                              }
                              
                              navigate(`/hr/attendance/employee/${id}/detail`);
                            }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => {
                              const recordId = record._id || record.uid || record.userId || record.deviceUserId;
                              const id = typeof recordId === 'object' ? recordId.id || recordId.toString() : recordId;
                              navigate(`/hr/attendance/${id}/edit`);
                            }}
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
            count={getFilteredData(attendance).length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </TableContainer>
      )}

      {/* Absent Employees Table */}
      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Position</TableCell>
                <TableCell>Absence Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {absentLoading ? (
                <LoadingSkeleton rows={10} />
              ) : absentEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Box sx={{ py: 3 }}>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        {absentSummary.workingDay === false ? 
                          'No absent employees on weekends' : 
                          'No absent employees found for this date'
                        }
                      </Typography>
                      {absentSummary.totalEmployees > 0 && (
                        <Typography variant="caption" color="textSecondary">
                          Total employees: {absentSummary.totalEmployees} | Present: {absentSummary.presentEmployees}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                getFilteredAbsentEmployees(absentEmployees)
                  .slice(absentPage * absentRowsPerPage, absentPage * absentRowsPerPage + absentRowsPerPage)
                  .map((employee, index) => (
                  <TableRow key={`${employee.employeeId}-${employee.absenceDate}-${index}`} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {employee.employeeId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {employee.fullName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {employee.placementDepartment?.name || employee.department?.name || employee.department}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {employee.position}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(employee.absenceDate)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label="Absent" 
                        color="error" 
                        size="small"
                        icon={<AbsentIcon />}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Employee Details">
                          <IconButton
                            size="small"
                            onClick={() => {
                              navigate(`/hr/attendance/employee/${employee.employeeId}/detail`);
                            }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Attendance History">
                          <IconButton
                            size="small"
                            onClick={() => {
                              navigate(`/hr/attendance/employee/${employee.employeeId}/history`);
                            }}
                          >
                            <CalendarIcon />
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
            count={getFilteredAbsentEmployees(absentEmployees).length}
            rowsPerPage={absentRowsPerPage}
            page={absentPage}
            onPageChange={handleAbsentPageChange}
            onRowsPerPageChange={handleAbsentRowsPerPageChange}
          />
        </TableContainer>
      )}

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