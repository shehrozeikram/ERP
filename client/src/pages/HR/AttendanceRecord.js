import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  InputAdornment,
  Chip,
  Avatar,
  Alert,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { PageLoading } from '../../components/LoadingSpinner';

const AttendanceRecord = () => {
  const { employees, departments, loading: dataLoading } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paginationLoading, setPaginationLoading] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [paginatedEmployees, setPaginatedEmployees] = useState([]);
  
  const navigate = useNavigate();

  // Pagination handlers
  const handleChangePage = useCallback((event, newPage) => {
    setPaginationLoading(true);
    setPage(newPage);
    setTimeout(() => setPaginationLoading(false), 300);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setPaginationLoading(true);
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
    setTimeout(() => setPaginationLoading(false), 300);
  }, []);

  // Filter handlers
  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
    setPage(0);
  }, []);

  const handleDepartmentFilterChange = useCallback((value) => {
    setDepartmentFilter(value);
    setPage(0);
  }, []);

  const handleStatusFilterChange = useCallback((value) => {
    setStatusFilter(value);
    setPage(0);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchTerm('');
    setDepartmentFilter('');
    setStatusFilter('');
    setPage(0);
  }, []);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (employee.firstName || '').toLowerCase().includes(searchLower) ||
        (employee.lastName || '').toLowerCase().includes(searchLower) ||
        (employee.employeeId || '').toLowerCase().includes(searchLower);
      
      const employeeDepartment = typeof employee.placementDepartment === 'object' ? employee.placementDepartment?.name : employee.placementDepartment;
      const matchesDepartment = !departmentFilter || employeeDepartment === departmentFilter;
      
      let matchesStatus = true;
      if (statusFilter) {
        if (statusFilter === 'active') {
          matchesStatus = employee.isActive === true && employee.employmentStatus === 'Active';
        } else if (statusFilter === 'draft') {
          matchesStatus = employee.employmentStatus === 'Draft';
        } else if (statusFilter === 'inactive') {
          matchesStatus = employee.isActive === false && employee.employmentStatus !== 'Draft';
        }
      }

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employees, searchTerm, departmentFilter, statusFilter]);

  // Sort employees by status and employee ID
  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      const aIsActive = a.isActive === true && a.employmentStatus === 'Active';
      const bIsActive = b.isActive === true && b.employmentStatus === 'Active';
      
      if (aIsActive !== bIsActive) {
        return aIsActive ? 1 : -1;
      }
      
      const idA = parseInt(a.employeeId) || 0;
      const idB = parseInt(b.employeeId) || 0;
      return idA - idB;
    });
  }, [filteredEmployees]);

  // Handle pagination
  useEffect(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginated = sortedEmployees.slice(startIndex, endIndex);
    setPaginatedEmployees(paginated);
  }, [sortedEmployees, page, rowsPerPage]);

  // Statistics
  const statistics = useMemo(() => {
    const activeEmployees = employees.filter(emp => emp.isActive === true && emp.employmentStatus === 'Active').length;
    const draftEmployees = employees.filter(emp => emp.employmentStatus === 'Draft').length;
    const inactiveEmployees = employees.filter(emp => emp.isActive === false && emp.employmentStatus !== 'Draft').length;
    
    return {
      totalEmployees: employees.length,
      activeEmployees,
      draftEmployees,
      inactiveEmployees,
      departmentsCount: departments.length
    };
  }, [employees, departments]);

  const getStatusColor = (employee) => {
    if (employee.isActive === true && employee.employmentStatus === 'Active') {
      return 'success';
    } else if (employee.employmentStatus === 'Draft') {
      return 'warning';
    } else {
      return 'error';
    }
  };

  const getStatusText = (employee) => {
    if (employee.isActive === true && employee.employmentStatus === 'Active') {
      return 'Active';
    } else if (employee.employmentStatus === 'Draft') {
      return 'Draft';
    } else {
      return 'Inactive';
    }
  };

  const formatEmployeeId = (employeeId) => {
    if (!employeeId) return '';
    return employeeId.toString().padStart(5, '0');
  };

  if (dataLoading.employees || dataLoading.departments) {
    return (
      <PageLoading 
        message="Loading employees..." 
        showSkeleton={true}
        skeletonType="table"
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">
            Attendance Record
          </Typography>
          <Typography variant="body2" color="textSecondary">
            View employee attendance history from ZKBio Time system
          </Typography>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Employees
              </Typography>
              <Typography variant="h4">
                {statistics.totalEmployees}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Employees
              </Typography>
              <Typography variant="h4" color="success.main">
                {statistics.activeEmployees}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Draft Employees
              </Typography>
              <Typography variant="h4" color="warning.main">
                {statistics.draftEmployees}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Departments
              </Typography>
              <Typography variant="h4">
                {statistics.departmentsCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search by Employee ID or Name..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              label="Department"
              value={departmentFilter}
              onChange={(e) => handleDepartmentFilterChange(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept.name}>
                  {dept.name}
                </option>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              label="Status"
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <IconButton
              onClick={clearAllFilters}
              title="Clear Filters"
              sx={{ height: 56, width: 56 }}
            >
              <ScheduleIcon />
            </IconButton>
          </Grid>
        </Grid>
        
        {/* Search Results Summary */}
        {(searchTerm || departmentFilter || statusFilter) && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.50', borderRadius: 1 }}>
            <Typography variant="body2" color="info.main">
              🔍 Found {sortedEmployees.length} employee(s)
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Employee Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Employee ID</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginationLoading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} sx={{ mr: 2 }} />
                    <Typography variant="body2" color="textSecondary">
                      Loading employees...
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : paginatedEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="textSecondary" gutterBottom>
                      No employees found
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {searchTerm || departmentFilter || statusFilter
                        ? 'Try adjusting your search criteria'
                        : 'No employees in the system yet'
                      }
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedEmployees.map((employee) => (
                <TableRow key={employee._id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                        {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          {employee.firstName} {employee.lastName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {employee.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {formatEmployeeId(employee.employeeId)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {typeof employee.placementDepartment === 'object' 
                        ? employee.placementDepartment?.name 
                        : employee.placementDepartment || 'N/A'
                      }
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusText(employee)}
                      color={getStatusColor(employee)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Attendance History">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/hr/attendance-record/${employee.employeeId}`)}
                        color="primary"
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
          count={sortedEmployees.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
    </Box>
  );
};

export default AttendanceRecord;
