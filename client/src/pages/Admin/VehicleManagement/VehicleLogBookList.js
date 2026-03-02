import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  IconButton,
  Skeleton,
  Alert,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Assignment as LogBookIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import vehicleLogBookService from '../../../services/vehicleLogBookService';
import { formatDate, formatCurrency } from '../../../utils/dateUtils';

// Lightweight reusable components
const FilterBar = ({ filters, onFilterChange, onSearch }) => (
  <Card sx={{ mb: 2 }}>
    <CardContent>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm={3}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search log entries..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} sm={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Purpose</InputLabel>
            <Select
              value={filters.purpose}
              onChange={(e) => onFilterChange('purpose', e.target.value)}
              label="Purpose"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Business">Business</MenuItem>
              <MenuItem value="Personal">Personal</MenuItem>
              <MenuItem value="Maintenance">Maintenance</MenuItem>
              <MenuItem value="Training">Training</MenuItem>
              <MenuItem value="Emergency">Emergency</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              onChange={(e) => onFilterChange('status', e.target.value)}
              label="Status"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Completed">Completed</MenuItem>
              <MenuItem value="Cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={2}>
          <TextField
            fullWidth
            size="small"
            type="date"
            label="From Date"
            value={filters.fromDate}
            onChange={(e) => onFilterChange('fromDate', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => onSearch()}
            fullWidth
          >
            Add Log Entry
          </Button>
        </Grid>
      </Grid>
    </CardContent>
  </Card>
);

const LogBookTable = ({ entries, onEdit, onDelete, onView, loading }) => (
  <TableContainer component={Paper} variant="outlined">
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Vehicle</TableCell>
          <TableCell>Driver</TableCell>
          <TableCell>Date</TableCell>
          <TableCell>Purpose</TableCell>
          <TableCell>Route</TableCell>
          <TableCell align="right">Distance</TableCell>
          <TableCell align="right">Fuel Cost</TableCell>
          <TableCell>Status</TableCell>
          <TableCell align="center">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell><Skeleton variant="text" height={20} width="75%" /></TableCell>
              <TableCell><Skeleton variant="text" height={20} width="80%" /></TableCell>
              <TableCell><Skeleton variant="text" height={20} width="70%" /></TableCell>
              <TableCell><Skeleton variant="text" height={20} width="85%" /></TableCell>
              <TableCell><Skeleton variant="text" height={20} width="65%" /></TableCell>
              <TableCell align="right"><Skeleton variant="text" height={20} width="45%" /></TableCell>
              <TableCell align="right"><Skeleton variant="text" height={20} width="50%" /></TableCell>
              <TableCell><Skeleton variant="rectangular" height={24} width={70} /></TableCell>
              <TableCell align="center">
                <Box display="flex" justifyContent="center" gap={1}>
                  <Skeleton variant="circular" width={28} height={28} />
                  <Skeleton variant="circular" width={28} height={28} />
                </Box>
              </TableCell>
            </TableRow>
          ))
        ) : entries.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} align="center">
              <Typography color="textSecondary">No log book entries found</Typography>
            </TableCell>
          </TableRow>
        ) : (
          entries.map((entry) => (
            <TableRow key={entry._id} hover>
              <TableCell>
                {entry.vehicleId?.make} {entry.vehicleId?.model}
                <br />
                <Typography variant="caption" color="textSecondary">
                  {entry.vehicleId?.licensePlate}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight="bold">
                  {entry.driverId?.firstName} {entry.driverId?.lastName}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {entry.driverId?.employeeId}
                </Typography>
              </TableCell>
              <TableCell>{formatDate(entry.date)}</TableCell>
              <TableCell>
                <Chip
                  label={entry.purpose}
                  size="small"
                  color={entry.purpose === 'Business' ? 'success' : 'default'}
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {entry.startLocation} → {entry.endLocation}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight="bold">
                  {entry.distanceTraveled || 0} km
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight="bold">
                  {formatCurrency(entry.fuelCost || 0)}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={entry.status}
                  size="small"
                  color={
                    entry.status === 'Completed' ? 'success' :
                    entry.status === 'Active' ? 'primary' : 'default'
                  }
                />
              </TableCell>
              <TableCell align="center">
                <IconButton
                  size="small"
                  onClick={() => onView(entry._id)}
                  color="info"
                  title="View Details"
                >
                  <ViewIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => onEdit(entry._id)}
                  color="primary"
                  title="Edit Entry"
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => onDelete(entry._id)}
                  color="error"
                  title="Delete Entry"
                >
                  <DeleteIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </TableContainer>
);

const VehicleLogBookList = () => {
  const navigate = useNavigate();
  const { vehicleId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entries, setEntries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState({
    search: '',
    purpose: '',
    status: '',
    fromDate: ''
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: page + 1, limit: rowsPerPage };
      if (vehicleId) params.vehicleId = vehicleId;
      if (filters.search) params.search = filters.search;
      if (filters.purpose) params.purpose = filters.purpose;
      if (filters.status) params.status = filters.status;
      if (filters.fromDate) params.startDate = filters.fromDate;

      const res = await vehicleLogBookService.getLogBookEntries(params);
      setEntries(res.data || []);
      setTotalCount(res.pagination?.total || 0);
      setError(null);
    } catch (err) {
      setError('Failed to fetch log book entries');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [vehicleId, page, rowsPerPage, filters]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [vehicleId, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleView = (id) => {
    navigate(`/admin/vehicle-management/logbook/${id}/view`);
  };

  const handleEdit = (id) => {
    navigate(`/admin/vehicle-management/logbook/${id}/edit`);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this log book entry?')) {
      try {
        await vehicleLogBookService.deleteLogBookEntry(id);
        setEntries(prev => prev.filter(entry => entry._id !== id));
      } catch (err) {
        setError('Failed to delete log book entry');
        console.error('Error deleting entry:', err);
      }
    }
  };

  const handleAddLogBook = () => {
    const url = vehicleId 
      ? `/admin/vehicle-management/logbook/new?vehicleId=${vehicleId}`
      : '/admin/vehicle-management/logbook/new';
    navigate(url);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Vehicle Log Book
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddLogBook}
        >
          Add Log Entry
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onSearch={handleAddLogBook}
      />

      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <LogBookIcon sx={{ mr: 1 }} />
            <Typography variant="h6">
              Log Book Entries ({totalCount})
            </Typography>
          </Box>

          <LogBookTable
            entries={entries}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            loading={loading}
          />
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default VehicleLogBookList;
