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
import vehicleMaintenanceService from '../../../services/vehicleMaintenanceService';
import vehicleService from '../../../services/vehicleService';
import { formatDate } from '../../../utils/dateUtils';

const VehicleMaintenanceForm = () => {
  const navigate = useNavigate();
  const { id, vehicleId } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [vehicles, setVehicles] = useState([]);

  const [formData, setFormData] = useState({
    vehicleId: vehicleId || '',
    maintenanceType: 'Routine',
    title: '',
    description: '',
    cost: '',
    serviceDate: new Date().toISOString().split('T')[0],
    nextServiceDate: '',
    serviceProvider: '',
    contactNumber: '',
    partsReplaced: [],
    mileageAtService: '',
    status: 'Scheduled',
    priority: 'Medium',
    estimatedDuration: '',
    notes: ''
  });

  const [newPart, setNewPart] = useState({
    partName: '',
    partNumber: '',
    cost: '',
    warranty: ''
  });

  useEffect(() => {
    fetchVehicles();
    if (isEdit) {
      fetchMaintenanceRecord();
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

  const fetchMaintenanceRecord = async () => {
    try {
      setLoading(true);
      const response = await vehicleMaintenanceService.getMaintenanceRecord(id);
      const maintenance = response.data;
      
      setFormData({
        vehicleId: maintenance.vehicleId._id,
        maintenanceType: maintenance.maintenanceType,
        title: maintenance.title,
        description: maintenance.description,
        cost: maintenance.cost,
        serviceDate: maintenance.serviceDate.split('T')[0],
        nextServiceDate: maintenance.nextServiceDate ? maintenance.nextServiceDate.split('T')[0] : '',
        serviceProvider: maintenance.serviceProvider,
        contactNumber: maintenance.contactNumber || '',
        partsReplaced: maintenance.partsReplaced || [],
        mileageAtService: maintenance.mileageAtService,
        status: maintenance.status,
        priority: maintenance.priority,
        estimatedDuration: maintenance.estimatedDuration || '',
        notes: maintenance.notes || ''
      });
    } catch (err) {
      setError('Failed to fetch maintenance record');
      console.error('Error fetching maintenance record:', err);
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

  const handlePartChange = (field) => (event) => {
    setNewPart(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const addPart = () => {
    if (newPart.partName && newPart.cost) {
      setFormData(prev => ({
        ...prev,
        partsReplaced: [...prev.partsReplaced, {
          partName: newPart.partName,
          partNumber: newPart.partNumber,
          cost: parseFloat(newPart.cost),
          warranty: newPart.warranty
        }]
      }));
      setNewPart({
        partName: '',
        partNumber: '',
        cost: '',
        warranty: ''
      });
    }
  };

  const removePart = (index) => {
    setFormData(prev => ({
      ...prev,
      partsReplaced: prev.partsReplaced.filter((_, i) => i !== index)
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
        cost: parseFloat(formData.cost),
        mileageAtService: parseFloat(formData.mileageAtService),
        estimatedDuration: formData.estimatedDuration ? parseFloat(formData.estimatedDuration) : undefined
      };

      if (isEdit) {
        await vehicleMaintenanceService.updateMaintenanceRecord(id, submitData);
        setSuccess('Maintenance record updated successfully');
      } else {
        await vehicleMaintenanceService.createMaintenanceRecord(submitData);
        setSuccess('Maintenance record created successfully');
      }

      setTimeout(() => {
        navigate('/admin/vehicle-management');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save maintenance record');
      console.error('Error saving maintenance record:', err);
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
        {isEdit ? 'Edit Maintenance Record' : 'Add New Maintenance Record'}
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

              {/* Maintenance Type */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Maintenance Type</InputLabel>
                  <Select
                    value={formData.maintenanceType}
                    onChange={handleChange('maintenanceType')}
                    label="Maintenance Type"
                  >
                    <MenuItem value="Routine">Routine</MenuItem>
                    <MenuItem value="Repair">Repair</MenuItem>
                    <MenuItem value="Inspection">Inspection</MenuItem>
                    <MenuItem value="Emergency">Emergency</MenuItem>
                    <MenuItem value="Preventive">Preventive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Title */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={formData.title}
                  onChange={handleChange('title')}
                  required
                />
              </Grid>

              {/* Description */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={handleChange('description')}
                  multiline
                  rows={3}
                  required
                />
              </Grid>

              {/* Service Date */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Service Date"
                  type="date"
                  value={formData.serviceDate}
                  onChange={handleChange('serviceDate')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              {/* Next Service Date */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Next Service Date"
                  type="date"
                  value={formData.nextServiceDate}
                  onChange={handleChange('nextServiceDate')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Service Provider */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Service Provider"
                  value={formData.serviceProvider}
                  onChange={handleChange('serviceProvider')}
                  required
                />
              </Grid>

              {/* Contact Number */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contact Number"
                  value={formData.contactNumber}
                  onChange={handleChange('contactNumber')}
                />
              </Grid>

              {/* Cost */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Service Cost (PKR)"
                  type="number"
                  value={formData.cost}
                  onChange={handleChange('cost')}
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              {/* Mileage at Service */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Mileage at Service"
                  type="number"
                  value={formData.mileageAtService}
                  onChange={handleChange('mileageAtService')}
                  required
                  inputProps={{ min: 0 }}
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
                    <MenuItem value="Scheduled">Scheduled</MenuItem>
                    <MenuItem value="In Progress">In Progress</MenuItem>
                    <MenuItem value="Completed">Completed</MenuItem>
                    <MenuItem value="Cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Priority */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={handleChange('priority')}
                    label="Priority"
                  >
                    <MenuItem value="Low">Low</MenuItem>
                    <MenuItem value="Medium">Medium</MenuItem>
                    <MenuItem value="High">High</MenuItem>
                    <MenuItem value="Critical">Critical</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Estimated Duration */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Estimated Duration (hours)"
                  type="number"
                  value={formData.estimatedDuration}
                  onChange={handleChange('estimatedDuration')}
                  inputProps={{ min: 0, step: 0.5 }}
                />
              </Grid>

              {/* Notes */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={formData.notes}
                  onChange={handleChange('notes')}
                  multiline
                  rows={2}
                />
              </Grid>

              {/* Parts Replaced Section */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Parts Replaced
                </Typography>

                {/* Add New Part */}
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="Part Name"
                        value={newPart.partName}
                        onChange={handlePartChange('partName')}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="Part Number"
                        value={newPart.partNumber}
                        onChange={handlePartChange('partNumber')}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="Cost (PKR)"
                        type="number"
                        value={newPart.cost}
                        onChange={handlePartChange('cost')}
                        size="small"
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="Warranty"
                        value={newPart.warranty}
                        onChange={handlePartChange('warranty')}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={addPart}
                        size="small"
                        disabled={!newPart.partName || !newPart.cost}
                      >
                        Add Part
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>

                {/* Parts List */}
                {formData.partsReplaced.map((part, index) => (
                  <Paper key={index} sx={{ p: 2, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body1" fontWeight="bold">
                        {part.partName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Part #: {part.partNumber || 'N/A'} | Cost: PKR {part.cost} | Warranty: {part.warranty || 'N/A'}
                      </Typography>
                    </Box>
                    <IconButton
                      color="error"
                      onClick={() => removePart(index)}
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

export default VehicleMaintenanceForm;

