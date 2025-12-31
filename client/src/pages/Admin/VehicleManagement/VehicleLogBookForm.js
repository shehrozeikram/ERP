import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import vehicleLogBookService from '../../../services/vehicleLogBookService';
import vehicleService from '../../../services/vehicleService';
import employeeService from '../../../services/employeeService';

const VehicleLogBookForm = () => {
  const navigate = useNavigate();
  const { id, vehicleId } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const [formData, setFormData] = useState({
    vehicleId: vehicleId || '',
    driverId: '',
    date: new Date().toISOString().split('T')[0],
    startMileage: '',
    endMileage: '',
    purpose: 'Business',
    startLocation: '',
    endLocation: '',
    fuelConsumed: '',
    fuelCost: '',
    tollCharges: '',
    parkingCharges: '',
    otherExpenses: '',
    startTime: '',
    endTime: '',
    passengers: [],
    notes: '',
    status: 'Active'
  });

  const [newPassenger, setNewPassenger] = useState({
    name: '',
    employeeId: ''
  });

  useEffect(() => {
    fetchVehicles();
    fetchEmployees();
    if (isEdit) {
      fetchLogBookEntry();
    }
  }, [id, isEdit]);

  const fetchVehicles = async () => {
    try {
      const response = await vehicleService.getVehicles();
      setVehicles(response.data);
    } catch (err) {
      console.error('Error fetching vehicles:', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeService.getEmployees();
      const allEmployees = response.data;
      setEmployees(allEmployees);
      
      // Filter employees with Driver designation
      const driverEmployees = allEmployees.filter(employee => {
        const designation = typeof employee.placementDesignation === 'object' 
          ? employee.placementDesignation?.title 
          : employee.placementDesignation;
        return designation && designation.toLowerCase().includes('driver');
      });
      setDrivers(driverEmployees);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };
  
  // Get drivers list, including current driver if editing
  const getDriversList = () => {
    if (!formData.driverId) {
      return drivers;
    }
    
    // If editing and current driver is not in drivers list, include them
    const currentDriver = employees.find(emp => emp._id === formData.driverId);
    if (currentDriver && !drivers.find(d => d._id === formData.driverId)) {
      return [...drivers, currentDriver];
    }
    
    return drivers;
  };

  const fetchLogBookEntry = async () => {
    try {
      setLoading(true);
      const response = await vehicleLogBookService.getLogBookEntry(id);
      const logEntry = response.data;
      
      setFormData({
        vehicleId: logEntry.vehicleId._id,
        driverId: logEntry.driverId._id,
        date: logEntry.date.split('T')[0],
        startMileage: logEntry.startMileage,
        endMileage: logEntry.endMileage,
        purpose: logEntry.purpose,
        startLocation: logEntry.startLocation,
        endLocation: logEntry.endLocation,
        fuelConsumed: logEntry.fuelConsumed || '',
        fuelCost: logEntry.fuelCost || '',
        tollCharges: logEntry.tollCharges || '',
        parkingCharges: logEntry.parkingCharges || '',
        otherExpenses: logEntry.otherExpenses || '',
        startTime: logEntry.startTime ? new Date(logEntry.startTime).toISOString().slice(0, 16) : '',
        endTime: logEntry.endTime ? new Date(logEntry.endTime).toISOString().slice(0, 16) : '',
        passengers: logEntry.passengers || [],
        notes: logEntry.notes || '',
        status: logEntry.status
      });
    } catch (err) {
      setError('Failed to fetch log book entry');
      console.error('Error fetching log book entry:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handlePassengerChange = (field) => (event) => {
    setNewPassenger(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const addPassenger = () => {
    if (newPassenger.name) {
      setFormData(prev => ({
        ...prev,
        passengers: [...prev.passengers, {
          name: newPassenger.name,
          employeeId: newPassenger.employeeId || null
        }]
      }));
      setNewPassenger({
        name: '',
        employeeId: ''
      });
    }
  };

  const removePassenger = (index) => {
    setFormData(prev => ({
      ...prev,
      passengers: prev.passengers.filter((_, i) => i !== index)
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
        startMileage: parseFloat(formData.startMileage),
        endMileage: parseFloat(formData.endMileage),
        fuelConsumed: formData.fuelConsumed ? parseFloat(formData.fuelConsumed) : 0,
        fuelCost: formData.fuelCost ? parseFloat(formData.fuelCost) : 0,
        tollCharges: formData.tollCharges ? parseFloat(formData.tollCharges) : 0,
        parkingCharges: formData.parkingCharges ? parseFloat(formData.parkingCharges) : 0,
        otherExpenses: formData.otherExpenses ? parseFloat(formData.otherExpenses) : 0,
        startTime: new Date(formData.startTime),
        endTime: new Date(formData.endTime)
      };

      if (isEdit) {
        await vehicleLogBookService.updateLogBookEntry(id, submitData);
        setSuccess('Log book entry updated successfully');
      } else {
        await vehicleLogBookService.createLogBookEntry(submitData);
        setSuccess('Log book entry created successfully');
      }

      setTimeout(() => {
        navigate('/admin/vehicle-management');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save log book entry');
      console.error('Error saving log book entry:', err);
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
      <Typography variant="h4" component="h1" gutterBottom>
        {isEdit ? 'Edit Log Book Entry' : 'Add New Log Book Entry'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Vehicle Selection */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Vehicle</InputLabel>
                  <Select
                    value={formData.vehicleId}
                    onChange={handleChange('vehicleId')}
                    label="Vehicle"
                  >
                    {vehicles.map((vehicle) => (
                      <MenuItem key={vehicle._id} value={vehicle._id}>
                        {vehicle.vehicleId} - {vehicle.make} {vehicle.model} ({vehicle.licensePlate})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Driver Selection */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Driver</InputLabel>
                  <Select
                    value={formData.driverId}
                    onChange={handleChange('driverId')}
                    label="Driver"
                  >
                    {getDriversList().map((employee) => (
                      <MenuItem key={employee._id} value={employee._id}>
                        {employee.firstName} {employee.lastName} ({employee.employeeId})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Date */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange('date')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              {/* Purpose */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Purpose</InputLabel>
                  <Select
                    value={formData.purpose}
                    onChange={handleChange('purpose')}
                    label="Purpose"
                  >
                    <MenuItem value="Business">Business</MenuItem>
                    <MenuItem value="Personal">Personal</MenuItem>
                    <MenuItem value="Maintenance">Maintenance</MenuItem>
                    <MenuItem value="Training">Training</MenuItem>
                    <MenuItem value="Emergency">Emergency</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Start Time */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Start Time"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={handleChange('startTime')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              {/* End Time */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="End Time"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={handleChange('endTime')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              {/* Start Location */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Start Location"
                  value={formData.startLocation}
                  onChange={handleChange('startLocation')}
                  required
                />
              </Grid>

              {/* End Location */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="End Location"
                  value={formData.endLocation}
                  onChange={handleChange('endLocation')}
                  required
                />
              </Grid>

              {/* Start Mileage */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Start Mileage"
                  type="number"
                  value={formData.startMileage}
                  onChange={handleChange('startMileage')}
                  required
                  inputProps={{ min: 0 }}
                />
              </Grid>

              {/* End Mileage */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="End Mileage"
                  type="number"
                  value={formData.endMileage}
                  onChange={handleChange('endMileage')}
                  required
                  inputProps={{ min: 0 }}
                />
              </Grid>

              {/* Fuel Consumed */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Fuel Consumed (Liters)"
                  type="number"
                  value={formData.fuelConsumed}
                  onChange={handleChange('fuelConsumed')}
                  inputProps={{ min: 0, step: 0.1 }}
                />
              </Grid>

              {/* Fuel Cost */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Fuel Cost (PKR)"
                  type="number"
                  value={formData.fuelCost}
                  onChange={handleChange('fuelCost')}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              {/* Toll Charges */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Toll Charges (PKR)"
                  type="number"
                  value={formData.tollCharges}
                  onChange={handleChange('tollCharges')}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              {/* Parking Charges */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Parking Charges (PKR)"
                  type="number"
                  value={formData.parkingCharges}
                  onChange={handleChange('parkingCharges')}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              {/* Other Expenses */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Other Expenses (PKR)"
                  type="number"
                  value={formData.otherExpenses}
                  onChange={handleChange('otherExpenses')}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              {/* Status */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={handleChange('status')}
                    label="Status"
                  >
                    <MenuItem value="Active">Active</MenuItem>
                    <MenuItem value="Completed">Completed</MenuItem>
                    <MenuItem value="Cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Notes */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={formData.notes}
                  onChange={handleChange('notes')}
                  multiline
                  rows={3}
                />
              </Grid>

              {/* Passengers Section */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Passengers
                </Typography>

                {/* Add New Passenger */}
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Passenger Name"
                        value={newPassenger.name}
                        onChange={handlePassengerChange('name')}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Employee (Optional)</InputLabel>
                        <Select
                          value={newPassenger.employeeId}
                          onChange={handlePassengerChange('employeeId')}
                          label="Employee (Optional)"
                        >
                          <MenuItem value="">None</MenuItem>
                          {employees.map((employee) => (
                            <MenuItem key={employee._id} value={employee._id}>
                              {employee.firstName} {employee.lastName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={addPassenger}
                        size="small"
                        disabled={!newPassenger.name}
                      >
                        Add Passenger
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>

                {/* Passengers List */}
                {formData.passengers.map((passenger, index) => (
                  <Paper key={index} sx={{ p: 2, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body1" fontWeight="bold">
                        {passenger.name}
                      </Typography>
                      {passenger.employeeId && (
                        <Typography variant="body2" color="text.secondary">
                          Employee ID: {passenger.employeeId}
                        </Typography>
                      )}
                    </Box>
                    <IconButton
                      color="error"
                      onClick={() => removePassenger(index)}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Paper>
                ))}
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Box display="flex" gap={2} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={() => navigate('/admin/vehicle-management')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={loading}
                  >
                    {loading ? <CircularProgress size={20} /> : (isEdit ? 'Update' : 'Create')}
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

export default VehicleLogBookForm;

