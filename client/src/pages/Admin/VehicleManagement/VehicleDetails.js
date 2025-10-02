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
  Skeleton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  CircularProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Build as BuildIcon,
  DirectionsCar as DirectionsCarIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import vehicleService from '../../../services/vehicleService';
import vehicleMaintenanceService from '../../../services/vehicleMaintenanceService';
import vehicleLogBookService from '../../../services/vehicleLogBookService';

const VehicleDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [logBookEntries, setLogBookEntries] = useState([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [logBookLoading, setLogBookLoading] = useState(false);

  useEffect(() => {
    fetchVehicle();
    fetchMaintenanceRecords();
    fetchLogBookEntries();
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

  const fetchMaintenanceRecords = async () => {
    try {
      setMaintenanceLoading(true);
      const response = await vehicleMaintenanceService.getVehicleMaintenance(id, { limit: 5 });
      setMaintenanceRecords(response.data);
    } catch (err) {
      console.error('Error fetching maintenance records:', err);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const fetchLogBookEntries = async () => {
    try {
      setLogBookLoading(true);
      const response = await vehicleLogBookService.getVehicleLogBook(id, { limit: 5 });
      setLogBookEntries(response.data);
    } catch (err) {
      console.error('Error fetching log book entries:', err);
    } finally {
      setLogBookLoading(false);
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
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="30%" height={40} />
          <Box display="flex" gap={1}>
            <Skeleton variant="rectangular" width={120} height={36} borderRadius={1} />
            <Skeleton variant="rectangular" width={100} height={36} borderRadius={1} />
          </Box>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Skeleton variant="text" width="25%" height={28} sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <Grid item xs={12} sm={6} key={item}>
                      <Skeleton variant="text" height={16} width="40%" sx={{ mb: 1 }} />
                      <Skeleton variant="text" height={20} width="65%" />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Skeleton variant="text" width="35%" height={24} />
                      <Skeleton variant="rectangular" width={80} height={32} borderRadius={1} />
                    </Box>
                    {[1, 2, 3].map((item) => (
                      <Box key={item} display="flex" alignItems="center" justifyContent="space-between" py={1}>
                        <Skeleton variant="text" height={16} width={60} />
                        <Skeleton variant="text" height={16} width={40} />
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Skeleton variant="text" width="30%" height={24} />
                      <Skeleton variant="rectangular" width={80} height={32} borderRadius={1} />
                    </Box>
                    {[1, 2, 3].map((item) => (
                      <Box key={item} display="flex" alignItems="center" justifyContent="space-between" py={1}>
                        <Skeleton variant="text" height={16} width={55} />
                        <Skeleton variant="text" height={16} width={35} />
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Skeleton variant="text" width="40%" height={28} sx={{ mb: 2 }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Skeleton variant="circular" width={80} height={80} sx={{ mb: 2, mx: 'auto' }} />
                  <Skeleton variant="rectangular" height={32} width={100} sx={{ mx: 'auto', mb: 2 }} />
                  <Skeleton variant="rectangular" height={24} width={80} sx={{ mx: 'auto' }} />
                </Box>
              </CardContent>
            </Card>

            <Stack spacing={2}>
              <Skeleton variant="rectangular" width={120} height={36} borderRadius={1} />
              <Skeleton variant="rectangular" width={100} height={36} borderRadius={1} />
            </Stack>
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="outlined" onClick={() => navigate('/admin/vehicle-management')}>
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
            onClick={() => navigate(`/admin/vehicle-management/vehicles/${id}/edit`)}
          >
            Edit Vehicle
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/admin/vehicle-management')}
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

        {/* Maintenance Records */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" gutterBottom>
                  Recent Maintenance
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/admin/vehicle-management/maintenance/new?vehicleId=${id}`)}
                >
                  Add Maintenance
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              {maintenanceLoading ? (
                <Box display="flex" justifyContent="center" p={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : maintenanceRecords.length > 0 ? (
                <Box>
                  {maintenanceRecords.map((record) => (
                    <Box key={record._id} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {record.title}
                        </Typography>
                        <Chip
                          label={record.status}
                          size="small"
                          color={record.status === 'Completed' ? 'success' : record.status === 'In Progress' ? 'primary' : 'default'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {record.maintenanceType} • {formatDate(record.serviceDate)}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Provider: {record.serviceProvider}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Cost: {formatCurrency(record.cost)}
                      </Typography>
                    </Box>
                  ))}
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => navigate(`/admin/vehicle-management/maintenance?vehicleId=${id}`)}
                    sx={{ mt: 1 }}
                  >
                    View All Maintenance Records
                  </Button>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                  No maintenance records found
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Log Book Entries */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" gutterBottom>
                  Recent Log Book Entries
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/admin/vehicle-management/logbook/new?vehicleId=${id}`)}
                >
                  Add Entry
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              {logBookLoading ? (
                <Box display="flex" justifyContent="center" p={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : logBookEntries.length > 0 ? (
                <Box>
                  {logBookEntries.map((entry) => (
                    <Box key={entry._id} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {entry.driverId?.firstName} {entry.driverId?.lastName}
                        </Typography>
                        <Chip
                          label={entry.purpose}
                          size="small"
                          color={entry.purpose === 'Business' ? 'success' : 'default'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {formatDate(entry.date)} • {entry.distanceTraveled} km
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {entry.startLocation} → {entry.endLocation}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Expenses: {formatCurrency(entry.totalExpenses || 0)}
                      </Typography>
                    </Box>
                  ))}
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => navigate(`/admin/vehicle-management/logbook?vehicleId=${id}`)}
                    sx={{ mt: 1 }}
                  >
                    View All Log Book Entries
                  </Button>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                  No log book entries found
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
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
