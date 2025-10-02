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
  Alert,
  Stack,
  Chip,
  Divider,
  Skeleton
} from '@mui/material';
import {
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  BusinessCenter as DepartmentIcon,
  Assignment as AssignmentIcon,
  Event as EventIcon
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import staffAssignmentService from '../../../services/staffAssignmentService';
import locationService from '../../../services/locationService';
import api from '../../../services/api';

const StaffAssignmentForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);
  const isView = Boolean(id) && !location.pathname.includes('/edit');

  const [formData, setFormData] = useState({
    staffId: '',
    locationId: '',
    departmentId: '',
    assignmentType: 'Driver',
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
  const [departments, setDepartments] = useState([]);

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
      // Fetch all active employees
      const employeeResponse = await staffAssignmentService.getEmployees();
      const allEmployees = employeeResponse.data || [];
      
      // Filter employees to only show those from Administration department
      const adminEmployees = allEmployees.filter(emp => 
        emp.placementDepartment && emp.placementDepartment._id === '68bebffba7f2f0565a67eb50' // Administration department ID
      );
      
      setEmployees(adminEmployees);
      console.log(`📊 Loaded ${adminEmployees.length} employees from Administration department`);

      const locationResponse = await locationService.getLocations({ limit: 1000 });
      
      // Fetch departments directly from API
      const departmentResponse = await api.get('/hr/departments');
      
      setLocations(locationResponse.data || []);
      setDepartments(departmentResponse.data.data || []);
    } catch (err) {
      setError('Failed to fetch employees, locations, and departments');
      console.error('Error fetching data:', err);
    }
  };

  const handleChange = (field) => (event) => {
    const newValue = event.target.value;
    
    setFormData(prev => {
      const updatedData = {
        ...prev,
        [field]: newValue
      };
      
      // Clear irrelevant fields when assignment type changes
      if (field === 'assignmentType') {
        if (['Guard', 'Security', 'Maintenance', 'Driver'].includes(newValue)) {
          // Location-based assignments: clear department
          updatedData.departmentId = '';
        } else if (['Office Boy', 'Office Staff', 'Admin Staff', 'Receptionist'].includes(newValue)) {
          // Department-based assignments: clear location
          updatedData.locationId = '';
        }
      }
      
      return updatedData;
    });
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
      
      // Handle specific error messages
      if (err.response?.data?.message) {
        const errorMessage = err.response.data.message;
        
        if (errorMessage.includes('already has an active assignment')) {
          setError(`${errorMessage}. Please transfer or complete the existing assignment first, or edit the current assignment.`);
        } else {
          setError(errorMessage);
        }
      } else {
        setError(isEdit ? 'Failed to update assignment' : 'Failed to create assignment');
      }
    } finally {
      setLoading(false);
    }
  };

  const assignmentTypes = [
    'Driver',
    'Office Boy', 
    'Guard',
    'Security',
    'Office Staff',
    'Admin Staff',
    'Maintenance',
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
      <Box sx={{ p: 3 }}>
        <Card>
          <CardContent>
            {/* Header Skeleton */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Skeleton variant="text" width="30%" height={36} />
              <Stack direction="row" spacing={2}>
                <Skeleton variant="rectangular" width={120} height={36} borderRadius={1} />
                <Skeleton variant="rectangular" width={140} height={36} borderRadius={1} />
              </Stack>
            </Box>

            {/* Content Skeleton */}
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Skeleton variant="circular" width={24} height={24} />
                  <Box flexGrow={1}>
                    <Skeleton variant="text" height={16} width="25%" />
                    <Skeleton variant="text" height={24} width="50%" sx={{ mt: 1 }} />
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Skeleton variant="circular" width={24} height={24} />
                  <Box flexGrow={1}>
                    <Skeleton variant="text" height={16} width="30%" />
                    <Skeleton variant="rectangular" width={80} height={24} sx={{ mt: 1 }} />
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Skeleton variant="text" height={1} />
              </Grid>

              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Skeleton variant="circular" width={24} height={24} />
                  <Box flexGrow={1}>
                    <Skeleton variant="text" height={16} width="30%" />
                    <Skeleton variant="text" height={24} width="40%" sx={{ mt: 1 }} />
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box flexGrow={1}>
                  <Skeleton variant="text" height={16} width="40%" />
                  <Skeleton variant="rectangular" width={80} height={24} sx={{ mt: 1 }} />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Render view mode
  if (isView) {
    return (
      <Box sx={{ p: 3 }}>
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5">
                Assignment Details
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  onClick={() => navigate('/admin/staff-management')}
                >
                  Back to Dashboard
                </Button>
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={() => navigate(`/admin/staff-management/assignments/${id}/edit`)}
                >
                  Edit Assignment
                </Button>
              </Stack>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {loading ? (
              <Typography>Loading...</Typography>
            ) : (
              <Grid container spacing={3}>
                {/* Staff Member */}
                <Grid item xs={12}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <PersonIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Staff Member
                      </Typography>
                      <Typography variant="h6">
                        {formData.staffId ? employees.find(emp => emp._id === formData.staffId)?.firstName + ' ' + employees.find(emp => emp._id === formData.staffId)?.lastName : 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                {/* Assignment Type */}
                <Grid item xs={12}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <AssignmentIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Assignment Type
                      </Typography>
                      <Chip label={formData.assignmentType} color="primary" />
                    </Box>
                  </Box>
                </Grid>

                {/* Location */}  
                {(formData.assignmentType === 'Guard' || formData.assignmentType === 'Security' || formData.assignmentType === 'Maintenance' || formData.assignmentType === 'Driver') && (
                  <Grid item xs={12}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <LocationIcon color="primary" />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Assigned Location
                        </Typography>
                        <Typography variant="h6">
                          {formData.locationId ? locations.find(loc => loc._id === formData.locationId)?.name : 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                )}

                {/* Department */}
                {(formData.assignmentType === 'Office Staff' || formData.assignmentType === 'Office Boy' || formData.assignmentType === 'Admin Staff' || formData.assignmentType === 'Receptionist') && (
                  <Grid item xs={12}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <DepartmentIcon color="primary" />
                      <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Assigned Department
                      </Typography>
                        <Typography variant="h6">
                          {formData.departmentId ? departments.find(dept => dept._id === formData.departmentId)?.name : 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                )}

                <Divider sx={{ width: '100%', my: 2 }} />

                {/* Assignment Details */}
                <Grid item xs={12} md={6}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <EventIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Start Date
                      </Typography>
                      <Typography variant="h6">
                        {formData.startDate ? new Date(formData.startDate).toLocaleDateString() : 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                {formData.endDate && (
                  <Grid item xs={12} md={6}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <EventIcon color="primary" />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          End Date
                        </Typography>
                        <Typography variant="h6">
                          {new Date(formData.endDate).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                )}

                {/* Status */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Assignment Status
                  </Typography>
                  <Chip 
                    label={formData.status} 
                    color={formData.status === 'Active' ? 'success' : formData.status === 'Completed' ? 'default' : 'warning'} 
                  />
                </Grid>

                {/* Notes */}
                {formData.notes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Notes
                    </Typography>
                    <Typography variant="body1">
                      {formData.notes}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            )}
          </CardContent>
        </Card>
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

              {/* Show Location for Guard, Security, Maintenance, Driver */}
              {['Guard', 'Security', 'Maintenance', 'Driver'].includes(formData.assignmentType) && (
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
              )}

              {/* Show Department for AssignmentType, Office Staff, Admin Staff, Receptionist */}
              {['Office Boy', 'Office Staff', 'Admin Staff', 'Receptionist'].includes(formData.assignmentType) && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Department</InputLabel>
                    <Select
                      value={formData.departmentId}
                      onChange={handleChange('departmentId')}
                      label="Department"
                    >
                      {departments.map((department) => (
                        <MenuItem key={department._id} value={department._id}>
                          {department.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

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
