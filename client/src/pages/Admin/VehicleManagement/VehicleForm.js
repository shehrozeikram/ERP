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
    purchasePrice: 0,
    currentMileage: 0,
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (isEdit) {
      fetchVehicle();
    }
  }, [id, isEdit]);

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
        purchasePrice: vehicle.purchasePrice || 0,
        currentMileage: vehicle.currentMileage || 0,
        notes: vehicle.notes || ''
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
        purchasePrice: parseFloat(formData.purchasePrice),
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
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
                  placeholder="e.g., VH001"
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
              <Grid item xs={12} md={4}>
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
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Purchase Price"
                  name="purchasePrice"
                  type="number"
                  value={formData.purchasePrice}
                  onChange={handleChange}
                  required
                  inputProps={{ min: 0, step: 0.01 }}
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
