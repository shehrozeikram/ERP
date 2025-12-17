import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Skeleton,
  Chip
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import vehicleService from '../../../services/vehicleService';

const VehicleForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    vehicleId: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    licensePlate: '',
    color: '',
    status: 'Available',
    fuelType: 'Petrol',
    capacity: 4,
    purchaseDate: '',
    currentMileage: 0,
    notes: '',
    trakkerPhone: '',
    trakkerDeviceId: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (isEdit) {
      fetchVehicle();
    } else {
      // Fetch next Vehicle ID when creating new vehicle
      fetchNextVehicleId();
    }
  }, [id, isEdit]);

  const fetchNextVehicleId = async () => {
    try {
      const response = await vehicleService.getNextVehicleId();
      if (response.success && response.data?.nextVehicleId) {
        setFormData(prev => ({
          ...prev,
          vehicleId: response.data.nextVehicleId
        }));
      }
    } catch (err) {
      console.error('Error fetching next Vehicle ID:', err);
    }
  };

  const fetchVehicle = async () => {
    try {
      setLoading(true);
      const response = await vehicleService.getVehicle(id);
      const vehicle = response.data;
      
      setFormData({
        vehicleId: vehicle.vehicleId || '',
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year || new Date().getFullYear(),
        licensePlate: vehicle.licensePlate || '',
        color: vehicle.color || '',
        status: vehicle.status || 'Available',
        fuelType: vehicle.fuelType || 'Petrol',
        capacity: vehicle.capacity || 4,
        purchaseDate: vehicle.purchaseDate ? new Date(vehicle.purchaseDate).toISOString().split('T')[0] : '',
        currentMileage: vehicle.currentMileage || 0,
        notes: vehicle.notes || '',
        trakkerPhone: vehicle.trakkerPhone || '',
        trakkerDeviceId: vehicle.trakkerDeviceId || ''
      });
    } catch (err) {
      setError('Failed to fetch vehicle details');
      console.error('Error fetching vehicle:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const submitData = {
        ...formData,
        year: parseInt(formData.year),
        capacity: parseInt(formData.capacity),
        currentMileage: parseFloat(formData.currentMileage)
      };

      if (isEdit) {
        await vehicleService.updateVehicle(id, submitData);
        setSuccess('Vehicle updated successfully!');
      } else {
        await vehicleService.createVehicle(submitData);
        setSuccess('Vehicle created successfully!');
      }

      setTimeout(() => {
        navigate('/admin/vehicles');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save vehicle');
      console.error('Error saving vehicle:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return (
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="25%" height={40} />
          <Skeleton variant="rectangular" width={80} height={36} borderRadius={1} />
        </Box>

        <Card>
          <CardContent>
            <Grid container spacing={3}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((item) => (
                <Grid item xs={12} sm={6} key={item}>
                  <Skeleton variant="text" height={20} width="35%" sx={{ mb: 1 }} />
                  <Skeleton variant="rectangular" height={56} width="100%" />
                </Grid>
              ))}
              <Grid item xs={12}>
                <Skeleton variant="text" height={20} width="25%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={80} width="100%" />
              </Grid>
              <Grid item xs={12}>
                <Box display="flex" gap={2} sx={{ mt: 3 }}>
                  <Skeleton variant="rectangular" width={140} height={36} borderRadius={1} />
                  <Skeleton variant="rectangular" width={80} height={36} borderRadius={1} />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Vehicle' : 'Add New Vehicle'}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/admin/vehicles')}
        >
          Back to Vehicles
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Vehicle ID"
                  name="vehicleId"
                  value={formData.vehicleId}
                  onChange={handleChange}
                  required
                  disabled={!isEdit}
                  placeholder="e.g., VH001"
                  helperText={!isEdit ? "Auto-generated" : ""}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="License Plate"
                  name="licensePlate"
                  value={formData.licensePlate}
                  onChange={handleChange}
                  required
                  placeholder="e.g., ABC-123"
                />
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Make"
                  name="make"
                  value={formData.make}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Toyota"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Model"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Camry"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Year"
                  name="year"
                  type="number"
                  value={formData.year}
                  onChange={handleChange}
                  required
                  inputProps={{ min: 1990, max: new Date().getFullYear() + 1 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Color"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Red"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Fuel Type</InputLabel>
                  <Select
                    name="fuelType"
                    value={formData.fuelType}
                    onChange={handleChange}
                    label="Fuel Type"
                  >
                    <MenuItem value="Petrol">Petrol</MenuItem>
                    <MenuItem value="Diesel">Diesel</MenuItem>
                    <MenuItem value="Electric">Electric</MenuItem>
                    <MenuItem value="Hybrid">Hybrid</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Capacity (Passengers)"
                  name="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={handleChange}
                  required
                  inputProps={{ min: 1, max: 50 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Purchase Date"
                  name="purchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={handleChange}
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Current Mileage"
                  name="currentMileage"
                  type="number"
                  value={formData.currentMileage}
                  onChange={handleChange}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    label="Status"
                  >
                    <MenuItem value="Available">Available</MenuItem>
                    <MenuItem value="In Use">In Use</MenuItem>
                    <MenuItem value="Maintenance">Maintenance</MenuItem>
                    <MenuItem value="Retired">Retired</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mt: 2, mb: 2, fontWeight: 'bold' }}>
                  Trakker GPS Tracking (Optional)
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Trakker Phone Number"
                  name="trakkerPhone"
                  value={formData.trakkerPhone}
                  onChange={handleChange}
                  placeholder="e.g., 03129110707"
                  helperText="Phone number associated with Trakker device"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Trakker Device ID"
                  name="trakkerDeviceId"
                  value={formData.trakkerDeviceId}
                  onChange={handleChange}
                  placeholder="e.g., 1707"
                  helperText="Device ID from Trakker system"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  multiline
                  rows={3}
                  placeholder="Additional notes about the vehicle..."
                />
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" gap={2}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    size="large"
                  >
                    {loading ? <CircularProgress size={24} /> : (isEdit ? 'Update Vehicle' : 'Create Vehicle')}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/admin/vehicles')}
                    size="large"
                  >
                    Cancel
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default VehicleForm;
