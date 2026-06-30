import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  Autocomplete,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  TrendingUp as TrendingUpIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import incrementService from '../../services/incrementService';
import api from '../../services/api';

const IncrementHistory = () => {
  const navigate = useNavigate();
  const [increments, setIncrements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({
    employeeId: '',
    status: '',
    incrementType: '',
    searchTerm: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;
  
  // Delete Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIncrementForDelete, setSelectedIncrementForDelete] = useState(null);

  useEffect(() => {
    fetchEmployees();
    fetchIncrementHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentPage]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/hr/employees?isActive=true');
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchIncrementHistory = async () => {
    try {
      setLoading(true);
      
      // For now, we'll fetch all increments and filter client-side
      // In a real app, you'd implement server-side filtering and pagination
      let allIncrements = [];
      const response = await incrementService.getAllIncrements();
      if (response.success && response.data) {
        allIncrements = response.data;
      }
      
      // Sort by request date (newest first)
      allIncrements.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));
      
      // Apply filters
      let filteredIncrements = allIncrements;
      
      if (filters.employeeId) {
        filteredIncrements = filteredIncrements.filter(inc => inc.employee._id === filters.employeeId);
      }
      
      if (filters.status) {
        filteredIncrements = filteredIncrements.filter(inc => inc.status === filters.status);
      }
      
      if (filters.incrementType) {
        filteredIncrements = filteredIncrements.filter(inc => inc.incrementType === filters.incrementType);
      }
      
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filteredIncrements = filteredIncrements.filter(inc => 
          inc.employee.firstName.toLowerCase().includes(searchLower) ||
          inc.employee.lastName.toLowerCase().includes(searchLower) ||
          inc.employee.employeeId.toLowerCase().includes(searchLower) ||
          inc.reason.toLowerCase().includes(searchLower)
        );
      }
      
      // Pagination
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedIncrements = filteredIncrements.slice(startIndex, endIndex);
      
      setIncrements(paginatedIncrements);
      setTotalPages(Math.ceil(filteredIncrements.length / itemsPerPage));
      
    } catch (error) {
      console.error('Error fetching increment history:', error);
      setError('Failed to fetch increment history');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'implemented': return 'info';
      default: return 'default';
    }
  };

  const getIncrementTypeColor = (type) => {
    switch (type) {
      case 'annual': return 'primary';
      case 'performance': return 'success';
      case 'special': return 'secondary';
      case 'market_adjustment': return 'info';
      default: return 'default';
    }
  };

  const clearFilters = () => {
    setFilters({
      employeeId: '',
      status: '',
      incrementType: '',
      searchTerm: ''
    });
    setCurrentPage(1);
  };

  const handleDeleteClick = (increment) => {
    setSelectedIncrementForDelete(increment);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedIncrementForDelete) return;
    try {
      setLoading(true);
      const response = await incrementService.deleteIncrement(selectedIncrementForDelete._id);
      if (response.success) {
        // Refresh the list
        fetchIncrementHistory();
        setDeleteDialogOpen(false);
        setSelectedIncrementForDelete(null);
      } else {
        setError(response.error || 'Failed to delete increment');
      }
    } catch (error) {
      console.error('Error deleting increment:', error);
      setError('An error occurred while deleting the increment');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedIncrementForDelete(null);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/hr/increments')}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4" component="h1">
          <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Increment History
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <FilterIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Search"
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                placeholder="Search by name, ID, or reason..."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                fullWidth
                options={employees}
                getOptionLabel={(employee) => 
                  `${employee.firstName} ${employee.lastName} (${employee.employeeId})`
                }
                value={employees.find(emp => emp._id === filters.employeeId) || null}
                onChange={(event, newValue) => {
                  handleFilterChange('employeeId', newValue?._id || '');
                }}
                filterOptions={(options, { inputValue }) => {
                  const filter = inputValue.toLowerCase();
                  return options.filter(option =>
                    option.firstName?.toLowerCase().includes(filter) ||
                    option.lastName?.toLowerCase().includes(filter) ||
                    option.employeeId?.toLowerCase().includes(filter) ||
                    `${option.firstName} ${option.lastName}`.toLowerCase().includes(filter)
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Employee"
                    placeholder="Search by name or employee ID..."
                  />
                )}
                renderOption={(props, employee) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body1">
                        {employee.firstName} {employee.lastName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        ID: {employee.employeeId} • Department: {employee.placementDepartment?.name || 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                )}
                noOptionsText="No employees found"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                  <MenuItem value="implemented">Implemented</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={filters.incrementType}
                  onChange={(e) => handleFilterChange('incrementType', e.target.value)}
                  label="Type"
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="annual">Annual</MenuItem>
                  <MenuItem value="performance">Performance</MenuItem>
                  <MenuItem value="special">Special</MenuItem>
                  <MenuItem value="market_adjustment">Market Adjustment</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Box mt={2}>
            <Button
              variant="outlined"
              onClick={clearFilters}
              size="small"
            >
              Clear Filters
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Increment History ({increments.length} records)
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Previous Salary</TableCell>
                  <TableCell>New Salary</TableCell>
                  <TableCell>Increment</TableCell>
                  <TableCell>Percentage</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Request Date</TableCell>
                  <TableCell>Effective Date</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {increments.map((increment) => (
                  <TableRow key={increment._id}>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2">
                          {increment.employee?.firstName} {increment.employee?.lastName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {increment.employee?.employeeId}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={increment.incrementType}
                        color={getIncrementTypeColor(increment.incrementType)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      Rs. {increment.previousSalary.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      Rs. {increment.newSalary.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Typography color={increment.incrementAmount > 0 ? 'success.main' : 'error.main'}>
                        Rs. {increment.incrementAmount.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color={increment.incrementPercentage > 0 ? 'success.main' : 'error.main'}>
                        {increment.incrementPercentage}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={increment.status}
                        color={getStatusColor(increment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(increment.requestDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(increment.effectiveDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {increment.reason}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton color="error" onClick={() => handleDeleteClick(increment)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={(event, page) => setCurrentPage(page)}
                color="primary"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this increment for <b>{selectedIncrementForDelete?.employee?.firstName} {selectedIncrementForDelete?.employee?.lastName}</b>?
            <br /><br />
            {['implemented', 'approved'].includes(selectedIncrementForDelete?.status) && (
              <span style={{ color: 'red' }}>
                <b>Warning:</b> Since this increment was {selectedIncrementForDelete.status}, deleting it will reverse its effect. The employee's current salary and any upcoming payrolls will be reduced by Rs. {selectedIncrementForDelete?.incrementAmount?.toLocaleString()}.
              </span>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IncrementHistory;
