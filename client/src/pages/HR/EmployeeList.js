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
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Alert,
  Snackbar,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { PageLoading } from '../../components/LoadingSpinner';
import api from '../../services/api';

const EmployeeList = () => {
  const { employees, departments, loading: dataLoading } = useData();
  const [paginationLoading, setPaginationLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [paginatedEmployees, setPaginatedEmployees] = useState([]);
  
  const navigate = useNavigate();

  // No need to fetch data - it's provided by DataContext

  // Pagination handlers
  const handleChangePage = useCallback((event, newPage) => {
    setPaginationLoading(true);
    setPage(newPage);
    // Small delay to show loading state
    setTimeout(() => setPaginationLoading(false), 300);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setPaginationLoading(true);
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Reset to first page when changing rows per page
    // Small delay to show loading state
    setTimeout(() => setPaginationLoading(false), 300);
  }, []);

  // Handle filter changes and reset pagination
  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
    setPage(0); // Reset to first page when search changes
  }, []);

  const handleDepartmentFilterChange = useCallback((value) => {
    setDepartmentFilter(value);
    setPage(0); // Reset to first page when department filter changes
  }, []);

  const handleStatusFilterChange = useCallback((value) => {
    setStatusFilter(value);
    setPage(0); // Reset to first page when status filter changes
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchTerm('');
    setDepartmentFilter('');
    setStatusFilter('');
    setPage(0); // Reset to first page when clearing filters
  }, []);

  // No need for useEffect - data is provided by DataContext

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      // Simple search - only search in name and employee ID
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (employee.firstName || '').toLowerCase().includes(searchLower) ||
        (employee.lastName || '').toLowerCase().includes(searchLower) ||
        (employee.employeeId || '').toLowerCase().includes(searchLower);
      
      const employeeDepartment = typeof employee.placementDepartment === 'object' ? employee.placementDepartment?.name : employee.placementDepartment;
      const matchesDepartment = !departmentFilter || employeeDepartment === departmentFilter;
      
      // Handle status filter
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

  // Sort filtered employees by status first (inactive/draft at top), then by Employee ID
  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      // First priority: Status (inactive/draft employees come first)
      const aIsActive = a.isActive === true && a.employmentStatus === 'Active';
      const bIsActive = b.isActive === true && b.employmentStatus === 'Active';
      
      if (aIsActive !== bIsActive) {
        // Inactive/draft employees come first
        return aIsActive ? 1 : -1;
      }
      
      // Second priority: Employee ID (ascending order for same status)
      const idA = parseInt(a.employeeId) || 0;
      const idB = parseInt(b.employeeId) || 0;
      return idA - idB;
    });
  }, [filteredEmployees]);

  // Memoize statistics calculations
  const statistics = useMemo(() => {
    const activeEmployees = employees.filter(emp => emp.isActive === true && emp.employmentStatus === 'Active').length;
    const draftEmployees = employees.filter(emp => emp.employmentStatus === 'Draft').length;
    const inactiveEmployees = employees.filter(emp => emp.isActive === false && emp.employmentStatus !== 'Draft').length;
    
    const newThisMonth = employees.filter(emp => {
      const hireDate = new Date(emp.hireDate);
      const now = new Date();
      return hireDate.getMonth() === now.getMonth() && 
             hireDate.getFullYear() === now.getFullYear();
    }).length;
    
    return {
      totalEmployees: employees.length,
      activeEmployees,
      draftEmployees,
      inactiveEmployees,
      departmentsCount: departments.length,
      newThisMonth
    };
  }, [employees, departments]);

  // Handle pagination for sorted employees
  useEffect(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginated = sortedEmployees.slice(startIndex, endIndex);
    setPaginatedEmployees(paginated);
    setTotalItems(sortedEmployees.length);
  }, [sortedEmployees, page, rowsPerPage]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    try {
      await api.delete(`/hr/employees/${selectedEmployee._id}`);
      setSnackbar({
        open: true,
        message: 'Employee deleted successfully',
        severity: 'success'
      });
      setDeleteDialogOpen(false);
      setSelectedEmployee(null);
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error deleting employee',
        severity: 'error'
      });
    }
  }, [selectedEmployee]);

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



  // Format employee ID to 5 digits with leading zeros
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Employee Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/hr/employees/add')}
        >
          Add Employee
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Employees
              </Typography>
              <Typography variant="h4">
                {statistics.totalEmployees}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                (Excluding deleted)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Employees
              </Typography>
              <Typography variant="h4">
                {statistics.activeEmployees}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                (Excluding deleted)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Draft Employees
              </Typography>
              <Typography variant="h4" color="warning.main">
                {statistics.draftEmployees}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                (Completed onboarding)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Inactive Employees
              </Typography>
              <Typography variant="h4" color="error.main">
                {statistics.inactiveEmployees}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                (Terminated/Resigned)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
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
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                New This Month
              </Typography>
              <Typography variant="h4">
                {statistics.newThisMonth}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                (Excluding deleted)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search employees..."
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
            <FormControl fullWidth>
              <InputLabel>Department</InputLabel>
              <Select
                value={departmentFilter}
                onChange={(e) => handleDepartmentFilterChange(e.target.value)}
                label="Department"
                sx={{
                  '& .MuiSelect-select': {
                    paddingRight: '32px', // Ensure space for dropdown icon
                  },
                  '& .MuiSelect-icon': {
                    right: '8px', // Position icon properly
                  }
                }}
              >
                <MenuItem value="">All Departments</MenuItem>
                {departments
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((dept) => (
                    <MenuItem key={dept._id} value={dept.name}>
                      {dept.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                label="Status"
                sx={{
                  '& .MuiSelect-select': {
                    paddingRight: '32px',
                  },
                  '& .MuiSelect-icon': {
                    right: '8px',
                  }
                }}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              onClick={clearAllFilters}
              fullWidth
              sx={{ height: 56 }}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
        
        {/* Search Results Summary */}
        {(searchTerm || departmentFilter || statusFilter) && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.50', borderRadius: 1, border: '1px solid', borderColor: 'info.200' }}>
            <Typography variant="body2" color="info.main" sx={{ fontWeight: 500 }}>
              🔍 Filtered Results: Found {totalItems} employee(s)
              {totalItems > rowsPerPage && (
                <span> • Use pagination below to navigate through all results</span>
              )}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
              {searchTerm && `Search: "${searchTerm}"`}
              {departmentFilter && ` • Department: ${departmentFilter}`}
              {statusFilter && ` • Status: ${statusFilter === 'active' ? 'Active' : statusFilter === 'draft' ? 'Draft' : 'Inactive'}`}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Employee Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        {/* Pagination Info */}
        <Box sx={{ 
          p: 2, 
          bgcolor: 'grey.50', 
          borderBottom: '1px solid',
          borderColor: 'grey.200',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2
        }}>
          <Box>
            <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 600 }}>
              👥 Employee List
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Showing {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, totalItems)} of {totalItems} employees
            </Typography>
            <Typography variant="caption" color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              📊 Sorted by Status (Inactive/Draft first), then Employee ID
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Page {page + 1} of {Math.ceil(totalItems / rowsPerPage)}
            </Typography>
            {totalItems > 0 && (
              <Chip 
                label={`${Math.ceil(totalItems / rowsPerPage)} pages`} 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            )}
          </Box>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Employee ID
                    <Chip 
                      label="↑ Sorted" 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                  </Box>
                </TableCell>
                <TableCell>ID Card</TableCell>
                <TableCell>Religion</TableCell>
                <TableCell>Marital Status</TableCell>
                <TableCell>Qualification</TableCell>
                <TableCell>Bank Name</TableCell>
                <TableCell>Spouse Name</TableCell>
                <TableCell>Appointment Date</TableCell>
                <TableCell>Probation Period</TableCell>
                <TableCell>End of Probation</TableCell>
                <TableCell>Confirmation Date</TableCell>
                <TableCell>Placement Info</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginationLoading ? (
                <TableRow>
                  <TableCell colSpan={17} align="center" sx={{ py: 4 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <CircularProgress size={24} sx={{ mb: 2 }} />
                      <Typography variant="body2" color="textSecondary">
                        Loading page {page + 1}...
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : paginatedEmployees.length > 0 ? (
                paginatedEmployees.map((employee) => (
                  <TableRow key={employee._id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 2 }}>
                          {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">
                            {employee.firstName} {employee.lastName}
                            {employee.employmentStatus === 'Draft' && (
                              <Chip 
                                label="Draft" 
                                size="small" 
                                color="warning" 
                                variant="outlined"
                                sx={{ ml: 1, fontSize: '0.6rem', height: 18 }}
                              />
                            )}
                            {employee.isActive === false && employee.employmentStatus !== 'Draft' && (
                              <Chip 
                                label="Inactive" 
                                size="small" 
                                color="error" 
                                variant="outlined"
                                sx={{ ml: 1, fontSize: '0.6rem', height: 18 }}
                              />
                            )}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {formatEmployeeId(employee.employeeId)}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{formatEmployeeId(employee.employeeId)}</TableCell>
                    <TableCell>{employee.idCard || 'N/A'}</TableCell>
                    <TableCell>{employee.religion || 'N/A'}</TableCell>
                    <TableCell>{employee.maritalStatus || 'N/A'}</TableCell>
                    <TableCell>{employee.qualification || 'N/A'}</TableCell>
                    <TableCell>{typeof employee.bankName === 'object' ? employee.bankName?.name : employee.bankName || 'N/A'}</TableCell>
                    <TableCell>{employee.spouseName || 'N/A'}</TableCell>
                    <TableCell>{employee.appointmentDate ? new Date(employee.appointmentDate).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell>{employee.probationPeriodMonths ? `${employee.probationPeriodMonths} months` : 'N/A'}</TableCell>
                    <TableCell>{employee.endOfProbationDate ? new Date(employee.endOfProbationDate).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell>{employee.confirmationDate ? new Date(employee.confirmationDate).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="caption" display="block">
                          Company: SGC
                        </Typography>
                        <Typography variant="caption" display="block">
                          {employee.placementDepartment?.name ? `Dept: ${employee.placementDepartment.name}` : 'Dept: N/A'}
                        </Typography>
                        <Typography variant="caption" display="block">
                          {employee.placementDesignation?.title ? `Designation: ${employee.placementDesignation.title}` : 'Designation: N/A'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.phone}</TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusText(employee)}
                        color={getStatusColor(employee)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/hr/employees/${employee._id}`)}
                        title="View Details"
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/hr/employees/${employee._id}/edit`)}
                        title="Edit Employee"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={17} align="center" sx={{ py: 4 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        {dataLoading.employees ? 'Loading employees...' : 'No employees found'}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {dataLoading.employees 
                          ? 'Please wait while we fetch your employee data...' 
                          : searchTerm || departmentFilter || statusFilter
                            ? 'Try adjusting your search criteria or filters'
                            : 'No employees in the system yet'
                        }
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Table Pagination */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          component="div"
          count={totalItems}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Employees per page:"
          labelDisplayedRows={({ from, to, count }) => 
            `${from}-${to} of ${count !== -1 ? count : `more than ${to}`} employees`
          }
          sx={{
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'grey.200',
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              fontWeight: 500,
            },
            '& .MuiTablePagination-select': {
              borderRadius: 1,
            }
          }}
        />
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedEmployee?.firstName} {selectedEmployee?.lastName}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EmployeeList; 