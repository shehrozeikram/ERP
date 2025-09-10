import React, { useState, useEffect, useCallback } from 'react';
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
  Chip,
  Box as MuiBox
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import eventService from '../../../services/eventService';

const EventForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Meeting',
    eventDate: '',
    startTime: '',
    endTime: '',
    location: '',
    organizer: '',
    status: 'Planned',
    maxParticipants: 50,
    resources: [],
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resourceInput, setResourceInput] = useState('');
  const [employees, setEmployees] = useState([]);

  const fetchEvent = useCallback(async () => {
    try {
      setLoading(true);
      const response = await eventService.getEvent(id);
      const event = response.data;
      
      setFormData({
        title: event.title || '',
        description: event.description || '',
        category: event.category || 'Meeting',
        eventDate: event.eventDate ? new Date(event.eventDate).toISOString().split('T')[0] : '',
        startTime: event.startTime || '',
        endTime: event.endTime || '',
        location: event.location || '',
        organizer: event.organizer?._id || '',
        status: event.status || 'Planned',
        maxParticipants: event.maxParticipants || 50,
        resources: event.resources || [],
        notes: event.notes || ''
      });
    } catch (err) {
      setError('Failed to fetch event details');
      console.error('Error fetching event:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchEmployees = useCallback(async () => {
    try {
      // In a real implementation, you would fetch employees from the HR API
      // For now, we'll use a mock list with proper ObjectIds
      setEmployees([
        { _id: '507f1f77bcf86cd799439011', firstName: 'John', lastName: 'Doe', employeeId: 'EMP001' },
        { _id: '507f1f77bcf86cd799439012', firstName: 'Jane', lastName: 'Smith', employeeId: 'EMP002' },
        { _id: '507f1f77bcf86cd799439013', firstName: 'Mike', lastName: 'Johnson', employeeId: 'EMP003' },
        { _id: '507f1f77bcf86cd799439014', firstName: 'Sarah', lastName: 'Wilson', employeeId: 'EMP004' },
        { _id: '507f1f77bcf86cd799439015', firstName: 'David', lastName: 'Brown', employeeId: 'EMP005' }
      ]);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    if (isEdit) {
      fetchEvent();
    }
  }, [isEdit, fetchEvent, fetchEmployees]);

  const handleChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleAddResource = () => {
    if (resourceInput.trim()) {
      setFormData(prev => ({
        ...prev,
        resources: [...prev.resources, resourceInput.trim()]
      }));
      setResourceInput('');
    }
  };

  const handleRemoveResource = (index) => {
    setFormData(prev => ({
      ...prev,
      resources: prev.resources.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      if (isEdit) {
        await eventService.updateEvent(id, formData);
      } else {
        await eventService.createEvent(formData);
      }

      navigate('/admin/events');
    } catch (err) {
      setError(isEdit ? 'Failed to update event' : 'Failed to create event');
      console.error('Error saving event:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    'Meeting',
    'Training',
    'Conference',
    'Workshop',
    'Seminar',
    'Other'
  ];

  const statuses = [
    'Planned',
    'Confirmed',
    'In Progress',
    'Completed',
    'Cancelled'
  ];

  if (loading && isEdit) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading event details...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Event' : 'Create New Event'}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/admin/events')}
        >
          Back to Events
        </Button>
      </Box>

      {error && (
        <Box mb={3}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      {/* Form */}
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Event Title"
                  value={formData.title}
                  onChange={handleChange('title')}
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    onChange={handleChange('category')}
                    label="Category"
                  >
                    {categories.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={handleChange('description')}
                  multiline
                  rows={3}
                />
              </Grid>

              {/* Date and Time */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Date and Time
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Event Date"
                  type="date"
                  value={formData.eventDate}
                  onChange={handleChange('eventDate')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Start Time"
                  type="time"
                  value={formData.startTime}
                  onChange={handleChange('startTime')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="End Time"
                  type="time"
                  value={formData.endTime}
                  onChange={handleChange('endTime')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              {/* Location and Organization */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Location and Organization
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Location"
                  value={formData.location}
                  onChange={handleChange('location')}
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Organizer</InputLabel>
                  <Select
                    value={formData.organizer}
                    onChange={handleChange('organizer')}
                    label="Organizer"
                  >
                    {employees.map((employee) => (
                      <MenuItem key={employee._id} value={employee._id}>
                        {employee.firstName} {employee.lastName} ({employee.employeeId})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Event Details */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Event Details
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={handleChange('status')}
                    label="Status"
                  >
                    {statuses.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Max Participants"
                  type="number"
                  value={formData.maxParticipants}
                  onChange={handleChange('maxParticipants')}
                  inputProps={{ min: 1 }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={formData.notes}
                  onChange={handleChange('notes')}
                  multiline
                  rows={2}
                />
              </Grid>

              {/* Resources */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Required Resources
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <MuiBox display="flex" gap={2} alignItems="center" mb={2}>
                  <TextField
                    label="Add Resource"
                    value={resourceInput}
                    onChange={(e) => setResourceInput(e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddResource();
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleAddResource}
                    disabled={!resourceInput.trim()}
                  >
                    Add
                  </Button>
                </MuiBox>

                <MuiBox display="flex" flexWrap="wrap" gap={1}>
                  {formData.resources.map((resource, index) => (
                    <Chip
                      key={index}
                      label={resource}
                      onDelete={() => handleRemoveResource(index)}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </MuiBox>
              </Grid>

              {/* Submit Button */}
              <Grid item xs={12}>
                <MuiBox display="flex" gap={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/admin/events')}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : (isEdit ? 'Update Event' : 'Create Event')}
                  </Button>
                </MuiBox>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default EventForm;
