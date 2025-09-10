import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Edit as EditIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import vehicleService from '../../../services/vehicleService';

const VehicleDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState('');

  useEffect(() => {
    fetchVehicle();
  }, [id]);

  const fetchVehicle = async () => {
    try {
      setLoading(true);
      const response = await vehicleService.getVehicle(id);
      setVehicle(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch vehicle details');
      console.error('Error fetching vehicle:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDriver = async () => {
    try {
      await vehicleService.assignDriver(id, selectedDriver || null);
      setAssignDialog(false);
      setSelectedDriver('');
      fetchVehicle();
    } catch (err) {
      setError('Failed to assign driver');
      console.error('Error assigning driver:', err);
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

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="outlined" onClick={() => navigate('/admin/vehicles')}>
          Back to Vehicles
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Vehicle Details
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<AssignmentIcon />}
            onClick={() => setAssignDialog(true)}
          >
            Assign Driver
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/admin/vehicles/${id}/edit`)}
          >
            Edit Vehicle
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/admin/vehicles')}
          >
            Back to Vehicles
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Vehicle ID
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {vehicle.vehicleId}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    License Plate
                  </Typography>
                  <Typography variant="h6" fontFamily="monospace">
                    {vehicle.licensePlate}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Make & Model
                  </Typography>
                  <Typography variant="body1">
                    {vehicle.make} {vehicle.model}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Year
                  </Typography>
                  <Typography variant="body1">
                    {vehicle.year}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Color
                  </Typography>
                  <Typography variant="body1">
                    {vehicle.color}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Fuel Type
                  </Typography>
                  <Typography variant="body1">
                    {vehicle.fuelType}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Capacity
                  </Typography>
                  <Typography variant="body1">
                    {vehicle.capacity} passengers
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Current Mileage
                  </Typography>
                  <Typography variant="body1">
                    {vehicle.currentMileage.toLocaleString()} km
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Status & Assignment */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status & Assignment
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box mb={2}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Current Status
                </Typography>
                <Chip
                  label={vehicle.status}
                  color={getStatusColor(vehicle.status)}
                  size="large"
                />
              </Box>
              
              <Box mb={2}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Assigned Driver
                </Typography>
                {vehicle.assignedDriver ? (
                  <Box display="flex" alignItems="center">
                    <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Box>
                      <Typography variant="body1" fontWeight="bold">
                        {vehicle.assignedDriver.firstName} {vehicle.assignedDriver.lastName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ID: {vehicle.assignedDriver.employeeId}
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No driver assigned
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Financial Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Financial Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Purchase Date
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(vehicle.purchaseDate)}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Purchase Price
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {formatCurrency(vehicle.purchasePrice)}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Maintenance Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Maintenance Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Last Service Date
                  </Typography>
                  <Typography variant="body1">
                    {vehicle.lastServiceDate ? formatDate(vehicle.lastServiceDate) : 'Not serviced'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Next Service Date
                  </Typography>
                  <Typography variant="body1">
                    {vehicle.nextServiceDate ? formatDate(vehicle.nextServiceDate) : 'Not scheduled'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Notes */}
        {vehicle.notes && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Notes
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body1">
                  {vehicle.notes}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Assign Driver Dialog */}
      <Dialog open={assignDialog} onClose={() => setAssignDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Driver</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a driver to assign to this vehicle, or leave empty to unassign current driver.
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Select Driver</InputLabel>
            <Select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              label="Select Driver"
            >
              <MenuItem value="">
                <em>Unassign Driver</em>
              </MenuItem>
              {/* Note: In a real implementation, you would fetch available drivers */}
              <MenuItem value="driver1">John Doe (EMP001)</MenuItem>
              <MenuItem value="driver2">Jane Smith (EMP002)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialog(false)}>Cancel</Button>
          <Button onClick={handleAssignDriver} variant="contained">
            Assign Driver
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VehicleDetails;
