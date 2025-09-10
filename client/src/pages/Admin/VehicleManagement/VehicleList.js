import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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
  Grid,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import vehicleService from '../../../services/vehicleService';

const VehicleList = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, vehicle: null });

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      
      const response = await vehicleService.getVehicles(params);
      setVehicles(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch vehicles');
      console.error('Error fetching vehicles:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const handleDelete = async () => {
    try {
      await vehicleService.deleteVehicle(deleteDialog.vehicle._id);
      setDeleteDialog({ open: false, vehicle: null });
      fetchVehicles();
    } catch (err) {
      setError('Failed to delete vehicle');
      console.error('Error deleting vehicle:', err);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Available': 'success',
      'In Use': 'primary',
      'Maintenance': 'warning',
      'Retired': 'default'
    };
    return colors[status] || 'default';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(amount);
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Vehicle Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/vehicles/new')}
        >
          Add Vehicle
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search vehicles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="Available">Available</MenuItem>
                  <MenuItem value="In Use">In Use</MenuItem>
                  <MenuItem value="Maintenance">Maintenance</MenuItem>
                  <MenuItem value="Retired">Retired</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Vehicle ID</TableCell>
                  <TableCell>Make & Model</TableCell>
                  <TableCell>Year</TableCell>
                  <TableCell>License Plate</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Assigned Driver</TableCell>
                  <TableCell>Purchase Price</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle._id}>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {vehicle.vehicleId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {vehicle.make} {vehicle.model}
                      </Typography>
                    </TableCell>
                    <TableCell>{vehicle.year}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {vehicle.licensePlate}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={vehicle.status}
                        color={getStatusColor(vehicle.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {vehicle.assignedDriver ? (
                        <Box display="flex" alignItems="center">
                          <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                          <Typography variant="body2">
                            {vehicle.assignedDriver.firstName} {vehicle.assignedDriver.lastName}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Unassigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(vehicle.purchasePrice)}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/admin/vehicles/${vehicle._id}`)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteDialog({ open: true, vehicle })}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, vehicle: null })}>
        <DialogTitle>Delete Vehicle</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete vehicle {deleteDialog.vehicle?.vehicleId}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, vehicle: null })}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VehicleList;
