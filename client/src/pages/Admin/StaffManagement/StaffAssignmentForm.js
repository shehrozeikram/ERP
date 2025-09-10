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
  MenuItem
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import staffAssignmentService from '../../../services/staffAssignmentService';
import locationService from '../../../services/locationService';

const StaffAssignmentForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    staffId: '',
    locationId: '',
    departmentId: '',
    assignmentType: 'Office Staff',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    status: 'Active',
    shiftTimings: {
      startTime: '',
      endTime: '',
      workingDays: []
    },
    responsibilities: [],
    reportingManager: '',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);

  const fetchAssignment = useCallback(async () => {
    try {
      setLoading(true);
      const response = await staffAssignmentService.getStaffAssignment(id);
      const assignment = response.data;
      
      setFormData({
        staffId: assignment.staffId?._id || '',
        locationId: assignment.locationId?._id || '',
        departmentId: assignment.departmentId?._id || '',
        assignmentType: assignment.assignmentType || 'Office Staff',
        startDate: assignment.startDate ? new Date(assignment.startDate).toISOString().split('T')[0] : '',
        endDate: assignment.endDate ? new Date(assignment.endDate).toISOString().split('T')[0] : '',
        status: assignment.status || 'Active',
        shiftTimings: assignment.shiftTimings || {
          startTime: '',
          endTime: '',
          workingDays: []
        },
        responsibilities: assignment.responsibilities || [],
        reportingManager: assignment.reportingManager?._id || '',
        notes: assignment.notes || ''
      });
    } catch (err) {
      setError('Failed to fetch assignment details');
      console.error('Error fetching assignment:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEmployeesAndLocations();
    if (isEdit) {
      fetchAssignment();
    }
  }, [isEdit, id, fetchAssignment]);

  const fetchEmployeesAndLocations = async () => {
    try {
      // In a real implementation, you would fetch employees from the HR API
      // For now, we'll use a mock list
      setEmployees([
        { _id: '507f1f77bcf86cd799439011', firstName: 'John', lastName: 'Doe', employeeId: 'EMP001' },
        { _id: '507f1f77bcf86cd799439012', firstName: 'Jane', lastName: 'Smith', employeeId: 'EMP002' },
        { _id: '507f1f77bcf86cd799439013', firstName: 'Mike', lastName: 'Johnson', employeeId: 'EMP003' },
        { _id: '507f1f77bcf86cd799439014', firstName: 'Sarah', lastName: 'Wilson', employeeId: 'EMP004' },
        { _id: '507f1f77bcf86cd799439015', firstName: 'David', lastName: 'Brown', employeeId: 'EMP005' }
      ]);

      const response = await locationService.getLocations({ limit: 1000 });
      setLocations(response.data || []);
    } catch (err) {
      setError('Failed to fetch employees and locations');
      console.error('Error fetching data:', err);
    }
  };

  const handleChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      if (isEdit) {
        await staffAssignmentService.updateStaffAssignment(id, formData);
      } else {
        await staffAssignmentService.createStaffAssignment(formData);
      }

      navigate('/admin/staff-management');
    } catch (err) {
      setError(isEdit ? 'Failed to update assignment' : 'Failed to create assignment');
      console.error('Error saving assignment:', err);
    } finally {
      setLoading(false);
    }
  };

  const assignmentTypes = [
    'Guard',
    'Office Staff',
    'Maintenance',
    'Security',
    'Receptionist',
    'Other'
  ];

  const statuses = [
    'Active',
    'Completed',
    'Transferred',
    'Suspended'
  ];

  if (loading && isEdit) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading assignment details...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Staff Assignment' : 'Create New Staff Assignment'}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/admin/staff-management')}
        >
          Back to Staff Management
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
                  Assignment Details
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Staff Member</InputLabel>
                  <Select
                    value={formData.staffId}
                    onChange={handleChange('staffId')}
                    label="Staff Member"
                  >
                    {employees.map((employee) => (
                      <MenuItem key={employee._id} value={employee._id}>
                        {employee.firstName} {employee.lastName} ({employee.employeeId})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Location</InputLabel>
                  <Select
                    value={formData.locationId}
                    onChange={handleChange('locationId')}
                    label="Location"
                  >
                    {locations.map((location) => (
                      <MenuItem key={location._id} value={location._id}>
                        {location.name} ({location.type}) - {location.address}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Assignment Type</InputLabel>
                  <Select
                    value={formData.assignmentType}
                    onChange={handleChange('assignmentType')}
                    label="Assignment Type"
                  >
                    {assignmentTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
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

              {/* Date Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Date Information
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={formData.startDate}
                  onChange={handleChange('startDate')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="End Date (Optional)"
                  type="date"
                  value={formData.endDate}
                  onChange={handleChange('endDate')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Additional Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Additional Information
                </Typography>
              </Grid>

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

              {/* Submit Button */}
              <Grid item xs={12}>
                <Box display="flex" gap={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/admin/staff-management')}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : (isEdit ? 'Update Assignment' : 'Create Assignment')}
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

export default StaffAssignmentForm;
