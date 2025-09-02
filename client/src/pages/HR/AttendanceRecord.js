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
  IconButton,
  TextField,
  Button,
  Alert,
  Tooltip,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const AttendanceRecord = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const navigate = useNavigate();

  // Fetch employee attendance records with pagination
  const fetchEmployeeAttendance = useCallback(async (currentPage = page, currentLimit = rowsPerPage, search = searchQuery) => {
    // Prevent multiple simultaneous requests
    if (loading) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: currentLimit.toString()
      });
      
      if (search.trim()) {
        params.append('search', search.trim());
      }
      
      const response = await fetch(`/api/zkbio/zkbio/employees/attendance?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setEmployees(result.data);
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
      } else {
        setError(result.message || 'Failed to fetch employee attendance');
      }
    } catch (error) {
      console.error('Error fetching employee attendance:', error);
      setError('Failed to connect to attendance system');
    } finally {
      setLoading(false);
    }
  }, [loading, page, rowsPerPage, searchQuery]);

  // Auto-fetch on component mount
  useEffect(() => {
    fetchEmployeeAttendance();
  }, []); // Empty dependency array - only run once on mount

  // Handle search with debouncing
  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        fetchEmployeeAttendance(0, rowsPerPage, searchQuery);
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    } else if (searchQuery === '') {
      // Only fetch if we're not on page 0 already to avoid duplicate calls
      if (page !== 0) {
        fetchEmployeeAttendance(0, rowsPerPage, '');
      }
    }
  }, [searchQuery]); // Only depend on searchQuery

  // Handle pagination changes
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    fetchEmployeeAttendance(newPage, rowsPerPage, searchQuery);
  };

  const handleRowsPerPageChange = (event) => {
    const newLimit = parseInt(event.target.value, 10);
    setRowsPerPage(newLimit);
    setPage(0);
    fetchEmployeeAttendance(0, newLimit, searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setPage(0);
    // Don't call fetchEmployeeAttendance here - let the useEffect handle it
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present':
        return 'success';
      case 'Absent':
        return 'error';
      case 'Late':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    return new Date(time).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Attendance Record
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Showing latest activity per employee (sorted by Employee ID) - Optimized with backend pagination
        </Typography>
      </Box>

      {/* Search Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            placeholder="Search by Employee ID or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
          {searchQuery && (
            <Button
              variant="outlined"
              onClick={clearSearch}
              startIcon={<ClearIcon />}
              size="small"
            >
              Clear
            </Button>
          )}
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Employee Attendance Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee ID</TableCell>
              <TableCell>Employee Name</TableCell>
              <TableCell>Latest Activity</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} sx={{ mr: 2 }} />
                    <Typography variant="body2" color="textSecondary">
                      Loading employee attendance records...
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="textSecondary">
                    {searchQuery ? 'No employees found matching your search' : 'No employee attendance records found'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => (
                <TableRow key={employee.employeeId} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {employee.employeeId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="primary" fontWeight="bold">
                      {employee.latestActivity || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatTime(employee.latestTime)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(employee.latestDate)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={employee.status || 'Unknown'}
                      color={getStatusColor(employee.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Attendance History">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/hr/attendance-record/${employee.employeeId}`)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </TableContainer>
    </Box>
  );
};

export default AttendanceRecord;
