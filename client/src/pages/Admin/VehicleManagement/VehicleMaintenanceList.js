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
  Build as MaintenanceIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import vehicleMaintenanceService from '../../../services/vehicleMaintenanceService';
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
            placeholder="Search maintenance..."
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
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              onChange={(e) => onFilterChange('status', e.target.value)}
              label="Status"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Scheduled">Scheduled</MenuItem>
              <MenuItem value="In Progress">In Progress</MenuItem>
              <MenuItem value="Completed">Completed</MenuItem>
              <MenuItem value="Cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select
              value={filters.type}
              onChange={(e) => onFilterChange('type', e.target.value)}
              label="Type"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Routine">Routine</MenuItem>
              <MenuItem value="Repair">Repair</MenuItem>
              <MenuItem value="Inspection">Inspection</MenuItem>
              <MenuItem value="Emergency">Emergency</MenuItem>
              <MenuItem value="Preventive">Preventive</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Priority</InputLabel>
            <Select
              value={filters.priority}
              onChange={(e) => onFilterChange('priority', e.target.value)}
              label="Priority"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Critical">Critical</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => onSearch()}
            fullWidth
          >
            Add Maintenance
          </Button>
        </Grid>
      </Grid>
    </CardContent>
  </Card>
);

const MaintenanceTable = ({ records, onEdit, onDelete, loading }) => (
  <TableContainer component={Paper} variant="outlined">
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Vehicle</TableCell>
          <TableCell>Title</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Date</TableCell>
          <TableCell>Provider</TableCell>
          <TableCell align="right">Cost</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Priority</TableCell>
          <TableCell align="center">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell><Skeleton variant="text" height={20} width="80%" /></TableCell>
              <TableCell><Skeleton variant="text" height={20} width="90%" /></TableCell>
              <TableCell><Skeleton variant="rectangular" height={24} width={60} /></TableCell>
              <TableCell><Skeleton variant="text" height={20} width="70%" /></TableCell>
              <TableCell><Skeleton variant="text" height={20} width="60%" /></TableCell>
              <TableCell align="right"><Skeleton variant="text" height={20} width="50%" /></TableCell>
              <TableCell><Skeleton variant="rectangular" height={24} width={70} /></TableCell>
              <TableCell><Skeleton variant="rectangular" height={24} width={60} /></TableCell>
              <TableCell align="center">
                <Box display="flex" justifyContent="center" gap={1}>
                  <Skeleton variant="circular" width={28} height={28} />
                  <Skeleton variant="circular" width={28} height={28} />
                </Box>
              </TableCell>
            </TableRow>
          ))
        ) : records.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} align="center">
              <Typography color="textSecondary">No maintenance records found</Typography>
            </TableCell>
          </TableRow>
        ) : (
          records.map((record) => (
            <TableRow key={record._id} hover>
              <TableCell>
                {record.vehicleId?.make} {record.vehicleId?.model}
                <br />
                <Typography variant="caption" color="textSecondary">
                  {record.vehicleId?.licensePlate}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight="bold">
                  {record.title}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {record.description?.substring(0, 50)}...
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={record.maintenanceType}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </TableCell>
              <TableCell>{formatDate(record.serviceDate)}</TableCell>
              <TableCell>{record.serviceProvider}</TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight="bold">
                  {formatCurrency(record.cost)}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={record.status}
                  size="small"
                  color={
                    record.status === 'Completed' ? 'success' :
                    record.status === 'In Progress' ? 'primary' :
                    record.status === 'Cancelled' ? 'error' : 'default'
                  }
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={record.priority}
                  size="small"
                  color={
                    record.priority === 'Critical' ? 'error' :
                    record.priority === 'High' ? 'warning' :
                    record.priority === 'Medium' ? 'info' : 'default'
                  }
                  variant="outlined"
                />
              </TableCell>
              <TableCell align="center">
                <IconButton
                  size="small"
                  onClick={() => onEdit(record._id)}
                  color="primary"
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => onDelete(record._id)}
                  color="error"
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

const VehicleMaintenanceList = () => {
  const navigate = useNavigate();
  const { vehicleId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [records, setRecords] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    type: '',
    priority: ''
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: page + 1, limit: rowsPerPage };
      if (vehicleId) params.vehicleId = vehicleId;
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.type) params.maintenanceType = filters.type;

      const res = await vehicleMaintenanceService.getMaintenanceRecords(params);
      setRecords(res.data || []);
      setTotalCount(res.pagination?.total || 0);
      setError(null);
    } catch (err) {
      setError('Failed to fetch maintenance records');
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

  const handleEdit = (id) => {
    navigate(`/admin/vehicle-management/maintenance/${id}/edit`);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this maintenance record?')) {
      try {
        await vehicleMaintenanceService.deleteMaintenanceRecord(id);
        setRecords(prev => prev.filter(record => record._id !== id));
      } catch (err) {
        setError('Failed to delete maintenance record');
        console.error('Error deleting record:', err);
      }
    }
  };

  const handleAddMaintenance = () => {
    const url = vehicleId 
      ? `/admin/vehicle-management/maintenance/new?vehicleId=${vehicleId}`
      : '/admin/vehicle-management/maintenance/new';
    navigate(url);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Maintenance Records
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddMaintenance}
        >
          Add Maintenance
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
        onSearch={handleAddMaintenance}
      />

      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <MaintenanceIcon sx={{ mr: 1 }} />
            <Typography variant="h6">
              Maintenance Records ({totalCount})
            </Typography>
          </Box>

          <MaintenanceTable
            records={records}
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

export default VehicleMaintenanceList;
